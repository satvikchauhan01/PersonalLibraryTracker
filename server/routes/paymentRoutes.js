import express from 'express';
import protect from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { verifyPaymentSchema } from '../validators/paymentSchemas.js';
import { subscribe, verify, cancel, getStatus } from '../controllers/paymentController.js';

const router = express.Router();

// Note: POST /api/payments/webhook is NOT here — it needs the raw request
// body for HMAC signature verification, so it's mounted directly in
// app.js with express.raw(), before the global express.json(). Documented
// below anyway (swagger-jsdoc just scans for `@swagger` blocks — the
// registration living in a different file doesn't matter to it).

/**
 * @swagger
 * /payments/webhook:
 *   post:
 *     summary: Razorpay webhook — subscription lifecycle events
 *     description: >
 *       Public, but signature-verified: the `X-Razorpay-Signature` header is checked against an
 *       HMAC-SHA256 of the raw request body using RAZORPAY_WEBHOOK_SECRET. Idempotent — a
 *       redelivered `X-Razorpay-Event-Id` is a no-op the second time. Handles
 *       subscription.activated/charged (→ isPro true, sends a receipt email),
 *       .pending (→ past_due), .halted/.cancelled/.completed (→ isPro false).
 *     tags: [Payments]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, description: "Razorpay's own webhook payload shape" }
 *     responses:
 *       200: { description: Processed (or already processed — same response either way) }
 *       400: { description: Missing/invalid signature, or malformed payload }
 */
// (no route registration here — the block above documents the mount in app.js;
// swagger-jsdoc just scans for `@swagger` comments, it doesn't require code to follow)

/**
 * @swagger
 * /payments/subscribe:
 *   post:
 *     summary: Start a Library Pro subscription
 *     description: Creates the subscription on Razorpay's side; returns what the client needs to open Checkout.
 *     tags: [Payments]
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { subscriptionId: { type: string }, keyId: { type: string } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       503: { description: Payments not configured (RAZORPAY_PLAN_ID unset) }
 */
router.post('/subscribe', protect, subscribe);

/**
 * @swagger
 * /payments/verify:
 *   post:
 *     summary: Verify a Checkout success callback
 *     description: Optimistic client-side confirmation — the webhook is the actual source of truth and will confirm/correct this.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_payment_id, razorpay_subscription_id, razorpay_signature]
 *             properties:
 *               razorpay_payment_id: { type: string }
 *               razorpay_subscription_id: { type: string }
 *               razorpay_signature: { type: string }
 *     responses:
 *       200: { description: Payment verified — isPro flipped to true }
 *       400: { description: Signature mismatch }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: Subscription not found for this user }
 */
router.post('/verify', protect, validate(verifyPaymentSchema), verify);

/**
 * @swagger
 * /payments/cancel:
 *   post:
 *     summary: Cancel Library Pro
 *     description: Stays active until the current billing cycle ends (cancel_at_cycle_end).
 *     tags: [Payments]
 *     responses:
 *       200: { description: Will cancel at the end of the current billing period }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: No active subscription found }
 */
router.post('/cancel', protect, cancel);

/**
 * @swagger
 * /payments/status:
 *   get:
 *     summary: Current plan + renewal/cancellation date
 *     tags: [Payments]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isPro: { type: boolean }
 *                 subscription: { $ref: '#/components/schemas/Subscription' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/status', protect, getStatus);

export default router;
