import User from '../models/User.js';

const FREE_MONTHLY_AI_CALLS = 10;

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Phase 09/18: the actual quota check+consume, extracted so a route can call
// it conditionally instead of always as blanket middleware — Phase 18's
// cached AI summary endpoint (GET /api/ai/summary/:bookId) needs this: a
// cache hit should never cost the user a quota slot, only a real Gemini
// generation should. Returns { allowed, message? }; never throws.
export const consumeAiQuota = async (user) => {
  if (user.isPro) return { allowed: true };

  const month = currentMonthKey();
  const doc = await User.findById(user._id).select('aiCallCount aiCallMonth isPro');

  if (doc.aiCallMonth !== month) {
    doc.aiCallMonth = month;
    doc.aiCallCount = 0;
  }

  if (doc.aiCallCount >= FREE_MONTHLY_AI_CALLS) {
    return {
      allowed: false,
      message: `You've used all ${FREE_MONTHLY_AI_CALLS} free AI calls this month. Upgrade to Library Pro for unlimited access.`,
    };
  }

  doc.aiCallCount += 1;
  await doc.save();
  return { allowed: true };
};

// Phase 09: gates the Gemini-backed routes (book insights, diary writing
// prompt, and every Phase 18 AI route except the cached-summary one above).
// Pro users pass straight through; free users get FREE_MONTHLY_AI_CALLS/month,
// tracked on the User doc and reset the first time a call lands in a new
// month. Use *after* `protect`.
//
// Consumes the quota slot on attempt, not on a successful Gemini response —
// simple and race-free; the tradeoff is a failed upstream call still costs
// the user a slot, which is an acceptable simplification at this scale.
const checkAiQuota = async (req, res, next) => {
  try {
    const { allowed, message } = await consumeAiQuota(req.user);
    if (!allowed) {
      return res.status(402).json({ message, upgradeRequired: true });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default checkAiQuota;
