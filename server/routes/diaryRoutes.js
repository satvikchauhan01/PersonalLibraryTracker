import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { diaryLockMiddleware } from '../middleware/diaryMiddleware.js';
import validate from '../middleware/validate.js';
import checkAiQuota from '../middleware/checkAiQuota.js'; // Phase 09
import { pinSchema, saveEntrySchema } from '../validators/diarySchemas.js';
import { askDiarySchema } from '../validators/aiSchemas.js'; // Phase 18
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
import { askDiary } from '../controllers/aiController.js'; // Phase 18

const router = express.Router();

// ── PIN / Lock management routes (no diaryLockMiddleware – these handle it) ──

/**
 * @swagger
 * /diary/lock/status:
 *   get:
 *     summary: Whether the diary PIN lock is enabled
 *     tags: [Diary]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { diaryLockEnabled: { type: boolean } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/lock/status', protect, getPinStatus);

/**
 * @swagger
 * /diary/lock/setup-pin:
 *   post:
 *     summary: Enable the diary lock with a new PIN
 *     tags: [Diary]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pin]
 *             properties: { pin: { type: string, minLength: 4, maxLength: 6 } }
 *     responses:
 *       200: { description: Lock enabled }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/lock/setup-pin', protect, validate(pinSchema), setupPin);

/**
 * @swagger
 * /diary/lock/verify-pin:
 *   post:
 *     summary: Unlock the diary — exchanges the correct PIN for a short-lived diary token
 *     description: >
 *       The returned `diaryToken` must be sent as the `x-diary-token` header on every
 *       lock-protected diary route below (stats, entries) while the lock is enabled.
 *     tags: [Diary]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pin]
 *             properties: { pin: { type: string } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { diaryToken: { type: string }, message: { type: string } }
 *       401: { description: Incorrect PIN }
 */
router.post('/lock/verify-pin', protect, validate(pinSchema), verifyPin);

/**
 * @swagger
 * /diary/lock/disable:
 *   post:
 *     summary: Disable the diary lock
 *     tags: [Diary]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pin]
 *             properties: { pin: { type: string } }
 *     responses:
 *       200: { description: Lock disabled }
 *       401: { description: Incorrect PIN }
 */
router.post('/lock/disable', protect, validate(pinSchema), disablePin);

// ── AI writing prompt (no diary lock required – just a spark for the day) ──

/**
 * @swagger
 * /diary/prompt:
 *   get:
 *     summary: Get an AI-generated writing prompt
 *     tags: [Diary]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { prompt: { type: string } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       402: { description: Free-tier AI quota exceeded (non-Pro users) }
 */
router.get('/prompt', protect, checkAiQuota, getWritingPrompt);

// ── Stats (protected by diary lock) ──

/**
 * @swagger
 * /diary/stats:
 *   get:
 *     summary: Diary streak/word-count/mood stats
 *     tags: [Diary]
 *     parameters:
 *       - in: header
 *         name: x-diary-token
 *         schema: { type: string }
 *         description: Required only if the diary lock is enabled (see /diary/lock/verify-pin)
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 streak: { type: integer }
 *                 totalEntries: { type: integer }
 *                 totalWords: { type: integer }
 *                 moodCounts: { type: object, additionalProperties: { type: integer } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       423: { description: Diary locked — missing/invalid/expired x-diary-token }
 */
router.get('/stats', protect, diaryLockMiddleware, getDiaryStats);

// ── Diary Entries (protected by diary lock) ──

/**
 * @swagger
 * /diary/entries:
 *   get:
 *     summary: List every diary entry (for the calendar/sidebar)
 *     tags: [Diary]
 *     parameters:
 *       - in: header
 *         name: x-diary-token
 *         schema: { type: string }
 *         description: Required only if the diary lock is enabled
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/DiaryEntry' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       423: { description: Diary locked — missing/invalid/expired x-diary-token }
 */
router.get('/entries', protect, diaryLockMiddleware, getEntries);

/**
 * @swagger
 * /diary/entries/{date}:
 *   get:
 *     summary: Get one day's entry
 *     tags: [Diary]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *       - in: header
 *         name: x-diary-token
 *         schema: { type: string }
 *         description: Required only if the diary lock is enabled
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DiaryEntry' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: No entry for that date }
 *       423: { description: Diary locked — missing/invalid/expired x-diary-token }
 *   put:
 *     summary: Create or update one day's entry (upsert)
 *     tags: [Diary]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *       - in: header
 *         name: x-diary-token
 *         schema: { type: string }
 *         description: Required only if the diary lock is enabled
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/DiaryEntry' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DiaryEntry' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       423: { description: Diary locked — missing/invalid/expired x-diary-token }
 *   delete:
 *     summary: Delete one day's entry
 *     tags: [Diary]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *       - in: header
 *         name: x-diary-token
 *         schema: { type: string }
 *         description: Required only if the diary lock is enabled
 *     responses:
 *       200: { description: Entry deleted }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       423: { description: Diary locked — missing/invalid/expired x-diary-token }
 */
router.get('/entries/:date', protect, diaryLockMiddleware, getEntryByDate);
router.put('/entries/:date', protect, diaryLockMiddleware, validate(saveEntrySchema), saveEntry);
router.delete('/entries/:date', protect, diaryLockMiddleware, deleteEntry);

// ── AI: ask your diary (RAG, protected by diary lock) ──

/**
 * @swagger
 * /diary/ask:
 *   post:
 *     summary: Ask a question about your own diary (RAG over embedded entries)
 *     description: >
 *       Embeds your question, ranks your diary entries by relevance, and answers using only
 *       those excerpts as context — `sources` lists exactly which entries (by date) were used.
 *     tags: [AI]
 *     parameters:
 *       - in: header
 *         name: x-diary-token
 *         schema: { type: string }
 *         description: Required only if the diary lock is enabled
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question]
 *             properties: { question: { type: string, minLength: 3, maxLength: 500 } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer: { type: string }
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties: { date: { type: string }, title: { type: string, nullable: true }, score: { type: number } }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       402: { description: Free-tier AI quota exceeded }
 *       423: { description: Diary locked — missing/invalid/expired x-diary-token }
 *       503: { description: AI not configured, or Gemini call failed }
 */
router.post('/ask', protect, diaryLockMiddleware, checkAiQuota, validate(askDiarySchema), askDiary);

export default router;
