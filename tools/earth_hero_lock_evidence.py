"""Lossless crops/contact sheets and input diagnostics; never changes runtime assets."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art/earth-hero-lock/final'
FONT = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 20)
SMALL = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)

def contact(rows, dest, size=(400, 300), crop=None):
    w, h = size
    result = Image.new('RGB', (w * max(map(len, rows)), (h + 30) * len(rows)), '#060c16')
    d = ImageDraw.Draw(result)
    for row, items in enumerate(rows):
        for col, (label, source) in enumerate(items):
            im = Image.open(OUT / source).convert('RGB')
            if crop:
                im = im.crop(crop)
            im.thumbnail(size, Image.Resampling.LANCZOS)
            result.paste(im, (col * w, row * (h + 30) + 30))
            d.text((col * w + 10, row * (h + 30) + 5), label, font=SMALL, fill='#d7e5f1')
    result.save(OUT / dest)

def curve_plot():
    report = json.loads((OUT / 'candidates-report.json').read_text())
    im = Image.new('RGB', (1440, 920), '#08101b')
    d = ImageDraw.Draw(im)
    d.text((35, 18), 'EARTH HERO LOCK - B: measured input / response + analytic dynamics', font=FONT, fill='white')
    candidate = next(x for x in report['candidates'] if x['strategy'] == 'B')
    charts = [
        ('Translation (CSS px at 900h)', [(x['input'], x['lock']['offsetPx'][0]) for x in candidate['samples']], 22, '#71c4e2'),
        ('Actual Hybrid angle (degrees; includes idle drift)', [(x['input'], x['hybrid']['measured']) for x in candidate['samples']], 2, '#e8b485'),
        ('Hybrid confidence = 1 - fallback mix', [(x['input'], 1 - x['hybrid']['mix']) for x in candidate['samples']], 1.1, '#8de2ba'),
    ]
    for index, (title, values, maximum, color) in enumerate(charts):
        x0, y0, width, height = 70 + index * 470, 105, 360, 270
        d.text((x0 - 25, 65), title, font=SMALL, fill='white')
        d.line((x0, y0, x0, y0 + height, x0 + width, y0 + height), fill='#617187', width=2)
        for tick in range(5):
            x = x0 + width * tick / 4
            d.text((x - 8, y0 + height + 8), str(tick / 4), font=SMALL, fill='#a4b4c8')
        pts = [(x0 + x * width, y0 + height - y / maximum * height) for x, y in values]
        d.line(pts, fill=color, width=3)
        for (x, y), (_, value) in zip(pts, values):
            d.ellipse((x-4, y-4, x+4, y+4), fill=color)
            d.text((x-12, y-25), f'{value:.2f}', font=SMALL, fill=color)
    d.text((55, 435), 'Unit step response: critically damped omega=24 vs exp(14/s) vs fixed lerp(.12/frame)', font=FONT, fill='white')
    x0, y0, width, height = 75, 500, 1000, 310
    d.line((x0, y0, x0, y0+height, x0+width, y0+height), fill='#617187', width=2)
    curves = [('Critical (30/60/120 Hz coincide)', '#8de2ba', lambda t: 1-(1+24*t)*math.exp(-24*t)),
              ('Exponential dt-aware', '#71c4e2', lambda t: 1-math.exp(-14*t))]
    for hz, color in [(30, '#82678e'), (60, '#af829a'), (120, '#e8b485')]:
        curves.append((f'Fixed lerp at {hz} Hz', color, lambda t, hz=hz: 1-.88**(t*hz)))
    for n, (name, color, fn) in enumerate(curves):
        d.line([(x0+i/200*width, y0+height-fn(i/200*.6)*height) for i in range(201)], fill=color, width=2)
        d.text((1100, 515+n*40), name, font=SMALL, fill=color)
    d.text((x0, 835), '0', font=SMALL, fill='white')
    d.text((x0+width-35, 835), '0.6 sec', font=SMALL, fill='white')
    d.text((75, 878), 'Angular samples are real runtime measurements, not a claim that the camera is static.', font=SMALL, fill='#a4b4c8')
    im.save(OUT / 'EARTH_INPUT_RESPONSE_CURVE.png')

def main():
    if (OUT / 'candidates-report.json').exists():
        contact([[(f'{s} | {n}% input', f'CANDIDATE_{s}_{n}.png') for n in [0,25,50,75,100]] for s in ['A','B','C']], 'INTERACTION_CANDIDATES.png', (320,256), (0,420,600,900))
        contact([[(f'{n}% input', f'CANDIDATE_B_{n}.png') for n in [0,25,50,75,100]]], 'EARTH_HERO_LOCK_MOTION_CONTACT.png', (400,320), (0,420,600,900))
        curve_plot()
    if (OUT / 'SAFE_RANGE_10.png').exists():
        contact([[(f'Hybrid {n} deg', f'SAFE_RANGE_{n}.png') for n in [0,2,4]], [(f'Hybrid {n} deg', f'SAFE_RANGE_{n}.png') for n in [6,8,10]]], 'EARTH_HERO_SAFE_RANGE.png', (500,400), (0,420,600,900))
    images = ['HOME_EARTH_HERO_LOCK.png','EARTH_HERO_LOCK_ROI.png','EARTH_HERO_LOCK_CENTER.png','EARTH_HERO_LOCK_EDGE.png','EARTH_HERO_LOCK_CORNER.png','EARTH_HERO_LOCK_CLOUD_DEPTH.png','EARTH_HERO_LOCK_ATMOSPHERE.png','EARTH_HERO_LOCK_MOTION_CONTACT.png','EARTH_INPUT_RESPONSE_CURVE.png','INTERACTION_CANDIDATES.png','EARTH_HERO_SAFE_RANGE.png']
    videos = [f'EARTH_HERO_LOCK_{n}.mp4' for n in ['SLOW','FAST','NATURAL']]
    body = ''.join(f'<section><h2>{name}</h2><a href="{name}"><img src="{name}"></a></section>' for name in images if (OUT/name).exists())
    body += ''.join(f'<section><h2>{name}</h2><video controls preload="metadata" src="{name}"></video></section>' for name in videos if (OUT/name).exists())
    (OUT/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Earth Hero Lock Review</title><style>body{background:#080d15;color:#d4e3f0;font:16px Arial;margin:30px}img,video{max-width:100%;height:auto}section{margin:35px 0}h2{font-size:16px}a{color:#9ddafa}</style><h1>EARTH HYBRID HERO LOCK V1</h1><p>Candidate review. Actual runtime screenshots; no relighting or color correction.</p>'+body, encoding='utf-8')

if __name__ == '__main__':
    main()
