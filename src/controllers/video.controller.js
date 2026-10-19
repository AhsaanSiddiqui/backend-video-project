import mongoose, { isValidObjectId } from 'mongoose';
import { User } from '../models/user.model.js';
import { Video } from '../models/video.model.js';
import { Like } from '../models/like.model.js';
import { Subscription } from '../models/subscription.model.js';
import { VideoView } from '../models/videoView.model.js';
import {
  MAX_VIEWS_PER_USER_PER_DAY,
  VIEW_COOLDOWN_MS,
} from '../constants.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import uploadOnCloudinary from '../utils/cloudinary.js';

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId, published } = req.query;
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  const filter = {};

  if (query) {
    filter.title = { $regex: query, $options: 'i' };
  }

  const isOwnerChannel =
    userId &&
    isValidObjectId(userId) &&
    req.user?._id?.toString() === userId.toString();

  if (userId && isValidObjectId(userId)) {
    filter.owner = new mongoose.Types.ObjectId(userId);
  }

  if (isOwnerChannel) {
    if (published === 'true') filter.isPublished = true;
    else if (published === 'false') filter.isPublished = false;
  } else {
    filter.isPublished = true;
  }

  const sortField = sortBy || 'createdAt';
  const sortOptions = {
    [sortField]: sortType === 'asc' ? 1 : -1,
  };

  const videos = await Video.find(filter)
    .populate('owner', 'username fullName avatar')
    .sort(sortOptions)
    .skip((pageNumber - 1) * limitNumber)
    .limit(limitNumber);

  const totalVideos = await Video.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(200, 'Videos fetched successfully', {
      videos,
      pagination: {
        totalVideos,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalVideos / limitNumber) || 1,
      },
    }),
  );
});

const publishAVideo = asyncHandler(async (req, res) => {
  // 1. The function should do these things:
  // 2. Validate title & description
  // 3. Get video file path
  // 4. Get thumbnail path
  // 5. Upload both to Cloudinary
  // 6. Save video in MongoDB
  // 7. Return response

  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video
  // validate required fields
  if (!title?.trim() || !description?.trim()) {
    throw new ApiError(400, 'Title and Description are required');
  }
  // get files from multer
  const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, 'Video file is required');
  }
  if (!thumbnailLocalPath) {
    throw new ApiError(400, 'Thumbnail file is required');
  }
  // upload video to cloudinary
  const videoUpload = await uploadOnCloudinary(videoFileLocalPath, 'video');
  if (!videoUpload) {
    throw new ApiError(500, 'Video upload failed');
  }
  // upload thumbnail to cloudinary
  const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath, 'image');
  if (!thumbnailUpload) {
    throw new ApiError(500, 'Thumbnail upload failed');
  }
  // create video document in MongoDB
  const newVideo = await Video.create({
    title,
    description,
    videoFile: videoUpload.secure_url,
    thumbnail: thumbnailUpload.secure_url,
    duration: videoUpload.duration || '0:00',
    owner: req.user._id,
    isPublished: true,
  });

  const populatedVideo = await Video.findById(newVideo._id).populate(
    'owner',
    'username fullName avatar',
  );

  return res
    .status(201)
    .json(new ApiResponse(201, 'Video published successfully', populatedVideo));
});

