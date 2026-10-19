import mongoose, { isValidObjectId } from 'mongoose';
import { Tweet } from '../models/tweet.model.js';
import { Like } from '../models/like.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content || content.trim() === '') {
    throw new ApiError(400, 'Tweet content is required');
  }

  const tweet = await Tweet.create({
    content: content.trim(),
    owner: req.user._id,
  });

  const populatedTweet = await Tweet.findById(tweet._id).populate(
    'owner',
    'username fullName avatar',
  );

  return res
    .status(201)
    .json(new ApiResponse(201, 'Tweet created successfully', populatedTweet));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  const tweets = await Tweet.find({ owner: userId })
    .populate('owner', 'username fullName avatar')
    .sort({ createdAt: -1 })
    .lean();

  const ids = tweets.map((tweet) => tweet._id);
  const likeStats = ids.length
    ? await Like.aggregate([
        { $match: { tweet: { $in: ids } } },
        {
          $group: {
            _id: '$tweet',
            likes: { $sum: 1 },
            likedByMe: {
              $max: {
                $cond: [
                  { $eq: ['$likedBy', new mongoose.Types.ObjectId(req.user._id)] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
    : [];
  const likesByTweet = new Map(likeStats.map((row) => [row._id.toString(), row]));
  const data = tweets.map((tweet) => {
    const stats = likesByTweet.get(tweet._id.toString());
    return {
      ...tweet,
      likes: stats?.likes ?? 0,
      isLiked: Boolean(stats?.likedByMe),
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, 'User tweets fetched successfully', data));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, 'Invalid tweet ID');
  }

  if (!content || content.trim() === '') {
    throw new ApiError(400, 'Content is required');
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, 'Tweet not found');
  }

  // ownership check
  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Unauthorized to update this tweet');
  }

  tweet.content = content.trim();
  await tweet.save();

  const updated = await Tweet.findById(tweet._id).populate(
    'owner',
    'username fullName avatar',
  );

  return res
    .status(200)
    .json(new ApiResponse(200, 'Tweet updated successfully', updated));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, 'Invalid tweet ID');
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, 'Tweet not found');
  }

  // 🔐 ownership check
  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Unauthorized to delete this tweet');
  }

  await Tweet.findByIdAndDelete(tweetId);

  return res
    .status(200)
    .json(new ApiResponse(200, 'Tweet deleted successfully', {}));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
