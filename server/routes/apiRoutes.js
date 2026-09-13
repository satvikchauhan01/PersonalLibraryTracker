import express from 'express';
import {
  searchGoogleBooks,
  getGeminiInsights,
  getBookByISBN,
} from '../controllers/apiController.js';
import protect from '../middleware/authMiddleware.js';
import checkAiQuota from '../middleware/checkAiQuota.js'; // Phase 09

const router = express.Router();

// Protect these routes so only logged-in users can use the APIs
router.get('/gbooks/search', protect, searchGoogleBooks);
router.post('/gemini/insights', protect, checkAiQuota, getGeminiInsights);

// Phase 03: ISBN lookup — auto-fills the add-book form
router.get('/isbn/:isbn', protect, getBookByISBN);

export default router;
