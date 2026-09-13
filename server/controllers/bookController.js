import { Parser as CsvParser } from 'json2csv'; // Phase 13
import Book from '../models/Book.js';
import Shelf from '../models/Shelf.js';
import Review from '../models/Review.js'; // Phase 13: pulled into export
import { logActivity } from './activityController.js'; // Phase 08
import { importRowSchema } from '../validators/bookSchemas.js'; // Phase 13

// Helper: normalize a string for loose title+author matching
const normalize = (str) => str.trim().toLowerCase().replace(/\s+/g, ' ');

// Phase 03/13: shared duplicate check — by ISBN if given, else normalized
// title+author — used by both addBook (single) and importBooks (bulk), so
// the two can never quietly define "duplicate" differently.
const findDuplicateBook = async (userId, { isbn, title, author }) => {
  if (isbn) {
    const byIsbn = await Book.findOne({ user: userId, isbn });
    if (byIsbn) return { book: byIsbn, matchedBy: 'isbn' };
  }

  const normalizedTitle = normalize(title);
  const normalizedAuthor = normalize(author);
  const byTitleAuthor = await Book.findOne({
    user: userId,
    $expr: {
      $and: [
        { $eq: [{ $toLower: { $trim: { input: '$title' } } }, normalizedTitle] },
        { $eq: [{ $toLower: { $trim: { input: '$author' } } }, normalizedAuthor] },
      ],
    },
  });
  if (byTitleAuthor) return { book: byTitleAuthor, matchedBy: 'titleAuthor' };

  return null;
};

// Escape regex special characters so a search term can't be (ab)used as a
// regex — e.g. author=".*" shouldn't match everything.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTABLE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'title',
  'author',
  'rating',
  'currentPage',
]);

