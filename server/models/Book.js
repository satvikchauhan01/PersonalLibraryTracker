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
    // Phase 05: Ratings & organization
    rating: {
      type: Number,
      default: null,
      min: 0,
      max: 5,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
    // Phase 18: AI stretch features. `description` is a cached blurb (best
    // effort — pulled in alongside the embedding, see aiController.js) used
    // as embedding input so "similar books" has more to go on than just
    // title/author/genre/tags. `embedding`/`embeddingUpdatedAt` are
    // select:false — 768 numbers per book is meaningless to the client and
    // would bloat every normal /api/books response for no reason.
    description: {
      type: String,
      default: null,
    },
    embedding: {
      type: [Number],
      default: undefined,
      select: false,
    },
    embeddingUpdatedAt: {
      type: Date,
      default: null,
      select: false,
    },
    aiSummary: {
      type: String,
      default: null,
    },
    aiSummaryGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Phase 03: compound unique index — one user can't add the same ISBN twice,
// but different users can share ISBNs.
//
// Phase 18 fix: this was `sparse: true`, which sounds like "skip books with
// no ISBN" but isn't — sparse only skips documents where the field is
// *missing*. addBook/updateBook/importBooks all explicitly set
// `isbn: isbn || null` (matching this schema's own `default: null`), so
// every book without an ISBN stored the field as present-with-value-null,
// which a sparse index DOES include. The result: a user's *second* book with
// no ISBN always 409'd as a false-positive duplicate — found live while
// seeding multiple no-ISBN books for Phase 18 testing (genuinely
// reproducible, unrelated to anything else Phase 18 touches). A partial
// index expressed directly on "isbn is a real string" is what "skip null
// ISBNs" actually requires. Existing databases built under the old
// definition need scripts/fixIsbnIndex.js run once — see that file.
bookSchema.index(
  { user: 1, isbn: 1 },
  { unique: true, partialFilterExpression: { isbn: { $type: 'string' } } }
);

// Text index on title + author for full-text search (used in Phase 06)
bookSchema.index({ title: 'text', author: 'text' });

const Book = mongoose.model('Book', bookSchema);
export default Book;
