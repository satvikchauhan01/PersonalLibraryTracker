import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getPendingRequests,
  getFriends,
  unfriend,
} from '../controllers/friendController.js';

const router = express.Router();

/**
 * @swagger
 * /friends/search:
 *   get:
 *     summary: Search for users to friend, by name or email
 *     tags: [Friends]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/FriendSearchResult' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/search', protect, searchUsers);

/**
 * @swagger
 * /friends/requests:
 *   get:
 *     summary: List the current user's pending friend requests (incoming + outgoing)
 *     tags: [Friends]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 incoming: { type: array, items: { $ref: '#/components/schemas/FriendRequest' } }
 *                 outgoing: { type: array, items: { $ref: '#/components/schemas/FriendRequest' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/requests', protect, getPendingRequests);

/**
 * @swagger
 * /friends:
 *   get:
 *     summary: List the current user's friends, with live online status
 *     tags: [Friends]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/FriendUser' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', protect, getFriends);

/**
 * @swagger
 * /friends/request/{userId}:
 *   post:
 *     summary: Send a friend request
 *     tags: [Friends]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FriendRequest' }
 *       400: { description: Can't send yourself a request }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: Already friends, or a request already exists in one direction }
 */
router.post('/request/:userId', protect, sendFriendRequest);

/**
 * @swagger
 * /friends/accept/{requestId}:
 *   post:
 *     summary: Accept a friend request
 *     tags: [Friends]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Friend request accepted — both users' friends lists are updated }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: This request is no longer pending }
 */
router.post('/accept/:requestId', protect, acceptFriendRequest);

/**
 * @swagger
 * /friends/decline/{requestId}:
 *   post:
 *     summary: Decline a friend request
 *     tags: [Friends]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Friend request declined }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/decline/:requestId', protect, declineFriendRequest);

/**
 * @swagger
 * /friends/{userId}:
 *   delete:
 *     summary: Remove a friend (mutual)
 *     tags: [Friends]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Unfriended }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.delete('/:userId', protect, unfriend);

export default router;
