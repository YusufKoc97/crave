import { getLanguage } from '@/lib/i18n';
import type { LangCode } from '@/lib/i18nCore';

/** Thousands / decimal separators per language (en: 5,625.5 — tr: 5.625,5). */
const SEPARATORS: Record<LangCode, { group: string; decimal: string }> = {
  en: { group: ',', decimal: '.' },
  tr: { group: '.', decimal: ',' },
};

/**
 * Locale-aware number → string without relying on `Intl` (its availability
 * differs between Hermes builds and Expo Go). Up to 3 fraction digits, like
 * `toLocaleString`'s default.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const { group, decimal } = SEPARATORS[getLanguage()];
  const rounded = Math.round(n * 1000) / 1000;
  const [int, frac] = Math.abs(rounded).toString().split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return (rounded < 0 ? '-' : '') + grouped + (frac ? decimal + frac : '');
}
