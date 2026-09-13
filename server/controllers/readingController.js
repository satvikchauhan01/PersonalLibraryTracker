import Book from '../models/Book.js';
import ReadingSession from '../models/ReadingSession.js';
import { logActivity } from './activityController.js'; // Phase 08
import { notifyUser } from '../services/notificationService.js'; // Phase 11

// Helper: today as YYYY-MM-DD in local time
const getLocalDateStr = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayStr = () => getLocalDateStr();

// Phase 08: streak milestones worth a live activity-feed shout-out.
// Phase 11 reuses this same threshold set for the personal streak-alert
// notification below, so the two can never quietly drift apart.
const STREAK_MILESTONES = new Set([7, 30, 100]);

// Shared by getStreak and logSession's milestone check — same algorithm,
// one place, so the two never quietly drift apart.
const computeCurrentStreak = (dateSet) => {
  let streak = 0;
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
  return streak;
};

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

    const wasCompleted = book.status === 'completed'; // Phase 08: detect the transition below

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

    if (!wasCompleted && updated.status === 'completed') {
      logActivity(req.user._id, 'book_completed', updated);
    }
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
      const wasCompleted = book.status === 'completed'; // Phase 08: detect the transition below

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

      if (!wasCompleted && book.status === 'completed') {
        logActivity(req.user._id, 'book_completed', book);
      }
    }

    res.status(201).json({ session, book });

    // Phase 08: streak-milestone shout-out — same algorithm getStreak uses,
    // run here too so a fresh log can react to it right away instead of
    // waiting for the next time someone loads the streak widget.
    ReadingSession.find({ user: req.user.id })
      .select('date')
      .lean()
      .then((allSessions) => {
        const streak = computeCurrentStreak(new Set(allSessions.map((s) => s.date)));
        if (STREAK_MILESTONES.has(streak)) {
          logActivity(req.user._id, 'reading_streak', null, { streakDays: streak });
          // Phase 11: a personal notification too, not just the friends
          // activity feed — this is the one thing STREAK_MILESTONES gates
          // that's actually about the reader themselves.
          notifyUser(
            req.user._id,
            'streak_milestone',
            `🔥 ${streak}-day reading streak! Keep it going.`,
            { metadata: { streakDays: streak } }
          );
        }
      })
      .catch(() => {});
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
    const sessions = await ReadingSession.find({ user: req.user.id })
      .select('date pagesRead')
      .lean();

    let streak = 0;
    let longestStreak = 0;
    const totalSessions = sessions.length;
    const totalPages = sessions.reduce((sum, s) => sum + (s.pagesRead || 0), 0);

    if (sessions.length > 0) {
      // Build a Set of unique date strings
      const dateSet = new Set(sessions.map((s) => s.date));
      streak = computeCurrentStreak(dateSet);

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
