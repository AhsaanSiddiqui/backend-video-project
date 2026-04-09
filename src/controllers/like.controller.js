import mongoose, { isValidObjectId } from 'mongoose';
import { Like } from '../models/like.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  const existingLike = await Like.findOne({
    likedBy: req.user._id,
    video: videoId,
  });

  if (existingLike) {
    // Unlike
    await Like.findByIdAndDelete(existingLike._id);

    return res.status(200).json(new ApiResponse(200, {}, 'Video unliked'));
  }

  // Like
  await Like.create({
    likedBy: req.user._id,
    video: videoId,
  });

  return res.status(200).json(new ApiResponse(200, {}, 'Video liked'));
});

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

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
