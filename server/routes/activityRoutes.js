import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { getActivityFeed } from '../controllers/activityController.js';

const router = express.Router();

router.get('/feed', protect, getActivityFeed);

export default router;
