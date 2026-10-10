import mongoose, { Schema } from 'mongoose';

// One document per (video, viewer, UTC day) — used to cap repeated views.
const videoViewSchema = new Schema(
  {
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
    },
    viewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    day: {
      type: String, // YYYY-MM-DD (UTC)
      required: true,
    },
    count: {
      type: Number,
      default: 0,
    },
    lastViewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

videoViewSchema.index({ video: 1, viewer: 1, day: 1 }, { unique: true });
// Old daily records are only needed for the current day; drop them after 2 days.
videoViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 24 * 60 * 60 });

export const VideoView = mongoose.model('VideoView', videoViewSchema);
