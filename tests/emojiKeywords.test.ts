import { describe, expect, it } from 'vitest';
import { EMOJI_KEYWORDS, emojiMatchesQuery } from '@/constants/emojiKeywords';

describe('emojiMatchesQuery', () => {
  it('matches everything when the query is empty', () => {
    expect(emojiMatchesQuery('🚬', '')).toBe(true);
    expect(emojiMatchesQuery('🔥', '   ')).toBe(true);
  });

  it('matches Turkish keywords (substring, case-insensitive)', () => {
    expect(emojiMatchesQuery('🚬', 'sigara')).toBe(true);
    expect(emojiMatchesQuery('🚬', 'SIGARA')).toBe(true);
    expect(emojiMatchesQuery('❤️', 'kalp')).toBe(true);
  });

  it('matches English keywords too', () => {
    expect(emojiMatchesQuery('🚬', 'smoke')).toBe(true);
    expect(emojiMatchesQuery('❤️', 'heart')).toBe(true);
  });

  it('uses substring matching, not whole-word', () => {
    // 'kah' should land 'kahve' (☕), 'kahve' on 🍵 is absent
    expect(emojiMatchesQuery('☕', 'kah')).toBe(true);
  });

  it("returns false when the emoji isn't indexed at all", () => {
    expect(emojiMatchesQuery('🦄', 'anything')).toBe(false);
  });

  it('every emoji in the index has at least one keyword', () => {
    for (const [, kws] of Object.entries(EMOJI_KEYWORDS)) {
      expect(kws.length).toBeGreaterThan(0);
      // Spot-check: the keywords array shouldn't contain empty strings
      // (empty would make every search match it).
      expect(kws.every((k) => k.length > 0)).toBe(true);
    }
  });
});
