import express from 'express';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { verifyPaymentSchema } from '../validators/paymentSchemas.js';
import { subscribe, verify, cancel, getStatus } from '../controllers/paymentController.js';

const router = express.Router();

// Note: POST /api/payments/webhook is NOT here — it needs the raw request
// body for HMAC signature verification, so it's mounted directly in
// server.js with express.raw(), before the global express.json().

router.post('/subscribe', protect, subscribe);
router.post('/verify', protect, validate(verifyPaymentSchema), verify);
router.post('/cancel', protect, cancel);
router.get('/status', protect, getStatus);

export default router;
