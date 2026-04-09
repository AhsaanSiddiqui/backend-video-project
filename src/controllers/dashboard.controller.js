import mongoose from 'mongoose';
import { Video } from '../models/video.model.js';
import { Subscription } from '../models/subscription.model.js';
import { Like } from '../models/like.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const getChannelStats = asyncHandler(async (req, res) => {
  // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

  const userId = req.user._id;

  // Total videos
  const totalVideos = await Video.countDocuments({ owner: userId });

  // Total views (aggregation)
  const viewsResult = await Video.aggregate([
    {
      $match: { owner: new mongoose.Types.ObjectId(userId) },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: '$views' },
      },
    },
  ]);

  const totalViews = viewsResult[0]?.totalViews || 0;

  // Total subscribers
  const totalSubscribers = await Subscription.countDocuments({
    channel: userId,
  });

  // Total likes on all videos of this user
  const likesResult = await Like.aggregate([
    {
      $lookup: {
        from: 'videos',
        localField: 'video',
        foreignField: '_id',
        as: 'videoData',
      },
    },
    {
      $unwind: '$videoData',
    },
    {
      $match: {
        'videoData.owner': new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: null,
        totalLikes: { $sum: 1 },
      },
    },
  ]);

  const totalLikes = likesResult[0]?.totalLikes || 0;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalVideos,
        totalViews,
        totalSubscribers,
        totalLikes,
      },
      'Channel stats fetched successfully',
    ),
  );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel
  const userId = req.user._id;

  const videos = await Video.find({ owner: userId }).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, videos, 'Channel videos fetched successfully'));
});

export { getChannelStats, getChannelVideos };
