import express from 'express';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { sendMessageSchema } from '../validators/messageSchemas.js';
import {
  getConversations,
  getMessages,
  sendMessage,
  markRead,
} from '../controllers/messageController.js';

const router = express.Router();

// Chat is friends-only (see messageController's isFriend guard on every
// route below) — there's no way to message someone who isn't a mutual
// friend, matching how the rest of the social features (activity feed,
// presence) are already scoped.

/**
 * @swagger
 * /messages/conversations:
 *   get:
 *     summary: List your conversations — one row per friend, most recently active first
 *     description: >
 *       Friends you haven't messaged yet are still included (after any active conversations,
 *       alphabetically), so starting a new chat doesn't need a separate "new conversation" step.
 *     tags: [Messages]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   friend:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       name: { type: string }
 *                       avatarUrl: { type: string }
 *                       isOnline: { type: boolean }
 *                   lastMessage:
 *                     type: object
 *                     nullable: true
 *                     properties:
 *                       text: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       fromMe: { type: boolean }
 *                   unreadCount: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/conversations', protect, getConversations);

/**
 * @swagger
 * /messages/{friendId}:
 *   get:
 *     summary: Message history with one friend (paginated, chronological order)
 *     description: Opening a conversation marks their messages to you as read, and notifies them via socket.
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30, maximum: 100 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages: { type: array, items: { $ref: '#/components/schemas/Message' } }
 *                 page: { type: integer }
 *                 total: { type: integer }
 *                 totalPages: { type: integer }
 *       400: { description: Invalid user id }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Not friends with this user }
 *   post:
 *     summary: Send a message to a friend
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties: { text: { type: string, maxLength: 2000 } }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Message' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Not friends with this user }
 */
router.get('/:friendId', protect, getMessages);
router.post('/:friendId', protect, validate(sendMessageSchema), sendMessage);

/**
 * @swagger
 * /messages/{friendId}/read:
 *   post:
 *     summary: Mark a thread read without re-fetching it
 *     description: >
 *       Used when a message arrives live via socket while its thread is already open — the
 *       client already has it, it just needs the server (and the sender, via a chat:read
 *       socket event) to know it's been seen.
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Marked read (a no-op if nothing was unread) }
 *       400: { description: Invalid user id }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Not friends with this user }
 */
router.post('/:friendId/read', protect, markRead);

export default router;
