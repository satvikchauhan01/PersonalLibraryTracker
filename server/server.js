import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import { initSocket } from './socket/index.js'; // Phase 08

// Import routes
import authRoutes from './routes/authRoutes.js';
import bookRoutes from './routes/bookRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import diaryRoutes from './routes/diaryRoutes.js';
import readingRoutes from './routes/readingRoutes.js'; // Phase 04
import organizationRoutes from './routes/organizationRoutes.js'; // Phase 05
import shelfRoutes from './routes/shelfRoutes.js'; // Phase 05
import quoteRoutes from './routes/quoteRoutes.js'; // Phase 05
import goalRoutes from './routes/goalRoutes.js'; // Phase 07
import analyticsRoutes from './routes/analyticsRoutes.js'; // Phase 07
import friendRoutes from './routes/friendRoutes.js'; // Phase 08
import activityRoutes from './routes/activityRoutes.js'; // Phase 08
import paymentRoutes from './routes/paymentRoutes.js'; // Phase 09
import { webhook } from './controllers/paymentController.js'; // Phase 09
import uploadRoutes from './routes/uploadRoutes.js'; // Phase 10
import notificationRoutes from './routes/notificationRoutes.js'; // Phase 11
import { startReminderJobs } from './jobs/reminderJobs.js'; // Phase 11
import { startEmailDigestJob } from './jobs/emailDigestJob.js'; // Phase 12
import errorHandler from './middleware/errorHandler.js'; // Phase 10

// Load env variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Needed on Render (behind a proxy) so req.ip / rate-limiting see the real client IP
app.set('trust proxy', 1);

const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser requests (curl, health checks) with no Origin header
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Origin',
      'X-Requested-With',
      'Accept',
      'x-diary-token',
    ],
  })
);
// Phase 09: Razorpay webhook signature verification needs the exact raw
// bytes of the request body, so this must be mounted BEFORE express.json()
// below — once that's consumed the body, the raw bytes are gone.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), webhook);

app.use(express.json()); // Body parser for JSON
app.use(cookieParser());

// Baseline rate limit across the whole API
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/external', apiRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api', readingRoutes); // Phase 04: progress, sessions, streak, calendar
app.use('/api', organizationRoutes); // Phase 05: rating, favorite, tags, review, notes
app.use('/api/shelves', shelfRoutes); // Phase 05
app.use('/api/quotes', quoteRoutes); // Phase 05
app.use('/api/goals', goalRoutes); // Phase 07
app.use('/api/analytics', analyticsRoutes); // Phase 07
app.use('/api/friends', friendRoutes); // Phase 08
app.use('/api/activity', activityRoutes); // Phase 08
app.use('/api/payments', paymentRoutes); // Phase 09 (webhook is mounted separately above)
app.use('/api/upload', uploadRoutes); // Phase 10
app.use('/api/notifications', notificationRoutes); // Phase 11

// Simple test route
app.get('/', (req, res) => {
  res.send('Personal Library API is running...');
});

// Phase 10: centralized error handler — must be the LAST app.use(), after
// every route. Express recognizes it as an error handler by its 4-argument
// signature (see middleware/errorHandler.js).
app.use(errorHandler);

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
