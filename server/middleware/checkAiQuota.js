import User from '../models/User.js';

const FREE_MONTHLY_AI_CALLS = 10;

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Phase 09: gates the Gemini-backed routes (book insights, diary writing
// prompt). Pro users pass straight through; free users get
// FREE_MONTHLY_AI_CALLS/month, tracked on the User doc and reset the first
// time a call lands in a new month. Use *after* `protect`.
//
// Consumes the quota slot on attempt, not on a successful Gemini response —
// simple and race-free; the tradeoff is a failed upstream call still costs
// the user a slot, which is an acceptable simplification at this scale.
const checkAiQuota = async (req, res, next) => {
  if (req.user.isPro) return next();

  try {
    const month = currentMonthKey();
    const user = await User.findById(req.user._id).select('aiCallCount aiCallMonth isPro');

    if (user.aiCallMonth !== month) {
      user.aiCallMonth = month;
      user.aiCallCount = 0;
    }

    if (user.aiCallCount >= FREE_MONTHLY_AI_CALLS) {
      return res.status(402).json({
        message: `You've used all ${FREE_MONTHLY_AI_CALLS} free AI calls this month. Upgrade to Library Pro for unlimited access.`,
        upgradeRequired: true,
      });
    }

    user.aiCallCount += 1;
    await user.save();
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default checkAiQuota;
