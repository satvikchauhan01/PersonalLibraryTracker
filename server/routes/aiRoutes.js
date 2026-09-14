import express from 'express';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import checkAiQuota from '../middleware/checkAiQuota.js'; // Phase 09
import { reviewAssistSchema, aiSearchSchema } from '../validators/aiSchemas.js';
import {
  getBookSummary,
  getHabitInsights,
  reviewAssist,
  naturalLanguageSearch,
} from '../controllers/aiController.js';

const router = express.Router();

// Phase 18: AI stretch features. GET /api/books/:id/similar lives in
// organizationRoutes.js (alongside the rest of the /books/:id/* sub-resources)
// and POST /api/diary/ask lives in diaryRoutes.js (needs diaryLockMiddleware) —
// everything else that isn't tied to one specific existing resource lands here.

/**
 * @swagger
 * /ai/summary/{bookId}:
 *   post:
 *     summary: Spoiler-light AI summary of a book (cached after first generation)
 *     description: >
 *       A cache hit (summary already generated for this book) costs no AI quota —
 *       only the first generation for a given book does.
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary: { type: string }
 *                 cached: { type: boolean }
 *                 generatedAt: { type: string, format: date-time }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       402: { description: Free-tier AI quota exceeded (only on a cache miss) }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       503: { description: AI not configured, or Gemini call failed }
 */
router.post('/summary/:bookId', protect, getBookSummary);

/**
 * @swagger
 * /ai/habits:
 *   get:
 *     summary: Plain-language insight generated from your Phase 07 analytics
 *     tags: [AI]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 insight: { type: string }
 *                 basedOn:
 *                   type: object
 *                   properties: { year: { type: integer }, totalBooks: { type: integer }, totalPages: { type: integer } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       402: { description: Free-tier AI quota exceeded }
 *       503: { description: AI not configured, or Gemini call failed }
 */
router.get('/habits', protect, checkAiQuota, getHabitInsights);

/**
 * @swagger
 * /ai/review-assist:
 *   post:
 *     summary: Turn bullet-point thoughts into a drafted review paragraph
 *     description: Returns a draft only — save it via POST /books/{id}/review once you're happy with it.
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookId, bulletPoints]
 *             properties:
 *               bookId: { type: string }
 *               bulletPoints: { type: array, items: { type: string }, minItems: 1, maxItems: 10 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { draft: { type: string } } }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       402: { description: Free-tier AI quota exceeded }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       503: { description: AI not configured, or Gemini call failed }
 */
router.post('/review-assist', protect, checkAiQuota, validate(reviewAssistSchema), reviewAssist);

/**
 * @swagger
 * /ai/search:
 *   post:
 *     summary: Translate a natural-language query into GET /books filter params
 *     description: >
 *       Returns structured `filters` shaped exactly like GET /books' own query params
 *       (q, status, genre, tag, minRating, sortBy, sortDir) — apply them client-side and
 *       call GET /books as normal; this route never queries books itself.
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties: { query: { type: string, example: 'short fantasy books I rated highly last year' } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { filters: { type: object } } }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       402: { description: Free-tier AI quota exceeded }
 *       503: { description: AI not configured, or Gemini call failed }
 */
router.post('/search', protect, checkAiQuota, validate(aiSearchSchema), naturalLanguageSearch);

export default router;
