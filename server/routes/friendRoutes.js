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

router.get('/search', protect, searchUsers);
router.get('/requests', protect, getPendingRequests);
router.get('/', protect, getFriends);

router.post('/request/:userId', protect, sendFriendRequest);
router.post('/accept/:requestId', protect, acceptFriendRequest);
router.post('/decline/:requestId', protect, declineFriendRequest);

router.delete('/:userId', protect, unfriend);

export default router;
