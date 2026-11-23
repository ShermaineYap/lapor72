import type { Category } from './detectors';

// Encodes the notification tests in Malaysia's Personal Data Protection Commissioner
// Guideline on Data Breach Notification (Feb 2025), as summarised by law-firm guides.
// Output is a draft assessment for a human to confirm, not legal advice.

export const HOURS_TO_COMMISSIONER = 72;
export const DAYS_TO_INDIVIDUALS = 7;
export const SIGNIFICANT_SCALE = 1000;

export interface IncidentFacts {
  categories: Category[];
  affected: number | null;
  breachAt: Date | null;
  discoveredAt: Date | null;
}

export interface Assessment {
  notifyCommissioner: boolean;
  notifyIndividuals: boolean;
  reasons: string[];
  commissionerDeadline: Date | null;
  deadlineBasis: 'breach' | 'discovery' | null;
}

export interface Thresholds { hours: number; days: number; scale: number }
const DEFAULTS: Thresholds = { hours: HOURS_TO_COMMISSIONER, days: DAYS_TO_INDIVIDUALS, scale: SIGNIFICANT_SCALE };

export function assess(f: IncidentFacts, t: Thresholds = DEFAULTS): Assessment {
  const has = (c: Category) => f.categories.includes(c);
  const harm: string[] = [];
  if (has('health')) harm.push('Health information is sensitive personal data.');
  if (has('financial')) harm.push('Bank, card or salary details could lead to financial loss.');
  if (has('credentials')) harm.push('Leaked passwords or PINs could let someone take over accounts.');
  if (has('identity_number') && (has('name') || has('phone') || has('address')))
    harm.push('IC or passport numbers together with other details could enable identity fraud.');
  const scale = (f.affected ?? 0) > t.scale;

  const reasons = [...harm];
  if (scale) reasons.push(`More than ${t.scale.toLocaleString('en-MY')} people are affected (significant scale).`);
  if (!reasons.length) reasons.push(`None of the significant-harm tests matched and no more than ${t.scale.toLocaleString('en-MY')} people are affected. Record the incident internally and keep reviewing it.`);

  const start = f.breachAt ?? f.discoveredAt;
  return {
    notifyCommissioner: harm.length > 0 || scale,
    notifyIndividuals: harm.length > 0,
    reasons,
    commissionerDeadline: start ? new Date(start.getTime() + t.hours * 3600_000) : null,
    deadlineBasis: f.breachAt ? 'breach' : f.discoveredAt ? 'discovery' : null,
  };
}

export function individualsDeadline(commissionerNotifiedAt: Date, days = DAYS_TO_INDIVIDUALS): Date {
  return new Date(commissionerNotifiedAt.getTime() + days * 86400_000);
}
