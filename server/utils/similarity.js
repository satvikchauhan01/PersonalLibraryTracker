// Phase 18: pure cosine-similarity math, extracted the same way utils/streak.js
// was in Phase 14 — no network/DB involved, so it's trivially unit-testable.
// Used to rank Gemini embedding vectors (books, diary entries) by relevance
// without needing a vector-search-capable database (see aiController.js).
export const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

// Ranks `items` (each with an `embedding` array) by similarity to
// `queryEmbedding`, highest first. Items with no embedding are skipped
// entirely rather than scored as 0 — they just haven't been indexed yet.
export const rankBySimilarity = (items, queryEmbedding, { limit = 5 } = {}) => {
  return items
    .filter((item) => Array.isArray(item.embedding) && item.embedding.length > 0)
    .map((item) => ({ item, score: cosineSimilarity(queryEmbedding, item.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};
