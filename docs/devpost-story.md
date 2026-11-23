## Inspiration

Since 1 June 2025, Malaysian organisations must notify the Personal Data Protection Commissioner of a serious personal data breach within 72 hours, and tell the people affected within 7 days after that. Large companies have lawyers and incident teams. A tuition centre, a clinic or an online shop has the owner, a phone and a spreadsheet that just got posted in a Facebook group.

The obvious shortcut is to paste the leaked list into a chatbot and ask what to do. That discloses every customer's IC number, phone and health note a second time. We wanted the opposite: help that never sees the leaked data.

## What it does

Lapor72 is a 72-hour breach desk in the browser. A clock counts down to the Commissioner deadline the moment you enter the breach time.

1. **Check the leaked data.** Paste a few rows or add a screenshot. Gemini Nano reads it on the device, together with pattern rules for Malaysian formats (MyKad numbers, Malaysian phone numbers, bank accounts). Each finding shows the text it came from; you can untick a false alarm or add something it missed. The step log shows "No internet requests".
2. **Say what happened.** When, how you found out, the cause, roughly how many people, what you have done.
3. **See who you must tell.** The app applies the tests in the Commissioner's Guideline on Data Breach Notification (sensitive data, financial loss, identity fraud, more than 1,000 people) and shows both deadlines and the reasons.
4. **Check what leaves the device.** Gemini Nano finds names and addresses in your own answers; rules remove IC numbers, phones, emails, account numbers and passwords. A final check blocks the send if anything is left. You see the exact fact sheet that will go to the cloud.
5. **Edit the notices.** Cloud Gemini drafts the Commissioner notification, the notice to affected people in English and Bahasa Melayu, and an internal incident record. The contact person is sent as a placeholder and filled back in on the device. A redacted case file is saved to Firestore.

## How we built it: Firebase AI Logic hybrid inference

Hybrid is the point of the design, not a fallback toggle: the raw records must not leave the device, and the drafting needs a stronger model and Bahasa Melayu output. So each step has its own inference mode, and every response's `inferenceSource` is shown in the "Where each step ran" panel, along with a count of internet requests measured with `PerformanceObserver`.

| Step | Model | Inference mode |
|---|---|---|
| What kinds of personal data leaked (text or image) | Gemini Nano + rules | `ONLY_ON_DEVICE`, JSON schema output via `responseConstraint` |
| Names and addresses in the owner's answers | Gemini Nano | `ONLY_ON_DEVICE`, JSON schema output |
| Who must be told and by when | rules in the browser | none |
| Final outbound check | rules in the browser | none |
| Draft notices (EN + BM) and incident log | `gemini-3.5-flash-lite` (from Remote Config) | `ONLY_IN_CLOUD`, `responseSchema`, retry with backoff |

We deliberately do **not** use `PREFER_ON_DEVICE` for the leak: if the device has no model, the app falls back to rules and says so, rather than silently uploading the records. Browsers without an on-device model can still see the whole flow with the sample incident, which shows a clearly labelled result recorded earlier with Gemini Nano.

Other Firebase products:
- **App Check** (reCAPTCHA Enterprise / Fraud Defense) protects every cloud call; debug tokens on localhost only.
- **Remote Config** holds the cloud model name and the legal thresholds (72 hours, 7 days, 1,000 people), so they can change without a redeploy if the guideline changes.
- **Anonymous Authentication + Cloud Firestore** (asia-southeast1, offline persistence) keep a private case file per browser containing only the redacted fact sheet and drafts. Security rules restrict each user to their own documents and to an allowed set of fields.
- **Firebase Hosting** serves the app; a service worker caches it so steps 1 to 4 work offline.

Stack: React, TypeScript, Vite, Firebase JS SDK 13.4.0. Unit tests cover the detectors, redaction and notification rules.

## We measured it

Before building the app we ran a detection study: 50 synthetic leaked records in English, Malay, Chinese and code-mixed text, hand-labelled with 8 categories. 20 were written after the pattern rules were frozen. MacBook Air M3, Chrome 157.

| Held-out (20) | Precision | Recall | Median time |
|---|---|---|---|
| Pattern rules only | 1.00 | 0.64 | <1 ms |
| Gemini Nano on-device + rules | 0.97 | 1.00 | 1.25 s |
| Cloud `gemini-3.5-flash-lite` | 0.97 | 1.00 | 1.98 s (p90 5.5 s) |

On-device detection matched the cloud, so there is no accuracy reason to upload a leak. That result decided the routing rule. The data, harness and scoring script are in the repo (`study/`).

In the app on the same machine: the on-device check takes about 2.5 s (the model is warmed when the page loads; about 15 s cold), name removal about 1.5 s, cloud drafting about 4 s.

## Challenges we ran into

- **Free-tier cloud quota.** `gemini-3.8-flash` allowed 5 requests per minute and returned "high demand" errors in testing, so the default became `gemini-3.5-flash-lite`, cloud calls are limited to one drafting step, and drafting retries with backoff. The model name lives in Remote Config.
- **Nano's false alarms.** Nano sometimes flags a category on a vague mention ("front desk phone") or invents one (an address in a list with none). We show the evidence for each finding and let the owner untick it, and rules confirm the fixed formats.
- **Languages.** Chrome's on-device model does not list Malay or Chinese as supported, yet on our samples it classified both correctly. We still keep all Bahasa Melayu writing in the cloud step.
- **Cold start.** The first on-device call took about 15 s, so we warm the model when the page loads.
- **App Check on the web.** The classic reCAPTCHA v3 provider is deprecated, so we used Fraud Defense with a site key restricted to our Hosting domains.

## Accomplishments we are proud of

- Leaked records never leave the device, and the app proves it on screen with a request counter.
- A measured, held-out evaluation behind the routing decision, with honest limits.
- A complete product: deadlines, reasons, redaction preview, bilingual drafts, saved cases, offline support.

## What we learned

Hybrid inference is most convincing when each feature chooses its mode for a reason the user can see. A small on-device model was good enough for classification and extraction in four language mixes; the cloud is worth its cost only where generation quality matters.

## What's next

- A wider held-out set, including real-format test data from partners, and span-level redaction measurement.
- Rule packs for other breach-notification regimes, starting with the GDPR (also 72 hours).
- An Android version with Gemini Nano via Firebase AI Logic.
- Filling the Commissioner's notification form fields directly.

## Limits

Synthetic data, 50 samples, labels and rules written by the same person, one machine. The notification assessment follows the Commissioner's February 2025 guideline as summarised in published legal guides and is a draft for a person to check, not legal advice.

## Built during the hackathon

Everything was written between 22 and 30 November 2026 for #BuildHybridAI. Built with help from Claude (an AI coding assistant). Narration in the video is a synthetic voice (Piper TTS); all data shown is synthetic.
