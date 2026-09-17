import { getResend } from '../config/resend.js';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Library Nest <onboarding@resend.dev>';

// First entry of the (possibly comma-separated) CLIENT_URL allowlist — see
// server.js's `allowedOrigins` for the same split. Good enough for building
// links into emails; a multi-origin deployment's primary origin goes first.
const clientOrigin = () => (process.env.CLIENT_URL || '').split(',')[0].trim();

const wrapper = (bodyHtml) => `
  <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
    <div style="background: linear-gradient(to right, #4f46e5, #7c3aed); padding: 24px 28px; border-radius: 12px 12px 0 0;">
      <h1 style="color: #fff; font-size: 20px; margin: 0;">📚 Library Nest</h1>
    </div>
    <div style="background: #fff; padding: 28px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
      ${bodyHtml}
    </div>
    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
      Library Nest — your personal reading tracker.
    </p>
  </div>
`;

// Every send funnels through here. Never throws — a failed/unconfigured
// email should never take down whatever request or cron job triggered it.
const sendEmail = async ({ to, subject, html }) => {
  const resend = getResend();
  if (!resend) {
    console.warn(
      `[email] Resend not configured (RESEND_API_KEY missing) — skipped "${subject}" to ${to}`
    );
    return null;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: wrapper(html),
    });

    if (error) {
      console.error(
        `[email] Resend API error sending "${subject}" to ${to}:`,
        error.message || error
      );
      return null;
    }

    console.log(`[email] Sent "${subject}" to ${to} (id: ${data?.id})`);
    return data;
  } catch (error) {
    console.error('[email] send failed:', error.message);
    return null;
  }
};

export const sendWelcomeEmail = (user) =>
  sendEmail({
    to: user.email,
    subject: 'Welcome to Library Nest 📚',
    html: `
      <p>Hi ${user.name},</p>
      <p>Welcome to Library Nest! Your reading tracker is ready — add your first book, log a
      session, and your streak starts today.</p>
      <p style="margin-top: 24px;">
        <a href="${clientOrigin()}" style="background:#4f46e5; color:#fff; padding:10px 20px; border-radius:9999px; text-decoration:none; font-weight:600;">
          Open Library Nest
        </a>
      </p>
    `,
  });

// Phase 12: the reset link points at the client's own /reset-password/:token
// route (client/src/pages/ResetPassword.jsx), not an API endpoint directly —
// the page collects the new password, then calls the API itself.
export const sendPasswordResetEmail = (user, rawToken) => {
  const resetUrl = `${clientOrigin()}/reset-password/${rawToken}`;

  // No real inbox to check against without a configured Resend account —
  // logging the link in dev lets the full flow be tested via curl/browser.
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[email:dev] Password reset link for ${user.email}: ${resetUrl}`);
  }

  return sendEmail({
    to: user.email,
    subject: 'Reset your Library Nest password',
    html: `
      <p>Hi ${user.name},</p>
      <p>We received a request to reset your password. This link is valid for 30 minutes and can
      only be used once.</p>
      <p style="margin-top: 24px;">
        <a href="${resetUrl}" style="background:#4f46e5; color:#fff; padding:10px 20px; border-radius:9999px; text-decoration:none; font-weight:600;">
          Reset Password
        </a>
      </p>
      <p style="color:#9ca3af; font-size: 13px; margin-top: 24px;">
        Didn't request this? You can safely ignore this email — your password won't change.
      </p>
    `,
  });
};

export const sendReceiptEmail = (user, subscription) =>
  sendEmail({
    to: user.email,
    subject: 'Your Library Pro receipt',
    html: `
      <p>Hi ${user.name},</p>
      <p>Thanks for subscribing to <strong>Library Pro</strong> — your payment went through.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:6px 0; color:#6b7280;">Plan</td><td style="padding:6px 0; text-align:right;">Library Pro — ₹99/month</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Status</td><td style="padding:6px 0; text-align:right; text-transform:capitalize;">${subscription.status}</td></tr>
        ${
          subscription.currentEnd
            ? `<tr><td style="padding:6px 0; color:#6b7280;">Renews</td><td style="padding:6px 0; text-align:right;">${new Date(subscription.currentEnd).toLocaleDateString('en-IN')}</td></tr>`
            : ''
        }
      </table>
      <p>Manage your subscription any time from the Billing page.</p>
    `,
  });

export const sendWeeklyDigestEmail = (user, stats) =>
  sendEmail({
    to: user.email,
    subject: 'Your week in reading 📖',
    html: `
      <p>Hi ${user.name},</p>
      <p>Here's your reading recap for the past 7 days:</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:6px 0; color:#6b7280;">Books completed</td><td style="padding:6px 0; text-align:right; font-weight:600;">${stats.booksCompleted}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Pages read</td><td style="padding:6px 0; text-align:right; font-weight:600;">${stats.pagesRead}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Reading sessions logged</td><td style="padding:6px 0; text-align:right; font-weight:600;">${stats.sessionCount}</td></tr>
      </table>
      <p style="margin-top: 24px;">
        <a href="${clientOrigin()}/dashboard" style="background:#4f46e5; color:#fff; padding:10px 20px; border-radius:9999px; text-decoration:none; font-weight:600;">
          View Full Dashboard
        </a>
      </p>
      <p style="color:#9ca3af; font-size: 13px; margin-top: 24px;">
        You're getting this because you opted into weekly digests — turn it off any time from your Profile page.
      </p>
    `,
  });
