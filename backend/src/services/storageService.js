import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

// Configure once on first import
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads a local file to Cloudinary and returns the secure URL.
 * Deletes the local file after a successful upload.
 * @param {string} localPath - Path to the local file
 * @param {string} folder - Cloudinary folder ('covers' or 'logos')
 * @returns {Promise<string>} Secure CDN URL
 */
export async function uploadLocalFileToStorage(localPath, _originalName, _mimeType, folder = 'uploads') {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  }

  const result = await cloudinary.uploader.upload(localPath, {
    folder: `included/${folder}`,
    resource_type: 'image',
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });

  try { fs.unlinkSync(localPath); } catch (_) { /* already cleaned up */ }

  console.log(`☁️  Uploaded to Cloudinary: ${result.secure_url}`);
  return result.secure_url;
}

/**
 * Uploads a buffer to Cloudinary and returns the secure URL.
 * @param {Buffer} fileBuffer
 * @param {string} originalName
 * @param {string} mimeType
 * @param {string} folder
 * @returns {Promise<string>} Secure CDN URL
 */
export async function uploadToStorage(fileBuffer, _originalName, _mimeType, folder = 'uploads') {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `included/${folder}`,
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        console.log(`☁️  Uploaded to Cloudinary: ${result.secure_url}`);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
}
