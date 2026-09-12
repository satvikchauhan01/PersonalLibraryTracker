import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import bookRoutes from './routes/bookRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import diaryRoutes from './routes/diaryRoutes.js';
import readingRoutes from './routes/readingRoutes.js'; // Phase 04
import organizationRoutes from './routes/organizationRoutes.js'; // Phase 05
import shelfRoutes from './routes/shelfRoutes.js'; // Phase 05
import quoteRoutes from './routes/quoteRoutes.js'; // Phase 05

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

// Simple test route
app.get('/', (req, res) => {
  res.send('Personal Library API is running...');
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
