import mongoose, { Schema } from 'mongoose';

const playListSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    videos: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Video',
      },
    ],
  },
  { timestamps: true },
);

export const PlayList = mongoose.model('PlayList', playListSchema);
