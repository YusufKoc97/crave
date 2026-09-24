import { describe, expect, it } from 'vitest';
import { isValidEmail, translateAuthError } from '@/lib/auth';
import { t } from '@/lib/i18n';

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects an empty / whitespace-only string', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('   ')).toBe(false);
  });

  it('rejects missing @ or TLD', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
    expect(isValidEmail('user@example')).toBe(false);
    expect(isValidEmail('user@example.c')).toBe(false);
  });

  it('rejects internal whitespace', () => {
    expect(isValidEmail('us er@example.com')).toBe(false);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });
});

describe('translateAuthError', () => {
  // Compared against the same `t()` keys the function uses, so these tests
  // hold in whatever language is current.
  it('maps invalid credentials', () => {
    expect(translateAuthError('Invalid login credentials')).toBe(
      t('auth.errors.invalid_credentials')
    );
  });

  it('maps email-not-confirmed', () => {
    expect(translateAuthError('Email not confirmed')).toBe(
      t('auth.errors.email_not_confirmed')
    );
  });

  it('maps duplicate registration', () => {
    expect(translateAuthError('User already registered')).toBe(
      t('auth.errors.already_registered')
    );
  });

  it('maps rate-limit', () => {
    expect(translateAuthError('You are sending too many requests')).toBe(
      t('auth.errors.rate_limited')
    );
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(translateAuthError('Some opaque server error')).toBe(
      t('auth.errors.generic')
    );
  });

  it('returns the generic message for null / undefined', () => {
    expect(translateAuthError(null)).toBe(t('auth.errors.generic'));
    expect(translateAuthError(undefined)).toBe(t('auth.errors.generic'));
  });
});
