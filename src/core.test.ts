import { describe, expect, it } from 'vitest';
import { detectCategories, findValues } from './detectors';
import { redact, stillHasValues } from './redact';
import { assess, individualsDeadline } from './rules';
import { SAMPLE } from './sample';

describe('detectors', () => {
  it('finds Malaysian IC, phone, email and account formats', () => {
    const t = 'Siti Aminah binti Ahmad, 920714-10-5531, 013-998 1122, siti@gmail.com, Maybank 1234-5678-9012';
    expect(detectCategories(t)).toEqual(expect.arrayContaining(['name', 'identity_number', 'phone', 'email', 'financial']));
    expect(findValues(t).map((h) => h.category)).toEqual(['name', 'identity_number', 'phone', 'email', 'financial']);
  });
  it('does not flag an ordinary stock list', () => {
    expect(detectCategories('beras 10kg x 25 beg, minyak masak 5kg x 18')).toEqual([]);
  });
  it('tags phone numbers as phones, not accounts', () => {
    expect(findValues('call 012-889 7766 now')[0].category).toBe('phone');
  });
});

describe('redact', () => {
  it('removes values and model-flagged names, leaving placeholders', () => {
    const r = redact('Puan Halimah (012-334 5566, IC 880515-01-6677) told us.', [{ category: 'name', value: 'Puan Halimah' }]);
    expect(r.text).toBe('[NAME_1] ([PHONE_1], IC [ID_1]) told us.');
    expect(stillHasValues(r.text)).toBe(false);
  });
  it('removes password values', () => {
    expect(redact('Kata laluan e-mel ialah Syarikat123 dan PIN 4482.').text).not.toMatch(/Syarikat123|4482/);
  });
  it('leaves the sample containment answer without values', () => {
    expect(stillHasValues(redact(SAMPLE.containment).text)).toBe(false);
  });
});

describe('rules', () => {
  const at = new Date('2026-11-20T10:00:00+08:00');
  it('requires both notifications for health data and sets a 72-hour deadline from the breach', () => {
    const a = assess({ categories: ['name', 'health'], affected: 40, breachAt: at, discoveredAt: null });
    expect(a.notifyCommissioner).toBe(true);
    expect(a.notifyIndividuals).toBe(true);
    expect(a.commissionerDeadline?.toISOString()).toBe('2026-11-23T02:00:00.000Z');
    expect(a.deadlineBasis).toBe('breach');
  });
  it('requires only the Commissioner for scale alone', () => {
    const a = assess({ categories: ['email'], affected: 1500, breachAt: null, discoveredAt: at });
    expect(a).toMatchObject({ notifyCommissioner: true, notifyIndividuals: false, deadlineBasis: 'discovery' });
  });
  it('treats IC numbers with names as an identity-fraud risk', () => {
    expect(assess({ categories: ['name', 'identity_number'], affected: 5, breachAt: at, discoveredAt: at }).notifyIndividuals).toBe(true);
  });
  it('needs no notification for emails alone at small scale', () => {
    const a = assess({ categories: ['email'], affected: 20, breachAt: at, discoveredAt: at });
    expect(a.notifyCommissioner).toBe(false);
  });
  it('gives individuals 7 days after the Commissioner is told', () => {
    expect(individualsDeadline(at).toISOString()).toBe('2026-11-27T02:00:00.000Z');
  });
});
