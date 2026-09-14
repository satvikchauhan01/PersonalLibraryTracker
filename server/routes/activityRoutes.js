import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { getActivityFeed } from '../controllers/activityController.js';

const router = express.Router();

/**
 * @swagger
 * /activity/feed:
 *   get:
 *     summary: Paginated feed of friends' activity, newest first
 *     tags: [Activity]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events: { type: array, items: { $ref: '#/components/schemas/ActivityEvent' } }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *                 total: { type: integer }
 *                 totalPages: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/feed', protect, getActivityFeed);

export default router;
