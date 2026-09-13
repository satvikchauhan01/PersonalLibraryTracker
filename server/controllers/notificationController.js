import Notification from '../models/Notification.js';

// @desc    Paginated notification inbox, newest first, plus an unread count
//          for the bell badge (so the client doesn't need a second request).
// @route   GET /api/notifications?page=&limit=
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const filter = { user: req.user._id };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('book', 'title coverUrl'),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);

    res.json({
      notifications,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark one notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    if (notification.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    notification.read = true;
    await notification.save();
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark every notification for the current user as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
