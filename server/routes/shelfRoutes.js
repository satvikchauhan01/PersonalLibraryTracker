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

/**
 * @swagger
 * /shelves:
 *   get:
 *     summary: List the current user's shelves
 *     tags: [Shelves]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/Shelf' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     summary: Create a shelf
 *     tags: [Shelves]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string, maxLength: 60 } }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Shelf' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { description: A shelf with this name already exists }
 */
router.route('/').get(protect, getShelves).post(protect, validate(createShelfSchema), createShelf);

/**
 * @swagger
 * /shelves/{id}:
 *   get:
 *     summary: Get one shelf, with its books populated
 *     tags: [Shelves]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Shelf' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     summary: Rename a shelf
 *     tags: [Shelves]
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
 *             required: [name]
 *             properties: { name: { type: string, maxLength: 60 } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Shelf' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: Delete a shelf
 *     tags: [Shelves]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Shelf removed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router
  .route('/:id')
  .get(protect, getShelf)
  .put(protect, validate(updateShelfSchema), renameShelf)
  .delete(protect, deleteShelf);

/**
 * @swagger
 * /shelves/{id}/books/{bookId}:
 *   post:
 *     summary: Add a book to a shelf
 *     tags: [Shelves]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Shelf' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: Remove a book from a shelf
 *     tags: [Shelves]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Shelf' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router
  .route('/:id/books/:bookId')
  .post(protect, addBookToShelf)
  .delete(protect, removeBookFromShelf);

export default router;
