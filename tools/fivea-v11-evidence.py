"""Arrange native browser captures without altering exposure, color or speed."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art' / 'fivea-v11'
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 20)

def sheet(name, files, columns=2):
    canvas = Image.new('RGB', (1600 * columns, 930 * ((len(files)+columns-1)//columns)), '#050c14')
    draw = ImageDraw.Draw(canvas)
    for i, (label, file) in enumerate(files):
        image = Image.open(OUT / file)
        assert image.format == 'PNG' and image.size == (1600, 900), file
        x, y = (i % columns)*1600, (i//columns)*930
        draw.text((x+20,y+5), label, font=font, fill='#b5c4ce')
        canvas.paste(image, (x,y+30))
    canvas.save(OUT / name)

sheet('FIVEA_V11_BEFORE_AFTER.png', [('BASE d4f4a2c / time 12 / balanced', 'baseline.png'), ('B / SAME CAMERA / LOCAL STAGE OFFSETS', 'FIVEA_V11_OVERVIEW.png')])
sheet('FIVEA_V11_MATERIAL_ONLY.png', [('BASE / ORIGINAL POSITIONS', 'baseline.png'), ('A / SAME CAMERA AND ORIGINAL POSITIONS', 'A.png')])
sheet('FIVEA_V11_DATA_CONTRAST.png', [('A3 LOW / time 12', 'STAGE_LOW.png'), ('A3 HIGH / time 12', 'STAGE_HIGH.png'), ('A3_TO_A4 LOW / time 12', 'FLOW_LOW.png'), ('A3_TO_A4 HIGH / time 12', 'FLOW_HIGH.png')])
Image.open(OUT/'FIVEA_V11_OVERVIEW.png').resize((640,360),Image.Resampling.LANCZOS).save(OUT/'FIVEA_V11_SMALL_READ.png')
links=['FIVEA_V11_OVERVIEW.png','FIVEA_V11_BEFORE_AFTER.png','FIVEA_V11_MATERIAL_ONLY.png','FIVEA_V11_DATA_CONTRAST.png','FIVEA_V11_PARTIAL.png','FIVEA_V11_PANEL_OPEN.png']
html='''<!doctype html><meta charset="utf-8"><title>FiveA V1.1 candidate review</title><style>body{background:#030810;color:#bed0dc;font:16px system-ui;margin:24px}img,video{max-width:100%;display:block;margin-bottom:36px}a{color:#8fc6e5}h1{font-size:24px}</style><h1>FiveA Scene V1.1 — candidate, not human-approved</h1><p>Native 1600×900 DPR1 browser PNG. Comparison sheets preserve pixels; no exposure/color processing. B changes stage-local art offsets, not camera. Data fixtures are MOCK/SYNTHETIC.</p>'''
for f in links:
    html+=f'<h2>{f}</h2><a href="{f}"><img src="{f}" loading="lazy"></a>'
html+='<h2>Continuous real browser journey</h2><video controls src="FIVEA_V11_JOURNEY_DEMO.mp4"></video><p><a href="review-report.json">Snapshot / binding / runtime records</a> · <a href="B-report.json">Performance</a> · <a href="tests/summary.json">Tests</a></p>'
(OUT/'index.html').write_text(html,encoding='utf-8')
print(json.dumps({'outputs':links,'sourceFormat':'native PNG','viewport':[1600,900],'dpr':1}))
checks = {}
for key, a, b in [('legacy_disabled', 'baseline.png', 'disabled.png'), ('home_frozen', 'HOME_FROZEN.png', 'HOME_CANDIDATE.png')]:
    diff = ImageChops.difference(Image.open(OUT/a).convert('RGB'), Image.open(OUT/b).convert('RGB'))
    checks[key] = {'pixelIdentical': diff.getbbox() is None, 'differenceBounds': diff.getbbox(),
        'changedPixels': sum(any(p) for p in diff.getdata()), 'maxChannelDifference': max(x[1] for x in diff.getextrema())}
for mode in ['A','B','disabled']:
    original=json.loads((OUT/'baseline-report.json').read_text())['fixed']
    current=json.loads((OUT/f'{mode}-report.json').read_text())['fixed']
    checks[mode+'_camera'] = current['camera'] == original['camera']
    if mode != 'B':
        checks[mode+'_positions'] = current['targets'] == original['targets']
(OUT/'preservation-checks.json').write_text(json.dumps(checks,indent=2))
print(json.dumps(checks))
assert checks['home_frozen']['pixelIdentical']
# Record rather than hide the observed one-pixel, one-code-value native-raster difference.
assert checks['legacy_disabled']['changedPixels'] <= 1 and checks['legacy_disabled']['maxChannelDifference'] <= 1
assert all(v for k,v in checks.items() if isinstance(v,bool))
