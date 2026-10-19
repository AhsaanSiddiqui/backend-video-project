import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { Video } from '../models/video.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    // console.log('Access Token: ', accessToken);
    // console.log('Refresh Token: ', refreshToken);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating access and refresh tokens',
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // res.status(200).json({
  //   message: 'Chai or Code',
  // });
  // user register logic building steps
  // 1. get user details from frontend
  // 2. validation - check fields is not empty
  // 3. check if user already exists: check by username, email
  // 4. check for images, check for avatar because this field is required
  // 5. upload them to cloudinary, after that check again avatar
  // 6. create user object - create entry in db
  // 7. remove password and refresh token field from response
  // 8. check for user creation
  // 9. return response

  // step 1
  const { fullName, username, email, password } = req.body;
  // console.log('Req Body: ', req.body);

  // step 2
  // mene ek middleware bnaya hai validation k liye or usy mene route me call krlia hai

  // step 3
  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existingUser) {
    throw new ApiError(400, 'User already exists');
  }

  // step 4
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar is required');
  }

  // console.log('Req Files: ', req.files);

  // step 5
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, 'Avatar upload failed');
  }

  // step 6
  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
  });

  // step 7
  const userCreated = await User.findById(user._id).select(
    '-password -refreshToken',
  );

  // step 8
  if (!userCreated) {
    throw new ApiError(500, 'User creation failed');
  }

  // step 9
  return res
    .status(201)
    .json(new ApiResponse(200, 'User created successfully', userCreated));

  // if (fullName === '') {
  //   throw new ApiError(400, 'Full Name is required');
  // }
});

const loginUser = asyncHandler(async (req, res) => {
  // 1. req.body se data le kr ana
  // 2. check krna prega username or email hai ya nhi
  // 3. user ko find krna
  // 4. agr user hai to password check krwao
  // 5. password agr check hogya hai to phr access and refresh Token dono generate krne hnge or dono user ko send krenge.
  // 6. token generate krne k bd in tokens ko cookie k through bhejdo, secure cookie
  const { email, username, password } = req.body;
  if (!username?.trim() && !email?.trim()) {
    throw new ApiError(400, 'Username or email is required');
  }

  const orConditions = [];
  if (email?.trim()) {
    orConditions.push({ email: email.trim().toLowerCase() });
  }
  if (username?.trim()) {
    orConditions.push({ username: username.trim().toLowerCase() });
  }

  const user = await User.findOne({ $or: orConditions });

  if (!user) {
    throw new ApiError(400, 'User not found');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid Password');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken',
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('refreshToken', refreshToken, options)
    .cookie('accessToken', accessToken, options)
    .json(
      new ApiResponse(200, 'User logged in successfully', {
        user: loggedInUser,
        accessToken,
        refreshToken,
      }),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    },
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, 'User logged out', {}));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(400, 'Refresh Token is required');
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, 'Invalid Refresh Token');
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, 'Refresh token is expired or used');
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id,
    );

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', refreshToken, options)
      .json(
        new ApiResponse(200, 'Access Token refreshed', {
          accessToken,
          refreshToken: refreshToken,
        }),
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid Refresh Token');
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!(newPassword === confirmPassword)) {
    throw new ApiError(400, 'New Password and Confirm Password do not match');
  }

  const user = await User.findById(req.user._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, 'Invalid Password');
  }
  user.password = newPassword;
  await user.save({
    validateBeforeSave: false,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, 'Password changed successfully'));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, 'User fetched successfully', req.user));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName?.trim() || !email?.trim()) {
    throw new ApiError(400, 'Full Name and Email are required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailTaken = await User.findOne({
    email: normalizedEmail,
    _id: { $ne: req.user._id },
  }).select('_id');
  if (emailTaken) {
    throw new ApiError(409, 'Email is already in use');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName: fullName.trim(),
        email: normalizedEmail,
      },
    },
    {
      new: true,
    },
  ).select('-password -refreshToken');

  return res
    .status(200)
    .json(new ApiResponse(200, 'User updated successfully', user));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar file is missing');
  }

  // delete old image
  const existingUser = await User.findById(req.user._id);

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, 'Error while uploading avatar');
  }

  // delete old avatar
  if (existingUser.avatar) {
    await deleteFromCloudinary(existingUser.avatar);
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    },
  ).select('-password -refreshToken');
  return res
    .status(200)
    .json(new ApiResponse(200, 'Avatar updated successfully', user));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, 'Cover image file is missing');
  }

  // delete old cover image
  const existingUser = await User.findById(req.user._id);

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, 'Error while uploading cover image');
  }

  if (existingUser.coverImage) {
    await deleteFromCloudinary(existingUser.coverImage);
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    },
  ).select('-password -refreshToken');
  return res
    .status(200)
    .json(new ApiResponse(200, 'Cover image updated successfully', user));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, 'Username is missing');
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscribers',
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subscribedTo',
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: '$subscribers',
        },
        channelsSubscribedToCount: {
          $size: '$subscribedTo',
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, '$subscribers.subscriber'],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, 'Channel not found');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], 'Channel profile fetched successfully'),
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('watchHistory');
  const ids = user?.watchHistory ?? [];

  const videos = await Video.find({ _id: { $in: ids } }).populate(
    'owner',
    'username fullName avatar',
  );
  const byId = new Map(videos.map((video) => [video._id.toString(), video]));
  const ordered = ids.map((id) => byId.get(id.toString())).filter(Boolean);

  return res
    .status(200)
    .json(new ApiResponse(200, 'Watch history fetched successfully', ordered));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ApiError(400, 'Email is required');
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(400, 'User not found');
  }

  const resetToken = user.generateResetPasswordToken({
    _id: user._id,
  });
  await user.save({ validateBeforeSave: false });
  const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
  return res.status(200).json(
    new ApiResponse(200, 'Reset password token generated successfully', {
      resetLink: resetUrl,
    }),
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword, confirmPassword } = req.body;

  if (!token || !newPassword || !confirmPassword) {
    throw new ApiError(400, 'All fields are required');
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, 'Passwords do not match');
  }

  // 🔥 hash incoming token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }, // 🔥 expiry check
  });

  if (!user) {
    throw new ApiError(400, 'Token is invalid or expired');
  }

  // 🔥 update password
  user.password = newPassword;

  // clear reset fields
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, 'Password reset successfully'));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
  forgotPassword,
  resetPassword,
};
