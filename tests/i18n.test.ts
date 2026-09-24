import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/en.json';
import tr from '@/i18n/tr.json';
import {
  TR_READY,
  flattenStrings,
  interpolate,
  lookup,
  pickLanguage,
  placeholders,
  translate,
} from '@/lib/i18nCore';

const TREES = { en, tr };
const enFlat = flattenStrings(en);
const trFlat = flattenStrings(tr);

describe('translate', () => {
  it('reads the current language when it has the key', () => {
    expect(translate(TREES, 'tr', 'craving_quotes.q1')).toBe(
      'Bu dürtüden daha güçlüsün.'
    );
  });

  it('falls back to English when the language lacks the key', () => {
    // A language with no strings at all falls back to English throughout.
    expect(translate({ en, tr: {} }, 'tr', 'premium.cta')).toBe(
      translate(TREES, 'en', 'premium.cta')
    );
  });

  it('returns the key itself when neither language has it', () => {
    expect(translate(TREES, 'tr', 'no.such.key')).toBe('no.such.key');
  });

  it('substitutes params and leaves unknown ones visible', () => {
    expect(interpolate('Hi {{name}} {{x}}', { name: 'A' })).toBe('Hi A {{x}}');
  });

  it('does not treat a subtree as a string', () => {
    expect(lookup(en, 'craving_quotes')).toBeUndefined();
  });
});

describe('pickLanguage', () => {
  it('maps locale tags to a supported base language', () => {
    expect(pickLanguage('tr-TR', ['en', 'tr'])).toBe('tr');
    expect(pickLanguage('tr_TR', ['en', 'tr'])).toBe('tr');
    expect(pickLanguage('EN', ['en', 'tr'])).toBe('en');
  });

  it('returns null for unsupported or disallowed languages', () => {
    expect(pickLanguage('de-DE', ['en', 'tr'])).toBeNull();
    expect(pickLanguage('tr-TR', ['en'])).toBeNull();
    expect(pickLanguage(null, ['en', 'tr'])).toBeNull();
  });
});

describe('Turkish translation file', () => {
  it('has no keys that English lacks (orphans / typos)', () => {
    const orphans = Object.keys(trFlat).filter((k) => !(k in enFlat));
    expect(orphans).toEqual([]);
  });

  it('keeps the same {{placeholders}} as English', () => {
    const mismatched = Object.keys(trFlat).filter(
      (k) =>
        k in enFlat &&
        placeholders(trFlat[k]).join() !== placeholders(enFlat[k]).join()
    );
    expect(mismatched).toEqual([]);
  });

  it('is complete once TR_READY is switched on', () => {
    const missing = Object.keys(enFlat).filter((k) => !(k in trFlat));
    if (TR_READY) expect(missing).toEqual([]);
    else expect(TR_READY).toBe(false); // in-progress: see `npm run i18n:missing`
  });
});

/** Every .ts/.tsx under the app source folders. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('t() call sites', () => {
  it('only reference keys that exist in en.json', () => {
    const missing: string[] = [];
    for (const dir of ['app', 'components', 'constants', 'context', 'lib']) {
      for (const file of sourceFiles(dir)) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/\bt\(\s*(['"])([A-Za-z0-9_.]+)\1/g)) {
          const key = m[2];
          // A trailing dot means the key is built at runtime (`t('a.' + b)`).
          if (key.endsWith('.')) continue;
          if (!(key in enFlat)) missing.push(`${file}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
