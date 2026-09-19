"""Transkripsi seluruh rekaman di video/pengujian -> video/_build/transkrip.json + .md"""
import os, json, io, subprocess, sys
from faster_whisper import WhisperModel
FF = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffmpeg.exe")
D, B = 'video/pengujian', 'video/_build'
os.makedirs(B, exist_ok=True)
model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=os.cpu_count())
out = {}
files = [f for f in sorted(os.listdir(D)) if f.lower().endswith('.mp4')]
for i, f in enumerate(files, 1):
    wav = os.path.join(B, '_tmp.wav')
    subprocess.run([FF, '-v', 'error', '-y', '-i', os.path.join(D, f), '-ac', '1', '-ar', '16000', wav], check=True)
    segs, info = model.transcribe(wav, language='id', vad_filter=True, condition_on_previous_text=False)
    out[f] = [{'a': round(s.start, 2), 'b': round(s.end, 2), 't': s.text.strip()} for s in segs]
    print(f'[{i}/{len(files)}] {f}: {len(out[f])} segmen', flush=True)
    json.dump(out, io.open(os.path.join(B, 'transkrip.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
md = []
for f, segs in out.items():
    md.append('\n## ' + f + '\n')
    for s in segs:
        md.append(f"- `{int(s['a'])//60:02d}:{int(s['a'])%60:02d}–{int(s['b'])//60:02d}:{int(s['b'])%60:02d}` {s['t']}")
io.open(os.path.join(B, 'transkrip.md'), 'w', encoding='utf-8').write('\n'.join(md))
print('selesai')
