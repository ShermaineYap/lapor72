# Lapor72

**A 72-hour data-breach desk for small Malaysian businesses.**
Live app: https://lapor72.web.app (desktop Chrome for on-device checking)

Since June 2025, Malaysian organisations must tell the Personal Data Protection Commissioner about a serious
personal data breach within 72 hours, and tell the people affected within 7 days after that. A clinic,
tuition centre or online shop rarely has a lawyer on call, and the obvious shortcut, pasting the leaked
customer list into a chatbot, discloses it a second time.

Lapor72 reads the leaked records **on the user's device** with Gemini Nano through Firebase AI Logic,
works out who must be told and by when, and sends only a **redacted fact sheet** to cloud Gemini to draft
the notices in English and Bahasa Melayu.

## How Firebase AI Logic is used

Each feature has its own deliberate inference mode; the app shows where every step ran (`inferenceSource`).

| Step | Where it runs | How |
|---|---|---|
| Find which kinds of personal data leaked, from pasted rows or a screenshot | Gemini Nano in Chrome, plus pattern rules for Malaysian formats (MyKad, phone, bank) | `InferenceMode.ONLY_ON_DEVICE`, JSON schema output, image input |
| Find names and addresses in the user's own answers so they can be removed | Gemini Nano | `ONLY_ON_DEVICE`, JSON schema output |
| Decide whether to notify, and the deadlines | Rules in the browser (thresholds from Remote Config) | none |
| Final check that no IC, phone, email, account number or password leaves | Rules in the browser | none |
| Draft the Commissioner notice, customer notices (EN/BM) and incident log | Cloud Gemini (model name from Remote Config, default `gemini-3.5-flash-lite`) | `ONLY_IN_CLOUD`, JSON schema output, retry with backoff |

**Raw records never go to the cloud**, not even as a fallback. Without a local model the app falls back to
pattern rules and says so; for the built-in sample it shows a clearly labelled result recorded earlier with
Gemini Nano, so the flow can be seen in any browser.

Other Firebase products:
- **App Check** (reCAPTCHA Enterprise / Fraud Defense) protects the cloud calls.
- **Remote Config** holds the cloud model name and the legal thresholds (72 hours, 7 days, 1,000 people),
  so they can change without a redeploy if the guideline changes.
- **Anonymous Authentication + Cloud Firestore** (asia-southeast1, offline cache) keep a private case file per
  browser with the redacted fact sheet and drafts only. Security rules restrict each user to their own cases.
- **Firebase Hosting** serves the app; a service worker keeps steps 1 to 4 working offline.

## Measured results

[`study/`](study/): 50 synthetic leaked-record samples in English, Malay, Chinese and code-mixed text, hand-labelled
with 8 categories; 20 were written after the pattern rules were frozen. MacBook Air M3, Chrome 157.

| Held-out (20) | Precision | Recall | Median latency |
|---|---|---|---|
| Pattern rules only | 1.00 | 0.64 | <1 ms |
| Gemini Nano on-device + rules | 0.97 | 1.00 | 1.25 s |
| Cloud `gemini-3.5-flash-lite` | 0.97 | 1.00 | 1.98 s (p90 5.5 s) |

On-device detection matched the cloud, so there is no accuracy reason to upload leaked records.
Re-score with `node study/score.mjs`. Limits: synthetic data, small sample, labels and rules written by the
same person, one machine, category-level detection (not span-level redaction quality).

In the app on the same machine: on-device check 2.2 to 2.5 s (model warmed on page load; 16 s cold),
name removal in answers about 1.5 s, cloud drafting about 4 s.

## Run it

Requirements: desktop Chrome with the built-in model (22 GB free disk; GPU with more than 4 GB VRAM, or 16 GB RAM).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for detectors, redaction and notification rules
npm run build && ./deploy.sh   # Firebase Hosting + Firestore rules (project lapor72)
```

On localhost, App Check prints a debug token in the browser console. Register it in the Firebase console
(App Check > Apps > Manage debug tokens). Never commit debug tokens.

## Repository

- `src/` the app (React + TypeScript, Vite). Core logic: `detectors.ts`, `redact.ts`, `rules.ts`, `ai.ts`.
- `study/` the detection study: data generators, harness page, raw results, scoring script.
- `quickstart/` the first hybrid-inference test page.
- `docs/DEVLOG.md` build notes and decisions.

## Built during #BuildHybridAI (11–30 November 2026)

Everything here was written during the submission period. Built with help from Claude (an AI coding assistant).

## Not legal advice

The assessment follows the Personal Data Protection Commissioner's Guideline on Data Breach Notification
(February 2025) as summarised in published legal guides. Every output is a draft for a person to check.

## Licence

Apache-2.0
