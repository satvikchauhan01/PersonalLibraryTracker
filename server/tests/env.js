// Phase 14: runs before each test file's own imports (vitest `setupFiles`),
// so anything a test file imports — app.js, its route/controller chain —
// sees these env vars already set. Deliberately NOT reading server/.env:
// the suite must pass with zero real credentials, same as CI will run it.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
