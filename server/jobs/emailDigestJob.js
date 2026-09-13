import cron from 'node-cron';
import User from '../models/User.js';
import Book from '../models/Book.js';
import ReadingSession from '../models/ReadingSession.js';
import { sendWeeklyDigestEmail } from '../services/emailService.js';

// Mirrors reminderJobs.js's date-string helper — ReadingSession.date is a
// local 'YYYY-MM-DD' string, not a Date, so range queries need this shape.
const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// @desc  Emails every emailDigestOptIn user a recap of the last 7 days.
// Skipped entirely for a user with nothing to report — an empty digest
// isn't worth an inbox notification.
export const runWeeklyDigest = async () => {
  const users = await User.find({ emailDigestOptIn: true }).select('name email');
  if (users.length === 0) return;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sinceStr = toDateStr(since);

  for (const user of users) {
    try {
      const [booksCompleted, sessions] = await Promise.all([
        Book.countDocuments({ user: user._id, status: 'completed', finishDate: { $gte: since } }),
        ReadingSession.find({ user: user._id, date: { $gte: sinceStr } })
          .select('pagesRead')
          .lean(),
      ]);

      const pagesRead = sessions.reduce((sum, s) => sum + (s.pagesRead || 0), 0);
      if (booksCompleted === 0 && pagesRead === 0) continue; // nothing to report

      await sendWeeklyDigestEmail(user, {
        booksCompleted,
        pagesRead,
        sessionCount: sessions.length,
      });
    } catch (error) {
      console.error(`runWeeklyDigest: user ${user._id} failed:`, error.message);
    }
  }
};

// Called once from server.js at boot, alongside startReminderJobs().
export const startEmailDigestJob = () => {
  // Monday 8am server time — a recap of the week that just ended.
  cron.schedule('0 8 * * 1', () => {
    runWeeklyDigest().catch((e) => console.error('runWeeklyDigest failed:', e.message));
  });
  console.log('Weekly email digest job scheduled.');
};
