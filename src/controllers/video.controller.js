import { asyncHandler } from '../utils/asynHandler.js';
import { ApiResponse } from '../utils/ApiResponse';
import User from '../models/user.model';
import Video from '../models/video.model';

// Video upload logic will be handled in video.controller.js, but we need to update the user's watch history when they watch a video. So, we can create a controller function for that here.

const uploadVideo = asyncHandler(async (req, res) => {
  // This function will handle video uploads. It will receive the video file, thumbnail, title, description, duration, and publish status from the request body. It will also get the owner (user ID) from the authenticated user (req.user).
  // After uploading the video, we will save the video details in the database and return a success response.
  const { title, description, duration, isPublished } = req.body;
  console.log('Req Body: ', req.body);
  const videoFile = req.file.path; // Assuming the video file is uploaded using multer and the path is stored in req.file.path
  console.log('req.file.path: ', videoFile);
  const thumbnail = req.body.thumbnail; // Assuming the thumbnail is sent as a URL in the request body
  const owner = req.user._id; // Get the authenticated user's ID from req.user
  console.log('Owner ID: ', owner);
});

export { uploadVideo };
