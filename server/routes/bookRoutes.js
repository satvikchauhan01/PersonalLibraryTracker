import express from 'express';
import {
  getBooks,
  addBook,
  updateBook,
  deleteBook,
  exportBooks,
  importBooks,
} from '../controllers/bookController.js';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import {
  createBookSchema,
  updateBookSchema,
  importBooksSchema,
} from '../validators/bookSchemas.js';

const router = express.Router();

// All these routes are protected. User must be logged in.
router.route('/').get(protect, getBooks).post(protect, validate(createBookSchema), addBook);

// Phase 13: literal paths — must come before the '/:id' param route below,
// or Express would try to match "export"/"import" as a book id.
router.get('/export', protect, exportBooks);
router.post('/import', protect, validate(importBooksSchema), importBooks);

router
  .route('/:id')
  .put(protect, validate(updateBookSchema), updateBook)
  .delete(protect, deleteBook);

export default router;
