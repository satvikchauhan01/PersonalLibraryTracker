import User from '../models/User.js';
import Book from '../models/Book.js';
import RefreshToken from '../models/RefreshToken.js';
import Sentry from '../config/sentry.js'; // Phase 17
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
  REFRESH_TOKEN_TTL_MS,
} from '../utils/tokens.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService.js'; // Phase 12

// Fields to return in user response (never return password)
const userResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || '',
  bio: user.bio || '',
  favoriteGenre: user.favoriteGenre || '',
  avatarUrl: user.avatarUrl || '',
  isPro: user.isPro || false, // Phase 09
  notificationPrefs: user.notificationPrefs, // Phase 11
  emailDigestOptIn: user.emailDigestOptIn || false, // Phase 12
  createdAt: user.createdAt,
});

// Password-reset tokens use the same shape as refresh tokens (raw 64-byte
// hex, only the SHA-256 hash ever stored) — reusing generateRefreshToken/
// hashToken from utils/tokens.js rather than a second implementation.
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

const isProd = process.env.NODE_ENV === 'production';
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
};

// Creates a refresh token, stores its hash, and sets it as an httpOnly cookie.
const issueRefreshToken = async (res, user, req) => {
  const rawToken = generateRefreshToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: getRefreshTokenExpiry(),
    userAgent: req.headers['user-agent'] || '',
    ip: req.ip,
  });
  res.cookie(REFRESH_COOKIE_NAME, rawToken, REFRESH_COOKIE_OPTIONS);
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  // req.body has already passed registerSchema (trimmed, defaulted) via the
  // validate middleware in authRoutes.js.
  const { name, email, password, phone, bio, favoriteGenre } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      bio,
      favoriteGenre,
    });

    if (user) {
      await issueRefreshToken(res, user, req);
      res.status(201).json({
        ...userResponse(user),
        accessToken: generateAccessToken(user),
      });

      // Phase 12: best-effort, after the response — a failed/unconfigured
      // welcome email should never hold up or fail a registration.
      sendWelcomeEmail(user).catch(() => {});
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    // Handle mongoose validation errors gracefully
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      if (user.isBanned) {
        return res.status(403).json({ message: 'Your account has been suspended.' });
      }
      await issueRefreshToken(res, user, req);
      res.json({
        ...userResponse(user),
        accessToken: generateAccessToken(user),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Rotate a refresh token for a new access token
// @route   POST /api/auth/refresh
// @access  Public (requires refresh cookie)
export const refreshToken = async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }

  const tokenHash = hashToken(rawToken);

  try {
    const existing = await RefreshToken.findOne({ tokenHash });
    if (!existing) {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated token — possible theft.
      // Kill every active session for this user.
      await RefreshToken.updateMany(
        { user: existing.user, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
      return res.status(401).json({ message: 'Session invalid. Please log in again.' });
    }

    if (existing.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Refresh token expired.' });
    }

    const user = await User.findById(existing.user);
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (user.isBanned) {
      await RefreshToken.updateMany(
        { user: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
      return res.status(403).json({ message: 'Your account has been suspended.' });
    }

    const newRawToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawToken);

    await RefreshToken.create({
      user: user._id,
      tokenHash: newTokenHash,
      expiresAt: getRefreshTokenExpiry(),
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip,
    });

    existing.revokedAt = new Date();
    existing.replacedByTokenHash = newTokenHash;
    await existing.save();

    res.cookie(REFRESH_COOKIE_NAME, newRawToken, REFRESH_COOKIE_OPTIONS);
    res.json({ accessToken: generateAccessToken(user) });
  } catch (error) {
    console.error('refreshToken error:', error);
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: 'Server error.' });
  }
};

// @desc    Log out (revoke refresh token)
// @route   POST /api/auth/logout
// @access  Public
export const logoutUser = async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawToken) {
    await RefreshToken.updateOne(
      { tokenHash: hashToken(rawToken) },
      { $set: { revokedAt: new Date() } }
    );
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.json({ message: 'Logged out.' });
};

// @desc    Request a password-reset email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    // Same response whether or not the account exists — don't let this
    // endpoint be used to enumerate registered emails.
    if (user) {
      const rawToken = generateRefreshToken(); // 64-byte hex, same generator as refresh tokens
      user.passwordResetTokenHash = hashToken(rawToken);
      user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();

      sendPasswordResetEmail(user, rawToken).catch(() => {});
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Complete a password reset with a token from the email link
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const tokenHash = hashToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    }

    user.password = password; // pre('save') hook hashes it
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await user.save();

    // A password reset should end every other session, not just whichever
    // browser followed the email link — same principle as reuse-detection
    // in refreshToken(), applied proactively here instead of reactively.
    await RefreshToken.updateMany(
      { user: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    res.json({ message: 'Password reset. Please log in with your new password.' });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(userResponse(user));
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/update-profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, phone, bio, favoriteGenre, avatarUrl, emailDigestOptIn } = req.body;

    if (name !== undefined) user.name = name.trim();
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (favoriteGenre !== undefined) user.favoriteGenre = favoriteGenre;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (emailDigestOptIn !== undefined) user.emailDigestOptIn = emailDigestOptIn; // Phase 12

    const updated = await user.save();
    res.json(userResponse(updated));
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update notification preferences (Phase 11)
// @route   PATCH /api/auth/notification-prefs
// @access  Private
export const updateNotificationPrefs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Merge rather than replace — only the keys the client actually sent
    // (already narrowed to booleans by notificationPrefsSchema) are touched.
    Object.assign(user.notificationPrefs, req.body);
    await user.save();
    res.json(userResponse(user));
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin-only: basic platform stats
// @route   GET /api/auth/admin/stats
// @access  Private/Admin
export const getAdminStats = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [totalUsers, totalAdmins, bannedUsers, proUsers, totalBooks, newUsersThisWeek] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({ isBanned: true }),
        User.countDocuments({ isPro: true }),
        Book.countDocuments(),
        User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      ]);
    res.json({ totalUsers, totalAdmins, bannedUsers, proUsers, totalBooks, newUsersThisWeek });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// Safe subset of a user document for admin-facing responses — never the
