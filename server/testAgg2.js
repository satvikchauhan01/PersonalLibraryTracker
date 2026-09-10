import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ReadingSession from './models/ReadingSession.js';
import User from './models/User.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('connected');
  const user = await User.findOne();

  // check all sessions
  const allSessions = await ReadingSession.find({ user: user._id }).lean();
  console.log('all sessions:', allSessions);

  const sinceStr = '2025-01-01';

  const aggRes = await ReadingSession.aggregate([
    {
      $match: {
        user: user._id,
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
  console.log('agg count:', aggRes.length);
  console.log('agg results:', aggRes);
  process.exit();
});
