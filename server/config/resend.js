import { Resend } from 'resend';

// Lazily constructed, and — unlike getRazorpay()/Cloudinary's config, which
// throw or 503 because their whole request IS the feature — this returns
// null instead of throwing. Every email send here is a best-effort side
// effect (welcome note, receipt, digest) fired after the real response
// already went out; the app must keep working with Resend unconfigured.
let instance = null;

export const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  if (!instance) {
    instance = new Resend(process.env.RESEND_API_KEY);
  }
  return instance;
};
