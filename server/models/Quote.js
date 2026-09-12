import mongoose from 'mongoose';

// Phase 05: a highlight/quote journal. Many per book, unlike Review/Note.
const quoteSchema = new mongoose.Schema(
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
      required: [true, 'Quote text is required'],
      trim: true,
      maxlength: 2000,
    },
    page: {
      type: Number,
      default: null,
      min: 1,
    },
  },
  { timestamps: true }
);

// Fast "quotes for this book, newest first" lookups
quoteSchema.index({ user: 1, book: 1, createdAt: -1 });

const Quote = mongoose.model('Quote', quoteSchema);
export default Quote;
