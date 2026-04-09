import mongoose, { isValidObjectId } from 'mongoose';
import { Comment } from '../models/comment.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  const skip = (page - 1) * limit;

  const comments = await Comment.find({ video: videoId })
    .populate('owner', 'username fullName avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const totalComments = await Comment.countDocuments({ video: videoId });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        comments,
        totalComments,
        currentPage: Number(page),
        totalPages: Math.ceil(totalComments / limit),
      },
      'Comments fetched successfully',
    ),
  );
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  if (!content || content.trim() === '') {
    throw new ApiError(400, 'Comment content is required');
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user._id,
  });

  const populatedComment = await Comment.findById(comment._id).populate(
    'owner',
    'username fullName avatar',
  );

  return res
    .status(201)
    .json(new ApiResponse(201, populatedComment, 'Comment added successfully'));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!mongoose.isValidObjectId(commentId)) {
    throw new ApiError(400, 'Invalid comment ID');
  }

  if (!content || content.trim() === '') {
    throw new ApiError(400, 'Content is required');
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, 'Comment not found');
  }

  // 🔐 ownership check
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Unauthorized to update this comment');
  }

  comment.content = content;
  await comment.save();

  return res
    .status(200)
    .json(new ApiResponse(200, comment, 'Comment updated successfully'));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!mongoose.isValidObjectId(commentId)) {
    throw new ApiError(400, 'Invalid comment ID');
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, 'Comment not found');
  }

  // 🔐 ownership check
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Unauthorized to delete this comment');
  }

  await Comment.findByIdAndDelete(commentId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Comment deleted successfully'));
});

export { getVideoComments, addComment, updateComment, deleteComment };
