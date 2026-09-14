import { z } from 'zod';

// Phase 04: extended status set (old values kept for migration compatibility)
const statusEnum = z.enum(['wantToRead', 'reading', 'completed', 'dnf', 'onHold']);

// ISO date string OR Date-coercible string
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional()
  .nullable();

// Phase 03: ISBN (10 or 13 digits, hyphens allowed on input).
// z.preprocess treats an empty string the same as "not provided" so a blank
// form field doesn't fail the regex below, and .transform() strips
// hyphens/spaces and upper-cases the checksum 'X' so the same ISBN always
// lands in the DB the same way — both for the unique index and for the
// duplicate-detection lookup in bookController.addBook.
const isbnSchema = z.preprocess(
  (val) => (val === '' ? null : val),
  z
    .string()
    .trim()
    .regex(/^[\d\-Xx]{10,17}$/, 'ISBN must be 10 or 13 digits')
    .transform((v) => v.replace(/[\s-]/g, '').toUpperCase())
    .optional()
    .nullable()
);

export const createBookSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).trim().min(1, 'Title is required'),
  author: z.string({ required_error: 'Author is required' }).trim().min(1, 'Author is required'),
  genre: z.string().trim().optional(),
  status: statusEnum.optional(),
  coverUrl: z.string().trim().optional(),
  isbn: isbnSchema,
  // Phase 04: reading progress
  currentPage: z.number().int().min(0).optional(),
  totalPages: z.number().int().min(0).optional(),
  startDate: dateString,
  finishDate: dateString,
  // Phase 18: optional blurb — richer input for the "similar books" embedding
  // and spoiler-light summary than title/author/genre alone.
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
});

export const updateBookSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
  author: z.string().trim().min(1, 'Author cannot be empty').optional(),
  genre: z.string().trim().optional(),
  status: statusEnum.optional(),
  coverUrl: z.string().trim().optional(),
  isbn: isbnSchema,
  // Phase 04: reading progress
  currentPage: z.number().int().min(0).optional(),
  totalPages: z.number().int().min(0).optional(),
  startDate: dateString,
  finishDate: dateString,
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
});

// Phase 13: one row of a bulk import. Deliberately more lenient than
// createBookSchema — rows come from a client-side CSV/JSON parse (Goodreads
// exports, or this app's own export) where numeric-looking fields can arrive
// as strings, and an out-of-range rating shouldn't fail the whole batch.
// Unknown keys (e.g. a re-imported export's `shelves`) are silently dropped
// — Zod object schemas strip them by default — so a round-trip never errors.
const importRating = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
  z.number().min(0).max(5).optional()
);
const importPageCount = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
  z.number().int().min(0).optional()
);

export const importRowSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).trim().min(1, 'Title is required'),
  author: z.string({ required_error: 'Author is required' }).trim().min(1, 'Author is required'),
  genre: z.string().trim().optional(),
  status: statusEnum.optional(),
  isbn: isbnSchema,
  currentPage: importPageCount,
  totalPages: importPageCount,
  startDate: dateString,
  finishDate: dateString,
  rating: importRating,
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string().trim()).optional(),
  review: z.string().trim().optional(),
});

// Deliberately loose at the route level — each row is validated
// individually inside importBooks instead, so one malformed row (a stray
// date format, say) doesn't reject an otherwise-good 200-row batch outright.
export const importBooksSchema = z.object({
  rows: z
    .array(z.record(z.unknown()))
    .min(1, 'No rows to import')
    .max(500, 'Import is capped at 500 rows at a time'),
});
