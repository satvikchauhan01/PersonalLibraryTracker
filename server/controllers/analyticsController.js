import Sentry from '../config/sentry.js'; // Phase 17
import { buildOverviewData } from '../utils/analyticsAggregation.js'; // Phase 18: extracted for reuse

// @desc    Reading analytics: books/month, pages/month (for the given year,
//          default current year), plus all-time genre/author/rating splits
//          (scoped to completed books, so "genre split" means "what have I
//          actually read", not "what's sitting on my want-to-read shelf")
// @route   GET /api/analytics/overview?year=
// @access  Private
export const getOverview = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const overview = await buildOverviewData(req.user._id, year);
    res.json(overview);
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};