// @desc    List the user's books — filterable, sortable, paginated
// @route   GET /api/books?q=&status=&genre=&author=&tag=&shelf=&minRating=&sortBy=&sortDir=&page=&limit=
// @access  Private
export const getBooks = async (req, res) => {
  try {
    const { q, status, genre, author, tag, shelf, minRating, sortDir } = req.query;
    const sortBy = SORTABLE_FIELDS.has(req.query.sortBy) ? req.query.sortBy : 'createdAt';

    const filter = { user: req.user.id };
    if (status) filter.status = status;
    if (genre) filter.genre = new RegExp(escapeRegex(genre), 'i');
    if (author) filter.author = new RegExp(escapeRegex(author), 'i');
    if (tag) filter.tags = tag;
    if (minRating) filter.rating = { $gte: Number(minRating) };

    // Filtering by shelf means looking the shelf up first — a shelf can hold
    // books across every reading status, so this is a separate id list, not
    // a field on Book itself.
    if (shelf) {
      const shelfDoc = await Shelf.findOne({ _id: shelf, user: req.user.id }).select('books');
      if (!shelfDoc) {
        return res.json({ books: [], page: 1, limit: 20, total: 0, totalPages: 1 });
      }
      filter._id = { $in: shelfDoc.books };
    }

    if (q) {
      filter.$text = { $search: q };
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Relevance-sort a text search unless the caller explicitly asked for a
    // different sort field; otherwise sort by the requested field.
    const sort =
      q && !req.query.sortBy
        ? { score: { $meta: 'textScore' } }
        : { [sortBy]: sortDir === 'asc' ? 1 : -1 };

    let query = Book.find(filter);
    if (q) query = query.select({ score: { $meta: 'textScore' } });

    const [books, total] = await Promise.all([
      query.sort(sort).skip(skip).limit(limit),
      Book.countDocuments(filter),
    ]);

    res.json({ books, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a new book
// @route   POST /api/books
// @access  Private
export const addBook = async (req, res) => {
  // req.body has already passed createBookSchema via the validate middleware
  const {
    title,
    author,
    genre,
    status,
    coverUrl,
    isbn,
    currentPage,
    totalPages,
    startDate,
    finishDate,
  } = req.body;

  try {
    // Phase 03: Duplicate detection (Phase 13: now the shared helper)
    const duplicate = await findDuplicateBook(req.user.id, { isbn, title, author });
    if (duplicate) {
      return res.status(409).json({
        message:
          duplicate.matchedBy === 'isbn'
            ? 'You already have this book in your library (matched by ISBN).'
            : 'You already have this book in your library (matched by title & author).',
        existingId: duplicate.book._id,
      });
    }

    const resolvedStatus = status || 'wantToRead';

    // Phase 07 fix: mirror updateBook's guarded auto-set — a book added
    // directly as 'reading'/'completed' (e.g. cataloging already-read books)
    // still needs a startDate/finishDate, or it silently never counts toward
    // goals or the analytics dashboard.
    const resolvedStartDate =
      startDate ||
      (resolvedStatus === 'reading' || resolvedStatus === 'completed' ? new Date() : null);
    const resolvedFinishDate = finishDate || (resolvedStatus === 'completed' ? new Date() : null);

    const book = new Book({
      title,
      author,
      genre,
      status: resolvedStatus,
      coverUrl: coverUrl || undefined, // Let the default apply if empty
      isbn: isbn || null,
      user: req.user.id, // Link to the logged-in user
      // Phase 04: progress fields
      currentPage: currentPage || 0,
      totalPages: totalPages || 0,
      startDate: resolvedStartDate,
      finishDate: resolvedFinishDate,
    });

    const createdBook = await book.save();
    res.status(201).json(createdBook);

    // Phase 08: fan out to friends' activity feeds. Fired after the response
    // is already sent — this is best-effort, not on the request's critical path.
    logActivity(req.user._id, 'book_added', createdBook);
    if (createdBook.status === 'completed') {
      logActivity(req.user._id, 'book_completed', createdBook);
    }
  } catch (error) {
    // Catch MongoDB duplicate key error on the isbn index (race condition safety)
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'You already have this book in your library.',
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a book
// @route   PUT /api/books/:id
// @access  Private
export const updateBook = async (req, res) => {
  const {
    title,
    author,
    genre,
    status,
    coverUrl,
    isbn,
    currentPage,
    totalPages,
    startDate,
    finishDate,
  } = req.body;

  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if the book belongs to the user
    if (book.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const wasCompleted = book.status === 'completed'; // Phase 08: detect the transition below

    book.title = title || book.title;
    book.author = author || book.author;
    book.genre = genre || book.genre;
    book.status = status || book.status;
    book.coverUrl = coverUrl || book.coverUrl;
    // Phase 03: Allow updating isbn (explicit null clears it)
    if (isbn !== undefined) {
      book.isbn = isbn || null;
    }
    // Phase 04: Allow updating progress fields
    if (currentPage !== undefined) book.currentPage = currentPage;
    if (totalPages !== undefined) book.totalPages = totalPages;
    if (startDate !== undefined) book.startDate = startDate || null;
    if (finishDate !== undefined) book.finishDate = finishDate || null;

    // Phase 04 fix: readingController's progress/session endpoints auto-set
    // startDate/finishDate on status transitions, but this endpoint — used by
    // the toggle button and the Edit form's status dropdown — didn't, so a
    // book could sit at "Reading" or "Completed" with no date ever recorded.
    // Mirror the same guarded (only-if-missing) behavior here.
    if (book.status === 'reading' && !book.startDate) {
      book.startDate = new Date();
    }
    if (book.status === 'completed' && !book.finishDate) {
      book.finishDate = new Date();
    }

    const updatedBook = await book.save();
    res.json(updatedBook);

    // Phase 08: only fire on the actual transition into 'completed', not on
    // every unrelated save of an already-completed book.
    if (!wasCompleted && updatedBook.status === 'completed') {
      logActivity(req.user._id, 'book_completed', updatedBook);
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Another book in your library already has this ISBN.',
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a book
// @route   DELETE /api/books/:id
// @access  Private
export const deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if the book belongs to the user
    if (book.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await book.deleteOne();
    res.json({ message: 'Book removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 13: IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

const toDateOnlyStr = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// @desc    Export the full library — books + reviews + shelf membership
// @route   GET /api/books/export?format=json|csv
// @access  Private
export const exportBooks = async (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';

  try {
    const books = await Book.find({ user: req.user.id }).sort({ createdAt: 1 }).lean();
    const bookIds = books.map((b) => b._id);

    const [reviews, shelves] = await Promise.all([
      Review.find({ user: req.user.id, book: { $in: bookIds } })
        .select('book text')
        .lean(),
      Shelf.find({ user: req.user.id }).select('name books').lean(),
    ]);

    const reviewByBook = new Map(reviews.map((r) => [String(r.book), r.text]));
    const shelvesByBook = new Map();
    for (const shelf of shelves) {
      for (const bookId of shelf.books) {
        const key = String(bookId);
        if (!shelvesByBook.has(key)) shelvesByBook.set(key, []);
        shelvesByBook.get(key).push(shelf.name);
      }
    }

    // This row shape intentionally mirrors importRowSchema (validators/bookSchemas.js)
    // so re-importing this exact export is a clean round-trip — see Phase 13 DoD.
    const rows = books.map((b) => ({
      title: b.title,
      author: b.author,
      genre: b.genre || '',
      status: b.status,
      isbn: b.isbn || '',
      currentPage: b.currentPage,
      totalPages: b.totalPages,
      startDate: toDateOnlyStr(b.startDate),
      finishDate: toDateOnlyStr(b.finishDate),
      rating: b.rating ?? '',
      isFavorite: b.isFavorite,
      tags: b.tags || [],
      review: reviewByBook.get(String(b._id)) || '',
      shelves: shelvesByBook.get(String(b._id)) || [],
    }));

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      // Arrays don't have a native CSV shape — flatten to a ';'-joined cell,
      // same convention on both ends (see the CSV import mapping client-side).
      const csvRows = rows.map((r) => ({
        ...r,
        tags: r.tags.join(';'),
        shelves: r.shelves.join(';'),
      }));
      const parser = new CsvParser({
        fields: [
          'title',
          'author',
          'genre',
          'status',
          'isbn',
          'currentPage',
          'totalPages',
          'startDate',
          'finishDate',
          'rating',
          'isFavorite',
          'tags',
          'review',
          'shelves',
        ],
      });
      const csv = parser.parse(csvRows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="library-export-${timestamp}.csv"`
      );
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="library-export-${timestamp}.json"`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk-import books (client-parsed CSV/JSON rows, already normalized
//          to our schema shape — see client/src/utils/importParsers.js)
// @route   POST /api/books/import
// @access  Private
export const importBooks = async (req, res) => {
  // req.body.rows only passed the loose route-level check (validate.js +
  // importBooksSchema — non-empty array, capped at 500). Each row is
  // validated here individually against importRowSchema so one malformed
  // row (a stray date format, an out-of-range rating) becomes a per-row
  // error instead of rejecting the whole batch before anything is saved.
  const { rows: rawRows } = req.body;
  const result = { added: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const parsed = importRowSchema.safeParse(rawRow);
    if (!parsed.success) {
      result.errors.push({
        row: i + 1,
        title: rawRow?.title,
        message: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
      continue;
    }
    const row = parsed.data;

    try {
      const duplicate = await findDuplicateBook(req.user.id, row);
      if (duplicate) {
        result.skipped++;
        continue;
      }

      const resolvedStatus = row.status || 'wantToRead';
      // Same guarded auto-set as addBook — a row imported straight as
      // 'reading'/'completed' still needs a date to count toward goals/analytics.
      const resolvedStartDate = row.startDate
        ? new Date(row.startDate)
        : resolvedStatus === 'reading' || resolvedStatus === 'completed'
          ? new Date()
          : null;
      const resolvedFinishDate = row.finishDate
        ? new Date(row.finishDate)
        : resolvedStatus === 'completed'
          ? new Date()
          : null;

      const book = await Book.create({
        title: row.title,
        author: row.author,
        genre: row.genre || 'N/A',
        status: resolvedStatus,
        isbn: row.isbn || null,
        user: req.user.id,
        currentPage: row.currentPage || 0,
        totalPages: row.totalPages || 0,
        startDate: resolvedStartDate,
        finishDate: resolvedFinishDate,
        rating: row.rating ?? null,
        isFavorite: row.isFavorite || false,
        tags: row.tags || [],
      });

      if (row.review) {
        await Review.create({ user: req.user.id, book: book._id, text: row.review });
      }

      result.added++;
    } catch (error) {
      result.errors.push({
        row: i + 1,
        title: row.title,
        message: error.code === 11000 ? 'Duplicate ISBN' : error.message,
      });
    }
  }

  // Phase 08: deliberately no logActivity call here — importing 50+ books at
  // once isn't a per-book "moment" worth fanning out to friends the way a
  // single manually-added book is, and there's no bulk-import event type.

  res.status(201).json(result);
};
