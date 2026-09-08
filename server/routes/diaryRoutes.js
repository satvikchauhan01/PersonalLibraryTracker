import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { diaryLockMiddleware } from '../middleware/diaryMiddleware.js';
import {
  // Lock / PIN management
  getPinStatus,
  setupPin,
  verifyPin,
  disablePin,
  // Entries
  getEntries,
  getEntryByDate,
  saveEntry,
  deleteEntry,
  // Stats & AI
  getDiaryStats,
  getWritingPrompt,
} from '../controllers/diaryController.js';

const router = express.Router();

// ── PIN / Lock management routes (no diaryLockMiddleware – these handle it) ──
router.get('/lock/status', protect, getPinStatus);
router.post('/lock/setup-pin', protect, setupPin);
router.post('/lock/verify-pin', protect, verifyPin);
router.post('/lock/disable', protect, disablePin);

// ── AI writing prompt (no diary lock required – just a spark for the day) ──
router.get('/prompt', protect, getWritingPrompt);

// ── Stats (protected by diary lock) ──
router.get('/stats', protect, diaryLockMiddleware, getDiaryStats);

// ── Diary Entries (protected by diary lock) ──
router.get('/entries', protect, diaryLockMiddleware, getEntries);
router.get('/entries/:date', protect, diaryLockMiddleware, getEntryByDate);
router.put('/entries/:date', protect, diaryLockMiddleware, saveEntry);
router.delete('/entries/:date', protect, diaryLockMiddleware, deleteEntry);

export default router;
