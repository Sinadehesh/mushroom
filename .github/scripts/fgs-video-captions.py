"""Joins the screen recording segments from fgs-video.sh and adds a title bar and step captions.

Usage: python3 fgs-video-captions.py video-output
Writes shroomlock-fgs-demo.mp4 and timestamps.txt (for the YouTube description) to that folder.
"""

import pathlib
import subprocess
import sys

out = pathlib.Path(sys.argv[1])
font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
W, H, TOP, BOTTOM = 720, 1600, 80, 150

segments = sorted((out / 'segments').glob('fgs_*.mp4'), key=lambda p: int(p.stem.split('_')[1]))
if not segments:
    sys.exit('No recording segments found')
(out / 'segments.txt').write_text(''.join(f"file '{p.resolve()}'\n" for p in segments))

captions = []
for line in (out / 'captions.tsv').read_text(encoding='utf-8').splitlines():
    start, first, second = line.split('\t')
    captions.append((float(start), first, second))

texts = out / 'captions'
texts.mkdir(exist_ok=True)


def text_file(name: str, text: str) -> str:
    path = texts / name
    path.write_text(text, encoding='utf-8')
    return str(path.resolve())


def drawtext(file: str, fontfile: str, size: int, color: str, y: int, enable: str = '') -> str:
    when = f":enable='{enable}'" if enable else ''
    return (
        f"drawtext=fontfile={fontfile}:textfile={file}:expansion=none:fontsize={size}:fontcolor={color}"
        f":x=(w-text_w)/2:y={y}{when}"
    )


filters = [
    'fps=30',
    f'scale={W}:{H}:force_original_aspect_ratio=decrease',
    f'pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black',
    f'pad={W}:{H + TOP + BOTTOM}:0:{TOP}:color=0x1F3D2B',
    drawtext(text_file('title.txt', 'Foreground service demo · ShroomLock'), bold, 28, 'white', 24),
]
for i, (start, first, second) in enumerate(captions):
    end = captions[i + 1][0] if i + 1 < len(captions) else 100000
    enable = f'between(t,{start:.2f},{end:.2f})'
    filters.append(drawtext(text_file(f'{i}a.txt', first), bold, 30, 'white', TOP + H + 30, enable))
    filters.append(drawtext(text_file(f'{i}b.txt', second), font, 22, '0xD8E8DC', TOP + H + 84, enable))
(out / 'filters.txt').write_text(','.join(filters), encoding='utf-8')

video = out / 'shroomlock-fgs-demo.mp4'
subprocess.run(
    ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(out / 'segments.txt'),
     '-filter_script:v', str(out / 'filters.txt'), '-an',
     '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
     str(video)],
    check=True,
)

# YouTube chapters must start at 0:00.
stamps = [f'{int(s) // 60}:{int(s) % 60:02d} {first}' for s, first, _ in [(0, captions[0][1], '')] + captions[1:]]
(out / 'timestamps.txt').write_text('\n'.join(stamps) + '\n', encoding='utf-8')
print('\n'.join(stamps))
print(f'Wrote {video}')
