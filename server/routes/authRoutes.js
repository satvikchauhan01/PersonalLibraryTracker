import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getMe,
  updateProfile,
  updateNotificationPrefs,
  forgotPassword,
  resetPassword,
  getAdminStats,
} from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  notificationPrefsSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/authSchemas.js';

const router = express.Router();

// Stricter limiter on brute-forceable endpoints — a password/credential
// guess is what this defends against, so it only belongs on routes an
// attacker without valid credentials can actually hammer.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
  skip: () => process.env.NODE_ENV === 'test', // Phase 14: unmetered in the test suite
});

// Bug fix: /refresh used to share authLimiter's 10/15min budget with
// /register + /login. /refresh isn't brute-forceable the same way — it's
// gated by possession of an unguessable httpOnly cookie, not a guessable
// credential — but it fires on every page load (AuthContext's silent
// bootstrap refresh) AND every access-token expiry (api.js's response
// interceptor), so completely normal use (a few reloads, a couple of
// expired-token refreshes, testing with a second account — exactly what
// trying out the friends feature involves) burns through 10 requests in
// minutes. Once exhausted, the next silent refresh 429s, and api.js's
// interceptor used to treat ANY refresh failure as "log the user out" —
// so a legitimately-still-logged-in user would get silently bounced to
// /auth with no explanation, anywhere in the app. Given its own, much
// higher ceiling here (still bounds abuse of a stolen cookie, just doesn't
// trip over ordinary usage) — see api.js's matching fix to stop treating a
// 429 here as a hard logout.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Create an account
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, maxLength: 60 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               phone: { type: string }
 *               bio: { type: string, maxLength: 280 }
 *               favoriteGenre: { type: string }
 *     responses:
 *       201:
 *         description: Account created — also sets an httpOnly refreshToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthSession' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       429: { description: Too many attempts (10 / 15 min) }
 */
router.post('/register', authLimiter, validate(registerSchema), registerUser);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Also sets an httpOnly refreshToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthSession' }
 *       401: { description: Invalid email or password }
 *       429: { description: Too many attempts (10 / 15 min) }
 */
router.post('/login', authLimiter, validate(loginSchema), loginUser);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Rotate the refresh token for a new access token
 *     description: >
 *       Reads the httpOnly refreshToken cookie (not the request body). Rotates it — the old
 *       token is revoked and a new one issued. Presenting an already-revoked token is treated
 *       as a compromise signal and revokes every refresh token for that user.
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: New access token issued, refreshToken cookie rotated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { accessToken: { type: string } }
 *       401: { description: No/invalid/expired/reused refresh token }
 *       429: { description: Too many attempts (100 / 15 min — much higher than login/register, since this fires on every page load) }
 */
router.post('/refresh', refreshLimiter, refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out — revokes the current refresh token
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Logged out (clears the refreshToken cookie)
 */
router.post('/logout', logoutUser);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password-reset email
 *     description: >
 *       Always responds 200 with the same message whether or not the email is registered, to
 *       avoid leaking account existence. If it is, a 30-minute single-use reset link is emailed.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties: { email: { type: string, format: email } }
 *     responses:
 *       200: { description: Reset link sent if the account exists }
 *       429: { description: Too many attempts (10 / 15 min) }
 */
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /auth/reset-password/{token}:
 *   post:
 *     summary: Complete a password reset
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: The raw token from the reset-link email (not its hash)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties: { password: { type: string, minLength: 6 } }
 *     responses:
 *       200: { description: Password reset — every existing refresh token is revoked }
 *       400: { description: Invalid, expired, or already-used token }
 */
router.post('/reset-password/:token', authLimiter, validate(resetPasswordSchema), resetPassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get the current user's profile
 *     tags: [Auth]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', protect, getMe);

/**
 * @swagger
 * /auth/update-profile:
 *   put:
 *     summary: Update editable profile fields
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 60 }
 *               phone: { type: string }
 *               bio: { type: string, maxLength: 280 }
 *               favoriteGenre: { type: string }
 *               avatarUrl: { type: string }
 *               emailDigestOptIn: { type: boolean }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.put('/update-profile', protect, validate(updateProfileSchema), updateProfile);

/**
 * @swagger
 * /auth/notification-prefs:
 *   patch:
 *     summary: Update one or more notification preferences
 *     description: Merges into the stored prefs — only the keys sent are changed.
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NotificationPrefs' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.patch(
  '/notification-prefs',
  protect,
  validate(notificationPrefsSchema),
  updateNotificationPrefs
);

/**
 * @swagger
 * /auth/admin/stats:
 *   get:
 *     summary: Basic platform stats
 *     description: Admin-only.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { totalUsers: { type: integer } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/admin/stats', protect, authorize('admin'), getAdminStats);

export default router;
