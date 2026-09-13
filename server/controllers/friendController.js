import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import { getIO, isUserOnline } from '../socket/index.js';

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Search for users to friend, by name or email
// @route   GET /api/friends/search?q=
// @access  Private
export const searchUsers = async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  try {
    const regex = new RegExp(escapeRegex(q), 'i');
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ name: regex }, { email: regex }],
    })
      .select('name email avatarUrl')
      .limit(20);

    const me = await User.findById(req.user._id).select('friends');
    const myFriendIds = new Set(me.friends.map(String));

    const requests = await FriendRequest.find({
      $or: [{ from: req.user._id }, { to: req.user._id }],
      status: 'pending',
    });
    const sentTo = new Set(
      requests.filter((r) => r.from.toString() === req.user.id).map((r) => r.to.toString())
    );
    const receivedFrom = new Map(
      requests.filter((r) => r.to.toString() === req.user.id).map((r) => [r.from.toString(), r._id])
    );

    const results = users.map((u) => {
      const id = u._id.toString();
      let relation = 'none';
      let requestId = null;
      if (myFriendIds.has(id)) {
        relation = 'friends';
      } else if (sentTo.has(id)) {
        relation = 'pending_sent';
      } else if (receivedFrom.has(id)) {
        relation = 'pending_received';
        requestId = receivedFrom.get(id);
      }
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        relation,
        requestId,
      };
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a friend request
// @route   POST /api/friends/request/:userId
// @access  Private
export const sendFriendRequest = async (req, res) => {
  const { userId: toId } = req.params;

  if (toId === req.user.id) {
    return res.status(400).json({ message: "You can't send yourself a friend request." });
  }

  try {
    const toUser = await User.findById(toId);
    if (!toUser) return res.status(404).json({ message: 'User not found.' });

    const me = await User.findById(req.user._id).select('friends');
    if (me.friends.some((f) => f.toString() === toId)) {
      return res.status(409).json({ message: 'You are already friends.' });
    }

    const reverse = await FriendRequest.findOne({
      from: toId,
      to: req.user._id,
      status: 'pending',
    });
    if (reverse) {
      return res.status(409).json({
        message: 'This user already sent you a friend request — accept it instead.',
        requestId: reverse._id,
      });
    }

    // Reuse an existing (e.g. previously declined) request doc rather than
    // colliding with the unique (from, to) index.
    let request = await FriendRequest.findOne({ from: req.user._id, to: toId });
    if (request) {
      if (request.status === 'pending') {
        return res.status(409).json({ message: 'Friend request already sent.' });
      }
      request.status = 'pending';
      await request.save();
    } else {
      request = await FriendRequest.create({ from: req.user._id, to: toId });
    }

    getIO()
      ?.to(`user:${toId}`)
      .emit('notification:new', {
        type: 'friend_request',
        from: { _id: req.user._id, name: req.user.name },
      });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Accept a friend request
// @route   POST /api/friends/accept/:requestId
// @access  Private
export const acceptFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.to.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({ message: 'This request is no longer pending.' });
    }

    request.status = 'accepted';
    await request.save();

    await User.updateOne({ _id: request.from }, { $addToSet: { friends: request.to } });
    await User.updateOne({ _id: request.to }, { $addToSet: { friends: request.from } });

    getIO()
      ?.to(`user:${request.from}`)
      .emit('notification:new', {
        type: 'friend_accepted',
        from: { _id: req.user._id, name: req.user.name },
      });

    res.json({ message: 'Friend request accepted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Decline a friend request
// @route   POST /api/friends/decline/:requestId
// @access  Private
export const declineFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.to.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    request.status = 'declined';
    await request.save();
    res.json({ message: 'Friend request declined.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    List the current user's pending friend requests (incoming + outgoing)
// @route   GET /api/friends/requests
// @access  Private
export const getPendingRequests = async (req, res) => {
  try {
    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ to: req.user._id, status: 'pending' }).populate(
        'from',
        'name email avatarUrl'
      ),
      FriendRequest.find({ from: req.user._id, status: 'pending' }).populate(
        'to',
        'name email avatarUrl'
      ),
    ]);
    res.json({ incoming, outgoing });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    List the current user's friends, with live online status
// @route   GET /api/friends
// @access  Private
export const getFriends = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).populate('friends', 'name email avatarUrl');
    const friends = me.friends.map((f) => ({
      _id: f._id,
      name: f.name,
      email: f.email,
      avatarUrl: f.avatarUrl,
      isOnline: isUserOnline(f._id),
    }));
    res.json(friends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove a friend (mutual)
// @route   DELETE /api/friends/:userId
// @access  Private
export const unfriend = async (req, res) => {
  try {
    const { userId } = req.params;
    await User.updateOne({ _id: req.user._id }, { $pull: { friends: userId } });
    await User.updateOne({ _id: userId }, { $pull: { friends: req.user._id } });
    // Clear old request docs too, so a future re-request isn't blocked by a
    // stale 'accepted' status sitting on the unique (from, to) index.
    await FriendRequest.deleteMany({
      $or: [
        { from: req.user._id, to: userId },
        { from: userId, to: req.user._id },
      ],
    });
    res.json({ message: 'Unfriended.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
