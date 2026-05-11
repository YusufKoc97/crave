import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { relativeTime } from '@/lib/relativeTime';

describe('relativeTime', () => {
  // Pin "now" so the test isn't flaky.
  const NOW = new Date('2026-03-05T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "şimdi" for under a minute', () => {
    expect(relativeTime(new Date(NOW - 30 * 1000).toISOString())).toBe('şimdi');
  });

  it('shows minutes for under an hour', () => {
    expect(relativeTime(new Date(NOW - 15 * 60 * 1000).toISOString())).toBe(
      '15dk önce'
    );
  });

  it('shows hours for under a day', () => {
    expect(relativeTime(new Date(NOW - 3 * 3600 * 1000).toISOString())).toBe(
      '3sa önce'
    );
  });

  it('shows "dün" for exactly 1 day', () => {
    expect(relativeTime(new Date(NOW - 24 * 3600 * 1000).toISOString())).toBe(
      'dün'
    );
  });

  it('shows days for under a week', () => {
    expect(
      relativeTime(new Date(NOW - 4 * 24 * 3600 * 1000).toISOString())
    ).toBe('4g önce');
  });

  it('shows weeks under a month', () => {
    expect(
      relativeTime(new Date(NOW - 14 * 24 * 3600 * 1000).toISOString())
    ).toBe('2h önce');
  });

  it('shows months under a year', () => {
    expect(
      relativeTime(new Date(NOW - 60 * 24 * 3600 * 1000).toISOString())
    ).toBe('2ay önce');
  });

  it('shows years past a year', () => {
    expect(
      relativeTime(new Date(NOW - 400 * 24 * 3600 * 1000).toISOString())
    ).toBe('1y önce');
  });
});