// password or any of the select:false security fields.
const adminUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isPro: user.isPro,
  isBanned: user.isBanned,
  banReason: user.banReason,
  createdAt: user.createdAt,
});

// @desc    Admin-only: paginated, searchable user list
// @route   GET /api/auth/admin/users
// @access  Private/Admin
export const listUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = (req.query.search || '').trim();

    // Escape regex metacharacters — a search term is user input, not a pattern.
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = search
      ? {
          $or: [
            { name: { $regex: escaped, $options: 'i' } },
            { email: { $regex: escaped, $options: 'i' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      users: users.map(adminUserResponse),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin-only: promote/demote a user
// @route   PATCH /api/auth/admin/users/:id/role
// @access  Private/Admin
export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Note: this route can never zero-out the admin count. It's gated by
    // authorize('admin') (the caller is always an admin) and the self-change
    // guard above rules out the caller as a target — so demoting `target`
    // away from 'admin' always still leaves the caller as one.
    target.role = role;
    await target.save();
    res.json(adminUserResponse(target));
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin-only: suspend or reinstate a user account
// @route   PATCH /api/auth/admin/users/:id/ban
// @access  Private/Admin
export const updateUserBanStatus = async (req, res) => {
  const { id } = req.params;
  const { isBanned, reason } = req.body;

  try {
    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot suspend your own account.' });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // An admin must be demoted before they can be suspended — keeps
    // suspension from becoming a backdoor way to sideline another admin.
    if (target.role === 'admin' && isBanned) {
      return res
        .status(400)
        .json({ message: 'Demote this admin before suspending their account.' });
    }

    target.isBanned = isBanned;
    target.banReason = isBanned ? reason || '' : '';
    target.bannedAt = isBanned ? new Date() : null;
    await target.save();

    if (isBanned) {
      // Kill any active session now rather than waiting for the access
      // token to expire or the next refresh attempt to hit the ban check.
      await RefreshToken.updateMany(
        { user: target._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    res.json(adminUserResponse(target));
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};
