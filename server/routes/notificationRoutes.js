import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';

const router = express.Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Paginated notification inbox, newest first
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications: { type: array, items: { $ref: '#/components/schemas/Notification' } }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *                 total: { type: integer }
 *                 totalPages: { type: integer }
 *                 unreadCount: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', protect, getNotifications);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark every notification as read
 *     tags: [Notifications]
 *     responses:
 *       200: { description: All notifications marked as read }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.patch('/read-all', protect, markAllNotificationsRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark one notification as read
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Notification' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/read', protect, markNotificationRead);

export default router;
