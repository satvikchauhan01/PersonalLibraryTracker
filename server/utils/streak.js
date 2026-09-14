// Phase 14: extracted out of readingController.js (unchanged logic) so the
// core streak algorithm is a pure, DB-free function — directly unit-testable
// without spinning up mongodb-memory-server, and still the single place
// readingController (getStreak + logSession's milestone check) and
// reminderJobs.js's future callers import from, so nothing can drift.

// Helper: a Date as YYYY-MM-DD in local time — matches how
// ReadingSession.date is stored (see models/ReadingSession.js).
export const getLocalDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Streak milestones worth a live activity-feed shout-out (Phase 08) and a
// personal streak-alert notification (Phase 11).
export const STREAK_MILESTONES = new Set([7, 30, 100]);

// Given the set of every date (as 'YYYY-MM-DD' strings) a user logged a
// reading session on, returns the current consecutive-day streak ending
// today. Allows exactly one day of grace: if nothing's logged yet today but
// yesterday continues an unbroken run, that run still counts — read as "I
// haven't logged today, but my streak isn't broken until midnight." Any
// other gap (a day with no session, encountered once the streak has already
// started counting) ends the streak right there.
export const computeCurrentStreak = (dateSet) => {
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
