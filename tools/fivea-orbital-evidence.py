"""Assemble unchanged native screenshots. No grading, sharpening or fake frames."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import json

ROOT = Path(__file__).resolve().parents[1] / 'art' / 'fivea-orbital'
def sheet(files, labels, output, columns):
    images = [Image.open(ROOT / f).convert('RGB') for f in files]
    w, h = images[0].size
    assert all(im.size == (w, h) for im in images)
    result = Image.new('RGB', (w * columns, (h + 26) * ((len(images) + columns - 1) // columns)), '#020711')
    draw = ImageDraw.Draw(result)
    for i, im in enumerate(images):
        x, y = (i % columns) * w, (i // columns) * (h + 26)
        result.paste(im, (x, y + 26)); draw.text((x + 12, y + 7), labels[i], fill='#9cb4c4')
    result.save(ROOT / output)

sheet(['BEFORE_V11.png', 'FIVEA_ORBITAL_OVERVIEW.png'], ['V1.1 / balanced / t=12', 'ORBITAL / balanced / t=12 / new local art layout'], 'FIVEA_ORBITAL_BEFORE_AFTER.png', 2)
sheet(['STAGE_LOW.png','STAGE_HIGH.png','FLOW_LOW.png','FLOW_HIGH.png'], ['A3 LOW / t=12','A3 HIGH / t=12','A3_TO_A4 LOW / t=12','A3_TO_A4 HIGH / t=12'], 'FIVEA_ORBITAL_DATA_COMPARE.png',2)
Image.open(ROOT/'FIVEA_ORBITAL_OVERVIEW.png').resize((640,360),Image.Resampling.LANCZOS).save(ROOT/'FIVEA_ORBITAL_SMALL_READ.png')
files=['FIVEA_ORBITAL_OVERVIEW.png','FIVEA_ORBITAL_BEFORE_AFTER.png','FIVEA_ORBITAL_CORE_CLOSEUP.png','FIVEA_ORBITAL_PANEL_OPEN.png','FIVEA_ORBITAL_DATA_COMPARE.png','PARTIAL.png','FIVEA_ORBITAL_SMALL_READ.png']
integrity={}
for f in files:
    im=Image.open(ROOT/f); assert im.format=='PNG'; integrity[f]={'size':list(im.size),'format':im.format}
    im.verify()
home_diff=ImageChops.difference(Image.open(ROOT/'HOME_FROZEN.png').convert('RGB'),Image.open(ROOT/'HOME_CANDIDATE.png').convert('RGB'))
integrity['HOME pixel identical']=home_diff.getbbox() is None
assert integrity['HOME pixel identical']
html='<!doctype html><meta charset="utf-8"><title>FiveA Orbital V1.2 Review</title><style>body{background:#050a12;color:#aec7da;font:15px system-ui;margin:24px}img,video{display:block;max-width:100%;margin:10px 0 35px}a{color:#aed4ed}h1{font-size:22px}</style><h1>FiveA Orbital V1.2 — NOT READY</h1><p>Open-panel extreme-phase A5 clipping remains. Experimental checkpoint only; not a production freeze.</p>'
html+='<p>Native PNG screenshots; composite labels only. Core closeup is a native 310px crop, not a changed camera. MP4 uses original browser frame timestamps, no retiming.</p>'
for f in files: html+=f'<h2><a href="{f}">{f}</a></h2><a href="{f}"><img src="{f}"></a>'
html+='<h2>Normal-speed browser recording</h2><video controls preload="metadata" src="FIVEA_ORBITAL_DEMO.mp4"></video>'
html+='<h2>Remaining panel edge case (t=99s)</h2><img src="PANEL_EXTREME_PHASE_99.png">'
(ROOT/'index.html').write_text(html,encoding='utf-8')
(ROOT/'image-integrity.json').write_text(json.dumps(integrity,indent=2),encoding='utf-8')
print(json.dumps(integrity))
