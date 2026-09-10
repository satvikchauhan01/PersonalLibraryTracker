import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
  REFRESH_TOKEN_TTL_MS,
} from '../utils/tokens.js';

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
  createdAt: user.createdAt,
});

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
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    // Handle mongoose validation errors gracefully
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
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
      await issueRefreshToken(res, user, req);
      res.json({
        ...userResponse(user),
        accessToken: generateAccessToken(user),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
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

    const { name, phone, bio, favoriteGenre, avatarUrl } = req.body;

    if (name !== undefined) user.name = name.trim();
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (favoriteGenre !== undefined) user.favoriteGenre = favoriteGenre;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    const updated = await user.save();
    res.json(userResponse(updated));
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin-only: basic platform stats
// @route   GET /api/auth/admin/stats
// @access  Private/Admin
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    res.json({ totalUsers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
