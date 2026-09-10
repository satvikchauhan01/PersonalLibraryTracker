import express from 'express';
import { getBooks, addBook, updateBook, deleteBook } from '../controllers/bookController.js';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { createBookSchema, updateBookSchema } from '../validators/bookSchemas.js';

const router = express.Router();

// All these routes are protected. User must be logged in.
router.route('/').get(protect, getBooks).post(protect, validate(createBookSchema), addBook);

router
  .route('/:id')
  .put(protect, validate(updateBookSchema), updateBook)
  .delete(protect, deleteBook);

export default router;
