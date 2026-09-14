import mongoose from 'mongoose';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { getIO, isUserOnline } from '../socket/index.js';
import Sentry from '../config/sentry.js';

// Chat is friends-only — this guards every route below against messaging a
// stranger, which matters both for UX (you can't DM someone who hasn't
// agreed to connect) and as a real access control (without this, any
// authenticated user could message any other user id).
const isFriend = (req, friendId) => req.user.friends.some((f) => f.toString() === friendId);

// Marks every unread message *from* friendId *to* me as read, and tells
// friendId's socket about it (so their sent-bubbles can flip "Sent" → "Seen"
// live). Shared by getMessages (opening/paginating a thread reads it) and
// markRead (explicitly marking read — used when a message arrives live via
// socket while the thread is already open, which getMessages is never
// called for, since nothing was fetched).
const markThreadRead = async (req, friendId) => {
  const unread = await Message.find({ from: friendId, to: req.user._id, read: false }).select(
    '_id'
  );
  if (unread.length === 0) return;

  const readAt = new Date();
  await Message.updateMany(
    { _id: { $in: unread.map((m) => m._id) } },
    { $set: { read: true, readAt } }
  );
  getIO()
    ?.to(`user:${friendId}`)
    .emit('chat:read', { by: req.user._id, messageIds: unread.map((m) => m._id), readAt });
};

// @desc    List conversations — one row per friend, with their last message
//          (if any) and how many of their messages to me are unread.
//          Friends you haven't messaged yet still appear (sorted after any
//          active conversations) so starting a new chat doesn't require a
//          separate "new conversation" flow.
// @route   GET /api/messages/conversations
// @access  Private
export const getConversations = async (req, res) => {
  try {
    const friendIds = req.user.friends;
    if (friendIds.length === 0) return res.json([]);

    const friendDocs = await User.find({ _id: { $in: friendIds } })
      .select('name avatarUrl')
      .lean();

    const [lastMessages, unreadCounts] = await Promise.all([
      // Newest message per (me, friend) pair, in either direction. $group
      // after a $sort takes the first document it sees per group — with a
      // descending sort that's the most recent one.
      Message.aggregate([
        {
          $match: {
            $or: [
              { from: req.user._id, to: { $in: friendIds } },
              { to: req.user._id, from: { $in: friendIds } },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: { $cond: [{ $eq: ['$from', req.user._id] }, '$to', '$from'] },
            text: { $first: '$text' },
            createdAt: { $first: '$createdAt' },
            fromMe: { $first: { $eq: ['$from', req.user._id] } },
          },
        },
      ]),
      Message.aggregate([
        { $match: { to: req.user._id, from: { $in: friendIds }, read: false } },
        { $group: { _id: '$from', count: { $sum: 1 } } },
      ]),
    ]);

    const lastMessageMap = new Map(lastMessages.map((m) => [String(m._id), m]));
    const unreadMap = new Map(unreadCounts.map((u) => [String(u._id), u.count]));

    const conversations = friendDocs.map((f) => {
      const id = String(f._id);
      const last = lastMessageMap.get(id);
      return {
        friend: {
          _id: f._id,
          name: f.name,
          avatarUrl: f.avatarUrl,
          isOnline: isUserOnline(f._id),
        },
        lastMessage: last
          ? { text: last.text, createdAt: last.createdAt, fromMe: last.fromMe }
          : null,
        unreadCount: unreadMap.get(id) || 0,
      };
    });

    // Active conversations first (most recently active first), then
    // never-messaged friends alphabetically.
    conversations.sort((a, b) => {
      if (a.lastMessage && b.lastMessage) {
        return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
      }
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      // Bug fix: an account created before Phase 01 added registration
      // validation can have a missing `name` field — localeCompare on
      // undefined 500'd this entire endpoint for that user's every friend,
      // not just the nameless one. Same underlying data case as Friends.jsx's
      // crash on the client.
      return (a.friend.name || '').localeCompare(b.friend.name || '');
    });

    res.json(conversations);
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Message history with one friend, paginated newest-first-then-
//          reversed (so the response is already in chronological display
//          order). Also marks their messages to me as read as a side effect
//          — opening a conversation IS reading it — and tells them via
//          socket so their UI can show a "seen" mark.
// @route   GET /api/messages/:friendId?page=&limit=
// @access  Private
export const getMessages = async (req, res) => {
  const { friendId } = req.params;

  if (!mongoose.isValidObjectId(friendId)) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }
  if (!isFriend(req, friendId)) {
    return res.status(403).json({ message: 'You can only message your friends.' });
  }

  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));

    const filter = {
      $or: [
        { from: req.user._id, to: friendId },
        { from: friendId, to: req.user._id },
      ],
    };

    const [messagesDesc, total] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Message.countDocuments(filter),
    ]);

    const messages = messagesDesc.reverse();

    // Opening/paginating a thread reads whatever's currently unread in it.
    await markThreadRead(req, friendId);

    res.json({ messages, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a message to a friend
// @route   POST /api/messages/:friendId
// @access  Private
export const sendMessage = async (req, res) => {
  const { friendId } = req.params;
  const { text } = req.body;

  if (!mongoose.isValidObjectId(friendId)) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }
  if (friendId === req.user.id) {
    return res.status(400).json({ message: "You can't message yourself." });
  }
  if (!isFriend(req, friendId)) {
    return res.status(403).json({ message: 'You can only message your friends.' });
  }

  try {
    const message = await Message.create({ from: req.user._id, to: friendId, text });

    const payload = {
      _id: message._id,
      from: req.user._id,
      to: friendId,
      text: message.text,
      read: false,
      createdAt: message.createdAt,
    };

    // Sent to both rooms: the recipient (for live delivery) and the
    // sender's own room too, so any *other* tab the sender has open stays
    // in sync — the sending tab itself already has this message from the
    // response below, so its socket handler dedupes by _id.
    const io = getIO();
    if (io) {
      io.to(`user:${friendId}`).emit('chat:new', payload);
      io.to(`user:${req.user._id}`).emit('chat:new', payload);
    }

    res.status(201).json(message);
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark a thread read without fetching it
// @route   POST /api/messages/:friendId/read
// @access  Private
// Bug fix: a message that arrives live via the `chat:new` socket event while
// its thread is already open was never actually marked read in the DB —
// only GET /api/messages/:friendId's side effect does that, and opening a
// live-updated thread doesn't call it again. The client now calls this
// route when that happens, so the unread count doesn't silently resurrect
// itself once the user navigates away and the sidebar/badge refetches.
export const markRead = async (req, res) => {
  const { friendId } = req.params;

  if (!mongoose.isValidObjectId(friendId)) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }
  if (!isFriend(req, friendId)) {
    return res.status(403).json({ message: 'You can only message your friends.' });
  }

  try {
    await markThreadRead(req, friendId);
    res.json({ message: 'Marked read.' });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ message: error.message });
  }
};
