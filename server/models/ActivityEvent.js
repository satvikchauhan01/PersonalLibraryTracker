import mongoose from 'mongoose';

// Phase 08: one row per trackable action, fanned out live to the actor's
// friends via Socket.IO (see socket/index.js) and also queryable as a feed
// history (see controllers/activityController.js).
const activityEventSchema = new mongoose.Schema(
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
      enum: ['book_added', 'book_completed', 'book_rated', 'reading_streak'],
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      default: null,
    },
    // e.g. { rating: 4.5 } for book_rated, { streakDays: 30 } for reading_streak
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

activityEventSchema.index({ user: 1, createdAt: -1 });

const ActivityEvent = mongoose.model('ActivityEvent', activityEventSchema);
export default ActivityEvent;
