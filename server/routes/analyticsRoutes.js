import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { getOverview } from '../controllers/analyticsController.js';

const router = express.Router();

/**
 * @swagger
 * /analytics/overview:
 *   get:
 *     summary: Aggregate reading analytics for one year
 *     tags: [Goals & Analytics]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Defaults to the current year
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AnalyticsOverview' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/overview', protect, getOverview);

export default router;
