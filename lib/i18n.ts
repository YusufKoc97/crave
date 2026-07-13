import en from '@/i18n/en.json';

/**
 * Tiny i18n helper — Faz 2 introduces a single language (English) but
 * every user-facing string still routes through `t()` so future
 * languages plug into the same shape. If we need pluralization,
 * per-user detection, or namespace splitting later, swap this file for
 * i18next; the call sites don't change.
 *
 * Key format: dot-separated path into the JSON tree, e.g.
 *   t('picker.title')
 *   t('addictions.nicotine.name')
 *   t('removal.title', { name: 'Nicotine' })
 */

type Params = Record<string, string | number>;

// Recursive JSON — leaves are strings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TREE: any = en;

function resolve(key: string): unknown {
  let node: unknown = TREE;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
    if (node === undefined) return undefined;
  }
  return node;
}

/**
 * Resolve a translation key. Missing keys return the key itself so the
 * dev sees "picker.title_typo" on screen rather than an empty string —
 * loud failure > silent failure. `{{param}}` placeholders are
 * substituted in-order from the second argument.
 */
export function t(key: string, params?: Params): string {
  const raw = resolve(key);
  if (typeof raw !== 'string') return key;
  if (!params) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const val = params[name];
    return val === undefined ? `{{${name}}}` : String(val);
  });
}
