// Phase 14 fix: must be the very first import. ESM evaluates a module's own
// imports, in order, before its body runs — so with `dotenv` imported
// further down (as this file used to), every module in between (routes →
// controllers → config/cloudinary.js, which reads process.env.CLOUDINARY_*
// at its own top level, not lazily) would already have finished evaluating,
// against still-undefined env vars, by the time dotenv.config() finally ran.
// `dotenv/config` has no imports of its own, so writing it first guarantees
// it runs — and populates process.env — before any subsequent import's
// module graph is evaluated at all.
import 'dotenv/config';
import http from 'http';
import connectDB from './config/db.js';
import { initSocket } from './socket/index.js'; // Phase 08
import { startReminderJobs } from './jobs/reminderJobs.js'; // Phase 11
import { startEmailDigestJob } from './jobs/emailDigestJob.js'; // Phase 12
import app, { allowedOrigins } from './app.js'; // Phase 14: app construction lives there now

// Connect to database
connectDB();

const PORT = process.env.PORT || 5001;

// Phase 08: Socket.IO needs a raw http.Server to attach to, so app.listen()
// (which creates one implicitly) becomes an explicit createServer + listen.
const httpServer = http.createServer(app);
initSocket(httpServer, allowedOrigins);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  startReminderJobs(); // Phase 11
  startEmailDigestJob(); // Phase 12
});
