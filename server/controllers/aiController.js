import Book from '../models/Book.js';
import DiaryEntry from '../models/DiaryEntry.js';
import Sentry from '../config/sentry.js'; // Phase 17
import { isGeminiConfigured } from '../config/gemini.js';
import { embedText, generateText, generateJson } from '../services/aiService.js';
import { rankBySimilarity } from '../utils/similarity.js';
import { buildOverviewData } from '../utils/analyticsAggregation.js';
import { consumeAiQuota } from '../middleware/checkAiQuota.js';

// Phase 18: AI stretch features. Every handler here starts with the same
// "is Gemini even configured" check and 503s cleanly if not — same
// graceful-degradation shape as diaryController.getWritingPrompt, and the
// reason the test suite (which never sets GEMINI_API_KEY) can exercise these
// routes for real instead of needing to mock the network.

const NOT_CONFIGURED = { message: 'AI features are not configured on this server yet.' };

// ─────────────────────────────────────────────────────────────────────────────
// Embedding helpers (shared by getSimilarBooks / askDiary)
// ─────────────────────────────────────────────────────────────────────────────

const buildBookEmbeddingText = (book) => {
  const parts = [`${book.title} by ${book.author}.`];
  if (book.genre && book.genre !== 'N/A') parts.push(`Genre: ${book.genre}.`);
  if (book.tags?.length) parts.push(`Tags: ${book.tags.join(', ')}.`);
  if (book.description) parts.push(book.description);
  return parts.join(' ');
};

// Embeds+persists a book's embedding if it doesn't have one yet. Returns the
// embedding array, or null if embedding failed/is unavailable. Caller must
// have queried the book with `.select('+embedding')`.
const ensureBookEmbedding = async (book) => {
  if (book.embedding?.length) return book.embedding;
  const embedding = await embedText(buildBookEmbeddingText(book));
  if (!embedding) return null;
  book.embedding = embedding;
  book.embeddingUpdatedAt = new Date();
  await book.save();
  return embedding;
};

