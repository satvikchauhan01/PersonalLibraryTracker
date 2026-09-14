import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express'; // Phase 15
import swaggerSpec from './config/swagger.js'; // Phase 15
import Sentry, { initSentry } from './config/sentry.js'; // Phase 17

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
import aiRoutes from './routes/aiRoutes.js'; // Phase 18
import errorHandler from './middleware/errorHandler.js'; // Phase 10

// Phase 14: pure Express app construction, split out of server.js so the
// test suite can `import app from './app.js'` and drive it with supertest
// directly — no real port, no connectDB(), no Socket.IO, no cron jobs. Those
// side effects stay in server.js, which is the only file that actually calls
// dotenv.config()/connectDB()/listen() — this module just reads
// process.env values already set by whatever imported it (server.js in prod/dev,
// tests/setup.js in the test suite).
// Phase 17: as early as possible in this module — by the time anything
// below could throw, Sentry is already either capturing or (no SENTRY_DSN)
// cleanly no-op. Safe to read process.env.SENTRY_DSN here specifically
// because server.js's very first import is `dotenv/config` (see the
// comment there) — this module's own top-level code, app.js included,
// never runs before that has already populated process.env.
initSentry();

const app = express();

// Needed on Render (behind a proxy) so req.ip / rate-limiting see the real client IP
app.set('trust proxy', 1);

const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Phase 15: mounted BEFORE helmet() — swagger-ui-express's page ships inline
// <script>/<style>, which helmet's default Content-Security-Policy would
// block outright. Registering it first means, for /api/docs/* requests,
// this middleware responds before the request ever reaches helmet — so the
// docs page renders correctly without loosening CSP for the actual API.
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
    skip: () => process.env.NODE_ENV === 'test', // Phase 14: unmetered in the test suite
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
app.use('/api/ai', aiRoutes); // Phase 18

// Simple test route
app.get('/', (req, res) => {
  res.send('Personal Library API is running...');
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Liveness/readiness check — verifies the live Mongo connection, not just process uptime
 *     tags: [External]
 *     security: []
 *     responses:
 *       200:
 *         description: API up, Mongo connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { status: { type: string }, mongo: { type: string } }
 *       503:
 *         description: Mongo not connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { status: { type: string }, mongo: { type: string } }
 */
// Phase 17: note this is at the app root (/health), not under /api — a load
// balancer/uptime monitor hitting this shouldn't have to know the API
// prefix, and it deliberately sits outside the /api rate limiter above.
app.get('/health', (req, res) => {
  // readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
  const mongoConnected = mongoose.connection.readyState === 1;
  res
    .status(mongoConnected ? 200 : 503)
    .json({
      status: mongoConnected ? 'ok' : 'degraded',
      mongo: mongoConnected ? 'connected' : 'disconnected',
    });
});

// Phase 17: registered after every route but before our own errorHandler —
// captures anything that reaches Express's error-handling chain (a
// synchronous throw inside a route handler, or an explicit next(err)) with
// a full stack trace, then calls next(err) itself so errorHandler below
// still sends the actual JSON response. No-ops cleanly if SENTRY_DSN isn't set.
Sentry.setupExpressErrorHandler(app);

// Phase 10: centralized error handler — must be the LAST app.use(), after
// every route (and after Sentry's error handler above). Express recognizes
// it as an error handler by its 4-argument signature (see middleware/errorHandler.js).
app.use(errorHandler);

export { allowedOrigins };
export default app;
