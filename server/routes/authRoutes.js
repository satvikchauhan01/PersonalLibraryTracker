import express from 'express';
import { registerUser, loginUser, getMe, updateProfile } from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../validators/authSchemas.js';

const router = express.Router();

router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.get('/me', protect, getMe);
router.put('/update-profile', protect, validate(updateProfileSchema), updateProfile);

export default router;
