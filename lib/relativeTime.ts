import { t } from '@/lib/i18n';

/** Format an ISO timestamp as a relative-time string in the current language. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return t('time.ago_now');
  const min = Math.floor(sec / 60);
  if (min < 60) return t('time.ago_min', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('time.ago_hr', { count: hr });
  const day = Math.floor(hr / 24);
  if (day === 1) return t('time.ago_yesterday');
  if (day < 7) return t('time.ago_day', { count: day });
  const wk = Math.floor(day / 7);
  if (wk < 4) return t('time.ago_week', { count: wk });
  const mo = Math.floor(day / 30);
  if (mo < 12) return t('time.ago_month', { count: mo });
  return t('time.ago_year', { count: Math.floor(day / 365) });
}
