import * as Sentry from '@sentry/node';

// Phase 17: same "gracefully degrade if unconfigured" shape as
// config/resend.js — Sentry.init() with no dsn just no-ops internally, but
// being explicit here means the rest of the app can check `isSentryEnabled`
// instead of guessing, and nothing else needs to know or care whether a
// real DSN is set.
export const isSentryEnabled = Boolean(process.env.SENTRY_DSN);

export const initSentry = () => {
  if (!isSentryEnabled) {
    console.warn('[sentry] SENTRY_DSN not set — error reporting disabled.');
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Keep this modest — it's request tracing volume, not error volume;
    // every error is still captured regardless of this sample rate.
    tracesSampleRate: 0.1,
  });
};

export default Sentry;
