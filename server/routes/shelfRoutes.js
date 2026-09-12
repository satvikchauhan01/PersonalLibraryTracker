import express from 'express';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { createShelfSchema, updateShelfSchema } from '../validators/organizationSchemas.js';
import {
  getShelves,
  getShelf,
  createShelf,
  renameShelf,
  deleteShelf,
  addBookToShelf,
  removeBookFromShelf,
} from '../controllers/shelfController.js';

const router = express.Router();

router.route('/').get(protect, getShelves).post(protect, validate(createShelfSchema), createShelf);

router
  .route('/:id')
  .get(protect, getShelf)
  .put(protect, validate(updateShelfSchema), renameShelf)
  .delete(protect, deleteShelf);

router
  .route('/:id/books/:bookId')
  .post(protect, addBookToShelf)
  .delete(protect, removeBookFromShelf);

export default router;
