// Deterministic detectors for Malaysian personal-data formats. Pure functions, no network.
// CATEGORY_PATTERNS decide which kinds of data are present (measured in quickstart/study).
// VALUE_PATTERNS find the exact values to black out before anything leaves the device.

export type Category =
  | 'name' | 'identity_number' | 'phone' | 'email' | 'address' | 'financial' | 'health' | 'credentials';

export const CATEGORIES: Category[] = ['name', 'identity_number', 'phone', 'email', 'address', 'financial', 'health', 'credentials'];

export const CATEGORY_LABEL: Record<Category, string> = {
  name: 'Names',
  identity_number: 'IC or passport numbers',
  phone: 'Phone numbers',
  email: 'Email addresses',
  address: 'Home or postal addresses',
  financial: 'Bank, card or salary details',
  health: 'Health information',
  credentials: 'Passwords or PINs',
};

const CATEGORY_PATTERNS: Record<Category, RegExp[]> = {
  identity_number: [
    /\b\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-?\d{2}-?\d{4}\b/,
    /\b(passport|pasport|护照)\s*(no\.?|number)?\s*[:#]?\s*[A-Z]\d{8}\b/i,
    /\b(IC|no\.?\s*kp|NRIC|身份证)\b/i,
  ],
  phone: [
    /(?<!\d)(\+?6?0)1\d[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/,
    /(?<!\d)0[3-9][-\s]?\d{4}[-\s]?\d{4}(?!\d)/,
  ],
  email: [/[\w.+-]+@[\w-]+\.[\w.-]+/],
  financial: [
    /\b(?:\d{4}[\s-]){3}\d{4}\b/,
    /\b(acct|account|akaun|bank|maybank|cimb|rhb|public bank|hong leong|ambank|bank islam|duitnow)\b[^\n]{0,30}?\d[\d\s-]{7,}\d/i,
    /(户口|账户|银行)[^\n]{0,10}?\d[\d\s-]{7,}\d/,
    /\b(gaji|salary|net pay|baki|balance|月薪|薪水|hutang|fees overdue)\b/i,
  ],
  address: [
    /\b(jalan|jln|lorong|lrg|persiaran|taman|kampung|kg\.?|lot\s*\d+|no\.?\s*\d+[a-z]?,?\s*jalan)\b/i,
    /\b\d{5}\s+[A-Z][a-z]+/,
    /(路|街|花园).{0,6}\d+\s*号|\d+\s*号/,
  ],
  health: [
    /\b(diabetes|hypertension|asthma|diagnos\w*|patient|medication|amlodipine|metformin|BP\s*\d{2,3}\/\d{2,3}|allerg\w*|pregnan\w*|HIV|cancer|heart disease)\b/i,
    /\b(kencing manis|darah tinggi|asma|alahan|ubat|pesakit|sakit jantung|hamil|barah)\b/i,
    /(糖尿病|高血压|哮喘|病人|服用|诊断|过敏|心脏病)/,
  ],
  credentials: [
    /\b(password|passwd|pwd|kata laluan|PIN|OTP|login|password_hash)\b/i,
    /(密码|口令)/,
    /\$2[aby]\$\d{2}\$/,
  ],
  name: [
    /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(bin|binti|a\/l|a\/p)\s[A-Z][a-z]+/,
    /\b(Encik|Puan|Cik|Tuan|Mr|Mrs|Ms|Dr|Madam)\.?\s[A-Z][a-z]+/,
  ],
};

/** Categories found by the deterministic rules. */
export function detectCategories(text: string): Category[] {
  return CATEGORIES.filter((c) => CATEGORY_PATTERNS[c].some((p) => p.test(text)));
}

export interface Hit { category: Category; value: string; index: number }

// Exact values to remove. Keyword-only patterns (e.g. "diabetes") are not values and are not listed.
const VALUE_PATTERNS: [Category, RegExp][] = [
  ['identity_number', /\b\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-?\d{2}-?\d{4}\b/g],
  ['identity_number', /\b[A-Z]\d{8}\b/g],
  ['email', /[\w.+-]+@[\w-]+\.[\w.-]*\w/g],
  ['financial', /\b(?:\d{4}[\s-]){3}\d{4}\b/g],
  ['phone', /(?<!\d)(?:\+?6?0)1\d[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/g],
  ['phone', /(?<!\d)0[3-9][-\s]?\d{4}[-\s]?\d{4}(?!\d)/g],
  ['financial', /\b\d{1,4}(?:[\s-]\d{3,6}){2,4}\b/g],
  ['credentials', /\$2[aby]\$\d{2}\$[^\s,]+/g],
  // A secret value: 4+ characters with at least one digit or symbol, after a password word,
  // optionally with up to two words between (e.g. "kata laluan e-mel ialah Syarikat123").
  ['credentials', /(?<=\b(?:password|passwd|pwd|kata laluan|PIN|key|pass)\b(?:\s+[\w-]+){0,2}?\s*(?:ialah|is|=|:)?\s*)(?=[^\s,;]*[\d@#$%!&*])[^\s,;]*[^\s,;.]/gi],
  ['credentials', /(?<=(?:密码|口令)[^:：\n]{0,6}[:：]?\s*)[^\s，,。]{4,}/g],
  ['name', /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:bin|binti|a\/l|a\/p)\s[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g],
];

/** Exact personal-data values found by the deterministic rules, longest first, without overlaps. */
export function findValues(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const [category, re] of VALUE_PATTERNS) {
    for (const m of text.matchAll(re)) hits.push({ category, value: m[0], index: m.index ?? 0 });
  }
  hits.sort((a, b) => b.value.length - a.value.length);
  const kept: Hit[] = [];
  for (const h of hits) {
    const end = h.index + h.value.length;
    if (!kept.some((k) => h.index < k.index + k.value.length && end > k.index)) kept.push(h);
  }
  return kept.sort((a, b) => a.index - b.index);
}

/** Short snippet around the first occurrence of a value, for showing evidence to the user. */
export function evidenceFor(text: string, category: Category): string | null {
  for (const p of CATEGORY_PATTERNS[category]) {
    const m = p.exec(text);
    if (m) {
      const start = Math.max(0, m.index - 18), end = Math.min(text.length, m.index + m[0].length + 18);
      return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : '');
    }
  }
  return null;
}
