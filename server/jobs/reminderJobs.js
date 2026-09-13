import cron from 'node-cron';
import Book from '../models/Book.js';
import ReadingSession from '../models/ReadingSession.js';
import ReadingGoal from '../models/ReadingGoal.js';
import Notification from '../models/Notification.js';
import { notifyUser } from '../services/notificationService.js';
import { getPeriodBounds, computeActual } from '../controllers/goalController.js';

// Mirrors readingController.js's getLocalDateStr — ReadingSession.date is
// stored as a local 'YYYY-MM-DD' string, not a Date, so "today" has to be
// computed the same way everywhere it's compared against that field.
const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysBetween = (from, to) => Math.floor((to - from) / (1000 * 60 * 60 * 24));

// ─────────────────────────────────────────────────────────────────────────────
// 1. Daily reading reminder — anyone with a book "in progress" who hasn't
//    logged a session yet today.
// ─────────────────────────────────────────────────────────────────────────────
export const runDailyReadingReminder = async () => {
  const today = todayStr();
  const userIds = await Book.distinct('user', { status: 'reading' });

  for (const userId of userIds) {
    try {
      const loggedToday = await ReadingSession.exists({ user: userId, date: today });
      if (loggedToday) continue;

      await notifyUser(
        userId,
        'reading_reminder',
        "You haven't logged any reading today — even a few pages keeps the streak alive."
      );
    } catch (error) {
      console.error(`runDailyReadingReminder: user ${userId} failed:`, error.message);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Continue-reading nudge — a book stuck at "reading" with no activity
//    (session or, failing that, its start date) in 5+ days. Rate-limited to
//    one nudge per book per 5-day window so it doesn't fire every single day.
// ─────────────────────────────────────────────────────────────────────────────
const STALE_AFTER_DAYS = 5;

export const runContinueReadingNudge = async () => {
  const books = await Book.find({ status: 'reading' }).select('user title startDate').lean();

  const now = new Date();

  for (const book of books) {
    try {
      const lastSession = await ReadingSession.findOne({ book: book._id })
        .sort({ date: -1 })
        .select('date')
        .lean();

      const lastActivity = lastSession ? new Date(lastSession.date) : book.startDate;
      if (!lastActivity) continue; // never started, nothing to nudge about yet

      const idleDays = daysBetween(lastActivity, now);
      if (idleDays < STALE_AFTER_DAYS) continue;

      const rateLimitSince = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
      const alreadyNudged = await Notification.exists({
        user: book.user,
        type: 'continue_reading',
        book: book._id,
        createdAt: { $gte: rateLimitSince },
      });
      if (alreadyNudged) continue;

      await notifyUser(
        book.user,
        'continue_reading',
        `You haven't touched "${book.title}" in ${idleDays} days — pick it back up?`,
        { book: book._id }
      );
    } catch (error) {
      console.error(`runContinueReadingNudge: book ${book._id} failed:`, error.message);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Weekly goal-pace check — for every goal active in the current period,
//    compare actual progress to where a linear pace would put you by now.
//    Reuses goalController's own period-math and actual-progress helpers so
//    this can never compute a different number than the Goals page shows.
// ─────────────────────────────────────────────────────────────────────────────
const PACE_THRESHOLD = 0.7; // behind if actual < 70% of the expected-by-now amount
const MIN_ELAPSED_FRACTION = 0.1; // don't nag in the goal's first few days

export const runWeeklyGoalPaceCheck = async () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const activeGoals = await ReadingGoal.find({
    $or: [
      { period: 'yearly', year: currentYear },
      { period: 'monthly', year: currentYear, month: currentMonth },
    ],
  });

  for (const goal of activeGoals) {
    try {
      const { startDate, endDate } = getPeriodBounds(goal);
      const elapsedFraction = Math.min(1, Math.max(0, (now - startDate) / (endDate - startDate)));
      if (elapsedFraction < MIN_ELAPSED_FRACTION) continue;

      const actual = await computeActual(goal.user, goal);
      const expectedByNow = goal.target * elapsedFraction;
      if (actual >= expectedByNow * PACE_THRESHOLD) continue; // on pace

      const percent = Math.round((actual / goal.target) * 100);
      const label =
        goal.period === 'yearly'
          ? `${goal.year}`
          : `${goal.year}-${String(goal.month).padStart(2, '0')}`;
      const unit = goal.metric === 'books' ? 'books' : 'pages';

      await notifyUser(
        goal.user,
        'goal_reminder',
        `You're behind pace on your ${label} goal: ${actual}/${goal.target} ${unit} (${percent}%).`,
        { metadata: { goalId: goal._id, percent } }
      );
    } catch (error) {
      console.error(`runWeeklyGoalPaceCheck: goal ${goal._id} failed:`, error.message);
    }
  }
};

// Schedules all three jobs. Called once from server.js at boot. Times are
// server-local (Render's containers run in UTC) — good enough for a
// single-timezone-audience side project; per-user timezone-aware scheduling
// is future scope, not something worth building for this app's scale.
export const startReminderJobs = () => {
  cron.schedule('0 20 * * *', () => {
    runDailyReadingReminder().catch((e) =>
      console.error('runDailyReadingReminder failed:', e.message)
    );
  });

  cron.schedule('0 10 * * *', () => {
    runContinueReadingNudge().catch((e) =>
      console.error('runContinueReadingNudge failed:', e.message)
    );
  });

  cron.schedule('0 9 * * 0', () => {
    runWeeklyGoalPaceCheck().catch((e) =>
      console.error('runWeeklyGoalPaceCheck failed:', e.message)
    );
  });

  console.log('Reminder jobs scheduled.');
};
