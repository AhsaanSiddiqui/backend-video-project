import mongoose, { Schema } from 'mongoose';

const likeSchema = new Schema(
  {
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
    },
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    tweet: {
      type: Schema.Types.ObjectId,
      ref: 'Tweet',
    },
    // Only videos can be disliked. Older documents have no type and count as likes.
    type: {
      type: String,
      enum: ['like', 'dislike'],
      default: 'like',
    },
  },
  { timestamps: true },
);

export const Like = mongoose.model('Like', likeSchema);