// A single request only backfills up to this many missing embeddings — a
// large library still works, it just gets fully indexed over a few requests
// instead of one request firing dozens of Gemini calls.
const MAX_BACKFILL_PER_REQUEST = 20;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/books/:id/similar — cosine similarity over Gemini embeddings,
// computed application-side (see librarytrackerroadmap.md's "Atlas Vector
// Search" framing — this project's Mongo isn't guaranteed to be an Atlas
// cluster with a vector index provisioned, and provisioning one is a manual
// Atlas UI step outside this codebase; ranking in-process over a personal
// library's book count, typically tens not millions, is the pragmatic
// equivalent and needs no extra infrastructure to work today).
// ─────────────────────────────────────────────────────────────────────────────
export const getSimilarBooks = async (req, res) => {
  try {
    // Resource existence/ownership is checked before the AI-configured check
    // (same order as getBookSummary below) — a request for a book that
    // doesn't exist, or isn't yours, should 404/401 regardless of whether
    // this server happens to have a Gemini key configured.
    const book = await Book.findById(req.params.id).select('+embedding');
    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (book.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (!isGeminiConfigured()) return res.status(503).json(NOT_CONFIGURED);

    const targetEmbedding = await ensureBookEmbedding(book);
    if (!targetEmbedding) {
      return res.status(503).json({ message: 'Could not analyze this book right now.' });
    }

    const candidates = await Book.find({ user: req.user.id, _id: { $ne: book._id } }).select(
      '+embedding'
    );

    let backfilled = 0;
    for (const candidate of candidates) {
      if (candidate.embedding?.length) continue;
      if (backfilled >= MAX_BACKFILL_PER_REQUEST) break;
      await ensureBookEmbedding(candidate);
      backfilled++;
    }

    const ranked = rankBySimilarity(candidates, targetEmbedding, { limit: 5 });

    res.json({
      book: { _id: book._id, title: book.title, author: book.author },
      similar: ranked.map(({ item, score }) => ({
        _id: item._id,
        title: item.title,
        author: item.author,
        genre: item.genre,
        coverUrl: item.coverUrl,
        rating: item.rating,
        score: Math.round(score * 1000) / 1000,
      })),
    });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diary/ask — RAG over the user's own diary entries. Sits behind
// diaryLockMiddleware in diaryRoutes.js, same as every other content route —
// unlocking is what makes the entry text readable at all.
// ─────────────────────────────────────────────────────────────────────────────
export const askDiary = async (req, res) => {
  try {
    if (!isGeminiConfigured()) return res.status(503).json(NOT_CONFIGURED);

    const { question } = req.body;

    const questionEmbedding = await embedText(question);
    if (!questionEmbedding) {
      return res.status(503).json({ message: 'Could not process that question right now.' });
    }

    // Generous cap — bounds one request's worst case without meaningfully
    // limiting anyone's actual diary history.
    const entries = await DiaryEntry.find({ user: req.user._id })
      .select('+embedding date title content mood')
      .sort({ date: -1 })
      .limit(200);

    if (entries.length === 0) {
      return res.json({
        answer: "You don't have any diary entries yet — write a few, then ask me again!",
        sources: [],
      });
    }

    let backfilled = 0;
    for (const entry of entries) {
      if (entry.embedding?.length) continue;
      if (!entry.content?.trim()) continue; // nothing worth embedding
      if (backfilled >= MAX_BACKFILL_PER_REQUEST) break;
      const embedding = await embedText(`${entry.title || ''} ${entry.content}`.trim());
      if (embedding) {
        entry.embedding = embedding;
        entry.embeddingUpdatedAt = new Date();
        await entry.save();
        backfilled++;
      }
    }

    const ranked = rankBySimilarity(entries, questionEmbedding, { limit: 5 });

    if (ranked.length === 0) {
      return res.json({
        answer:
          "I couldn't find anything relevant in your diary yet — try again once a few more entries have content.",
        sources: [],
      });
    }

    const context = ranked
      .map(
        ({ item }) =>
          `[${item.date}]${item.title ? ` "${item.title}"` : ''}: ${item.content.slice(0, 800)}`
      )
      .join('\n\n');

    const answer = await generateText({
      system:
        "You are a thoughtful assistant answering questions about the user's own personal diary. " +
        'Only use the excerpts provided below — never invent details or dates that are not there. ' +
        'Reference the dates you drew from directly in your answer (e.g. "On 2024-03-01, you wrote..."). ' +
        "If the excerpts don't answer the question, say so honestly instead of guessing.",
      prompt: `Diary excerpts:\n\n${context}\n\nQuestion: ${question}`,
    });

    if (!answer) {
      return res.status(503).json({ message: 'Could not generate an answer right now.' });
    }

    res.json({
      answer,
      sources: ranked.map(({ item, score }) => ({
        date: item.date,
        title: item.title || null,
        score: Math.round(score * 1000) / 1000,
      })),
    });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/summary/:bookId — spoiler-light summary, cached on Book.aiSummary.
// Deliberately does NOT sit behind the blanket checkAiQuota middleware — a
// cache hit costs nothing (no Gemini call happens), so quota is only
// consumed on the generation path, via consumeAiQuota() directly.
// ─────────────────────────────────────────────────────────────────────────────
export const getBookSummary = async (req, res) => {
  try {
    const book = await Book.findById(req.params.bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (book.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (book.aiSummary) {
      return res.json({
        summary: book.aiSummary,
        cached: true,
        generatedAt: book.aiSummaryGeneratedAt,
      });
    }

    if (!isGeminiConfigured()) return res.status(503).json(NOT_CONFIGURED);

    const { allowed, message } = await consumeAiQuota(req.user);
    if (!allowed) {
      return res.status(402).json({ message, upgradeRequired: true });
    }

    const summary = await generateText({
      system:
        'You write short, spoiler-light book summaries. 2-3 sentences. Describe the premise and tone ' +
        "only — never reveal the ending, major plot twists, or how a conflict resolves. If you're not " +
        'confident about the book, say so briefly instead of guessing.',
      prompt: `Write a spoiler-light summary of "${book.title}" by ${book.author}${
        book.genre && book.genre !== 'N/A' ? ` (${book.genre})` : ''
      }.`,
    });

    if (!summary) {
      return res.status(503).json({ message: 'Could not generate a summary right now.' });
    }

    book.aiSummary = summary;
    book.aiSummaryGeneratedAt = new Date();
    await book.save();

    res.json({ summary, cached: false, generatedAt: book.aiSummaryGeneratedAt });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai/habits — Gemini reads Phase 07's own analytics aggregation
// (buildOverviewData, same numbers the Dashboard chart renders) and returns
// one plain-language insight instead of raw numbers.
// ─────────────────────────────────────────────────────────────────────────────
export const getHabitInsights = async (req, res) => {
  try {
    if (!isGeminiConfigured()) return res.status(503).json(NOT_CONFIGURED);

    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const overview = await buildOverviewData(req.user._id, year);

    const totalBooks = overview.booksPerMonth.reduce((sum, m) => sum + m.count, 0);
    const totalPages = overview.pagesPerMonth.reduce((sum, m) => sum + m.pages, 0);

    if (totalBooks === 0 && totalPages === 0) {
      return res.json({
        insight: `No reading activity logged for ${year} yet — finish a book or log a session to get a personalized insight.`,
        basedOn: { year, totalBooks, totalPages },
      });
    }

    const dataSummary = [
      `Year: ${year}`,
      `Books completed by month: ${overview.booksPerMonth.map((m) => `${m.month}=${m.count}`).join(', ')}`,
      `Pages read by month: ${overview.pagesPerMonth.map((m) => `${m.month}=${m.pages}`).join(', ')}`,
      `Genre breakdown (all-time, completed books): ${
        overview.genreBreakdown.map((g) => `${g.genre}=${g.count}`).join(', ') || 'none'
      }`,
      `Rating distribution (all-time): ${
        overview.ratingDistribution.map((r) => `${r.rating}star=${r.count}`).join(', ') || 'none'
      }`,
    ].join('\n');

    const insight = await generateText({
      system:
        "You are a friendly reading coach. Given a reader's aggregate stats, write ONE short, plain-language " +
        'insight (2-3 sentences) that notices an actual pattern in the numbers given (a busy month, a favorite ' +
        'genre, a quiet stretch, etc). Only reference numbers actually present in the data — never invent ' +
        'stats. Be encouraging, not preachy.',
      prompt: dataSummary,
    });

    if (!insight) {
      return res.status(503).json({ message: 'Could not generate an insight right now.' });
    }

    res.json({ insight, basedOn: { year, totalBooks, totalPages } });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/review-assist — turns bullet points into a drafted review
// paragraph. Returns the draft only; saving it still goes through the
// existing POST /api/books/:id/review (Phase 05) so the user can edit first.
// ─────────────────────────────────────────────────────────────────────────────
export const reviewAssist = async (req, res) => {
  try {
    const { bookId, bulletPoints } = req.body;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    if (book.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (!isGeminiConfigured()) return res.status(503).json(NOT_CONFIGURED);

    const draft = await generateText({
      system:
        "You turn a reader's bullet-point thoughts into a natural, first-person book review paragraph. " +
        'Use only the opinions/facts given in the bullets — never invent details, plot points, or opinions ' +
        'the reader did not mention. Conversational tone, 80-180 words, no heading, no bullet list in the output.',
      prompt: `Book: "${book.title}" by ${book.author}${
        book.rating != null ? ` (rated ${book.rating}/5 by the reader)` : ''
      }.\n\nReader's bullet points:\n${bulletPoints.map((b) => `- ${b}`).join('\n')}`,
    });

    if (!draft) {
      return res.status(503).json({ message: 'Could not draft a review right now.' });
    }

    res.json({ draft });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/search — natural language → structured filter params matching
// GET /api/books' own query shape (Phase 06). The client applies the
// returned `filters` into its existing filter state and re-fetches through
// the normal /api/books endpoint — this route never touches Book directly.
// ─────────────────────────────────────────────────────────────────────────────
const SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    q: {
      type: 'string',
      description:
        'Free-text search across title/author — only if a specific title/author/keyword is named',
    },
    status: { type: 'string', enum: ['wantToRead', 'reading', 'completed', 'dnf', 'onHold'] },
    genre: { type: 'string' },
    tag: { type: 'string' },
    minRating: { type: 'number' },
    sortBy: {
      type: 'string',
      enum: ['createdAt', 'updatedAt', 'title', 'author', 'rating', 'currentPage'],
    },
    sortDir: { type: 'string', enum: ['asc', 'desc'] },
  },
};

const ALLOWED_STATUS = new Set(['wantToRead', 'reading', 'completed', 'dnf', 'onHold']);
const ALLOWED_SORT_BY = new Set([
  'createdAt',
  'updatedAt',
  'title',
  'author',
  'rating',
  'currentPage',
]);
const ALLOWED_SORT_DIR = new Set(['asc', 'desc']);

export const naturalLanguageSearch = async (req, res) => {
  try {
    if (!isGeminiConfigured()) return res.status(503).json(NOT_CONFIGURED);

    const { query } = req.body;

    const raw = await generateJson({
      system:
        'Translate a natural-language library search request into structured filter params for a book ' +
        'search API. Only include fields that clearly apply — omit anything not implied by the query. ' +
        'Only use enum values exactly as given in the schema.',
      prompt: query,
      schema: SEARCH_SCHEMA,
    });

    if (!raw) {
      return res.status(503).json({ message: 'Could not interpret that search right now.' });
    }

    // Defensive allowlist — the schema constrains Gemini's output, but this
    // endpoint's own response still shouldn't blindly forward whatever came
    // back without re-checking types/enums itself.
    const filters = {};
    if (typeof raw.q === 'string' && raw.q.trim()) filters.q = raw.q.trim();
    if (ALLOWED_STATUS.has(raw.status)) filters.status = raw.status;
    if (typeof raw.genre === 'string' && raw.genre.trim()) filters.genre = raw.genre.trim();
    if (typeof raw.tag === 'string' && raw.tag.trim()) filters.tag = raw.tag.trim();
    if (typeof raw.minRating === 'number' && raw.minRating >= 0 && raw.minRating <= 5) {
      filters.minRating = raw.minRating;
    }
    if (ALLOWED_SORT_BY.has(raw.sortBy)) filters.sortBy = raw.sortBy;
    if (ALLOWED_SORT_DIR.has(raw.sortDir)) filters.sortDir = raw.sortDir;

    res.json({ filters });
  } catch (error) {
    Sentry.captureException(error); // Phase 17
    res.status(500).json({ message: error.message });
  }
};
