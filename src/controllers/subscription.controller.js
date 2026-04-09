import mongoose, { isValidObjectId } from 'mongoose';
import { User } from '../models/user.model.js';
import { Subscription } from '../models/subscription.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user._id;
  // TODO: toggle subscription
  // 1. Validate channelId
  // 2. Check if channelId is valid and is not same as userId
  // 3. Check if subscription already exists
  // 4. If exists, delete the subscription and return response
  // 5. If not exists, create a new subscription and return response

  // 1. Validate channelId
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, 'Invalid channel ID');
  }

  // 2. prevent self subscription
  if (channelId === userId.toString()) {
    throw new ApiError(400, 'You cannot subscribe to yourself');
  }

  // 3. Check if subscription already exists
  const existingSubscription = await Subscription.findOne({
    subscriber: userId,
    channel: channelId,
  });

  // 4. If exists, unsubscribe
  if (existingSubscription) {
    await Subscription.findByIdAndDelete(existingSubscription._id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, 'Unsubscribed successfully'));
  }

  // 5. If not exists, subscribe
  await Subscription.create({
    subscriber: userId,
    channel: channelId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Subscribed successfully'));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  // 1. Validate channelId
  if (!mongoose.isValidObjectId(channelId)) {
    throw new ApiError(400, 'Invalid channel ID');
  }

  // 2. Check if the channel exists
  const channel = await User.findById(channelId);
  if (!channel) {
    throw new ApiError(404, 'Channel not found');
  }

  // 3. Find subscribers
  const subscribers = await Subscription.find({ channel: channelId })
    .populate('subscriber', 'username fullName avatar') // return only relevant user info
    .select('subscriber createdAt');

  // 4. Return response
  return res.status(200).json(
    new ApiResponse(
      200,
      subscribers.map((s) => s.subscriber), // send array of subscriber users
      'Subscribers fetched successfully',
    ),
  );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  // Check if subscriberId is a valid MongoDB ObjectId
  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, 'Invalid subscriber ID');
  }

  // Find all subscriptions for this user
  const subscriptions = await Subscription.find({
    subscriber: subscriberId,
  }).populate({
    path: 'channel',
    select: 'username fullName avatar', // include only necessary fields
  });

  // Map channels from the subscriptions
  const subscribedChannels = subscriptions.map((sub) => sub.channel);

  return res.status(200).json(
    new ApiResponse({
      success: true,
      statusCode: 200,
      message: 'Subscribed channels fetched successfully',
      data: subscribedChannels,
    }),
  );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
