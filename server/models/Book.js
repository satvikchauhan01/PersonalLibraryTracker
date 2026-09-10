import mongoose from 'mongoose';

const bookSchema = mongoose.Schema(
  {
    // Link to the user who owns this book
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    genre: {
      type: String,
      default: 'N/A',
    },
    // Phase 04: extended status enum. Legacy 'toRead'/'currentlyReading' values
    // were migrated by scripts/migratePhase04.js and are no longer accepted —
    // this now matches the Zod statusEnum in validators/bookSchemas.js exactly.
    status: {
      type: String,
      required: true,
      enum: ['wantToRead', 'reading', 'completed', 'dnf', 'onHold'],
      default: 'wantToRead',
    },
    coverUrl: {
      type: String,
      default: 'https://placehold.co/128x192/475569/ffffff?text=No+Cover',
    },
    // Phase 03: ISBN as a first-class identifier
    isbn: {
      type: String,
      trim: true,
      default: null,
    },
    // Phase 04: Reading progress fields
    currentPage: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPages: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    finishDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Phase 03: Sparse compound unique index — one user can't add the same ISBN twice,
// but different users can share ISBNs. sparse:true excludes null/missing isbn values.
bookSchema.index({ user: 1, isbn: 1 }, { unique: true, sparse: true });

// Text index on title + author for full-text search (used in Phase 06)
bookSchema.index({ title: 'text', author: 'text' });

const Book = mongoose.model('Book', bookSchema);
export default Book;
