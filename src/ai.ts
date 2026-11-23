import { getGenerativeModel, InferenceMode, Schema } from 'firebase/ai';
import { ai, config, configReady } from './firebase';
import { CATEGORIES, type Category } from './detectors';

export type Source = 'on_device' | 'in_cloud';

// ---------- on-device: what kinds of personal data are in the leak (measured in quickstart/study) ----------
const CLASSIFY_INSTRUCTION = `You triage leaked records for a data-breach report. List every category of personal data that appears in the text.
Categories: name (a real person's name), identity_number (national ID such as MyKad/NRIC, passport number), phone, email,
address (street or postal address), financial (bank or card number, salary, income, balance, debt), health (medical condition,
medication, treatment), credentials (password, PIN, OTP, login secret). Return an empty list if none appear.
The text may be in English, Malay or Chinese, or mixed.

Text:
`;
const categoriesJson = {
  type: 'object',
  properties: { categories: { type: 'array', items: { type: 'string', enum: CATEGORIES } } },
  required: ['categories'],
};
const classifier = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_ON_DEVICE,
  onDeviceParams: { promptOptions: { responseConstraint: categoriesJson } },
});

// ---------- on-device: exact names and addresses in short free text, so they can be blacked out ----------
const SPANS_INSTRUCTION = `Copy out, exactly as written, every person's name and every street or postal address in the text below.
Do not include company names, job titles or anything else. Return empty lists if there are none.

Text:
`;
const spansJson = {
  type: 'object',
  properties: { names: { type: 'array', items: { type: 'string' } }, addresses: { type: 'array', items: { type: 'string' } } },
  required: ['names', 'addresses'],
};
const spanFinder = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_ON_DEVICE,
  onDeviceParams: { promptOptions: { responseConstraint: spansJson } },
});

export type DeviceStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

/** Whether Chrome's built-in model can run here. Never triggers a download by itself. */
export async function deviceStatus(): Promise<DeviceStatus> {
  const LM = (globalThis as { LanguageModel?: { availability(o?: object): Promise<string> } }).LanguageModel;
  if (!LM) return 'unavailable';
  try {
    return (await LM.availability({ expectedInputs: [{ type: 'text' }, { type: 'image' }] })) as DeviceStatus;
  } catch {
    return 'unavailable';
  }
}

/** Downloads (if needed) and warms the on-device model. Must be called from a user action. */
export async function prepareDevice(onProgress?: (p: number) => void): Promise<void> {
  await classifier.initializeDeviceModel(onProgress);
}

export interface ImagePart { mimeType: 'image/png' | 'image/jpeg'; data: string }

export async function classifyOnDevice(text: string, image?: ImagePart): Promise<{ categories: Category[]; ms: number; source: Source }> {
  const t = performance.now();
  const parts = image ? [CLASSIFY_INSTRUCTION + text, { type: 'inlineData' as const, inlineData: image }] : CLASSIFY_INSTRUCTION + text;
  const r = await classifier.generateContent(parts);
  const raw = JSON.parse(r.response.text()).categories ?? [];
  return {
    categories: (raw as string[]).filter((c): c is Category => (CATEGORIES as string[]).includes(c)),
    ms: Math.round(performance.now() - t),
    source: r.response.inferenceSource as Source,
  };
}

export async function findNamesAndAddresses(text: string): Promise<{ category: Category; value: string }[]> {
  if (!text.trim()) return [];
  const r = await spanFinder.generateContent(SPANS_INSTRUCTION + text);
  const j = JSON.parse(r.response.text());
  return [
    ...((j.names ?? []) as string[]).map((value) => ({ category: 'name' as Category, value })),
    ...((j.addresses ?? []) as string[]).map((value) => ({ category: 'address' as Category, value })),
  ].filter((e) => e.value && text.includes(e.value));
}

// ---------- cloud: draft the notices from the redacted fact sheet only ----------
export interface Drafts { commissionerNotice: string; customerNoticeEn: string; customerNoticeMs: string; incidentLog: string }

const draftsSchema = Schema.object({
  properties: {
    commissionerNotice: Schema.string(),
    customerNoticeEn: Schema.string(),
    customerNoticeMs: Schema.string(),
    incidentLog: Schema.string(),
  },
});
const drafterFor = (model: string) => getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_IN_CLOUD,
  inCloudParams: {
    model,
    generationConfig: { responseMimeType: 'application/json', responseSchema: draftsSchema },
    systemInstruction: `You help a small Malaysian business respond to a personal data breach under the Personal Data Protection Act 2010
and the Commissioner's Guideline on Data Breach Notification. You receive a redacted fact sheet in JSON. Placeholders like [NAME_1]
stand for removed personal data: never guess or invent what they hide. Write plainly and factually; do not admit legal liability;
do not promise compensation. Use only facts in the fact sheet and write "[to confirm]" where a needed fact is missing.
Keep the placeholder [CONTACT_PERSON] exactly as written wherever the contact person is named; it is filled in on the user's device.
Other placeholders such as [NAME_1] or [PHONE_1] must not appear in the notices: refer to that person by their role instead (for example "a parent").
Format each text with short paragraphs separated by blank lines, and start each section of the Commissioner notice with a short heading line.
Return JSON with:
- commissionerNotice: an initial notification to the Personal Data Protection Commissioner covering what happened, when it happened and
  was discovered, the kinds of personal data involved, approximate number of people affected, likely consequences, containment steps taken,
  steps planned, and the organisation's contact person.
- customerNoticeEn: a short, calm notice to affected individuals in English: what happened, what data was involved, what we are doing,
  what they should do (e.g. watch for scam calls, change passwords), and who to contact.
- customerNoticeMs: the same customer notice in natural Bahasa Melayu.
- incidentLog: an internal incident record with a timeline and the decisions made.`,
  },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function draftNotices(factSheet: object, onRetry?: (attempt: number) => void): Promise<{ drafts: Drafts; ms: number; source: Source; model: string }> {
  await configReady;
  const model = config.cloudModel();
  const drafter = drafterFor(model);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const t = performance.now();
    try {
      const r = await drafter.generateContent(JSON.stringify(factSheet, null, 2));
      return { drafts: JSON.parse(r.response.text()) as Drafts, ms: Math.round(performance.now() - t), source: r.response.inferenceSource as Source, model };
    } catch (e) {
      lastError = e;
      if (!/\b(429|500|503)\b/.test(String(e))) break;
      onRetry?.(attempt + 1);
      await sleep(8000 * (attempt + 1));
    }
  }
  throw lastError;
}
