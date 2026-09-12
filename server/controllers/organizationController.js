import Book from '../models/Book.js';
import Review from '../models/Review.js';
import Note from '../models/Note.js';

// Shared ownership check — returns the book or null after already responding.
const loadOwnedBook = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    res.status(404).json({ message: 'Book not found.' });
    return null;
  }
  if (book.user.toString() !== req.user.id) {
    res.status(401).json({ message: 'Not authorized.' });
    return null;
  }
  return book;
};

// ─────────────────────────────────────────────────────────────────────────────
// RATING
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Set or clear a book's star rating
// @route   PUT /api/books/:id/rating
// @access  Private
export const setRating = async (req, res) => {
  try {
    const book = await loadOwnedBook(req, res);
    if (!book) return;

    book.rating = req.body.rating;
    await book.save();
    res.json({ _id: book._id, rating: book.rating });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FAVORITE
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Toggle (or explicitly set) a book's favorite flag
// @route   PATCH /api/books/:id/favorite
// @access  Private
export const setFavorite = async (req, res) => {
  try {
    const book = await loadOwnedBook(req, res);
    if (!book) return;

    book.isFavorite = req.body.isFavorite !== undefined ? req.body.isFavorite : !book.isFavorite;
    await book.save();
    res.json({ _id: book._id, isFavorite: book.isFavorite });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TAGS
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Replace a book's tag list
// @route   PATCH /api/books/:id/tags
// @access  Private
export const setTags = async (req, res) => {
  try {
    const book = await loadOwnedBook(req, res);
    if (!book) return;

    // De-dupe case-insensitively while preserving the caller's casing on first use
    const seen = new Set();
    const tags = [];
    for (const tag of req.body.tags) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        tags.push(tag);
      }
    }

    book.tags = tags;
    await book.save();
    res.json({ _id: book._id, tags: book.tags });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Write or update the review for a book (upsert)
// @route   POST /api/books/:id/review
// @access  Private
export const saveReview = async (req, res) => {
  try {
    const book = await loadOwnedBook(req, res);
    if (!book) return;

    const review = await Review.findOneAndUpdate(
      { user: req.user.id, book: book._id },
      { $set: { text: req.body.text } },
      { upsert: true, new: true, runValidators: true }
    );
    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get the current user's review for a book
// @route   GET /api/books/:id/review
// @access  Private
export const getReview = async (req, res) => {
  try {
    const book = await loadOwnedBook(req, res);
    if (!book) return;

    const review = await Review.findOne({ user: req.user.id, book: book._id });
    if (!review) {
      return res.status(404).json({ message: 'No review yet for this book.' });
    }
    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete the current user's review for a book
// @route   DELETE /api/books/:id/review
// @access  Private
export const deleteReview = async (req, res) => {
  try {
    const book = await loadOwnedBook(req, res);
    if (!book) return;

    await Review.findOneAndDelete({ user: req.user.id, book: book._id });
    res.json({ message: 'Review removed.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTES (private scratchpad — distinct from Review)
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Write or update private notes for a book (upsert)
// @route   POST /api/books/:id/notes
// @access  Private
export const saveNote = async (req, res) => {
  try {
    const book = await loadOwnedBook(req, res);
    if (!book) return;

    const note = await Note.findOneAndUpdate(
      { user: req.user.id, book: book._id },
      { $set: { text: req.body.text } },
      { upsert: true, new: true, runValidators: true }
    );
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get the current user's private notes for a book
// @route   GET /api/books/:id/notes
// @access  Private
export const getNote = async (req, res) => {
  try {
    const book = await loadOwnedBook(req, res);
    if (!book) return;

    const note = await Note.findOne({ user: req.user.id, book: book._id });
    if (!note) {
      return res.status(404).json({ message: 'No notes yet for this book.' });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
