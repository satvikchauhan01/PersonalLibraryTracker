import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Module-level singleton so controllers can emit events without needing `io`
// threaded through every function call. Set once by initSocket(), read via
// getIO() from anywhere else in the server.
let io = null;

// userId (string) -> Set of connected socket ids. A user can have more than
// one tab/device open; they only go "offline" once every socket closes.
const onlineUsers = new Map();

export const isUserOnline = (userId) => onlineUsers.has(String(userId));

const broadcastPresence = async (io, userId, isOnline) => {
  const user = await User.findById(userId).select('friends');
  if (!user) return;
  for (const friendId of user.friends) {
    io.to(`user:${friendId}`).emit('presence:update', { userId: String(userId), isOnline });
  }
};

export const initSocket = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // Auth handshake: reject any connection without a valid access token.
  // Uses the same JWT_SECRET/shape as the HTTP access token (utils/tokens.js)
  // so a client can reuse whatever token it already has in memory.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Not authorized, no token'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id');
      if (!user) return next(new Error('Not authorized, user not found'));

      socket.userId = String(user._id);
      next();
    } catch {
      next(new Error('Not authorized, token failed'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket;
    socket.join(`user:${userId}`);

    const wasOffline = !onlineUsers.has(userId);
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    if (wasOffline) {
      broadcastPresence(io, userId, true).catch(() => {});
    }

    // Chat: cache this connection's friend set once (not re-fetched per
    // keystroke) so `typing` events can be relay-checked against it — a
    // client shouldn't be able to make a typing indicator appear for an
    // arbitrary stranger's `to`, only for an actual friend. A mid-session
    // friendship change won't be reflected until the next reconnect, which
    // is an acceptable staleness window for an ephemeral, no-persistence signal.
    let friendIds = new Set();
    try {
      const me = await User.findById(userId).select('friends');
      friendIds = new Set((me?.friends || []).map(String));
    } catch {
      // If this lookup fails, typing indicators just silently no-op below —
      // not worth failing the whole connection over.
    }

    // Chat: purely ephemeral (no DB write) typing indicator, relayed
    // straight to the other person's room. `isTyping` lets one event type
    // cover both "started typing" and "stopped typing".
    socket.on('chat:typing', ({ to, isTyping }) => {
      if (!to || !friendIds.has(String(to))) return;
      socket.to(`user:${to}`).emit('chat:typing', { from: userId, isTyping: !!isTyping });
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        broadcastPresence(io, userId, false).catch(() => {});
      }
    });
  });

  return io;
};

export const getIO = () => io;
