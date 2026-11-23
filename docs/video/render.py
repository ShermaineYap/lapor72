"""Renders 1920x1080 slides and framed demo screens for the Lapor72 video."""
import base64, pathlib
from playwright.sync_api import sync_playwright

OUT = pathlib.Path('png'); OUT.mkdir(exist_ok=True)
CSS = """
:root { --paper:#eef1f3; --ink:#17212b; --muted:#5a6672; --local:#0f5c57; --local-wash:#e3f1ef;
        --cloud:#2f55c9; --cloud-wash:#e7ecfb; --red:#b3261e; --line:#cfd6dc; }
* { box-sizing:border-box; margin:0; }
body { width:1920px; height:1080px; font-family:'Atkinson Hyperlegible Next'; color:var(--ink); background:var(--paper); overflow:hidden; }
.mono { font-family:'Atkinson Hyperlegible Mono'; font-weight:700; font-variant-numeric:tabular-nums; }
.band { background:var(--ink); color:#f4f6f8; }
.pad { padding:0 150px; }
h1 { font-size:76px; line-height:1.08; font-weight:700; letter-spacing:-0.01em; }
h2 { font-size:44px; font-weight:700; }
p { font-size:34px; line-height:1.4; }
.muted { color:var(--muted); }
.badge { display:inline-block; font-size:24px; font-weight:700; padding:4px 14px; border-radius:999px; white-space:nowrap; }
.dev { background:var(--local-wash); color:var(--local); } .cld { background:var(--cloud-wash); color:var(--cloud); }
"""

SLIDES = {
'title': """
<div class="band" style="height:560px;display:flex;flex-direction:column;justify-content:flex-end;padding:0 150px 70px">
  <div style="font-size:34px;font-weight:700;color:#aab6c1;margin-bottom:10px">Lapor72</div>
  <div class="mono" style="font-size:250px;line-height:.9;letter-spacing:-0.02em">72:00:00</div>
</div>
<div class="pad" style="padding-top:70px">
  <p style="font-size:46px;max-width:1500px;line-height:1.3">A tuition centre's fee spreadsheet, with parents' IC numbers and a child's allergy, is posted in a public Facebook group.</p>
  <p class="muted" style="margin-top:26px;font-size:34px">Malaysian law: tell the Personal Data Protection Commissioner within 72 hours.</p>
</div>""",
'problem': """
<div class="pad" style="padding-top:120px">
  <h1 style="max-width:1500px">The shortcut leaks the data a second time</h1>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:70px">
    <div style="border:3px solid var(--red);border-radius:18px;padding:40px 44px;background:#fdf1f0">
      <h2 style="color:var(--red)">Paste it into a chatbot</h2>
      <p style="margin-top:18px">Every parent's IC number, phone and health note is uploaded to ask what to do.</p>
    </div>
    <div style="border:3px solid var(--local);border-radius:18px;padding:40px 44px;background:var(--local-wash)">
      <h2 style="color:var(--local)">Lapor72</h2>
      <p style="margin-top:18px">The leak is read on the device. Only a redacted fact sheet goes to the cloud.</p>
    </div>
  </div>
  <p class="muted" style="margin-top:56px;font-size:30px">PDPA breach notification since 1 June 2025: Commissioner within 72 hours, affected people within 7 days after.</p>
</div>""",
'study': """
<div class="pad" style="padding-top:100px">
  <h1>We measured it</h1>
  <p class="muted" style="margin-top:14px">50 synthetic leaked records in English, Malay, Chinese and mixed text. Scores on the 20 held out.</p>
  <table style="margin-top:50px;border-collapse:collapse;font-size:38px;width:100%">
    <tr style="text-align:left;color:var(--muted);font-size:30px"><th style="padding:14px 0;font-weight:700">Detector</th><th>Precision</th><th>Recall</th><th>Median time</th></tr>
    <tr style="border-top:2px solid var(--line)"><td style="padding:22px 0">Pattern rules only</td><td>1.00</td><td>0.64</td><td>&lt;1 ms</td></tr>
    <tr style="border-top:2px solid var(--line);background:var(--local-wash);color:var(--local);font-weight:700"><td style="padding:22px 16px">Gemini Nano on-device + rules</td><td>0.97</td><td>1.00</td><td>1.25 s</td></tr>
    <tr style="border-top:2px solid var(--line);color:var(--cloud)"><td style="padding:22px 0">Cloud gemini-3.5-flash-lite</td><td>0.97</td><td>1.00</td><td>1.98 s</td></tr>
  </table>
  <p class="muted" style="margin-top:44px;font-size:26px">MacBook Air M3, Chrome 157. Limits: synthetic data, small sample, one machine. Data and scoring script in the repo.</p>
</div>""",
'architecture': """
<div class="pad" style="padding-top:64px">
  <h1>Each step has its own inference mode</h1>
  <div style="margin-top:36px;display:grid;gap:14px">
    {rows}
  </div>
  <p class="muted" style="margin-top:26px;font-size:27px;max-width:1550px">App Check on every cloud call. Remote Config: model name and legal thresholds. Anonymous Auth + Firestore (Singapore): redacted case file. Hosting + service worker: works offline.</p>
</div>""",
'end': """
<div class="band" style="height:1080px;display:flex;flex-direction:column;justify-content:center;padding:0 150px">
  <div class="mono" style="font-size:150px;line-height:1">Lapor72</div>
  <p style="font-size:44px;margin-top:30px;color:#d6dde3;max-width:1400px">72 hours to report a breach. The leaked records never leave your device.</p>
  <p style="font-size:40px;margin-top:60px;font-weight:700">lapor72.web.app</p>
  <p style="font-size:32px;margin-top:10px;color:#aab6c1">github.com/ShermaineYap/lapor72</p>
  <p style="font-size:28px;margin-top:60px;color:#8796a3">Built for #BuildHybridAI 2026 with Firebase AI Logic</p>
</div>""",
}
ARCH_ROWS = [
  ('Find what kinds of personal data leaked', 'Gemini Nano + rules', 'ONLY_ON_DEVICE', 'dev', 'No internet requests'),
  ('Find names and addresses in your answers', 'Gemini Nano', 'ONLY_ON_DEVICE', 'dev', 'No internet requests'),
  ('Decide who must be told, and by when', 'Rules in the browser', 'no model', 'dev', 'Thresholds from Remote Config'),
  ('Final check before anything leaves', 'Rules in the browser', 'no model', 'dev', 'Blocks IC, phone, email, account, password'),
  ('Draft notices in English and Bahasa Melayu', 'gemini-3.5-flash-lite', 'ONLY_IN_CLOUD', 'cld', 'Redacted fact sheet only'),
]
rows = ''.join(f"""<div style="display:grid;grid-template-columns:690px 400px 1fr;align-items:center;background:#fff;border:2px solid var(--line);border-radius:14px;padding:16px 28px;font-size:30px">
  <div style="font-weight:700">{a}</div><div><span class="badge {c}">{m}</span><div class="muted" style="font-size:24px;margin-top:6px">{b}</div></div><div class="muted" style="font-size:26px">{d}</div></div>"""
  for a, b, m, c, d in ARCH_ROWS)
