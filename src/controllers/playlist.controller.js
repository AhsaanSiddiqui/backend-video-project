import { isValidObjectId } from 'mongoose';
import { PlayList } from '../models/playlist.model.js';
import { Video } from '../models/video.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Loads a playlist and makes sure the current user owns it
const findOwnedPlaylist = async (playlistId, userId) => {
  const playlist = await PlayList.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, 'Playlist not found');
  }
  if (playlist.owner?.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only change your own playlists');
  }
  return playlist;
};

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description = '' } = req.body;

  if (!name?.trim()) {
    throw new ApiError(400, 'Playlist name is required');
  }

  const playlist = await PlayList.create({
    name: name.trim(),
    description,
    owner: req.user._id,
    videos: [],
  });

  return res
    .status(201)
    .json(new ApiResponse(201, 'Playlist created successfully', playlist));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  //TODO: get user playlists
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  const playlists = await PlayList.find({ owner: userId })
    .populate({
      path: 'videos',
      select: 'title thumbnail views createdAt owner',
      populate: { path: 'owner', select: 'username fullName avatar' },
    })
    .sort({ updatedAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, 'User playlists fetched', playlists));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, 'Invalid playlist ID');
  }

  const playlist = await PlayList.findById(playlistId)
    .populate({
      path: 'videos',
      populate: { path: 'owner', select: 'username fullName avatar' },
    })
    .populate('owner', 'username fullName avatar');

  if (!playlist) {
    throw new ApiError(404, 'Playlist not found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, 'Playlist fetched successfully', playlist));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid ID');
  }

  const video = await Video.findById(videoId).select('_id');
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  const playlist = await findOwnedPlaylist(playlistId, req.user._id);

  if (!Array.isArray(playlist.videos)) {
    playlist.videos = [];
  }

  const alreadySaved = playlist.videos.some((id) => id?.toString() === videoId);
  if (!alreadySaved) {
    playlist.videos.push(videoId);
    await playlist.save();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, 'Video added to playlist', playlist));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, 'Invalid ID');
  }

  await findOwnedPlaylist(playlistId, req.user._id);

  const playlist = await PlayList.findByIdAndUpdate(
    playlistId,
    {
      $pull: { videos: videoId },
    },
    { new: true },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, 'Video removed from playlist', playlist));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, 'Invalid playlist ID');
  }

  await findOwnedPlaylist(playlistId, req.user._id);
  await PlayList.findByIdAndDelete(playlistId);

  return res
    .status(200)
    .json(new ApiResponse(200, 'Playlist deleted successfully', {}));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, 'Invalid playlist ID');
  }

  await findOwnedPlaylist(playlistId, req.user._id);

  if (name !== undefined && !String(name).trim()) {
    throw new ApiError(400, 'Playlist name is required');
  }

  const playlist = await PlayList.findByIdAndUpdate(
    playlistId,
    {
      $set: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    },
    { new: true },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, 'Playlist updated successfully', playlist));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
