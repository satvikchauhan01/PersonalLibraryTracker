import Book from '../models/Book.js';

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
  // in bookRoutes.js.
  const { title, author, genre, status, coverUrl } = req.body;

  try {
    const book = new Book({
      title,
      author,
      genre,
      status,
      coverUrl: coverUrl || undefined, // Let the default apply if empty
      user: req.user.id, // Link to the logged-in user
    });

    const createdBook = await book.save();
    res.status(201).json(createdBook);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a book
// @route   PUT /api/books/:id
// @access  Private
export const updateBook = async (req, res) => {
  const { title, author, genre, status, coverUrl } = req.body;

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

    const updatedBook = await book.save();
    res.json(updatedBook);
  } catch (error) {
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
