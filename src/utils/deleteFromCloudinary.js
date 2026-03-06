import { v2 as cloudinary } from 'cloudinary';

export const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    // extract public_id from URL
    const parts = imageUrl.split('/');
    const fileName = parts[parts.length - 1]; // user123.jpg
    const folder = parts[parts.length - 2]; // avatars
    const publicId = `${folder}/${fileName.split('.')[0]}`;

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
};
