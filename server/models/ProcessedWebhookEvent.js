import mongoose from 'mongoose';

// Phase 09: dedup log for Razorpay webhook deliveries. Razorpay retries a
// webhook if it doesn't get a 2xx quickly, so the same event can legitimately
// arrive more than once — this collection is the idempotency guard: a second
// delivery hits the unique index and is acked without reprocessing.
const processedWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    eventType: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Auto-purge after 90 days — plenty long enough to catch any realistic
// retry window, no need to keep this collection growing forever.
processedWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const ProcessedWebhookEvent = mongoose.model('ProcessedWebhookEvent', processedWebhookEventSchema);
export default ProcessedWebhookEvent;
