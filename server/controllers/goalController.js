import ReadingGoal from '../models/ReadingGoal.js';
import Book from '../models/Book.js';
import ReadingSession from '../models/ReadingSession.js';
import Sentry from '../config/sentry.js'; // Phase 17

// Turns a goal's year/period/month into a [start, end) window, both as real
// Dates (for Book.finishDate) and as 'YYYY-MM-DD' strings (for
// ReadingSession.date, which is stored as a string — see models/ReadingSession.js).
// Exported (Phase 11): jobs/reminderJobs.js reuses this + computeActual for
// its weekly goal-pace check, rather than re-deriving the same period math.
export const getPeriodBounds = (goal) => {
  const pad = (n) => String(n).padStart(2, '0');

  if (goal.period === 'yearly') {
    return {
      startDate: new Date(Date.UTC(goal.year, 0, 1)),
      endDate: new Date(Date.UTC(goal.year + 1, 0, 1)),
      startStr: `${goal.year}-01-01`,
      endStr: `${goal.year + 1}-01-01`,
    };
  }

  const nextMonth = goal.month === 12 ? 1 : goal.month + 1;
  const nextYear = goal.month === 12 ? goal.year + 1 : goal.year;
  return {
    startDate: new Date(Date.UTC(goal.year, goal.month - 1, 1)),
    endDate: new Date(Date.UTC(nextYear, nextMonth - 1, 1)),
    startStr: `${goal.year}-${pad(goal.month)}-01`,
    endStr: `${nextYear}-${pad(nextMonth)}-01`,
  };
};

export const computeActual = async (userId, goal) => {
  const { startDate, endDate, startStr, endStr } = getPeriodBounds(goal);

  if (goal.metric === 'books') {
    return Book.countDocuments({
      user: userId,
      status: 'completed',
      finishDate: { $gte: startDate, $lt: endDate },
    });
  }

  const [result] = await ReadingSession.aggregate([
    { $match: { user: userId, date: { $gte: startStr, $lt: endStr } } },
    { $group: { _id: null, total: { $sum: '$pagesRead' } } },
  ]);
  return result?.total || 0;
};

// @desc    List the current user's goals
// @route   GET /api/goals
// @access  Private
export const getGoals = async (req, res) => {
  try {
    const goals = await ReadingGoal.find({ user: req.user.id }).sort({ year: -1, month: 1 });
    res.json(goals);
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a goal
// @route   POST /api/goals
// @access  Private
export const createGoal = async (req, res) => {
  try {
    const { year, period, month, metric, target } = req.body;
    const goal = await ReadingGoal.create({
      user: req.user.id,
      year,
      period,
      month: period === 'monthly' ? month : null,
      metric,
      target,
    });
    res.status(201).json(goal);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You already have a goal for this period.' });
    }
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a goal's target
// @route   PUT /api/goals/:id
// @access  Private
export const updateGoal = async (req, res) => {
  try {
    const goal = await ReadingGoal.findById(req.params.id);
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    if (goal.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    if (req.body.target !== undefined) goal.target = req.body.target;
    await goal.save();
    res.json(goal);
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a goal
// @route   DELETE /api/goals/:id
// @access  Private
export const deleteGoal = async (req, res) => {
  try {
    const goal = await ReadingGoal.findById(req.params.id);
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    if (goal.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    await goal.deleteOne();
    res.json({ message: 'Goal removed.' });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// @desc    Actual vs. target for every active goal
// @route   GET /api/goals/progress
// @access  Private
export const getGoalsProgress = async (req, res) => {
  try {
    const goals = await ReadingGoal.find({ user: req.user.id }).sort({ year: -1, month: 1 });

    const progress = await Promise.all(
      goals.map(async (goal) => {
        const actual = await computeActual(req.user._id, goal);
        return {
          _id: goal._id,
          year: goal.year,
          period: goal.period,
          month: goal.month,
          metric: goal.metric,
          target: goal.target,
          actual,
          percent: Math.min(100, Math.round((actual / goal.target) * 100)),
        };
      })
    );

    res.json(progress);
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};
