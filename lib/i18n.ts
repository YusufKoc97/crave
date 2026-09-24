import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '@/i18n/en.json';
import tr from '@/i18n/tr.json';
import {
  TR_READY,
  pickLanguage,
  translate,
  type LangCode,
  type Params,
} from './i18nCore';

/**
 * Tiny i18n layer. Every user-facing string routes through `t()`; English
 * (`i18n/en.json`) is the source of truth and the fallback for any key a
 * language hasn't translated yet, so adding a string in English never
 * breaks another language — it just shows in English until translated.
 *
 * Key format: dot-separated path into the JSON tree, e.g.
 *   t('picker.title')
 *   t('removal.title', { name: 'Nicotine' })
 *
 * The current language is module state (so `t()` stays a plain function
 * callable anywhere) plus a subscribe hook (`lib/useLanguage.ts`) the root
 * layout uses to re-render the tree when the language changes.
 */

const TREES: Record<LangCode, unknown> = { en, tr };
const STORAGE_KEY = 'crave.language';

/** Names shown in the picker — each language in its own tongue, never translated. */
export const LANGUAGES: readonly { code: LangCode; native: string }[] = [
  { code: 'en', native: 'English' },
  { code: 'tr', native: 'Türkçe' },
];

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

/** Languages the user may pick right now (Turkish is DEV-only until TR_READY). */
export function availableLanguages() {
  return LANGUAGES.filter((l) => l.code === 'en' || TR_READY || isDev);
}

/** Languages we auto-pick from the device locale — only finished ones. */
const DETECTABLE: readonly LangCode[] = TR_READY ? ['en', 'tr'] : ['en'];

let current: LangCode = 'en';
const listeners = new Set<() => void>();

export function getLanguage(): LangCode {
  return current;
}

export function subscribeLanguage(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function apply(code: LangCode) {
  if (code === current) return;
  current = code;
  listeners.forEach((fn) => fn());
}

export function t(key: string, params?: Params): string {
  return translate(TREES, current, key, params);
}

/** Switch language and remember the choice. */
export async function setLanguage(code: LangCode): Promise<void> {
  apply(code);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch (e) {
    console.warn('i18n: could not persist language', e);
  }
}

function deviceLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}

/**
 * Startup: the saved choice wins; otherwise follow the device language (if
 * we ship it), otherwise English. Call once before first render.
 */
export async function hydrateLanguage(): Promise<void> {
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    /* fall through to detection */
  }
  const allowed = availableLanguages().map((l) => l.code);
  const saved = pickLanguage(stored, allowed);
  apply(saved ?? pickLanguage(deviceLocale(), DETECTABLE) ?? 'en');
}
