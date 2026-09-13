import mongoose from 'mongoose';

// Phase 11: a persisted, per-user notification — unlike the Phase 08
// ActivityEvent (which fans out to *friends*), these are always about the
// owning user themselves (reminders, nudges, milestone shout-outs) and need
// to survive until the user is next online to see them, not just fire a
// live socket event that's lost if nobody's connected.
const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['reading_reminder', 'goal_reminder', 'continue_reading', 'streak_milestone'],
    },
    message: {
      type: String,
      required: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      default: null,
    },
    // e.g. { streakDays: 30 } for streak_milestone, { goalId, percent } for goal_reminder
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
