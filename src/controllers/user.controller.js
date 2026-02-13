import { asyncHandler } from '../utils/asynHandler.js';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';

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
  console.log('email: ', email);

  // step 2
  // mene ek middleware bnaya hai validation k liye or usy mene route me call krlia hai

  // step 3
  const existingUser = User.findOne({
    $or: [{ username }, { email }],
  });
  if (existingUser) {
    throw new ApiError(400, 'User already exists');
  }

  // step 4
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar is required');
  }

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

export { registerUser };
