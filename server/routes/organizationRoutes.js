import express from 'express';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import checkAiQuota from '../middleware/checkAiQuota.js'; // Phase 18
import {
  ratingSchema,
  favoriteSchema,
  tagsSchema,
  reviewSchema,
  noteSchema,
} from '../validators/organizationSchemas.js';
import {
  setRating,
  setFavorite,
  setTags,
  saveReview,
  getReview,
  deleteReview,
  saveNote,
  getNote,
} from '../controllers/organizationController.js';
import { getSimilarBooks } from '../controllers/aiController.js'; // Phase 18

const router = express.Router();

// Phase 05: book-scoped rating/favorite/tags/review/notes — mounted under
// /api (like readingRoutes.js) so bookRoutes.js stays focused on plain CRUD.

/**
 * @swagger
 * /books/{id}/rating:
 *   put:
 *     summary: Set or clear a book's star rating
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties: { rating: { type: number, nullable: true, minimum: 0, maximum: 5 } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { _id: { type: string }, rating: { type: number, nullable: true } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.put('/books/:id/rating', protect, validate(ratingSchema), setRating);

/**
 * @swagger
 * /books/{id}/favorite:
 *   patch:
 *     summary: Toggle (or explicitly set) a book's favorite flag
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { isFavorite: { type: boolean, description: Omit to toggle the current value } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { _id: { type: string }, isFavorite: { type: boolean } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/books/:id/favorite', protect, validate(favoriteSchema), setFavorite);

/**
 * @swagger
 * /books/{id}/tags:
 *   patch:
 *     summary: Replace a book's tag list
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tags]
 *             properties: { tags: { type: array, items: { type: string } } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { _id: { type: string }, tags: { type: array, items: { type: string } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/books/:id/tags', protect, validate(tagsSchema), setTags);

/**
 * @swagger
 * /books/{id}/review:
 *   post:
 *     summary: Write or update the review for a book (upsert)
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties: { text: { type: string, maxLength: 4000 } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Review' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   get:
 *     summary: Get the current user's review for a book
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Review' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: No review yet for this book }
 *   delete:
 *     summary: Delete the current user's review for a book
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Review removed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router
  .route('/books/:id/review')
  .post(protect, validate(reviewSchema), saveReview)
  .get(protect, getReview)
  .delete(protect, deleteReview);

/**
 * @swagger
 * /books/{id}/notes:
 *   post:
 *     summary: Write or update private notes for a book (upsert)
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties: { text: { type: string, maxLength: 4000 } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Note' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   get:
 *     summary: Get the current user's private notes for a book
 *     tags: [Organization]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Note' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: No notes yet for this book }
 */
router
  .route('/books/:id/notes')
  .post(protect, validate(noteSchema), saveNote)
  .get(protect, getNote);

/**
 * @swagger
 * /books/{id}/similar:
 *   get:
 *     summary: Books from your own library similar to this one (Gemini embeddings, cosine similarity)
 *     description: >
 *       Embeddings are computed lazily and cached on the Book doc — the first call for a given
 *       book (or a library with un-indexed books) is slower than subsequent ones.
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 book: { type: object, properties: { _id: { type: string }, title: { type: string }, author: { type: string } } }
 *                 similar:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       title: { type: string }
 *                       author: { type: string }
 *                       genre: { type: string }
 *                       coverUrl: { type: string }
 *                       rating: { type: number, nullable: true }
 *                       score: { type: number }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       503: { description: AI not configured, or Gemini call failed }
 */
router.get('/books/:id/similar', protect, checkAiQuota, getSimilarBooks);

export default router;
