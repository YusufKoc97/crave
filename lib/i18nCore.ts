/**
 * Pure i18n logic — no React, no storage, no RN globals — so it can be unit
 * tested under Vitest. `lib/i18n.ts` wires it to state + AsyncStorage.
 */

export type LangCode = 'en' | 'tr';
export type Params = Record<string, string | number>;

/**
 * Flip to `true` once `i18n/tr.json` is fully translated (check with
 * `npm run i18n:missing`). Until then Turkish is DEV-only: it can't be
 * auto-detected from the device and isn't offered in the Settings picker
 * of a production build, so nobody ships a half-English "Turkish" app.
 */
export const TR_READY = false;

/** Walk a dot path (`a.b.c`) into a nested object; undefined if absent. */
export function lookup(tree: unknown, key: string): string | undefined {
  let node: unknown = tree;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
    if (node === undefined) return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

/** `{{name}}` substitution; an unknown param is left visible as `{{name}}`. */
export function interpolate(raw: string, params?: Params): string {
  if (!params) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const val = params[name];
    return val === undefined ? `{{${name}}}` : String(val);
  });
}

/**
 * Translate `key` in `lang`, falling back to English when that language has
 * no such string, and to the key itself when English lacks it too (loud, so
 * a typo shows up on screen instead of as an empty label).
 */
export function translate(
  trees: Record<LangCode, unknown>,
  lang: LangCode,
  key: string,
  params?: Params
): string {
  const raw = lookup(trees[lang], key) ?? lookup(trees.en, key);
  return raw === undefined ? key : interpolate(raw, params);
}

/** `'tr-TR'` / `'tr_TR'` / `'TR'` → `'tr'` if it's one of `allowed`, else null. */
export function pickLanguage(
  tag: string | null | undefined,
  allowed: readonly LangCode[]
): LangCode | null {
  if (!tag) return null;
  const base = tag.split(/[-_]/)[0].toLowerCase();
  return (allowed as readonly string[]).includes(base)
    ? (base as LangCode)
    : null;
}

/** Every leaf string of a nested JSON tree, keyed by its dot path. */
export function flattenStrings(
  tree: unknown,
  prefix = '',
  out: Record<string, string> = {}
): Record<string, string> {
  if (typeof tree === 'string') {
    out[prefix] = tree;
  } else if (typeof tree === 'object' && tree !== null) {
    for (const [k, v] of Object.entries(tree)) {
      flattenStrings(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

/** Sorted `{{placeholder}}` names in a string. */
export function placeholders(s: string): string[] {
  return [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}
