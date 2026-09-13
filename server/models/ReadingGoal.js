import mongoose from 'mongoose';

// Phase 07: yearly or monthly reading goals, tracked against completed
// books (metric: 'books') or logged reading sessions (metric: 'pages').
const readingGoalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
    },
    period: {
      type: String,
      required: true,
      enum: ['yearly', 'monthly'],
    },
    // Required when period === 'monthly' (1-12); null for a yearly goal
    month: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },
    metric: {
      type: String,
      required: true,
      enum: ['books', 'pages'],
    },
    target: {
      type: Number,
      required: [true, 'Target is required'],
      min: 1,
    },
  },
  { timestamps: true }
);

// A user can't have two goals for the same year/period/month/metric
readingGoalSchema.index({ user: 1, year: 1, period: 1, month: 1, metric: 1 }, { unique: true });

const ReadingGoal = mongoose.model('ReadingGoal', readingGoalSchema);
export default ReadingGoal;
