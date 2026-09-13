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

// Stricter limiter on brute-forceable endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});

router.post('/register', authLimiter, validate(registerSchema), registerUser);
router.post('/login', authLimiter, validate(loginSchema), loginUser);
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', logoutUser);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password/:token', authLimiter, validate(resetPasswordSchema), resetPassword);
router.get('/me', protect, getMe);
router.put('/update-profile', protect, validate(updateProfileSchema), updateProfile);
router.patch(
  '/notification-prefs',
  protect,
  validate(notificationPrefsSchema),
  updateNotificationPrefs
);
router.get('/admin/stats', protect, authorize('admin'), getAdminStats);

export default router;
