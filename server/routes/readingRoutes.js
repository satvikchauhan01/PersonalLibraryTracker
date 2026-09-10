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

// Per-book progress & sessions (mounted under /api/books in bookRoutes, but
// we use a separate router so server.js keeps things clean)
router.patch('/books/:id/progress', protect, updateProgress);
router.route('/books/:id/sessions').post(protect, logSession).get(protect, getSessions);

// Global reading analytics
router.get('/reading/streak', protect, getStreak);
router.get('/reading/calendar', protect, getCalendar);

export default router;
