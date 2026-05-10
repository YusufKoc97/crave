import { describe, expect, it } from 'vitest';
import { calculateAge } from '@/lib/onboarding';

describe('calculateAge', () => {
  it('returns -1 for non-finite inputs', () => {
    expect(calculateAge(NaN, 6, 15)).toBe(-1);
    expect(calculateAge(2000, NaN, 15)).toBe(-1);
  });

  it('returns -1 for out-of-range years', () => {
    expect(calculateAge(1899, 6, 15)).toBe(-1);
    expect(calculateAge(2101, 6, 15)).toBe(-1);
  });

  it('returns -1 for invalid months', () => {
    expect(calculateAge(2000, 0, 15)).toBe(-1);
    expect(calculateAge(2000, 13, 15)).toBe(-1);
  });

  it('returns -1 for invalid days', () => {
    expect(calculateAge(2000, 6, 0)).toBe(-1);
    expect(calculateAge(2000, 6, 32)).toBe(-1);
  });

  it('rejects impossible day/month combos (Feb 30)', () => {
    expect(calculateAge(2000, 2, 30)).toBe(-1);
  });

  it('respects leap years (Feb 29 ok in 2000)', () => {
    const age = calculateAge(2000, 2, 29);
    expect(age).toBeGreaterThanOrEqual(0);
  });

  it('rejects Feb 29 on a non-leap year', () => {
    expect(calculateAge(2001, 2, 29)).toBe(-1);
  });

  it('produces a sane age for a recent birthday', () => {
    // Not pinning to "now" so the test stays valid across years; just
    // assert it's nonnegative and < 130.
    const age = calculateAge(2000, 1, 1);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(130);
  });
});
