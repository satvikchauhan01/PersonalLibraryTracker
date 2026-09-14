import crypto from 'crypto';
import { getRazorpay } from '../config/razorpay.js';
import Sentry from '../config/sentry.js'; // Phase 17
import Subscription from '../models/Subscription.js';
import ProcessedWebhookEvent from '../models/ProcessedWebhookEvent.js';
import User from '../models/User.js';
import { sendReceiptEmail } from '../services/emailService.js'; // Phase 12

// Razorpay requires a fixed number of billing cycles up front for a
// subscription; 12 months is the simplest "renews for a year" choice — the
// user can still cancel (at cycle end) any time via /cancel.
const TOTAL_BILLING_CYCLES = 12;

// @desc    Start a Library Pro subscription — creates it on Razorpay's side
//          and returns what the client needs to open Checkout.
// @route   POST /api/payments/subscribe
// @access  Private
export const subscribe = async (req, res) => {
  if (!process.env.RAZORPAY_PLAN_ID) {
    return res.status(503).json({ message: 'Payments are not configured yet.' });
  }

  try {
    const razorpay = getRazorpay();
    const rzpSubscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      customer_notify: 1,
      total_count: TOTAL_BILLING_CYCLES,
      notes: { userId: req.user.id },
    });

    await Subscription.create({
      user: req.user._id,
      razorpaySubscriptionId: rzpSubscription.id,
      razorpayPlanId: process.env.RAZORPAY_PLAN_ID,
      status: rzpSubscription.status, // 'created'
    });

    res.status(201).json({
      subscriptionId: rzpSubscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('subscribe error:', error.message);
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: 'Could not start a subscription.' });
  }
};

// @desc    Verify a Checkout success callback (optimistic — the webhook
//          below is the actual source of truth and will confirm/correct this)
// @route   POST /api/payments/verify
// @access  Private
export const verify = async (req, res) => {
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

  try {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed.' });
    }

    const subscription = await Subscription.findOne({
      razorpaySubscriptionId: razorpay_subscription_id,
      user: req.user._id,
    });
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found.' });
    }

    subscription.status = 'active';
    await subscription.save();
    await User.updateOne({ _id: req.user._id }, { isPro: true });

    res.json({ message: 'Payment verified.' });
  } catch (error) {
    console.error('verify error:', error.message);
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: 'Server error verifying payment.' });
  }
};

// @desc    Razorpay webhook — subscription.activated/charged/cancelled/halted/completed
// @route   POST /api/payments/webhook
// @access  Public (signature-verified; mounted with a raw body parser in server.js)
export const webhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body; // Buffer — express.raw() in server.js, mounted before express.json()

  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return res.status(400).json({ message: 'Missing webhook signature or secret.' });
  }

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expected) {
    return res.status(400).json({ message: 'Invalid webhook signature.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Malformed webhook payload.' });
  }

  // Idempotency: Razorpay retries a webhook until it gets a 2xx, so the same
  // delivery can arrive more than once. Razorpay sends a per-delivery event
  // id header; fall back to hashing the raw body if that's ever absent, so
  // an identical redelivered payload still dedupes correctly either way.
  const eventId =
    req.headers['x-razorpay-event-id'] || crypto.createHash('sha256').update(rawBody).digest('hex');

  try {
    await ProcessedWebhookEvent.create({ eventId, eventType: payload.event });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({ message: 'Already processed.' });
    }
    throw error;
  }

  const subEntity = payload.payload?.subscription?.entity;
  if (!subEntity) {
    return res.status(200).json({ message: 'No subscription entity — ignored.' });
  }

  const subscription = await Subscription.findOne({ razorpaySubscriptionId: subEntity.id });
  if (!subscription) {
    return res.status(200).json({ message: 'Unknown subscription — ignored.' });
  }

  switch (payload.event) {
    case 'subscription.activated':
    case 'subscription.charged':
      subscription.status = 'active';
      if (subEntity.current_start)
        subscription.currentStart = new Date(subEntity.current_start * 1000);
      if (subEntity.current_end) subscription.currentEnd = new Date(subEntity.current_end * 1000);
      await subscription.save();
      await User.updateOne({ _id: subscription.user }, { isPro: true });

      // Phase 12: best-effort receipt — webhook still acks 2xx even if this fails.
      User.findById(subscription.user)
        .select('name email')
        .then((user) => user && sendReceiptEmail(user, subscription))
        .catch(() => {});
      break;

    case 'subscription.pending':
      subscription.status = 'past_due';
      await subscription.save();
      break;

    case 'subscription.halted':
      subscription.status = 'halted';
      await subscription.save();
      await User.updateOne({ _id: subscription.user }, { isPro: false });
      break;

    case 'subscription.cancelled':
    case 'subscription.completed':
      subscription.status = payload.event === 'subscription.completed' ? 'completed' : 'cancelled';
      await subscription.save();
      await User.updateOne({ _id: subscription.user }, { isPro: false });
      break;

    default:
      // Forward-compatible: ack anything we don't specifically handle yet.
      break;
  }

  res.status(200).json({ received: true });
};

// @desc    Cancel Pro — stays active until the current billing cycle ends
// @route   POST /api/payments/cancel
// @access  Private
export const cancel = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.user._id,
      status: { $in: ['active', 'authenticated', 'past_due'] },
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found.' });
    }

    const razorpay = getRazorpay();
    await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, {
      cancel_at_cycle_end: 1,
    });

    subscription.cancelAtCycleEnd = true;
    await subscription.save();

    res.json({ message: 'Your subscription will end at the close of the current billing period.' });
  } catch (error) {
    console.error('cancel error:', error.message);
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: 'Could not cancel the subscription.' });
  }
};

// @desc    Current plan + renewal/cancellation date
// @route   GET /api/payments/status
// @access  Private
export const getStatus = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({
      isPro: req.user.isPro,
      subscription: subscription
        ? {
            status: subscription.status,
            currentEnd: subscription.currentEnd,
            cancelAtCycleEnd: subscription.cancelAtCycleEnd,
          }
        : null,
    });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};
