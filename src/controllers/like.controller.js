import mongoose, { isValidObjectId } from 'mongoose';
import { Like } from '../models/like.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Likes and dislikes on a video are mutually exclusive: choosing the same
// reaction again removes it, choosing the other one switches to it.
const toggleVideoReaction = async (req, res, type) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  const existing = await Like.findOne({
    likedBy: req.user._id,
    video: videoId,
  });

  let reaction = type;
  if (existing && (existing.type || 'like') === type) {
    await Like.findByIdAndDelete(existing._id);
    reaction = null;
  } else if (existing) {
    existing.type = type;
    await existing.save();
  } else {
    await Like.create({ likedBy: req.user._id, video: videoId, type });
  }

  const [likesCount, dislikesCount] = await Promise.all([
    Like.countDocuments({ video: videoId, type: { $ne: 'dislike' } }),
    Like.countDocuments({ video: videoId, type: 'dislike' }),
  ]);

  const message = reaction
    ? `Video ${type === 'like' ? 'liked' : 'disliked'}`
    : `Video ${type === 'like' ? 'unliked' : 'undisliked'}`;

  return res
    .status(200)
    .json(new ApiResponse(200, { reaction, likesCount, dislikesCount }, message));
};

const toggleVideoLike = asyncHandler((req, res) =>
  toggleVideoReaction(req, res, 'like'),
);

const toggleVideoDislike = asyncHandler((req, res) =>
  toggleVideoReaction(req, res, 'dislike'),
);

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, 'Invalid comment ID');
  }

  const existingLike = await Like.findOne({
    likedBy: req.user._id,
    comment: commentId,
  });

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);

    return res.status(200).json(new ApiResponse(200, {}, 'Comment unliked'));
  }

  await Like.create({
    likedBy: req.user._id,
    comment: commentId,
  });

  return res.status(200).json(new ApiResponse(200, {}, 'Comment liked'));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, 'Invalid tweet ID');
  }

  const existingLike = await Like.findOne({
    likedBy: req.user._id,
    tweet: tweetId,
  });

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);

    return res.status(200).json(new ApiResponse(200, {}, 'Tweet unliked'));
  }

  await Like.create({
    likedBy: req.user._id,
    tweet: tweetId,
  });

  return res.status(200).json(new ApiResponse(200, {}, 'Tweet liked'));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const likes = await Like.find({
    likedBy: req.user._id,
    video: { $ne: null },
    type: { $ne: 'dislike' },
  }).populate({
    path: 'video',
    populate: {
      path: 'owner',
      select: 'username fullName avatar',
    },
  });

  const likedVideos = likes.map((like) => like.video);

  return res
    .status(200)
    .json(
      new ApiResponse(200, likedVideos, 'Liked videos fetched successfully'),
    );
});

export {
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
  toggleVideoDislike,
  getLikedVideos,
};
