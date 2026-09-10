import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { diaryLockMiddleware } from '../middleware/diaryMiddleware.js';
import validate from '../middleware/validate.js';
import { pinSchema, saveEntrySchema } from '../validators/diarySchemas.js';
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
router.post('/lock/setup-pin', protect, validate(pinSchema), setupPin);
router.post('/lock/verify-pin', protect, validate(pinSchema), verifyPin);
router.post('/lock/disable', protect, validate(pinSchema), disablePin);

// ── AI writing prompt (no diary lock required – just a spark for the day) ──
router.get('/prompt', protect, getWritingPrompt);

// ── Stats (protected by diary lock) ──
router.get('/stats', protect, diaryLockMiddleware, getDiaryStats);

// ── Diary Entries (protected by diary lock) ──
router.get('/entries', protect, diaryLockMiddleware, getEntries);
router.get('/entries/:date', protect, diaryLockMiddleware, getEntryByDate);
router.put('/entries/:date', protect, diaryLockMiddleware, validate(saveEntrySchema), saveEntry);
router.delete('/entries/:date', protect, diaryLockMiddleware, deleteEntry);

export default router;
