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
    expect(translate(TREES, 'tr', 'premium.cta')).toBe(
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
