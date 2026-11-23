import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_LABEL, detectCategories, evidenceFor, findValues, type Category } from './detectors';
import { redact, stillHasValues } from './redact';
import { assess, individualsDeadline } from './rules';
import { CAUSES, RECORDED, SAMPLE } from './sample';
import { config, configReady } from './firebase';
import { listCases, saveCase, type SavedCase } from './cases';
import {
  classifyOnDevice, deviceStatus, draftNotices, findNamesAndAddresses, prepareDevice,
  type DeviceStatus, type Drafts, type ImagePart, type Source,
} from './ai';

const MODEL_CHAR_LIMIT = 6000;
const CONTACT_PLACEHOLDER = '[CONTACT_PERSON]';
type Step = 1 | 2 | 3 | 4 | 5;
type RunSource = Source | 'rules' | 'recorded';
interface RunLog { what: string; source: RunSource; ms: number; requests?: number }

/** Counts requests that left the browser (other origins, excluding fonts) while `fn` runs. */
async function countRequests<T>(fn: () => Promise<T>): Promise<{ value: T; requests: number }> {
  const seen: string[] = [];
  const isExternal = (e: PerformanceEntry) => {
    const u = new URL(e.name);
    return u.origin !== location.origin && !u.host.startsWith('fonts.');
  };
  const obs = new PerformanceObserver((list) => list.getEntries().filter(isExternal).forEach((e) => seen.push(e.name)));
  obs.observe({ type: 'resource', buffered: false });
  try {
    const value = await fn();
    await new Promise((r) => setTimeout(r, 300)); // let the last entries arrive
    return { value, requests: seen.length };
  } finally { obs.disconnect(); }
}

const myt = (d: Date) =>
  d.toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' (Malaysia time)';
const fmtDateTime = (d: Date) =>
  d.toLocaleString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Badge({ source }: { source: RunSource }) {
  const text = source === 'on_device' ? 'Ran on this device' : source === 'in_cloud' ? 'Ran in the cloud' : source === 'recorded' ? 'Recorded on-device result' : 'Rules on this device';
  return <span className={`badge badge-${source}`}>{text}</span>;
}

