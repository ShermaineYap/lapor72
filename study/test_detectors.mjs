import { readFileSync } from 'node:fs';
import { detect } from './detectors.js';
const S = JSON.parse(readFileSync(new URL('./samples.json', import.meta.url)));
let fp = 0, fn = 0;
for (const s of S) {
  const gold = new Set(s.labels.filter((l) => l !== 'none')); const got = new Set(detect(s.text));
  const miss = [...gold].filter((x) => !got.has(x)), extra = [...got].filter((x) => !gold.has(x));
  fp += extra.length; fn += miss.length;
  if (miss.length || extra.length) console.log(s.id, s.lang, 'miss', miss, 'extra', extra);
}
console.log({ fp, fn });
