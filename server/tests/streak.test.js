import { describe, it, expect } from 'vitest';
import { computeCurrentStreak, getLocalDateStr } from '../utils/streak.js';

// Pure function, zero DB — daysAgo(0) is always "today" relative to the
// real clock, matching computeCurrentStreak's own `new Date()` anchor.
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getLocalDateStr(d);
};

describe('computeCurrentStreak', () => {
  it('returns 0 for no sessions logged at all', () => {
    expect(computeCurrentStreak(new Set())).toBe(0);
  });

  it('counts an unbroken run ending today', () => {
    const dates = new Set([daysAgo(0), daysAgo(1), daysAgo(2)]);
    expect(computeCurrentStreak(dates)).toBe(3);
  });

  it('grants one grace day — streak still counts if today is empty but yesterday continues it', () => {
    const dates = new Set([daysAgo(1), daysAgo(2), daysAgo(3)]); // nothing logged today
    expect(computeCurrentStreak(dates)).toBe(3);
  });

  it('stops at a gap day instead of continuing past it', () => {
    // Logged today and yesterday, then a 2-day gap, then an older run —
    // the current streak must be 2, not 2 + (the disconnected older run).
    const dates = new Set([daysAgo(0), daysAgo(1), daysAgo(4), daysAgo(5), daysAgo(6)]);
    expect(computeCurrentStreak(dates)).toBe(2);
  });

  it('resets to 0 when the most recent session is more than 1 day old', () => {
    // Nothing today or yesterday — the 1-day grace period doesn't reach back
    // 2+ days, so a run further in the past no longer counts as "current."
    const dates = new Set([daysAgo(2), daysAgo(3), daysAgo(4)]);
    expect(computeCurrentStreak(dates)).toBe(0);
  });
});