function Clock({ deadline, basis }: { deadline: Date | null; basis: 'breach' | 'discovery' | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = deadline ? deadline.getTime() - now : 72 * 3600_000;
  const overdue = left < 0;
  const abs = Math.abs(left);
  const h = Math.floor(abs / 3600_000), m = Math.floor((abs % 3600_000) / 60_000), s = Math.floor((abs % 60_000) / 1000);
  const digits = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const state = !deadline ? 'idle' : overdue ? 'overdue' : left < 12 * 3600_000 ? 'urgent' : 'running';
  return (
    <header className={`clock clock-${state}`} aria-live="off">
      <div className="clock-inner">
        <div className="brand">Lapor72</div>
        <div className="clock-digits" aria-label={deadline ? `${h} hours ${m} minutes ${overdue ? 'overdue' : 'left'}` : '72 hours'}>
          {overdue && <span className="clock-sign">+</span>}{digits}
        </div>
        <p className="clock-caption">
          {!deadline && 'Malaysian law gives you 72 hours to tell the Personal Data Protection Commissioner about a serious breach. The clock starts when you enter the breach time in step 2.'}
          {deadline && !overdue && <>left to notify the Commissioner, by <strong>{fmtDateTime(deadline)}</strong>{basis === 'discovery' && ' (counted from discovery because the breach time is unknown)'}.</>}
          {deadline && overdue && <>past the 72-hour deadline of {fmtDateTime(deadline)}. Notify now and explain the delay in writing.</>}
        </p>
      </div>
    </header>
  );
}

export default function App() {
  const [step, setStep] = useState<Step>(1);
  const [runs, setRuns] = useState<RunLog[]>([]);
  const logRun = (r: RunLog) => setRuns((x) => [...x, r]);

  // Step 1: the leak
  const [device, setDevice] = useState<DeviceStatus | 'checking'>('checking');
  const [progress, setProgress] = useState<number | null>(null);
  const [leak, setLeak] = useState('');
  const [image, setImage] = useState<(ImagePart & { url: string }) | null>(null);
  const [checking, setChecking] = useState(false);
  const [modelCats, setModelCats] = useState<Category[] | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<Category>>(new Set());
  const [checked, setChecked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  const [saved, setSaved] = useState<SavedCase[]>([]);
  const [saveNote, setSaveNote] = useState('');
  const [caseId] = useState(() => crypto.randomUUID());
  useEffect(() => { listCases().then(setSaved).catch(() => {}); }, []);

  useEffect(() => {
    deviceStatus().then((s) => {
      setDevice(s);
      // Loading the model into memory takes ~10-15 s the first time; do it while the user reads.
      if (s === 'available') classifyOnDevice('warm-up').catch(() => {});
    });
  }, []);

  const ruleCats = useMemo(() => detectCategories(leak), [leak]);
  const valuesInLeak = useMemo(() => findValues(leak).length, [leak]);
  const rows = useMemo(() => Math.max(0, leak.trim().split('\n').length - (leak.includes(',') ? 1 : 0)), [leak]);

  // Step 2: what happened
  const [org, setOrg] = useState('');
  const [contact, setContact] = useState('');
  const [breachAt, setBreachAt] = useState('');
  const [discoveredAt, setDiscoveredAt] = useState('');
  const [howDiscovered, setHowDiscovered] = useState('');
  const [cause, setCause] = useState('');
  const [affected, setAffected] = useState('');
  const [containment, setContainment] = useState('');

  const facts = {
    categories: [...chosen],
    affected: affected ? Number(affected) : null,
    breachAt: breachAt ? new Date(breachAt) : null,
    discoveredAt: discoveredAt ? new Date(discoveredAt) : null,
  };
  const [thresholds, setThresholds] = useState({ hours: 72, days: 7, scale: 1000 });
  useEffect(() => {
    configReady.then(() => setThresholds({ hours: config.hoursToCommissioner(), days: config.daysToIndividuals(), scale: config.significantScale() }));
  }, []);
  const assessment = assess(facts, thresholds);

  // Step 4 and 5
  const [outbound, setOutbound] = useState<{ sheet: object; json: string; removed: number; safe: boolean } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [drafting, setDrafting] = useState<'idle' | 'working' | 'error'>('idle');
  const [draftNote, setDraftNote] = useState('');

  function loadSample() {
    setLeak(SAMPLE.leak); setImage(null);
    setOrg(SAMPLE.organisation); setContact(SAMPLE.contact);
    const now = new Date();
    const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setBreachAt(local(new Date(now.getTime() - 26 * 3600_000)));
    setDiscoveredAt(local(new Date(now.getTime() - 3 * 3600_000)));
    setHowDiscovered(SAMPLE.howDiscovered); setCause(SAMPLE.cause);
    setAffected(String(SAMPLE.affected)); setContainment(SAMPLE.containment);
    setChecked(false); setModelCats(null);
  }

  async function onImage(f: File | undefined) {
    if (!f) return;
    if (!['image/png', 'image/jpeg'].includes(f.type)) { setModelError('Use a PNG or JPEG screenshot.'); return; }
    const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(f); });
    setImage({ mimeType: f.type as ImagePart['mimeType'], data, url: URL.createObjectURL(f) });
    setChecked(false);
  }

  async function checkLeak() {
    setChecking(true); setModelError(null); setModelCats(null);
    const t = performance.now();
    const rules = detectCategories(leak);
    logRun({ what: 'Pattern rules scanned the leak', source: 'rules', ms: Math.round(performance.now() - t) });
    let found = new Set<Category>(rules);
    try {
      if (device === 'downloadable' || device === 'downloading') {
        setProgress(0);
        await prepareDevice((p) => setProgress(p));
        setDevice(await deviceStatus()); setProgress(null);
      }
      if ((await deviceStatus()) === 'available') {
        const { value: r, requests } = await countRequests(() => classifyOnDevice(leak.slice(0, MODEL_CHAR_LIMIT), image ?? undefined));
        setModelCats(r.categories);
        logRun({ what: 'Gemini Nano read the leak', source: r.source, ms: r.ms, requests });
        found = new Set([...found, ...r.categories]);
      } else if (leak === SAMPLE.leak && !image) {
        setModelCats([...RECORDED.categories]);
        logRun({ what: 'Gemini Nano result for the sample, recorded on a MacBook Air M3', source: 'recorded', ms: 0 });
        found = new Set([...found, ...RECORDED.categories]);
        setModelError('This browser has no on-device model, so the sample shows a result recorded earlier with Gemini Nano in Chrome. Your own data would be checked by the pattern rules only. Nothing was sent to the cloud.');
      } else {
        setModelError('This browser has no on-device model, so only the pattern rules checked the leak. They miss most names. Nothing was sent to the cloud.');
      }
    } catch (e) {
      setModelError(`The on-device model could not run (${String(e).slice(0, 120)}). Only the pattern rules checked the leak. Nothing was sent to the cloud.`);
    }
    setChosen(found); setChecked(true); setChecking(false);
  }

  async function prepareOutbound() {
    setPreparing(true);
    const free = [howDiscovered, containment].join('\n');
    let modelFlagged: { category: Category; value: string }[] = [];
    if ((await deviceStatus()) === 'available') {
      const t = performance.now();
      try {
        const { value, requests } = await countRequests(() => findNamesAndAddresses(free));
        modelFlagged = value;
        logRun({ what: 'Gemini Nano looked for names and addresses in your answers', source: 'on_device', ms: Math.round(performance.now() - t), requests });
      } catch { /* rules still run below */ }
    } else if (howDiscovered === SAMPLE.howDiscovered) {
      modelFlagged = [...RECORDED.answerNames];
      logRun({ what: 'Gemini Nano result for the sample answers, recorded earlier', source: 'recorded', ms: 0 });
    }
    const how = redact(howDiscovered, modelFlagged);
    const cont = redact(containment, modelFlagged);
    const sheet = {
      organisation: org || '[to confirm]',
      // The contact's real name is put back into the drafts on this device after they come back.
      contactPerson: contact.trim() ? CONTACT_PLACEHOLDER : '[to confirm]',
      incident: {
        cause: CAUSES.find((c) => c.value === cause)?.label ?? '[to confirm]',
        whatHappened: how.text || '[to confirm]',
        breachOccurred: facts.breachAt ? myt(facts.breachAt) : 'unknown',
        discovered: facts.discoveredAt ? myt(facts.discoveredAt) : '[to confirm]',
        containmentSoFar: cont.text || '[to confirm]',
      },
      dataInvolved: [...chosen].map((c) => CATEGORY_LABEL[c]),
      approximatePeopleAffected: facts.affected ?? '[to confirm]',
      assessment: {
        notifyCommissioner: assessment.notifyCommissioner,
        notifyAffectedIndividuals: assessment.notifyIndividuals,
        reasons: assessment.reasons,
        commissionerDeadline: assessment.commissionerDeadline ? myt(assessment.commissionerDeadline) : '[to confirm]',
      },
    };
    const json = JSON.stringify(sheet, null, 2);
    const removed = how.removed.length + cont.removed.length + (contact.trim() ? 1 : 0);
    setOutbound({ sheet, json, removed, safe: !stillHasValues(json) });
    setPreparing(false); setStep(4);
  }

  async function sendForDrafting() {
    if (!outbound?.safe) return;
    setDrafting('working'); setDraftNote('');
    try {
      const { value: r, requests } = await countRequests(() => draftNotices(outbound.sheet, (n) => setDraftNote(`Gemini is busy. Trying again (${n} of 2)…`)));
      saveCase({ id: caseId, organisation: org || 'Unnamed organisation', commissionerDeadline: assessment.commissionerDeadline?.toISOString() ?? null, sheet: outbound.sheet, drafts: r.drafts })
        .then(() => { setSaveNote('Saved to your case file in Firestore: the redacted fact sheet and drafts only.'); listCases().then(setSaved).catch(() => {}); })
        .catch(() => setSaveNote('Could not save the case file. Your drafts are still here.'));
      const fill = (t: string) => t.split(CONTACT_PLACEHOLDER).join(contact.trim() || CONTACT_PLACEHOLDER);
      setDrafts({
        commissionerNotice: fill(r.drafts.commissionerNotice), customerNoticeEn: fill(r.drafts.customerNoticeEn),
        customerNoticeMs: fill(r.drafts.customerNoticeMs), incidentLog: fill(r.drafts.incidentLog),
      });
      logRun({ what: `${r.model} drafted the notices from the fact sheet`, source: r.source, ms: r.ms, requests });
      if (contact.trim()) logRun({ what: 'Your contact person was put back into the drafts', source: 'rules', ms: 0 });
      setDrafting('idle'); setStep(5);
    } catch (e) {
      setDrafting('error');
      setDraftNote(/App ?Check|appCheck|403/i.test(String(e))
        ? 'The cloud refused this browser because it could not be verified (App Check). Reload the page and try again; on localhost, register this browser\'s debug token in the Firebase console.'
        : /429/.test(String(e))
        ? 'The free cloud quota is used up for this minute. Wait a minute and press Draft the notices again.'
        : `The cloud model did not answer (${String(e).slice(0, 100)}). Press Draft the notices to try again.`);
    }
  }

  const steps: { n: Step; title: string; done: boolean }[] = [
    { n: 1, title: 'Check the leaked data', done: checked },
    { n: 2, title: 'Say what happened', done: !!(breachAt || discoveredAt) && !!cause },
    { n: 3, title: 'See who you must tell', done: step > 3 },
    { n: 4, title: 'Check what leaves this device', done: !!drafts },
    { n: 5, title: 'Edit the notices', done: false },
  ];
  const canOpen = (n: Step) => n === 1 || (n === 2 && checked) || (n === 3 && steps[1].done) || (n === 4 && !!outbound) || (n === 5 && !!drafts);

  return (
    <>
      <Clock deadline={assessment.commissionerDeadline} basis={assessment.deadlineBasis} />
      <div className="layout">
        <nav className="rail" aria-label="Steps">
          <ol>
            {steps.map((s) => (
              <li key={s.n}>
                <button className={`rail-step ${step === s.n ? 'current' : ''} ${s.done ? 'done' : ''}`} disabled={!canOpen(s.n)}
                  aria-current={step === s.n ? 'step' : undefined} onClick={() => setStep(s.n)}>
                  <span className="rail-n">{s.n}</span><span>{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
          {saved.length > 0 && (
            <div className="ledger">
              <h2>Your saved cases</h2>
              <ul>{saved.map((c) => (
                <li key={c.id}>
                  <button className="link" onClick={() => { if (c.drafts) { setDrafts(c.drafts); setStep(5); } }}>{c.organisation}</button>
                  {c.commissionerDeadline && <span className="muted">, Commissioner by {fmtDateTime(new Date(c.commissionerDeadline))}</span>}
                </li>
              ))}</ul>
            </div>
          )}
          <div className="ledger">
            <h2>Where each step ran</h2>
            {runs.length === 0 && <p className="muted">Nothing has run yet.</p>}
            <ul>{runs.map((r, i) => (
              <li key={i}><Badge source={r.source} /> {r.what} <span className="muted">{r.ms} ms</span>
                {r.requests !== undefined && <span className={`netcount ${r.requests ? 'net-out' : 'net-none'}`}>{r.requests === 0 ? 'No internet requests' : `${r.requests} internet request${r.requests > 1 ? 's' : ''}`}</span>}
              </li>
            ))}</ul>
          </div>
        </nav>

        <main className="work">
          {step === 1 && (
            <section>
              <h1>Check the leaked data</h1>
              <p className="lede">Paste a few rows of what leaked, or add a screenshot. It is read here, in your browser, and is never uploaded.</p>
              <DeviceLine status={device} progress={progress} />
              {!online && <p className="note">You are offline. Checking the data and working out who to tell still work on this device; drafting the notices needs a connection.</p>}
              <label className="field">
                <span>Leaked records</span>
                <textarea value={leak} onChange={(e) => { setLeak(e.target.value); setChecked(false); }} rows={9}
                  placeholder={'name,ic_no,phone\n…'} spellCheck={false} />
              </label>
              <div className="row">
                <button className="secondary" onClick={() => fileRef.current?.click()}>Add a screenshot</button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onImage(e.target.files?.[0])} />
                <button className="link" onClick={loadSample}>Try the sample incident</button>
              </div>
              {image && <figure className="shot"><img src={image.url} alt="Screenshot of the leaked data" /><button className="link" onClick={() => setImage(null)}>Remove screenshot</button></figure>}
              {leak.length > MODEL_CHAR_LIMIT && <p className="note">The on-device model reads the first {MODEL_CHAR_LIMIT.toLocaleString()} characters; the pattern rules read everything.</p>}
              <button className="primary" disabled={(!leak.trim() && !image) || checking} onClick={checkLeak}>
                {checking ? 'Checking on this device…' : 'Check the data'}
              </button>

              {checked && (
                <div className="findings">
                  <h2>What the leak contains</h2>
                  {modelError && <p className="warn">{modelError}</p>}
                  <p className="muted">Untick anything that is wrong. Each finding shows where it was seen.</p>
                  <ul className="cats">
                    {CATEGORIES.map((c) => {
                      const byRules = ruleCats.includes(c), byModel = !!modelCats?.includes(c);
                      if (!byRules && !byModel && !chosen.has(c)) return null;
                      const ev = evidenceFor(leak, c);
                      return (
                        <li key={c}>
                          <label className="cat">
                            <input type="checkbox" checked={chosen.has(c)} onChange={(e) => {
                              const n = new Set(chosen); e.target.checked ? n.add(c) : n.delete(c); setChosen(n);
                            }} />
                            <span className="cat-name">{CATEGORY_LABEL[c]}</span>
                            <span className="cat-how">{byRules && byModel ? 'Found by the rules and the model' : byRules ? 'Found by the rules' : byModel ? 'Found by the model; check it' : 'Added by you'}</span>
                          </label>
                          {ev && <code className="evidence">{ev}</code>}
                        </li>
                      );
                    })}
                  </ul>
                  {CATEGORIES.some((c) => !ruleCats.includes(c) && !modelCats?.includes(c) && !chosen.has(c)) && (
                    <details className="missed">
                      <summary>Add something the check missed</summary>
                      <div className="missed-list">
                        {CATEGORIES.filter((c) => !ruleCats.includes(c) && !modelCats?.includes(c) && !chosen.has(c)).map((c) => (
                          <button key={c} className="secondary" onClick={() => setChosen(new Set([...chosen, c]))}>Add {CATEGORY_LABEL[c].charAt(0).toLowerCase() + CATEGORY_LABEL[c].slice(1)}</button>
                        ))}
                      </div>
                    </details>
                  )}
                  {chosen.size === 0 && <p>No personal data found. If you know there was some, add it in step 2 by describing it.</p>}
                  <p className="kept"><strong>{valuesInLeak}</strong> personal data values in {rows || 'these'} rows stayed on this device.
                    {runs.find((r) => r.what === 'Gemini Nano read the leak')?.requests === 0 && ' No internet requests were made while checking.'}</p>
                  <button className="primary" onClick={() => setStep(2)}>Continue</button>
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section>
              <h1>Say what happened</h1>
              <p className="lede">Short answers are fine. Before anything goes to the cloud, names and numbers in these answers are removed on this device.</p>
              <div className="grid2">
                <label className="field"><span>Your organisation</span><input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="e.g. Cahaya Tuition Centre" /></label>
                <label className="field"><span>Contact person for the Commissioner (role is enough)</span><input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. Centre manager" /></label>
                <label className="field"><span>When did the breach happen?</span><input type="datetime-local" value={breachAt} onChange={(e) => setBreachAt(e.target.value)} /></label>
                <label className="field"><span>When did you find out?</span><input type="datetime-local" value={discoveredAt} onChange={(e) => setDiscoveredAt(e.target.value)} /></label>
              </div>
              <label className="field"><span>What caused it?</span>
                <select value={cause} onChange={(e) => setCause(e.target.value)}>
                  <option value="">Choose one</option>
                  {CAUSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="field"><span>How did you find out?</span><textarea rows={2} value={howDiscovered} onChange={(e) => setHowDiscovered(e.target.value)} /></label>
              <label className="field narrow"><span>About how many people are affected?</span><input inputMode="numeric" value={affected} onChange={(e) => setAffected(e.target.value.replace(/\D/g, ''))} placeholder={rows ? String(rows) : ''} /></label>
              <label className="field"><span>What have you done so far to contain it?</span><textarea rows={2} value={containment} onChange={(e) => setContainment(e.target.value)} /></label>
              <button className="primary" disabled={!steps[1].done} onClick={() => setStep(3)}>See who you must tell</button>
              {!steps[1].done && <p className="muted">Enter at least one of the two times and the cause.</p>}
            </section>
          )}

          {step === 3 && (
            <section>
              <h1>{assessment.notifyCommissioner ? 'You need to notify the Commissioner' : 'You may not need to notify anyone yet'}</h1>
              <div className="verdicts">
                <div className={`verdict ${assessment.notifyCommissioner ? 'yes' : 'no'}`}>
                  <h2>Personal Data Protection Commissioner</h2>
                  <p>{assessment.notifyCommissioner
                    ? <>Notify as soon as you can, and by <strong>{assessment.commissionerDeadline ? fmtDateTime(assessment.commissionerDeadline) : 'within 72 hours'}</strong>.</>
                    : 'Not required on these facts.'}</p>
                </div>
                <div className={`verdict ${assessment.notifyIndividuals ? 'yes' : 'no'}`}>
                  <h2>The people affected</h2>
                  <p>{assessment.notifyIndividuals
                    ? <>Tell them without delay, and within {thresholds.days} days of notifying the Commissioner (by {fmtDateTime(individualsDeadline(new Date(), thresholds.days))} if you notify today).</>
                    : 'Not required on these facts.'}</p>
                </div>
              </div>
              <h2>Why</h2>
              <ul className="reasons">{assessment.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              <p className="muted small">Based on the Commissioner's Guideline on Data Breach Notification (February 2025). This is a draft assessment to help you act quickly, not legal advice; check the guideline at pdp.gov.my or with a lawyer.</p>
              <button className="primary" disabled={preparing} onClick={prepareOutbound}>{preparing ? 'Removing personal data on this device…' : 'Prepare the fact sheet for drafting'}</button>
            </section>
          )}

          {step === 4 && outbound && (
            <section>
              <h1>Check what leaves this device</h1>
              <p className="lede">Only this fact sheet will be sent to Gemini in the cloud to draft the notices. The leaked records are not in it.</p>
              <div className="split">
                <div className="stays">
                  <h2>Stays on this device</h2>
                  <p><strong>{valuesInLeak}</strong> values in the leaked records</p>
                  <p><strong>{outbound.removed}</strong> names, numbers or addresses removed from your answers</p>
                </div>
                <div className="leaves">
                  <h2>Sent to the cloud</h2>
                  <pre className="payload">{outbound.json}</pre>
                </div>
              </div>
              {outbound.safe
                ? <p className="ok">Final check passed: no IC numbers, phone numbers, emails, account numbers or passwords are in the fact sheet.</p>
                : <p className="warn">The final check still found personal data in the fact sheet, so it will not be sent. Go back to step 2 and remove it from your answers.</p>}
              <button className="primary cloud" disabled={!outbound.safe || drafting === 'working'} onClick={sendForDrafting}>
                {drafting === 'working' ? 'Drafting in the cloud…' : 'Draft the notices'}
              </button>
              {draftNote && <p className={drafting === 'error' ? 'warn' : 'muted'}>{draftNote}</p>}
            </section>
          )}

          {step === 5 && drafts && (
            <section>
              <h1>Edit the notices</h1>
              <p className="lede">These are drafts. Replace every [placeholder] and anything marked [to confirm] before you send them.</p>
              {saveNote && <p className="muted small">{saveNote}</p>}
              <DraftBox title="Notification to the Commissioner" key={drafts.commissionerNotice} text={drafts.commissionerNotice} hint="Submit it through the form on pdp.gov.my." />
              <DraftBox title="Notice to affected people (English)" key={drafts.customerNoticeEn} text={drafts.customerNoticeEn} />
              <DraftBox title="Notis kepada individu terjejas (Bahasa Melayu)" key={drafts.customerNoticeMs} text={drafts.customerNoticeMs} />
              <DraftBox title="Internal incident record" key={drafts.incidentLog} text={drafts.incidentLog} hint="Keep this with your records of the breach." />
            </section>
          )}
        </main>
      </div>
    </>
  );
}

function DeviceLine({ status, progress }: { status: DeviceStatus | 'checking'; progress: number | null }) {
  if (progress !== null) return <p className="device">Downloading the on-device model: {Math.round(progress * 100)}%. This happens once.</p>;
  const text: Record<DeviceStatus | 'checking', string> = {
    checking: 'Checking for an on-device model…',
    available: 'On-device model ready. The leaked data will be read on this computer.',
    downloadable: 'Chrome can download its on-device model the first time you check data. It is a one-time download.',
    downloading: 'Chrome is downloading its on-device model.',
    unavailable: 'No on-device model in this browser. Pattern rules will still check the data here; use desktop Chrome for full checking.',
  };
  return <p className={`device device-${status}`}>{text[status]}</p>;
}

function DraftBox({ title, text, hint }: { title: string; text: string; hint?: string }) {
  const [value, setValue] = useState(text);
  const [copied, setCopied] = useState(false);
  return (
    <div className="draft">
      <div className="draft-head">
        <h2>{title}</h2>
        <button className="secondary" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {hint && <p className="muted small">{hint}</p>}
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={Math.min(18, Math.max(6, value.split('\n').length + 1))} />
    </div>
  );
}
