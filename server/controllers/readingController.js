import Book from '../models/Book.js';
import ReadingSession from '../models/ReadingSession.js';

// Helper: today as YYYY-MM-DD in local time
const getLocalDateStr = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayStr = () => getLocalDateStr();

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS UPDATE
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Update current page; auto-complete when currentPage >= totalPages
// @route   PATCH /api/books/:id/progress
// @access  Private
export const updateProgress = async (req, res) => {
  const { currentPage } = req.body;

  if (currentPage === undefined || typeof currentPage !== 'number' || currentPage < 0) {
    return res.status(400).json({ message: 'currentPage must be a non-negative number.' });
  }

  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found.' });
    if (book.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    // Set startDate when transitioning into 'reading' for the first time
    if (book.status === 'wantToRead' && !book.startDate) {
      book.startDate = new Date();
      book.status = 'reading';
    }

    book.currentPage = currentPage;

    // Auto-complete when at or past totalPages (and totalPages is set)
    if (book.totalPages > 0 && currentPage >= book.totalPages) {
      book.currentPage = book.totalPages;
      book.status = 'completed';
      if (!book.finishDate) {
        book.finishDate = new Date();
      }
    }

    const updated = await book.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Log a reading session for a book
// @route   POST /api/books/:id/sessions
// @access  Private
export const logSession = async (req, res) => {
  const { pagesRead, durationMinutes, note, currentPage, date } = req.body;

  if (!pagesRead || typeof pagesRead !== 'number' || pagesRead < 1) {
    return res.status(400).json({ message: 'pagesRead must be a positive number.' });
  }

  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found.' });
    if (book.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    const sessionDate = date || todayStr();

    const session = await ReadingSession.create({
      user: req.user.id,
      book: book._id,
      date: sessionDate,
      pagesRead,
      durationMinutes: durationMinutes || null,
      note: note || '',
    });

    // Optionally advance currentPage on the book
    if (currentPage !== undefined && typeof currentPage === 'number') {
      // Set startDate when starting for the first time
      if (book.status === 'wantToRead' && !book.startDate) {
        book.startDate = new Date();
        book.status = 'reading';
      }

      book.currentPage = currentPage;

      // Auto-complete
      if (book.totalPages > 0 && currentPage >= book.totalPages) {
        book.currentPage = book.totalPages;
        book.status = 'completed';
        if (!book.finishDate) {
          book.finishDate = new Date();
        }
      }

      await book.save();
    }

    res.status(201).json({ session, book });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all sessions for a book (most recent first)
// @route   GET /api/books/:id/sessions
// @access  Private
export const getSessions = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found.' });
    if (book.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    const sessions = await ReadingSession.find({ user: req.user.id, book: book._id }).sort({
      date: -1,
      createdAt: -1,
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STREAK
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Consecutive-day reading streak (mirrors diary streak algorithm)
// @route   GET /api/reading/streak
// @access  Private
export const getStreak = async (req, res) => {
  try {
    const sessions = await ReadingSession.find({ user: req.user.id }).select('date').lean();

    let streak = 0;
    let longestStreak = 0;
    let totalSessions = sessions.length;
    let totalPages = 0;

    // Also need total pages — fetch separately for calendar data re-use
    const allSessions = await ReadingSession.find({ user: req.user.id })
      .select('date pagesRead')
      .lean();
    totalPages = allSessions.reduce((sum, s) => sum + (s.pagesRead || 0), 0);

    if (sessions.length > 0) {
      // Build a Set of unique date strings
      const dateSet = new Set(sessions.map((s) => s.date));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let current = new Date(today);
      let counting = true;

      while (counting) {
        const ds = getLocalDateStr(current);
        if (dateSet.has(ds)) {
          streak++;
          current.setDate(current.getDate() - 1);
        } else {
          // Allow grace: if streak === 0 and today hasn't been logged yet, check yesterday
          if (streak === 0) {
            current.setDate(current.getDate() - 1);
            const yds = getLocalDateStr(current);
            if (dateSet.has(yds)) {
              streak++;
              current.setDate(current.getDate() - 1);
              continue;
            }
          }
          counting = false;
        }
      }

      // Compute longest streak across all dates
      const sortedDates = [...dateSet].sort();
      let tempStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    res.json({ streak, longestStreak, totalSessions, totalPages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR HEATMAP
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Heatmap data: date → total pages read (last 365 days)
// @route   GET /api/reading/calendar
// @access  Private
export const getCalendar = async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 365);
    const sinceStr = getLocalDateStr(since);

    const sessions = await ReadingSession.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: sinceStr },
        },
      },
      {
        $group: {
          _id: '$date',
          pages: { $sum: '$pagesRead' },
          sessions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Shape: { "2025-01-01": { pages: 42, sessions: 2 }, ... }
    const calendar = {};
    for (const s of sessions) {
      calendar[s._id] = { pages: s.pages, sessions: s.sessions };
    }

    res.json(calendar);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
