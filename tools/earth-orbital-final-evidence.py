"""Unretouched 802f/final A/B, native-pixel night detail and review gallery."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/earth-v12-final'
OUT=ART/'final'
for role in ['HOME','CLOSEUP']:
    sheet=Image.new('RGB',(3200,928),'#060b12')
    for index,(label,file) in enumerate([
        ('802F3F V1.2 BASELINE',ART/f'baseline-802f/EARTH_V12_{role}.png'),
        ('V1.2 FINAL POLISH - CANDIDATE',OUT/f'EARTH_V12_FINAL_{role}.png')]):
        with Image.open(file) as frame:
            assert frame.size==(1600,900)
            sheet.paste(frame,(1600*index,28))
        ImageDraw.Draw(sheet).text((index*1600+12,8),label,fill='#bdcadb')
    sheet.save(OUT/f'EARTH_V12_FINAL_VS_802F_{role}.png')
with Image.open(OUT/'EARTH_V12_FINAL_HOME.png') as frame:
    frame.resize((640,360),Image.Resampling.LANCZOS).save(OUT/'EARTH_V12_FINAL_SMALL_READ.png')
with Image.open(OUT/'EARTH_V12_FINAL_CLOSEUP.png') as frame:
    # Native pixels only, same camera and exposure; not a brightened night pass.
    frame.crop((420,350,900,830)).save(OUT/'EARTH_V12_FINAL_NIGHT.png')
report=json.loads((OUT/'runtime-report.json').read_text())
runtime=next(c['url'] for c in report['cases'] if c['name']=='EARTH_V12_FINAL_HOME')
runtime=runtime.replace('&earthAudit=1','').replace('&earthFreeze=1','')
names=['HOME','CLOSEUP','CITY','CLOUD','ATMOSPHERE','NIGHT','VS_802F_HOME','VS_802F_CLOSEUP',
       'SMALL_READ','LEFT','CENTER','RIGHT']
html='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Earth V1.2 Final Polish Review</title><style>body{max-width:1600px;margin:24px auto;background:#060b12;color:#cbd8e8;font:16px system-ui}h1,h2{font-weight:400}img,video{width:100%;height:auto}a{color:#a4c8e5}figure{margin:28px 0 44px}small{color:#9daec2}</style>
<h1>Earth V1.2 Final Realism Polish — Review Evidence</h1>
<p><strong>NOT READY FOR PRODUCTION.</strong> Closeup city/weather improvements do not establish a sufficiently clear HOME-scale upgrade over 802f. Two corrections completed; development stopped.</p>
<p>1600x900 / DPR1 / identical 802f camera and Earth phase. No grading, sharpening or exposure changes. NIGHT is a native 480x480 crop, not an enhanced pass.</p>'''
html+=f'<p><a href="{runtime}">Open live HOME</a> · <a href="{runtime}&debugEarthV3Closeup=1">Open live closeup</a></p>'
for name in names:
    file=f'EARTH_V12_FINAL_{name}.png'
    html+=f'<figure><h2>{name}</h2><a href="{file}"><img loading="lazy" src="{file}" alt="{name}"></a></figure>'
if (OUT/'EARTH_V12_FINAL_ORBITAL.mp4').exists():
    html+='<h2>Actual closeup motion</h2><video controls src="EARTH_V12_FINAL_ORBITAL.mp4"></video><p>Recording is separate from performance measurement.</p>'
(OUT/'index.html').write_text(html,encoding='utf-8')
print(OUT/'index.html')
