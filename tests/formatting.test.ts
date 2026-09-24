import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/lib/i18n';
import { formatNumber } from '@/lib/numberFormat';
import {
  clockTitleParams,
  formatHour,
  formatHourRange,
} from '@/lib/timeFormat';

afterEach(async () => {
  await setLanguage('en');
});

describe('number formatting', () => {
  it('groups thousands per language', async () => {
    expect(formatNumber(5625)).toBe('5,625');
    await setLanguage('tr');
    expect(formatNumber(5625)).toBe('5.625');
  });

  it('handles decimals, negatives and small numbers', async () => {
    expect(formatNumber(1234567.5)).toBe('1,234,567.5');
    expect(formatNumber(-42)).toBe('-42');
    expect(formatNumber(7)).toBe('7');
    await setLanguage('tr');
    expect(formatNumber(1234567.5)).toBe('1.234.567,5');
  });
});

describe('clock formatting', () => {
  it('uses 12-hour AM/PM in English', () => {
    expect(formatHour(19)).toBe('7PM');
    expect(formatHour(0)).toBe('12AM');
    expect(formatHourRange(19, 22)).toBe('7-10 PM');
    expect(formatHourRange(10, 13)).toBe('10 AM - 1 PM');
  });

  it('uses 24-hour time in Turkish', async () => {
    await setLanguage('tr');
    expect(formatHour(19)).toBe('19:00');
    expect(formatHourRange(19, 22)).toBe('19:00-22:00');
    // A window that ends at midnight wraps to 00:00, never "24:00".
    expect(formatHourRange(22, 24)).toBe('22:00-00:00');
  });

  it('feeds the pattern-card title the right parts per language', async () => {
    expect(clockTitleParams(19, 22)).toEqual({
      start: '7',
      end: '10',
      ampm: 'PM',
    });
    await setLanguage('tr');
    expect(clockTitleParams(19, 22)).toEqual({
      start: '19:00',
      end: '22:00',
      ampm: '',
    });
  });
});
