import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { getOverview } from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/overview', protect, getOverview);

export default router;
