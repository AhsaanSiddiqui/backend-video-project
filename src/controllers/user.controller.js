import { asyncHandler } from '../utils/asynHandler.js';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';

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
  console.log('Req Body: ', req.body);

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

  console.log('Req Files: ', req.files);

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
  if (!username && !email) {
    throw new ApiError(400, 'Username or Password is required');
  }
  // if (!(username || email)) {
  //   throw new ApiError(400, 'Username or Password is required');
  // }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

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
      $set: {
        refreshToken: undefined,
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
    .json(new ApiResponse(200, {}, 'User logged out'));
});

const refreshAccessToken = asyncHandler(async (res, req) => {
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

    options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new ApiResponse(200, 'Access Token refreshed', {
          accessToken,
          refreshToken: newRefreshToken,
        }),
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid Refresh Token');
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
