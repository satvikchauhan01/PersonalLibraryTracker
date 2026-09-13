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

// Must come before /:id so "progress" isn't parsed as an id
router.get('/progress', protect, getGoalsProgress);

router.route('/').get(protect, getGoals).post(protect, validate(createGoalSchema), createGoal);

router
  .route('/:id')
  .put(protect, validate(updateGoalSchema), updateGoal)
  .delete(protect, deleteGoal);

export default router;
