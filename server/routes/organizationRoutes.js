import express from 'express';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
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

const router = express.Router();

// Phase 05: book-scoped rating/favorite/tags/review/notes — mounted under
// /api (like readingRoutes.js) so bookRoutes.js stays focused on plain CRUD.
router.put('/books/:id/rating', protect, validate(ratingSchema), setRating);
router.patch('/books/:id/favorite', protect, validate(favoriteSchema), setFavorite);
router.patch('/books/:id/tags', protect, validate(tagsSchema), setTags);

router
  .route('/books/:id/review')
  .post(protect, validate(reviewSchema), saveReview)
  .get(protect, getReview)
  .delete(protect, deleteReview);

router
  .route('/books/:id/notes')
  .post(protect, validate(noteSchema), saveNote)
  .get(protect, getNote);

export default router;
