import Book from '../models/Book.js';

// Helper: normalize a string for loose title+author matching
const normalize = (str) => str.trim().toLowerCase().replace(/\s+/g, ' ');

// @desc    Get all books for a user
// @route   GET /api/books
// @access  Private
export const getBooks = async (req, res) => {
  try {
    // req.user.id comes from the authMiddleware
    const books = await Book.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a new book
// @route   POST /api/books
// @access  Private
export const addBook = async (req, res) => {
  // req.body has already passed createBookSchema via the validate middleware
  const { title, author, genre, status, coverUrl, isbn } = req.body;

  try {
    // Phase 03: Duplicate detection
    // 1. Check by ISBN first (if provided)
    if (isbn) {
      const byIsbn = await Book.findOne({ user: req.user.id, isbn });
      if (byIsbn) {
        return res.status(409).json({
          message: 'You already have this book in your library (matched by ISBN).',
          existingId: byIsbn._id,
        });
      }
    }

    // 2. Check by normalized title + author
    const normalizedTitle = normalize(title);
    const normalizedAuthor = normalize(author);
    const byTitleAuthor = await Book.findOne({
      user: req.user.id,
      $expr: {
        $and: [
          {
            $eq: [{ $toLower: { $trim: { input: '$title' } } }, normalizedTitle],
          },
          {
            $eq: [{ $toLower: { $trim: { input: '$author' } } }, normalizedAuthor],
          },
        ],
      },
    });

    if (byTitleAuthor) {
      return res.status(409).json({
        message: 'You already have this book in your library (matched by title & author).',
        existingId: byTitleAuthor._id,
      });
    }

    const book = new Book({
      title,
      author,
      genre,
      status,
      coverUrl: coverUrl || undefined, // Let the default apply if empty
      isbn: isbn || null,
      user: req.user.id, // Link to the logged-in user
    });

    const createdBook = await book.save();
    res.status(201).json(createdBook);
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
  const { title, author, genre, status, coverUrl, isbn } = req.body;

  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Check if the book belongs to the user
    if (book.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    book.title = title || book.title;
    book.author = author || book.author;
    book.genre = genre || book.genre;
    book.status = status || book.status;
    book.coverUrl = coverUrl || book.coverUrl;
    // Phase 03: Allow updating isbn (explicit null clears it)
    if (isbn !== undefined) {
      book.isbn = isbn || null;
    }

    const updatedBook = await book.save();
    res.json(updatedBook);
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
