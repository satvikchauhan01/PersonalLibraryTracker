// Phase 18: shared Gemini model constants + the same "is this integration
// configured" check pattern as resend.js/razorpay.js — apiController.js and
// diaryController.js already talk to Gemini directly (Phase 09/12) with
// their own inline fetch calls; this file doesn't touch those, it just
// gives the new Phase 18 AI features (aiService.js) one place to read the
// model name and the configured-check from, instead of repeating
// `process.env.GEMINI_API_KEY` string checks six more times.

// Matches the generation model already in use elsewhere in this codebase
// (apiController.js's getGeminiInsights, diaryController.js's getWritingPrompt)
// — kept identical rather than introduced as a second, different model.
export const GEMINI_GENERATION_MODEL = 'gemini-3.6-flash';

// A dedicated embedding model — generateContent models don't support
// embedContent. 768 dimensions (Gemini supports truncating from its native
// 3072) keeps a per-document embedding small enough to store directly on
// the Book/DiaryEntry doc without materially bloating it.
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;

export const isGeminiConfigured = () => !!process.env.GEMINI_API_KEY;
