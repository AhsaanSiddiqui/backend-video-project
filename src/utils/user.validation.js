import ApiError from '../utils/ApiError.js';

export const validateRegisterUser = ({
  fullName,
  username,
  email,
  password,
}) => {
  // 1️⃣ Empty check
  if ([fullName, username, email, password].some((f) => f?.trim() === '')) {
    throw new ApiError(400, 'All fields are required');
  }

  // 2️⃣ Normalize
  username = username.trim().toLowerCase();
  email = email.trim().toLowerCase();

  // 3️⃣ Email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Invalid email format');
  }

  // 4️⃣ Username
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new ApiError(400, 'Invalid username');
  }

  // 5️⃣ Password
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  return {
    fullName: fullName.trim(),
    username,
    email,
  };
};
