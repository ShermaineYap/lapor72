import { findValues, type Category } from './detectors';

const TAG: Record<Category, string> = {
  name: 'NAME', identity_number: 'ID', phone: 'PHONE', email: 'EMAIL',
  address: 'ADDRESS', financial: 'ACCOUNT', health: 'HEALTH', credentials: 'SECRET',
};

export interface Redaction { text: string; removed: { tag: string; category: Category }[] }

/**
 * Replaces personal-data values with placeholders such as [NAME_1].
 * `extra` holds exact strings the on-device model flagged (names, addresses) that rules cannot find.
 */
export function redact(text: string, extra: { category: Category; value: string }[] = []): Redaction {
  const removed: Redaction['removed'] = [];
  const counters: Partial<Record<Category, number>> = {};
  const tagFor = (c: Category) => `[${TAG[c]}_${(counters[c] = (counters[c] ?? 0) + 1)}]`;
  let out = text;
  // Model-flagged strings first (longest first so "Siti Aminah binti Ahmad" beats "Siti").
  for (const e of [...extra].sort((a, b) => b.value.length - a.value.length)) {
    const v = e.value.trim();
    if (v.length < 3 || !out.includes(v)) continue;
    const tag = tagFor(e.category);
    out = out.split(v).join(tag);
    removed.push({ tag, category: e.category });
  }
  // Then deterministic values, right to left so indexes stay valid.
  const hits = findValues(out).filter((h) => !/^\[[A-Z]+_\d+\]$/.test(h.value));
  for (const h of [...hits].reverse()) {
    const tag = tagFor(h.category);
    out = out.slice(0, h.index) + tag + out.slice(h.index + h.value.length);
    removed.push({ tag, category: h.category });
  }
  return { text: out, removed };
}

/** True if the text still contains a value the deterministic rules recognise. */
export function stillHasValues(text: string): boolean {
  return findValues(text).length > 0;
}
