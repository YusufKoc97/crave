/**
 * Translate Supabase auth errors into user-facing Turkish messages.
 * Falls back to a generic message for codes we haven't explicitly handled.
 */
export function translateAuthError(message: string | undefined | null): string {
  if (!message) return 'Bir hata oluştu. Tekrar deneyin.';

  const m = message.toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
    return 'E-posta veya şifre hatalı.';
  }
  if (m.includes('email not confirmed')) {
    return 'E-postanı henüz onaylamadın. Gelen kutunu kontrol et.';
  }
  if (m.includes('user already registered') || m.includes('already exists')) {
    return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.';
  }
  if (m.includes('password should be at least')) {
    return 'Şifre en az 6 karakter olmalı.';
  }
  if (m.includes('unable to validate email')) {
    return 'Geçerli bir e-posta gir.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Çok fazla deneme. Birkaç dakika bekle, tekrar dene.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Bağlantı hatası. İnternetini kontrol et.';
  }
  return 'Bir hata oluştu. Tekrar deneyin.';
}

/** Lightweight email validation — good enough for client-side gate. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
