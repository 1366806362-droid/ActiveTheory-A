"""Assemble native browser evidence; no grading, sharpening or speed changes."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import json
import shutil

ROOT = Path('art/fivea-color-depth')

def contact(names, labels, output, columns=2):
    images = [Image.open(ROOT / name).convert('RGB') for name in names]
    w, h = images[0].size
    assert all(image.size == (w, h) for image in images)
    result = Image.new('RGB', (w * columns, (h + 28) * ((len(images) + columns - 1) // columns)), '#030812')
    draw = ImageDraw.Draw(result)
    for i, (image, label) in enumerate(zip(images, labels)):
        x, y = i % columns * w, i // columns * (h + 28)
        result.paste(image, (x, y + 28))
        draw.text((x + 10, y + 7), label, fill='#b8cede')
    result.save(ROOT / output)

contact(['BEFORE.png', 'FIVEA_COLOR_DEPTH_OVERVIEW.png'], ['3B131B8 / SAME SNAPSHOT, CAMERA, T=12', 'COLOR + CORE + DEPTH / SAME SNAPSHOT, CAMERA, T=12'], 'FIVEA_COLOR_DEPTH_BEFORE_AFTER.png')
contact(['BACKGROUND_OFF.png', 'FIVEA_COLOR_DEPTH_OVERVIEW.png'], ['FIVEA ENVIRONMENT OFF', 'FIVEA ENVIRONMENT ON'], 'FIVEA_COLOR_DEPTH_BACKGROUND_OFF_ON.png')
contact(['BLOOM_OFF.png', 'FIVEA_COLOR_DEPTH_OVERVIEW.png'], ['BLOOM OFF', 'EXISTING BLOOM ON'], 'FIVEA_COLOR_DEPTH_BLOOM_COMPARE.png')
contact([f'A{i}.png' for i in range(1,6)], ['A1 AWARE','A2 APPEAL','A3 ASK','A4 ACT','A5 ADVOCATE'], 'FIVEA_COLOR_DEPTH_PALETTE.png', 5)
contact(['stage_low.png', 'stage_high.png'], ['A3 LOW / REAL SNAPSHOT', 'A3 HIGH / REAL SNAPSHOT'], 'FIVEA_COLOR_DEPTH_DATA_LOW_HIGH.png')
contact([f'HOME_METEOR_{i}.png' for i in range(6)], [f'DEV SINGLE TRIGGER / FRAME {i}' for i in range(6)], 'HOME_METEOR_FRAME_SEQUENCE.png', 3)
old = Image.open(ROOT / 'HOME_BASELINE.png').convert('RGB')
off = Image.open(ROOT / 'HOME_METEORS_OFF.png').convert('RGB')
idle = Image.open(ROOT / 'HOME_METEORS_IDLE.png').convert('RGB')
integrity = {'home_off_matches_3b131b8': ImageChops.difference(old,off).getbbox() is None,
             'home_idle_matches_off': ImageChops.difference(off,idle).getbbox() is None}
delta = ImageChops.difference(old, off)
integrity['home_baseline_max_channel_difference'] = max(pair[1] for pair in delta.getextrema())
integrity['home_baseline_changed_pixels'] = sum(1 for pixel in delta.getdata() if any(pixel))
video = ROOT / 'FIVEA_ORBITAL_DEMO.mp4'
if video.exists():
    shutil.copyfile(video, ROOT / 'FIVEA_COLOR_DEPTH_DEMO.mp4')
names = ['FIVEA_COLOR_DEPTH_OVERVIEW.png','FIVEA_COLOR_DEPTH_BEFORE_AFTER.png','FIVEA_COLOR_DEPTH_CORE.png','FIVEA_COLOR_DEPTH_PALETTE.png',
         'FIVEA_COLOR_DEPTH_BACKGROUND_OFF_ON.png','FIVEA_COLOR_DEPTH_BLOOM_COMPARE.png','FIVEA_COLOR_DEPTH_PANEL_SETTLED.png',
         'FIVEA_COLOR_DEPTH_PANEL_CLOSED.png','FIVEA_COLOR_DEPTH_SMALL_READ.png','FIVEA_COLOR_DEPTH_DATA_LOW_HIGH.png','stages_partial.png','HOME_METEOR_FRAME_SEQUENCE.png']
html = '''<!doctype html><meta charset="utf-8"><title>FiveA Color & Cosmic Depth + HOME Meteors</title>
<style>body{margin:24px;background:#030812;color:#bed0de;font:15px system-ui}img,video{display:block;max-width:100%;margin:12px 0 30px}a{color:#b8ddeb}h1{font-size:24px}h2{font-size:16px}</style>
<h1>FiveA Color & Cosmic Depth + HOME subtle meteors</h1><p>Candidate: READY FOR HUMAN REVIEW. Native PNG / DPR1. No grading or sharpening.</p>'''
for name in names:
    with Image.open(ROOT / name) as image:
        integrity[name] = {'size':list(image.size),'format':image.format}
    html += f'<h2><a href="{name}">{name}</a></h2><a href="{name}"><img src="{name}" loading="lazy"></a>'
for name in ['FIVEA_COLOR_DEPTH_DEMO.mp4','HOME_METEOR_DEMO.mp4']:
    html += f'<h2>{name}</h2><video src="{name}" controls preload="metadata"></video>'
html += '<p>HOME video uses normal real-time cadence. The frame sequence is explicitly a development single trigger.</p>'
(ROOT / 'index.html').write_text(html,encoding='utf-8')
(ROOT / 'image-integrity.json').write_text(json.dumps(integrity,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in integrity.items() if isinstance(v,bool)}))
