import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  updateProgress,
  logSession,
  getSessions,
  getStreak,
  getCalendar,
} from '../controllers/readingController.js';

const router = express.Router();

/**
 * @swagger
 * /books/{id}/progress:
 *   patch:
 *     summary: Update current page (auto-completes the book at totalPages)
 *     tags: [Reading]
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
 *             required: [currentPage]
 *             properties: { currentPage: { type: integer, minimum: 0 } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Book' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/books/:id/progress', protect, updateProgress);

/**
 * @swagger
 * /books/{id}/sessions:
 *   post:
 *     summary: Log a reading session for a book
 *     tags: [Reading]
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
 *             required: [pagesRead]
 *             properties:
 *               pagesRead: { type: integer, minimum: 1 }
 *               durationMinutes: { type: integer, minimum: 1 }
 *               note: { type: string }
 *               currentPage: { type: integer, description: Optionally also advances the book's currentPage }
 *               date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$', description: Defaults to today }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session: { $ref: '#/components/schemas/ReadingSession' }
 *                 book: { $ref: '#/components/schemas/Book' }
 *       400: { description: pagesRead missing or not a positive number }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   get:
 *     summary: List sessions for a book, most recent first
 *     tags: [Reading]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/ReadingSession' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.route('/books/:id/sessions').post(protect, logSession).get(protect, getSessions);

/**
 * @swagger
 * /reading/streak:
 *   get:
 *     summary: Current + longest consecutive-day reading streak
 *     tags: [Reading]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/StreakInfo' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/reading/streak', protect, getStreak);

/**
 * @swagger
 * /reading/calendar:
 *   get:
 *     summary: Heatmap data — pages read per day, last 365 days
 *     tags: [Reading]
 *     responses:
 *       200:
 *         description: "Map of 'YYYY-MM-DD' to { pages, sessions }"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties: { pages: { type: integer }, sessions: { type: integer } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/reading/calendar', protect, getCalendar);

export default router;
