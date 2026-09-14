import express from 'express';
import protect from '../middleware/authMiddleware.js';
import requireCloudinary from '../middleware/requireCloudinary.js';
import { avatarUpload, bookCoverUpload, diaryImageUpload } from '../config/uploaders.js';
import { uploadImage } from '../controllers/uploadController.js';

const router = express.Router();

/**
 * @swagger
 * /upload/avatar:
 *   post:
 *     summary: Upload a profile avatar image
 *     tags: [Uploads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties: { image: { type: string, format: binary } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { url: { type: string, description: The Cloudinary URL to save on the User/Book/DiaryEntry } }
 *       400: { description: Missing/invalid file, or not an image }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       503: { description: Cloudinary not configured }
 */
router.post('/avatar', protect, requireCloudinary, avatarUpload.single('image'), uploadImage);

/**
 * @swagger
 * /upload/book-cover:
 *   post:
 *     summary: Upload a book cover image
 *     tags: [Uploads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties: { image: { type: string, format: binary } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { url: { type: string } }
 *       400: { description: Missing/invalid file, or not an image }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       503: { description: Cloudinary not configured }
 */
router.post(
  '/book-cover',
  protect,
  requireCloudinary,
  bookCoverUpload.single('image'),
  uploadImage
);

/**
 * @swagger
 * /upload/diary-image:
 *   post:
 *     summary: Upload an image to attach to a diary entry
 *     tags: [Uploads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties: { image: { type: string, format: binary } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { url: { type: string } }
 *       400: { description: Missing/invalid file, or not an image }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       503: { description: Cloudinary not configured }
 */
router.post(
  '/diary-image',
  protect,
  requireCloudinary,
  diaryImageUpload.single('image'),
  uploadImage
);

export default router;
