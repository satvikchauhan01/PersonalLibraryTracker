import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Bug fix: the previous version reached `if (!token)` even after the
  // try/catch below had already sent a 401 — a malformed header (e.g. just
  // "Bearer" with nothing after it, or a trailing space with no token) made
  // it send a *second* response for the same request, which throws
  // ERR_HTTP_HEADERS_SENT uncaught and crashes the whole process. Each path
  // below now returns exactly once.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    next();
  } catch {
    // Expected for expired/invalid tokens — not worth logging on every request
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export default protect;
