import { getLanguage, t } from '@/lib/i18n';
import type { LangCode } from '@/lib/i18nCore';

/**
 * Clock formatting per language. English reads 12-hour with AM/PM ("7PM",
 * "7-10 PM"); Turkish reads 24-hour ("19:00", "19:00-22:00"). Kept out of the
 * translation files because it changes the *numbers*, not just the words.
 */
const CLOCK_24H: Record<LangCode, boolean> = { en: false, tr: true };

function uses24h(): boolean {
  return CLOCK_24H[getLanguage()];
}

const norm = (h: number) => ((h % 24) + 24) % 24;
const pad2 = (h: number) => String(h).padStart(2, '0');
const suffixOf = (h: number) => (norm(h) < 12 ? t('time.am') : t('time.pm'));
const to12 = (h: number) => norm(h) % 12 || 12;

/** A single hour of the day: "7PM" / "19:00". */
export function formatHour(hour: number): string {
  if (uses24h()) return `${pad2(norm(hour))}:00`;
  return `${to12(hour)}${suffixOf(hour)}`;
}

/**
 * A window of hours. `endHourExc` is one PAST the last hour, so 19, 20, 21
 * reads "7-10 PM" / "19:00-22:00".
 */
export function formatHourRange(startHour: number, endHourExc: number): string {
  if (uses24h()) {
    return `${pad2(norm(startHour))}:00-${pad2(norm(endHourExc))}:00`;
  }
  const s = suffixOf(startHour);
  const e = suffixOf(endHourExc);
  if (s === e) return `${to12(startHour)}-${to12(endHourExc)} ${e}`;
  return `${to12(startHour)} ${s} - ${to12(endHourExc)} ${e}`;
}

/**
 * Params for `comparison.pattern.clock_title` ("…between {{start}}–{{end}}
 * {{ampm}}"). On a 24-hour clock the start/end carry the full "19:00" and
 * `ampm` is empty.
 */
export function clockTitleParams(startHour: number, endHour: number) {
  if (uses24h()) {
    return {
      start: `${pad2(norm(startHour))}:00`,
      end: `${pad2(norm(endHour))}:00`,
      ampm: '',
    };
  }
  return {
    start: String(to12(startHour)),
    end: String(to12(endHour)),
    ampm: endHour < 12 ? t('time.am') : t('time.pm'),
  };
}
