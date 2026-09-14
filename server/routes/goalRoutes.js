import express from 'express';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { createGoalSchema, updateGoalSchema } from '../validators/goalSchemas.js';
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getGoalsProgress,
} from '../controllers/goalController.js';

const router = express.Router();

/**
 * @swagger
 * /goals/progress:
 *   get:
 *     summary: Actual vs. target for every goal
 *     tags: [Goals & Analytics]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/GoalProgress' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// Must come before /:id so "progress" isn't parsed as an id
router.get('/progress', protect, getGoalsProgress);

/**
 * @swagger
 * /goals:
 *   get:
 *     summary: List the current user's goals
 *     tags: [Goals & Analytics]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/ReadingGoal' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     summary: Create a goal
 *     tags: [Goals & Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [year, period, metric, target]
 *             properties:
 *               year: { type: integer, minimum: 2000 }
 *               period: { type: string, enum: [yearly, monthly] }
 *               month: { type: integer, minimum: 1, maximum: 12, description: Required when period is monthly }
 *               metric: { type: string, enum: [books, pages] }
 *               target: { type: integer, minimum: 1 }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ReadingGoal' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { description: A goal for this year/period/month/metric already exists }
 */
router.route('/').get(protect, getGoals).post(protect, validate(createGoalSchema), createGoal);

/**
 * @swagger
 * /goals/{id}:
 *   put:
 *     summary: Update a goal's target
 *     tags: [Goals & Analytics]
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
 *             properties: { target: { type: integer, minimum: 1 } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ReadingGoal' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: Delete a goal
 *     tags: [Goals & Analytics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Goal removed }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router
  .route('/:id')
  .put(protect, validate(updateGoalSchema), updateGoal)
  .delete(protect, deleteGoal);

export default router;
