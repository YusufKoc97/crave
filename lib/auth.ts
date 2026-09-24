import { t } from '@/lib/i18n';
/**
 * Translate Supabase auth errors into user-facing messages (current language).
 * Falls back to a generic message for codes we haven't explicitly handled.
 */
export function translateAuthError(message: string | undefined | null): string {
  if (!message) return t('auth.errors.generic');

  const m = message.toLowerCase();

  if (
    m.includes('invalid login credentials') ||
    m.includes('invalid email or password')
  ) {
    return t('auth.errors.invalid_credentials');
  }
  if (m.includes('email not confirmed')) {
    return t('auth.errors.email_not_confirmed');
  }
  if (m.includes('user already registered') || m.includes('already exists')) {
    return t('auth.errors.already_registered');
  }
  if (m.includes('password should be at least')) {
    return t('auth.errors.password_short');
  }
  if (m.includes('unable to validate email')) {
    return t('auth.errors.invalid_email');
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return t('auth.errors.rate_limited');
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return t('auth.errors.network');
  }
  return t('auth.errors.generic');
}

/** Lightweight email validation — good enough for client-side gate. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
