import mongoose from 'mongoose';

// Phase 05: one structured, book-tied opinion per user per book — distinct
// from Note, which is a private freeform scratchpad (see models/Note.js).
const reviewSchema = new mongoose.Schema(
  {
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
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
  },
  { timestamps: true }
);

// One review per user per book — POST upserts rather than duplicating
reviewSchema.index({ user: 1, book: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
