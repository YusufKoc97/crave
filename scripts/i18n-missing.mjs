/* global console, process */
// Lists English strings that i18n/tr.json hasn't translated yet, grouped by
// top-level section:  npm run i18n:missing
import { readFileSync } from 'node:fs';

const en = JSON.parse(readFileSync('i18n/en.json', 'utf8'));
const tr = JSON.parse(readFileSync('i18n/tr.json', 'utf8'));

const flat = (t, p = '', o = {}) => {
  if (typeof t === 'string') o[p] = t;
  else if (t && typeof t === 'object')
    for (const [k, v] of Object.entries(t)) flat(v, p ? `${p}.${k}` : k, o);
  return o;
};

const enFlat = flat(en);
const trFlat = flat(tr);
const missing = Object.keys(enFlat).filter((k) => !(k in trFlat));

const bySection = {};
for (const k of missing) (bySection[k.split('.')[0]] ??= []).push(k);

console.log(
  `Turkish: ${Object.keys(trFlat).length}/${Object.keys(enFlat).length} translated, ${missing.length} missing\n`
);
for (const [section, keys] of Object.entries(bySection).sort(
  (a, b) => b[1].length - a[1].length
)) {
  console.log(`${section.padEnd(24)} ${keys.length}`);
}
if (process.argv.includes('--keys')) {
  console.log('\n' + missing.join('\n'));
}
