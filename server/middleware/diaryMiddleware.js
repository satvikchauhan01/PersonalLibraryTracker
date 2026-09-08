import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Diary Security Middleware
 * If the user has diaryLockEnabled, all diary content routes require
 * a valid diary access token (x-diary-token header).
 * If the lock is OFF, requests pass through freely.
 */
export const diaryLockMiddleware = async (req, res, next) => {
  try {
    // Fetch the user with diaryLockEnabled (diaryPin is selected: false by default)
    const user = await User.findById(req.user._id).select('diaryLockEnabled');

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    // If diary lock is NOT enabled, skip this middleware
    if (!user.diaryLockEnabled) {
      return next();
    }

    // Diary is locked — check for diary access token
    const diaryToken = req.headers['x-diary-token'];
    if (!diaryToken) {
      return res.status(423).json({
        message: 'Diary is locked. Please enter your PIN to unlock.',
        locked: true,
      });
    }

    // Verify the diary token
    try {
      const decoded = jwt.verify(diaryToken, process.env.JWT_SECRET + '_diary');
      // Ensure the diary token belongs to this user
      if (decoded.userId !== req.user._id.toString()) {
        return res.status(423).json({
          message: 'Invalid diary token. Please re-enter your PIN.',
          locked: true,
        });
      }
      return next();
    } catch {
      return res.status(423).json({
        message: 'Diary session expired. Please re-enter your PIN.',
        locked: true,
        expired: true,
      });
    }
  } catch (error) {
    console.error('Diary lock middleware error:', error);
    return res.status(500).json({ message: 'Server error in diary security check.' });
  }
};
