import express from 'express';
import protect from '../middleware/authMiddleware.js';
import requireCloudinary from '../middleware/requireCloudinary.js';
import { avatarUpload, bookCoverUpload, diaryImageUpload } from '../config/uploaders.js';
import { uploadImage } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/avatar', protect, requireCloudinary, avatarUpload.single('image'), uploadImage);
router.post(
  '/book-cover',
  protect,
  requireCloudinary,
  bookCoverUpload.single('image'),
  uploadImage
);
router.post(
  '/diary-image',
  protect,
  requireCloudinary,
  diaryImageUpload.single('image'),
  uploadImage
);

export default router;
