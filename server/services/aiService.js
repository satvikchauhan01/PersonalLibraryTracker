import fetch from 'node-fetch';
import {
  GEMINI_GENERATION_MODEL,
  GEMINI_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  isGeminiConfigured,
} from '../config/gemini.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Phase 18: the shared Gemini REST layer for every *new* AI feature (similar
// books, ask-your-diary, summaries, habit insights, review drafting, NL
// search). apiController.js and diaryController.js already made their own
// direct fetch calls for the pre-existing Gemini features (Phase 09/12) —
// deliberately left untouched rather than refactored onto this, to avoid
// any behavior change to code that's already shipped and tested.
//
// Every function here follows the same graceful-degradation shape as
// emailService.js: never throws for "not configured", just returns null so
// callers can 503 cleanly instead of hanging on a network call that was
// never going to succeed (this is also what keeps the test suite from
// making real network calls — NODE_ENV=test never sets GEMINI_API_KEY).

// @param text        Text to embed.
// @param taskType    Gemini embedding task type — SEMANTIC_SIMILARITY for
//                     both sides of a similarity comparison (what every
//                     caller here needs; there's no separate "query" vs
//                     "document" split like RETRIEVAL_QUERY/RETRIEVAL_DOCUMENT
//                     would need, since we compare book-to-book / entry-to-question
//                     symmetrically).
export const embedText = async (text) => {
  if (!isGeminiConfigured() || !text || !text.trim()) return null;

  try {
    const url = `${BASE_URL}/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: 'SEMANTIC_SIMILARITY',
      }),
    });

    if (!response.ok) {
      console.error('[ai] embedText failed:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return data.embedding?.values || null;
  } catch (error) {
    console.error('[ai] embedText error:', error.message);
    return null;
  }
};

// Free-form text generation (no forced JSON shape) — book summaries, habit
// insights, drafted reviews. Returns the raw response text, or null.
export const generateText = async ({ system, prompt }) => {
  if (!isGeminiConfigured() || !prompt) return null;

  try {
    const url = `${BASE_URL}/${GEMINI_GENERATION_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[ai] generateText failed:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (error) {
    console.error('[ai] generateText error:', error.message);
    return null;
  }
};

// Structured-output generation — Gemini is constrained to return JSON
// matching `schema` (a plain JSON-Schema object), so the caller gets a
// parsed object back instead of having to coax/parse free text itself.
// Used by the natural-language search endpoint. Returns null on any
// failure (unconfigured, non-2xx, unparsable) — callers treat that as "no
// filters extracted" rather than a hard error.
export const generateJson = async ({ system, prompt, schema }) => {
  if (!isGeminiConfigured() || !prompt) return null;

  try {
    const url = `${BASE_URL}/${GEMINI_GENERATION_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[ai] generateJson failed:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      console.error('[ai] generateJson: response was not valid JSON:', text);
      return null;
    }
  } catch (error) {
    console.error('[ai] generateJson error:', error.message);
    return null;
  }
};
