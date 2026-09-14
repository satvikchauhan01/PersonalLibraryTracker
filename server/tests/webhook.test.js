import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import ProcessedWebhookEvent from '../models/ProcessedWebhookEvent.js';
import { setupTestDb } from './dbSetup.js';

setupTestDb();

// Signs a payload exactly like Razorpay does — HMAC-SHA256 of the raw JSON
// bytes, using the webhook secret. Mirrors the original Phase 09 self-signed
// test payloads: no real Razorpay account needed to exercise this path.
const sign = (rawBody) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

const buildChargedPayload = (subscriptionId) => ({
  event: 'subscription.charged',
  payload: {
    subscription: {
      entity: {
        id: subscriptionId,
        status: 'active',
        current_start: Math.floor(Date.now() / 1000),
        current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      },
    },
  },
});

describe('Payment webhook idempotency', () => {
  it('processes a subscription.charged event and flips the user to Pro', async () => {
    const user = await User.create({
      name: 'Payer',
      email: 'payer@example.com',
      password: 'password123',
    });
    await Subscription.create({
      user: user._id,
      razorpaySubscriptionId: 'sub_test_123',
      razorpayPlanId: 'plan_test_123',
      status: 'created',
    });

    const rawBody = JSON.stringify(buildChargedPayload('sub_test_123'));
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(rawBody))
      .set('x-razorpay-event-id', 'evt_test_1')
      .send(rawBody);

    expect(res.status).toBe(200);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isPro).toBe(true);

    const sub = await Subscription.findOne({ razorpaySubscriptionId: 'sub_test_123' });
    expect(sub.status).toBe('active');
  });

  it('rejects a payload with an invalid signature', async () => {
    const rawBody = JSON.stringify(buildChargedPayload('sub_test_bad_sig'));
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'not-the-real-signature')
      .set('x-razorpay-event-id', 'evt_test_bad')
      .send(rawBody);

    expect(res.status).toBe(400);
  });

  it('is idempotent — a redelivered event id is a no-op the second time', async () => {
    const user = await User.create({
      name: 'Payer2',
      email: 'payer2@example.com',
      password: 'password123',
    });
    await Subscription.create({
      user: user._id,
      razorpaySubscriptionId: 'sub_test_456',
      razorpayPlanId: 'plan_test_123',
      status: 'created',
    });

    const rawBody = JSON.stringify(buildChargedPayload('sub_test_456'));
    const signature = sign(rawBody);

    const first = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_test_redelivered')
      .send(rawBody);
    expect(first.status).toBe(200);

    // Razorpay retries until it sees a 2xx — the exact same delivery
    // (same event id, same body) arriving again must be recognized and
    // short-circuited, not reprocessed.
    const second = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_test_redelivered')
      .send(rawBody);
    expect(second.status).toBe(200);
    expect(second.body.message).toBe('Already processed.');

    // Only one ProcessedWebhookEvent row exists for this delivery — proof
    // the second call didn't fall through to the processing logic at all.
    const eventCount = await ProcessedWebhookEvent.countDocuments({
      eventId: 'evt_test_redelivered',
    });
    expect(eventCount).toBe(1);
  });
});
