import * as Sentry from '@sentry/react';

// Phase 17: same shape as the server's config/sentry.js — Sentry.init()
// with no dsn just no-ops internally, so nothing else here needs to branch
// on whether a real DSN is configured.
export const initSentry = () => {
  if (!process.env.REACT_APP_SENTRY_DSN) {
    console.warn('[sentry] REACT_APP_SENTRY_DSN not set — error reporting disabled.');
    return;
  }
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
};

export default Sentry;
