// Scores device.json, cloud.json and the frozen regex detectors against the hand labels.
import { readFileSync, existsSync } from 'node:fs';
import { detect, CATEGORIES } from './detectors.js';
const here = (f) => new URL(f, import.meta.url);
const S = [...JSON.parse(readFileSync(here('samples.json'))), ...JSON.parse(readFileSync(here('heldout.json')))];
const gold = Object.fromEntries(S.map((s) => [s.id, new Set(s.labels.filter((l) => l !== 'none'))]));
const meta = Object.fromEntries(S.map((s) => [s.id, s]));
const load = (f) => (existsSync(here(f)) ? Object.fromEntries(JSON.parse(readFileSync(here(f))).rows.map((r) => [r.id, r])) : null);
const dev = load('device.json'), cloud = load('cloud.json');
const systems = {
  regex: (id) => new Set(detect(meta[id].text)),
  ...(dev && { nano: (id) => new Set(dev[id]?.got || []), 'nano+regex': (id) => new Set([...(dev[id]?.got || []), ...detect(meta[id].text)]) }),
  ...(cloud && { cloud: (id) => new Set(cloud[id]?.got || []), 'cloud+regex': (id) => new Set([...(cloud[id]?.got || []), ...detect(meta[id].text)]) }),
};
const f = (n) => (Number.isFinite(n) ? n.toFixed(2) : ' -  ');
function score(sys, ids) {
  let tp = 0, fp = 0, fn = 0, exact = 0;
  for (const id of ids) {
    const g = gold[id], p = sys(id);
    const a = [...p].filter((x) => g.has(x)).length; tp += a; fp += p.size - a; fn += g.size - a;
    if (a === g.size && p.size === g.size) exact++;
  }
  const P = tp / (tp + fp), R = tp / (tp + fn);
  return { P, R, F1: (2 * P * R) / (P + R), exact: `${exact}/${ids.length}`, fp, fn };
}
const splits = { 'dev (30)': S.filter((s) => !s.split).map((s) => s.id), 'held-out (20)': S.filter((s) => s.split).map((s) => s.id) };
for (const lang of ['en', 'ms', 'zh', 'mixed']) splits[`all, ${lang}`] = S.filter((s) => s.lang === lang).map((s) => s.id);
for (const [name, ids] of Object.entries(splits)) {
  console.log(`\n## ${name}`); console.log('system       P     R     F1    exact  fp fn');
  for (const [k, sys] of Object.entries(systems)) { const r = score(sys, ids); console.log(`${k.padEnd(12)} ${f(r.P)}  ${f(r.R)}  ${f(r.F1)}  ${r.exact.padEnd(6)} ${r.fp}  ${r.fn}`); }
}
console.log('\n## per-category recall, all 50');
for (const c of CATEGORIES) {
  const ids = S.filter((s) => gold[s.id].has(c)).map((s) => s.id);
  console.log(c.padEnd(16), `n=${ids.length}`, Object.entries(systems).map(([k, sys]) => `${k}=${ids.filter((id) => sys(id).has(c)).length}`).join('  '));
}
for (const [k, d] of [['device', dev], ['cloud', cloud]]) if (d) {
  const ms = Object.values(d).filter((r) => r.ms).map((r) => r.ms).sort((a, b) => a - b);
  console.log(`\n${k}: ${ms.length}/50 answered, errors ${Object.values(d).filter((r) => r.error && !r.got).length}, median ${ms[ms.length >> 1]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms, sources ${JSON.stringify(Object.values(d).reduce((a, r) => ((a[r.src || 'err'] = (a[r.src || 'err'] || 0) + 1), a), {}))}`);
}
