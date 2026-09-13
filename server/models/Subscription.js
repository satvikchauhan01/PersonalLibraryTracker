import mongoose from 'mongoose';

// Phase 09: one row per Razorpay subscription attempt/lifecycle. `status`
// mirrors Razorpay's own subscription states exactly, so a webhook payload's
// `payload.subscription.entity.status` can be written straight through.
const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    razorpaySubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayPlanId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['created', 'authenticated', 'active', 'past_due', 'halted', 'cancelled', 'completed'],
      default: 'created',
    },
    currentStart: {
      type: Date,
      default: null,
    },
    currentEnd: {
      type: Date,
      default: null,
    },
    // Set when the user calls /cancel — Razorpay keeps the subscription
    // active until the cycle actually ends, then sends the webhook that
    // flips `status` to 'cancelled' for real. This flag lets the UI say
    // "cancels on {currentEnd}" in the meantime.
    cancelAtCycleEnd: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
