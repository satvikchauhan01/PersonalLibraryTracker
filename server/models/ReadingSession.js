import mongoose from 'mongoose';

const readingSessionSchema = new mongoose.Schema(
  {
    // Phase 04: Reading Session model
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Book',
    },
    // YYYY-MM-DD string for easy date-set lookups (same pattern as DiaryEntry)
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    pagesRead: {
      type: Number,
      required: true,
      min: 1,
    },
    durationMinutes: {
      type: Number,
      default: null,
      min: 1,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for fast streak/calendar aggregations: all sessions for a user by date
readingSessionSchema.index({ user: 1, date: 1 });
// Index for per-book session history
readingSessionSchema.index({ user: 1, book: 1, date: -1 });

const ReadingSession = mongoose.model('ReadingSession', readingSessionSchema);
export default ReadingSession;