// Returns true if this view should add to the video's view count.
// A user (owner included) counts at most MAX_VIEWS_PER_USER_PER_DAY times per
// UTC day, and views within VIEW_COOLDOWN_MS of the last counted one are ignored.
const recordView = async (videoId, viewerId) => {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);

  // Existing record for today: count it only if under the cap and past the cooldown
  const updated = await VideoView.findOneAndUpdate(
    {
      video: videoId,
      viewer: viewerId,
      day,
      count: { $lt: MAX_VIEWS_PER_USER_PER_DAY },
      lastViewedAt: { $lte: new Date(now.getTime() - VIEW_COOLDOWN_MS) },
    },
    { $inc: { count: 1 }, $set: { lastViewedAt: now } },
  );
  if (updated) return true;

  // First view today. If the record already exists (capped or in cooldown),
  // the unique index rejects this and the view is not counted.
  try {
    await VideoView.create({
      video: videoId,
      viewer: viewerId,
      day,
      count: 1,
      lastViewedAt: now,
    });
    return true;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
};

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  // 1 Validate videoId
  // 2 Find video in DB
  // 3 Populate owner info
  // 4 Increase views count
  // 5 Return video response

  // 1. Validate videoId
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  // 2. Find video in DB and 3. Populate owner info
  const video = await Video.findById(videoId).populate(
    'owner',
    'username fullName avatar',
  );
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  // 4. Increase views count (capped per user per day, with a cooldown)
  const viewCounted = await recordView(video._id, req.user._id);
  if (viewCounted) {
    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
  }

  // Most recent watch stays at the front, without duplicate entries.
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { watchHistory: video._id },
  });
  await User.findByIdAndUpdate(req.user._id, {
    $push: { watchHistory: { $each: [video._id], $position: 0 } },
  });

  // 5. Attach like + subscription info for the watch page
  const ownerId = video.owner?._id;
  const [likesCount, dislikesCount, myReaction, subscribersCount, isSubscribed] =
    await Promise.all([
      Like.countDocuments({ video: videoId, type: { $ne: 'dislike' } }),
      Like.countDocuments({ video: videoId, type: 'dislike' }),
      Like.findOne({ video: videoId, likedBy: req.user._id }).select('type'),
      ownerId ? Subscription.countDocuments({ channel: ownerId }) : 0,
      ownerId
        ? Subscription.exists({ channel: ownerId, subscriber: req.user._id })
        : null,
    ]);

  // 6. Return video response
  return res.status(200).json(
    new ApiResponse(200, 'Video fetched successfully', {
      ...video.toObject(),
      views: video.views + (viewCounted ? 1 : 0),
      likesCount,
      dislikesCount,
      isLiked: Boolean(myReaction) && myReaction.type !== 'dislike',
      isDisliked: myReaction?.type === 'dislike',
      subscribersCount,
      isSubscribed: Boolean(isSubscribed),
    }),
  );
});

const updateVideo = asyncHandler(async (req, res) => {
  // 1. validation
  // 2. optional updates (title, description)
  // 3. thumbnail replacement
  // 4. Cloudinary upload
  // 5. ownership check
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  const { title, description } = req.body || {};
  // 1. Validate videoId
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }
  // 2. Find video in DB
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }
  // 3. Ownership check
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to update this video');
  }
  // 4. Optional updates (title, description)
  if (title) video.title = title;
  if (description) video.description = description;

  // 5. Thumbnail replacement
  if (req.file) {
    const thumbnailLocalPath = req.file?.path;
    // upload thumbnail to cloudinary
    const thumbnailUpload = await uploadOnCloudinary(
      thumbnailLocalPath,
      'image',
    );
    if (!thumbnailUpload) {
      throw new ApiError(500, 'Thumbnail upload failed');
    }
    video.thumbnail = thumbnailUpload.secure_url;
  }
  // 6. save updated video
  await video.save();

  // 7. return response
  return res
    .status(200)
    .json(new ApiResponse(200, 'Video updated successfully', video));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  // 1. Validate videoId
  // 2. Find video in DB
  // 3. Ownership check
  // 4. Delete video document

  // 1. Validate videoId
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }
  // 2. Find video in DB
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }
  // 3. Ownership check
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to delete this video');
  }
  // 4. Delete video document
  await Video.findByIdAndDelete(videoId);

  // 5. return response
  return res
    .status(200)
    .json(new ApiResponse(200, 'Video deleted successfully', {}));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: toggle publish status
  // 1. Validate videoId
  // 2. Find video in DB
  // 3. Ownership check
  // 4. Toggle publish status
  // 5. Return response

  // 1. Validate videoId
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }
  // 2. Find video in DB
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }
  // 3. Ownership check
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not allowed to update this video');
  }
  // 4. Toggle publish status
  // video.isPublished = !video.isPublished;
  // await video.save();
  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: { isPublished: !video.isPublished } },
    { new: true },
  );

  // 5. Return response
  return res.status(200).json(
    new ApiResponse(
      200,
      `Video is now ${updatedVideo.isPublished ? 'Published' : 'Unpublished'}`,
      updatedVideo,
    ),
  );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