SLIDES['architecture'] = SLIDES['architecture'].replace('{rows}', rows)

def frame_html(img):
    data = base64.b64encode(pathlib.Path(img).read_bytes()).decode()
    # Browser screenshot (1392x868) shown at 1488x928, centred, with a thin window bar; room for captions below.
    return f"""<div style="position:absolute;left:216px;top:26px;width:1488px;border-radius:14px;overflow:hidden;box-shadow:0 18px 50px rgba(23,33,43,.28);border:1px solid #c3ccd3">
      <div style="height:36px;background:#dfe4e8;display:flex;align-items:center;gap:10px;padding:0 16px;font-size:20px;color:#5a6672">
        <span style="width:13px;height:13px;border-radius:50%;background:#ec6a5e"></span><span style="width:13px;height:13px;border-radius:50%;background:#f4bf4f"></span><span style="width:13px;height:13px;border-radius:50%;background:#61c554"></span>
        <span style="margin-left:16px">lapor72.web.app</span><span style="margin-left:auto">Live in Chrome 157 on a MacBook Air M3</span></div>
      <img src="data:image/jpeg;base64,{data}" style="display:block;width:1488px;height:928px"></div>"""

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    for name, body in SLIDES.items():
        pg.set_content(f"<style>{CSS}</style>{body}"); pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT / f'slide_{name}.png'))
    for img in sorted(pathlib.Path('frames').glob('*.jpg')):
        pg.set_content(f"<style>{CSS} body{{background:#cfd6dc}}</style>{frame_html(img)}"); pg.wait_for_timeout(150)
        pg.screenshot(path=str(OUT / f'frame_{img.stem}.png'))
    b.close()
print('rendered', len(list(OUT.glob('*.png'))))
