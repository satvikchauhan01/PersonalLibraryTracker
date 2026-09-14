import express from 'express';
import {
  searchGoogleBooks,
  getGeminiInsights,
  getBookByISBN,
} from '../controllers/apiController.js';
import protect from '../middleware/authMiddleware.js';
import checkAiQuota from '../middleware/checkAiQuota.js'; // Phase 09

const router = express.Router();

/**
 * @swagger
 * /external/gbooks/search:
 *   get:
 *     summary: Search Google Books by title/author
 *     description: Used by the "Search by Title" tab on the add-book form.
 *     tags: [External]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 3 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   title: { type: string }
 *                   author: { type: string }
 *                   genre: { type: string }
 *                   coverUrl: { type: string }
 *                   description: { type: string, description: 'Phase 18 — feeds the optional book description field' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/gbooks/search', protect, searchGoogleBooks);

/**
 * @swagger
 * /external/gemini/insights:
 *   post:
 *     summary: AI-generated insights about a book (Gemini + Google Search grounding)
 *     description: Free tier is quota-limited per month; Library Pro users are unlimited.
 *     tags: [External]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, author]
 *             properties: { title: { type: string }, author: { type: string } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 insight: { type: string }
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties: { title: { type: string }, uri: { type: string } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       402: { description: Free-tier AI quota exceeded — upgrade to Library Pro }
 */
router.post('/gemini/insights', protect, checkAiQuota, getGeminiInsights);

/**
 * @swagger
 * /external/isbn/{isbn}:
 *   get:
 *     summary: Look up a book by ISBN (auto-fills the add-book form)
 *     tags: [External]
 *     parameters:
 *       - in: path
 *         name: isbn
 *         required: true
 *         schema: { type: string }
 *         description: 10 or 13 digits, hyphens allowed
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title: { type: string }
 *                 author: { type: string }
 *                 genre: { type: string }
 *                 coverUrl: { type: string }
 *                 isbn: { type: string }
 *                 description: { type: string, description: 'Phase 18 — feeds the optional book description field' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: No book found for this ISBN }
 */
router.get('/isbn/:isbn', protect, getBookByISBN);

export default router;
