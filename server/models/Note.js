import mongoose from 'mongoose';

// Phase 05: private freeform scratchpad per book — page references, half-formed
// thoughts while reading. Distinct from Review, which is the structured opinion.
const noteSchema = new mongoose.Schema(
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

// One notes scratchpad per user per book — POST upserts
noteSchema.index({ user: 1, book: 1 }, { unique: true });

const Note = mongoose.model('Note', noteSchema);
export default Note;
