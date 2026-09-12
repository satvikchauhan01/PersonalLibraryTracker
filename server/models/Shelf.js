import mongoose from 'mongoose';

// Phase 05: user-defined collections. A shelf can hold books regardless of
// their reading status (e.g. a "Re-read someday" shelf mixing completed and
// want-to-read books).
const shelfSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    name: {
      type: String,
      required: [true, 'Shelf name is required'],
      trim: true,
      maxlength: 60,
    },
    books: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
      default: [],
    },
  },
  { timestamps: true }
);

// A user can't have two shelves with the same name
shelfSchema.index({ user: 1, name: 1 }, { unique: true });

const Shelf = mongoose.model('Shelf', shelfSchema);
export default Shelf;
