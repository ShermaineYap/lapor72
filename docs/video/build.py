"""Assembles the Lapor72 demo video: images with crossfades, narration, burned-in captions."""
import json, re, subprocess

S = json.load(open('script.json'))
T = 0.4          # crossfade length
LEAD = 0.35      # narration starts this long after its segment begins
TAIL = 0.55      # pause after narration before the next segment

def run(cmd): subprocess.run(cmd, check=True)

# ---- image timeline --------------------------------------------------------
images, starts, t = [], [], 0.0
for s in S:
    seg = s['dur'] + LEAD + TAIL
    starts.append(t)
    kind, ref = s['visual'].split(':')
    pics = [f'png/slide_{ref}.png'] if kind == 'slide' else [f'png/frame_{n}.png' for n in ref.split(',')]
    for p in pics: images.append((p, seg / len(pics)))
    t += seg
total = t

inputs, filters = [], []
for i, (p, d) in enumerate(images):
    length = d + (T if i < len(images) - 1 else 0)
    inputs += ['-loop', '1', '-t', f'{length:.3f}', '-i', p]
    filters.append(f'[{i}:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p[v{i}]')
prev, offset = 'v0', 0.0
for i in range(1, len(images)):
    offset += images[i - 1][1]
    out = f'x{i}'
    filters.append(f'[{prev}][v{i}]xfade=transition=fade:duration={T}:offset={offset:.3f}[{out}]')
    prev = out

# ---- captions (ASS) --------------------------------------------------------
def ts(x):
    h, m = int(x // 3600), int(x % 3600 // 60); s = x % 60
    return f'{h}:{m:02d}:{s:05.2f}'

def chunks(text, limit=92):
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    out, cur = [], ''
    for sen in sentences:
        parts = [sen] if len(sen) <= limit else re.split(r'(?<=,)\s+', sen)
        for part in parts:
            if cur and len(cur) + 1 + len(part) > limit: out.append(cur); cur = part
            else: cur = f'{cur} {part}'.strip()
    if cur: out.append(cur)
    return out

events = []
for s, st in zip(S, starts):
    cs = chunks(s['cap']); total_chars = sum(len(c) for c in cs); a = st + LEAD
    for c in cs:
        d = s['dur'] * len(c) / total_chars
        events.append(f'Dialogue: 0,{ts(a)},{ts(a + d)},Cap,,0,0,0,,{c}'); a += d
ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Atkinson Hyperlegible Next,40,&H00FFFFFF,&H00FFFFFF,&H182B2117,&H182B2117,0,0,0,0,100,100,0,0,3,14,0,2,160,160,22,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + '\n'.join(events) + '\n'
open('captions.ass', 'w').write(ass)
filters.append(f"[{prev}]subtitles=captions.ass:fontsdir=fonts[vout]")

# ---- narration track --------------------------------------------------------
parts = []
for s, st in zip(S, starts):
    parts.append(f"[{len(images) + S.index(s)}:a]adelay={int((st + LEAD) * 1000)}:all=1[a{s['id']}]")
amix = ''.join(f"[a{s['id']}]" for s in S) + f'amix=inputs={len(S)}:normalize=0,apad,atrim=0:{total:.3f},loudnorm=I=-16:TP=-1.5[aout]'
audio_inputs = []
for s in S: audio_inputs += ['-i', f"audio/{s['id']}.wav"]

cmd = ['ffmpeg', '-y', *inputs, *audio_inputs, '-filter_complex', ';'.join(filters + parts + [amix]),
       '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
       '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-t', f'{total:.3f}', '-movflags', '+faststart', 'lapor72-demo.mp4']
run(cmd)
print(f'total {total:.1f}s, {len(images)} images, {len(events)} captions')
