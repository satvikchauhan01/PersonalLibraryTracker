import Shelf from '../models/Shelf.js';
import Book from '../models/Book.js';

// @desc    List the current user's shelves (with book count)
// @route   GET /api/shelves
// @access  Private
export const getShelves = async (req, res) => {
  try {
    const shelves = await Shelf.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(shelves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get one shelf with its books populated
// @route   GET /api/shelves/:id
// @access  Private
export const getShelf = async (req, res) => {
  try {
    const shelf = await Shelf.findById(req.params.id).populate('books');
    if (!shelf) return res.status(404).json({ message: 'Shelf not found.' });
    if (shelf.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }
    res.json(shelf);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a shelf
// @route   POST /api/shelves
// @access  Private
export const createShelf = async (req, res) => {
  try {
    const shelf = await Shelf.create({ user: req.user.id, name: req.body.name });
    res.status(201).json(shelf);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You already have a shelf with this name.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Rename a shelf
// @route   PUT /api/shelves/:id
// @access  Private
export const renameShelf = async (req, res) => {
  try {
    const shelf = await Shelf.findById(req.params.id);
    if (!shelf) return res.status(404).json({ message: 'Shelf not found.' });
    if (shelf.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    if (req.body.name !== undefined) shelf.name = req.body.name;
    await shelf.save();
    res.json(shelf);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You already have a shelf with this name.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a shelf (does not delete the books on it)
// @route   DELETE /api/shelves/:id
// @access  Private
export const deleteShelf = async (req, res) => {
  try {
    const shelf = await Shelf.findById(req.params.id);
    if (!shelf) return res.status(404).json({ message: 'Shelf not found.' });
    if (shelf.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    await shelf.deleteOne();
    res.json({ message: 'Shelf removed.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a book to a shelf
// @route   POST /api/shelves/:id/books/:bookId
// @access  Private
export const addBookToShelf = async (req, res) => {
  try {
    const shelf = await Shelf.findById(req.params.id);
    if (!shelf) return res.status(404).json({ message: 'Shelf not found.' });
    if (shelf.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    const book = await Book.findById(req.params.bookId);
    if (!book || book.user.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    const alreadyOnShelf = shelf.books.some((b) => b.toString() === book._id.toString());
    if (!alreadyOnShelf) {
      shelf.books.push(book._id);
      await shelf.save();
    }

    res.json(shelf);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove a book from a shelf
// @route   DELETE /api/shelves/:id/books/:bookId
// @access  Private
export const removeBookFromShelf = async (req, res) => {
  try {
    const shelf = await Shelf.findById(req.params.id);
    if (!shelf) return res.status(404).json({ message: 'Shelf not found.' });
    if (shelf.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    shelf.books = shelf.books.filter((b) => b.toString() !== req.params.bookId);
    await shelf.save();
    res.json(shelf);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
