# Lapor72 – setup and day-1 findings

## Setup (22–23 Nov 2026)
- Firebase project: `lapor72` (Spark, no billing, Analytics off). Web app "Lapor72 Web".
- AI Logic: Gemini Developer API backend. SDK: firebase 13.4.0.
- App Check: Fraud Defense (reCAPTCHA Enterprise) provider, site key in quickstart/index.html (public).
  Key domains: lapor72.web.app, lapor72.firebaseapp.com (plan: deploy on Firebase Hosting).
  Debug token registered for the Claude built-in browser only. Chrome needs its own token
  (printed in Chrome's console on localhost) before cloud calls work there.
- Quick-start: `cd ~/dev/lapor72/quickstart && python3 -m http.server 5173`, open http://localhost:5173

## Measured (MacBook Air M3, 16 GB, Chrome 157)
| Test | Path | Latency |
|---|---|---|
| Plain prompt, PREFER_ON_DEVICE, first call | on_device | 16.1 s (session cold start) |
| Same, warm | on_device | 1.3 s |
| Structured JSON (category enum), first | on_device | 9.3 s |
| Same, warm | on_device | 1.7 s |
| Cloud gemini-3.5-flash-lite | in_cloud | 1.5 s |
| Cloud gemini-3.8-flash | failed 3 of 3 attempts: 429 (5 req/min free tier), 500 high demand, 503 deadline | – |
- Built-in browser (no usable Nano): PREFER_ON_DEVICE fell back to cloud automatically.
- Direct Prompt API test: Malay sample produced a false "identity_number" — pair Nano with regex.

## Consequences
- Free-tier cloud quota is tiny (5 RPM per model, shared by every judge). Keep cloud calls to the
  drafting step only, use gemini-3.5-flash-lite as default with 3.8-flash optional, add retry + demo mode.
- Warm the on-device session at page load (hide the 9–16 s cold start behind the intake screen).

## Detection study (23 Nov 2026) — `quickstart/study/`
50 synthetic leaked-record samples, hand-labelled with 8 categories (name, identity_number, phone, email,
address, financial, health, credentials): 30 development + 20 held-out written after `detectors.js` was
frozen (sha256 prefix e85ed1339d6b3d36). Languages: 16 en, 15 ms, 9 zh, 10 mixed. Re-score: `node score.mjs`.

| System | Held-out P | Held-out R | Held-out F1 | Exact (held-out) | Median latency |
|---|---|---|---|---|---|
| Regex only (frozen) | 1.00 | 0.64 | 0.78 | 10/20 | <1 ms |
| Gemini Nano on-device (Firebase AI Logic, ONLY_ON_DEVICE) | 0.97 | 1.00 | 0.99 | 19/20 | 1.25 s (p90 1.66 s) |
| Nano + regex (union) | 0.97 | 1.00 | 0.99 | 19/20 | 1.25 s |
| Cloud gemini-3.5-flash-lite (ONLY_IN_CLOUD) | 0.97 | 1.00 | 0.99 | 19/20 | 1.98 s (p90 5.53 s) |

All 50: Nano+regex F1 0.98 (6 false alarms, 0 misses); cloud F1 0.98 (3 false alarms, 0 misses).
Nano missed one password in code-mixed text (#28); regex caught it, so the union has zero misses.
Regex alone misses names (11/28) and new formats on held-out (+60 phones, "dengue", "key =", "pendapatan").
Chinese: Nano 9/9 exact although Chrome lists only en/ja/es/de/fr as supported.

### Decision: routing rule
- Intake detection runs ONLY_ON_DEVICE (Nano + regex union). Raw records never go to the cloud:
  on these samples the cloud was not more accurate, so there is no accuracy reason to send them.
- Cloud (gemini-3.5-flash-lite default) is used only to draft notices from the redacted fact sheet.
- No local model: fall back to regex only and say so plainly (held-out recall 0.64, names missed);
  never send raw records to the cloud as a fallback.
- Nano false alarms are on vague mentions ("front desk phone", a hall booking): show each finding
  with the evidence snippet so the user can untick it; regex agreement marks a finding "confirmed".

### Limits (say these in the write-up)
- Synthetic data, 50 samples, labels written by the same person who wrote the detectors.
- One machine (MacBook Air M3, Chrome 157); one cloud model on the free tier.
- Category-level detection only, not span-level redaction quality (next study).

## App v0.1 (23 Nov 2026) — `app/`
Vite + React + TypeScript, static, firebase 13.4.0. Five steps: check leak (Nano + rules, text or screenshot) →
what happened → who to tell (rules) → what leaves the device (redaction + final check) → edit drafts (cloud).
- Build: source in ~/dev/lapor72/app; built from a scratch copy, output copied to quickstart/app
  (served locally for testing).
- Tested end to end in Chrome: on-device classify 2.2–2.5 s (warmed on load; 16 s cold), names in answers
  1.3–1.7 s on-device, cloud drafts 3.8–4.4 s. 11 unit tests pass.
- Contact person is sent as [CONTACT_PERSON] and filled back in on the device.
- Debug tokens registered: built-in browser, Chrome (localhost only).
- To do: demo mode for judges without Nano, offline (service worker), Remote Config (model name, prompts,
  rule numbers), anonymous Auth + Firestore (save redacted cases), Firebase Hosting deploy, public repo.
