import express from 'express';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { createQuoteSchema, updateQuoteSchema } from '../validators/organizationSchemas.js';
import {
  getQuotes,
  createQuote,
  updateQuote,
  deleteQuote,
} from '../controllers/quoteController.js';

const router = express.Router();

router.route('/').get(protect, getQuotes).post(protect, validate(createQuoteSchema), createQuote);

router
  .route('/:id')
  .put(protect, validate(updateQuoteSchema), updateQuote)
  .delete(protect, deleteQuote);

export default router;
