import Book from '../models/Book.js';
import ReadingSession from '../models/ReadingSession.js';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Phase 18: extracted verbatim from analyticsController.getOverview (Phase
// 07) so the new GET /api/ai/habits endpoint can feed Gemini the exact same
// numbers the Dashboard chart shows, instead of re-deriving them — one
// source of truth for "what does this user's reading data say". Phase 07's
// route handler is now a thin wrapper around this (see analyticsController.js);
// this change is behavior-preserving, not a new aggregation.
export const buildOverviewData = async (userId, year) => {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const yearStartStr = `${year}-01-01`;
  const yearEndStr = `${year + 1}-01-01`;

  const [booksPerMonthRaw, pagesPerMonthRaw, genreRaw, authorRaw, ratingRaw] = await Promise.all([
    Book.aggregate([
      {
        $match: {
          user: userId,
          status: 'completed',
          finishDate: { $gte: yearStart, $lt: yearEnd },
        },
      },
      { $group: { _id: { $month: '$finishDate' }, count: { $sum: 1 } } },
    ]),
    ReadingSession.aggregate([
      { $match: { user: userId, date: { $gte: yearStartStr, $lt: yearEndStr } } },
      { $group: { _id: { $substrBytes: ['$date', 5, 2] }, total: { $sum: '$pagesRead' } } },
    ]),
    Book.aggregate([
      { $match: { user: userId, status: 'completed' } },
      { $group: { _id: { $ifNull: ['$genre', 'N/A'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Book.aggregate([
      { $match: { user: userId, status: 'completed' } },
      { $group: { _id: '$author', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Book.aggregate([
      { $match: { user: userId, rating: { $ne: null } } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const booksByMonth = new Map(booksPerMonthRaw.map((r) => [r._id, r.count]));
  const pagesByMonth = new Map(pagesPerMonthRaw.map((r) => [parseInt(r._id, 10), r.total]));

  const booksPerMonth = MONTH_NAMES.map((label, i) => ({
    month: label,
    count: booksByMonth.get(i + 1) || 0,
  }));
  const pagesPerMonth = MONTH_NAMES.map((label, i) => ({
    month: label,
    pages: pagesByMonth.get(i + 1) || 0,
  }));

  return {
    year,
    booksPerMonth,
    pagesPerMonth,
    genreBreakdown: genreRaw.map((g) => ({ genre: g._id, count: g.count })),
    authorBreakdown: authorRaw.map((a) => ({ author: a._id, count: a.count })),
    ratingDistribution: ratingRaw.map((r) => ({ rating: r._id, count: r.count })),
  };
};
