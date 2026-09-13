import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getIO } from '../socket/index.js';

// Maps a notification type to the notificationPrefs field that gates it.
// Kept as the single source of truth so a cron job and a real-time trigger
// (e.g. readingController.logSession's streak check) can't drift apart on
// which pref governs which notification.
const PREF_KEY_BY_TYPE = {
  reading_reminder: 'readingReminders',
  goal_reminder: 'goalReminders',
  continue_reading: 'continueReadingNudges',
  streak_milestone: 'streakAlerts',
};

// Creates a persisted Notification for `userId` — unless they've opted out
// of that category — and pushes it live over the user's own socket room if
// they're currently connected. Returns the created doc, or null if skipped
// (opted out, user missing) or on error (logged, never thrown — a failed
// reminder should never take down whatever cron job or request called it).
export const notifyUser = async (userId, type, message, { book = null, metadata = {} } = {}) => {
  try {
    const prefKey = PREF_KEY_BY_TYPE[type];
    if (prefKey) {
      const user = await User.findById(userId).select('notificationPrefs');
      if (!user || user.notificationPrefs?.[prefKey] === false) return null;
    }

    const notification = await Notification.create({
      user: userId,
      type,
      message,
      book: book?._id || book || null,
      metadata,
    });

    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', {
        _id: notification._id,
        type: notification.type,
        message: notification.message,
        book: notification.book,
        metadata: notification.metadata,
        createdAt: notification.createdAt,
      });
    }

    return notification;
  } catch (error) {
    console.error('notifyUser error:', error.message);
    return null;
  }
};
