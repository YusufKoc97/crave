import { describe, expect, it } from 'vitest';
import { isValidEmail, translateAuthError } from '@/lib/auth';

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
  it('translates invalid-credentials into Turkish', () => {
    expect(translateAuthError('Invalid login credentials')).toBe(
      'E-posta veya şifre hatalı.'
    );
  });

  it('translates email-not-confirmed', () => {
    expect(translateAuthError('Email not confirmed')).toContain('onaylamadın');
  });

  it('translates duplicate registration', () => {
    expect(translateAuthError('User already registered')).toContain(
      'zaten kayıtlı'
    );
  });

  it('translates rate-limit', () => {
    expect(translateAuthError('You are sending too many requests')).toContain(
      'Çok fazla'
    );
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(translateAuthError('Some opaque server error')).toBe(
      'Bir hata oluştu. Tekrar deneyin.'
    );
  });

  it('returns the generic message for null / undefined', () => {
    expect(translateAuthError(null)).toBe(
      'Bir hata oluştu. Tekrar deneyin.'
    );
    expect(translateAuthError(undefined)).toBe(
      'Bir hata oluştu. Tekrar deneyin.'
    );
  });
});
