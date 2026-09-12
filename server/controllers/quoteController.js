import Quote from '../models/Quote.js';
import Book from '../models/Book.js';

// @desc    List the current user's quotes, newest first (optionally filtered by book)
// @route   GET /api/quotes?book=:bookId
// @access  Private
export const getQuotes = async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.book) filter.book = req.query.book;

    const quotes = await Quote.find(filter).sort({ createdAt: -1 });
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a quote/highlight
// @route   POST /api/quotes
// @access  Private
export const createQuote = async (req, res) => {
  try {
    const { book: bookId, text, page } = req.body;

    const book = await Book.findById(bookId);
    if (!book || book.user.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Book not found.' });
    }

    const quote = await Quote.create({
      user: req.user.id,
      book: bookId,
      text,
      page: page ?? null,
    });
    res.status(201).json(quote);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Edit a quote
// @route   PUT /api/quotes/:id
// @access  Private
export const updateQuote = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found.' });
    if (quote.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    if (req.body.text !== undefined) quote.text = req.body.text;
    if (req.body.page !== undefined) quote.page = req.body.page;

    await quote.save();
    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a quote
// @route   DELETE /api/quotes/:id
// @access  Private
export const deleteQuote = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found.' });
    if (quote.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    await quote.deleteOne();
    res.json({ message: 'Quote removed.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
