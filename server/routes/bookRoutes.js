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

/**
 * @swagger
 * /books:
 *   get:
 *     summary: List the current user's books — filterable, sortable, paginated
 *     tags: [Books]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Full-text search across title + author
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [wantToRead, reading, completed, dnf, onHold] }
 *       - in: query
 *         name: genre
 *         schema: { type: string }
 *       - in: query
 *         name: author
 *         schema: { type: string }
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *       - in: query
 *         name: shelf
 *         schema: { type: string }
 *         description: Shelf id
 *       - in: query
 *         name: minRating
 *         schema: { type: number }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, updatedAt, title, author, rating, currentPage] }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedBooks' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     summary: Add a book
 *     description: >
 *       Rejected with 409 if a book with the same ISBN, or the same normalized title+author,
 *       already exists in this user's library.
 *     tags: [Books]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BookInput' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Book' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { description: Duplicate book (matched by ISBN or title+author) }
 */
router.route('/').get(protect, getBooks).post(protect, validate(createBookSchema), addBook);

/**
 * @swagger
 * /books/export:
 *   get:
 *     summary: Export the full library (books + ratings/tags/reviews/shelf membership)
 *     tags: [Books]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, csv], default: json }
 *     responses:
 *       200:
 *         description: A downloadable file (Content-Disposition attachment)
 *         content:
 *           application/json: { schema: { type: array, items: { type: object } } }
 *           text/csv: { schema: { type: string } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/export', protect, exportBooks);

/**
 * @swagger
 * /books/import:
 *   post:
 *     summary: Bulk-import books (client-parsed CSV/JSON rows)
 *     description: >
 *       Each row is validated independently, so one malformed row never fails the whole batch —
 *       it's reported in `errors` instead. Duplicates (same rule as POST /books) are skipped,
 *       not errored.
 *     tags: [Books]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rows]
 *             properties:
 *               rows:
 *                 type: array
 *                 maxItems: 500
 *                 items: { $ref: '#/components/schemas/BookInput' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ImportResult' }
 *       400: { description: rows missing, empty, or over the 500-row cap }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/import', protect, validate(importBooksSchema), importBooks);

/**
 * @swagger
 * /books/{id}:
 *   put:
 *     summary: Update a book
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BookInput' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Book' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: Another book already has this ISBN }
 *   delete:
 *     summary: Delete a book
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Book removed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router
  .route('/:id')
  .put(protect, validate(updateBookSchema), updateBook)
  .delete(protect, deleteBook);

export default router;
