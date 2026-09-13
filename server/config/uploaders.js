import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.js';

// Phase 10: one multer instance per upload type, since each has its own
// size cap and Cloudinary folder. `file.path` on req.file after upload is
// the resulting secure Cloudinary URL — that's all the controller needs.
const makeUploader = (folder, maxSizeBytes) => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `library-tracker/${folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSizeBytes },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed.'));
      }
      cb(null, true);
    },
  });
};

export const avatarUpload = makeUploader('avatars', 2 * 1024 * 1024); // 2MB
export const bookCoverUpload = makeUploader('book-covers', 3 * 1024 * 1024); // 3MB
export const diaryImageUpload = makeUploader('diary-images', 3 * 1024 * 1024); // 3MB
