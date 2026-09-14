"""Assemble native FiveA energy-star evidence without grading or sharpening."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import shutil

ROOT = Path('art/fivea-energy-stars')

def contact(files, labels, output, columns=2):
    images = [Image.open(ROOT / name).convert('RGB') for name in files]
    width, height = images[0].size
    assert all(image.size == (width, height) for image in images)
    rows = (len(images) + columns - 1) // columns
    canvas = Image.new('RGB', (width * columns, (height + 28) * rows), (3, 8, 16))
    draw = ImageDraw.Draw(canvas)
    for index, (image, label) in enumerate(zip(images, labels)):
        x, y = (index % columns) * width, (index // columns) * (height + 28)
        draw.text((x + 12, y + 7), label, fill=(176, 205, 225))
        canvas.paste(image, (x, y + 28))
    canvas.save(ROOT / output)

contact(
    ['BEFORE_PARTICLE_STARS.png', 'FIVEA_ENERGY_STARS_OVERVIEW.png'],
    ['1CC1693 PARTICLE STARS', 'CENTER-WEIGHTED ENERGY STARS / SAME CAMERA + SNAPSHOT + T=12'],
    'FIVEA_ENERGY_STARS_BEFORE_AFTER.png')
contact(
    ['BLOOM_OFF.png', 'BLOOM_ON.png'],
    ['BLOOM OFF', 'BLOOM ON / EXISTING COMPOSER UNCHANGED'],
    'FIVEA_ENERGY_STARS_BLOOM_COMPARE.png')
contact(
    ['DATA_LOW.png', 'DATA_HIGH.png'],
    ['A3 LOW / REAL SNAPSHOT', 'A3 HIGH / REAL SNAPSHOT'],
    'FIVEA_ENERGY_STARS_DATA_LOW_HIGH.png')

video_source = ROOT / 'FIVEA_ORBITAL_DEMO.mp4'
if video_source.exists():
    shutil.copyfile(video_source, ROOT / 'FIVEA_ENERGY_STARS_DEMO.mp4')

names = [
    'FIVEA_ENERGY_STARS_OVERVIEW.png', 'FIVEA_ENERGY_STARS_CORE.png',
    'FIVEA_ENERGY_STARS_SATELLITE.png', 'FIVEA_ENERGY_STARS_BEFORE_AFTER.png',
    'FIVEA_ENERGY_STARS_BLOOM_COMPARE.png', 'FIVEA_ENERGY_STARS_DATA_LOW_HIGH.png',
    'FIVEA_ENERGY_STARS_PANEL.png', 'FIVEA_ENERGY_STARS_SMALL_READ.png', 'PARTIAL.png'
]
integrity = {}
for name in names:
    with Image.open(ROOT / name) as image:
        assert image.format == 'PNG'
        integrity[name] = {'size': list(image.size), 'format': image.format}

html = '''<!doctype html><meta charset="utf-8"><title>FiveA Energy Stars V1.3</title>
<style>body{background:#030812;color:#b8cee0;font:15px system-ui;margin:24px}img,video{display:block;max-width:100%;margin:10px 0 34px}a{color:#b9daf1}h1{font-size:25px}h2{font-size:17px}</style>
<h1>FiveA Centered Energy Particle Stars — READY FOR HUMAN REVIEW</h1>
<p>Native Edge PNGs at DPR1. Comparison panels only add labels; no exposure, grading or sharpening.</p>'''
for name in names:
    html += f'<h2><a href="{name}">{name}</a></h2><a href="{name}"><img src="{name}" loading="lazy"></a>'
html += '<h2>FIVEA_ENERGY_STARS_DEMO.mp4</h2><video src="FIVEA_ENERGY_STARS_DEMO.mp4" controls preload="metadata"></video>'
(ROOT / 'index.html').write_text(html, encoding='utf-8')
(ROOT / 'image-integrity.json').write_text(json.dumps(integrity, indent=2), encoding='utf-8')
print(json.dumps(integrity, indent=2))
