import ActivityEvent from '../models/ActivityEvent.js';
import User from '../models/User.js';
import { getIO } from '../socket/index.js';

// Records an activity event and fans it out live to the actor's friends'
// `user:{id}` rooms. Called from bookController/readingController/
// organizationController at the actual trigger points — see comments there
// for exactly which action fires which type.
//
// `book`, if given, can be the already-loaded Book doc (avoids a second
// fetch at the call site) — only _id/title/coverUrl are used here.
export const logActivity = async (userId, type, book = null, metadata = {}) => {
  try {
    const event = await ActivityEvent.create({
      user: userId,
      type,
      book: book?._id || null,
      metadata,
    });

    const user = await User.findById(userId).select('name avatarUrl friends isPro');
    if (!user || user.friends.length === 0) return;

    const payload = {
      _id: event._id,
      type: event.type,
      metadata,
      createdAt: event.createdAt,
      // Phase 09: Pro badge on the activity feed
      user: { _id: user._id, name: user.name, avatarUrl: user.avatarUrl, isPro: user.isPro },
      book: book ? { _id: book._id, title: book.title, coverUrl: book.coverUrl } : null,
    };

    const io = getIO();
    if (io) {
      for (const friendId of user.friends) {
        io.to(`user:${friendId}`).emit('activity:new', payload);
      }
    }
  } catch (error) {
    console.error('logActivity error:', error.message);
  }
};

// @desc    Paginated feed of friends' activity, newest first
// @route   GET /api/activity/feed?page=&limit=
// @access  Private
export const getActivityFeed = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('friends');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const filter = { user: { $in: me.friends } };
    const [events, total] = await Promise.all([
      ActivityEvent.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'name avatarUrl isPro') // isPro: Phase 09 badge
        .populate('book', 'title coverUrl'),
      ActivityEvent.countDocuments(filter),
    ]);

    res.json({ events, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
