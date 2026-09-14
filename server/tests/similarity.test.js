import { describe, it, expect } from 'vitest';
import { cosineSimilarity, rankBySimilarity } from '../utils/similarity.js';

// Pure math, zero DB/network — same rationale as streak.test.js.
describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1);
  });

  it('is unaffected by magnitude — only direction matters', () => {
    // [2,0] and [10,0] point the same way, just scaled differently
    expect(cosineSimilarity([2, 0], [10, 0])).toBeCloseTo(1);
  });

  it('returns 0 for mismatched lengths instead of throwing', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });

  it('returns 0 for empty vectors instead of dividing by zero', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('returns 0 for non-array input instead of throwing', () => {
    expect(cosineSimilarity(null, [1, 2])).toBe(0);
    expect(cosineSimilarity(undefined, undefined)).toBe(0);
  });
});

describe('rankBySimilarity', () => {
  const query = [1, 0];
  const items = [
    { id: 'close', embedding: [0.9, 0.1] },
    { id: 'far', embedding: [0, 1] },
    { id: 'exact', embedding: [1, 0] },
    { id: 'no-embedding' }, // should be skipped entirely, not scored as 0
  ];

  it('ranks highest-similarity first and skips items with no embedding', () => {
    const ranked = rankBySimilarity(items, query, { limit: 5 });
    expect(ranked.map((r) => r.item.id)).toEqual(['exact', 'close', 'far']);
    expect(ranked[0].score).toBeCloseTo(1);
  });

  it('respects the limit', () => {
    const ranked = rankBySimilarity(items, query, { limit: 1 });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].item.id).toBe('exact');
  });
});
