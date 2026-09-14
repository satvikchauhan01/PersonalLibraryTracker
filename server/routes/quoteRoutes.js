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

/**
 * @swagger
 * /quotes:
 *   get:
 *     summary: List quotes, optionally scoped to one book
 *     tags: [Quotes]
 *     parameters:
 *       - in: query
 *         name: book
 *         schema: { type: string }
 *         description: Book id — omit to list every quote across the library
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/Quote' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     summary: Add a quote
 *     tags: [Quotes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [book, text]
 *             properties:
 *               book: { type: string }
 *               text: { type: string, maxLength: 2000 }
 *               page: { type: integer, minimum: 1 }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Quote' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.route('/').get(protect, getQuotes).post(protect, validate(createQuoteSchema), createQuote);

/**
 * @swagger
 * /quotes/{id}:
 *   put:
 *     summary: Update a quote
 *     tags: [Quotes]
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
 *             properties:
 *               text: { type: string, maxLength: 2000 }
 *               page: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Quote' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: Delete a quote
 *     tags: [Quotes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Quote removed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router
  .route('/:id')
  .put(protect, validate(updateQuoteSchema), updateQuote)
  .delete(protect, deleteQuote);

export default router;
