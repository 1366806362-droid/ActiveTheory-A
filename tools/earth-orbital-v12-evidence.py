"""Lossless screenshot derivatives; no color, sharpness or exposure manipulation."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'art/earth-v12'
for role in ['HOME','CLOSEUP']:
    sheet=Image.new('RGB',(3200,928),'#060b12')
    for index,(label,file) in enumerate([('FROZEN HOME FINAL V1',f'FROZEN_{role}.png'),('EARTH ORBITAL V1.2 CANDIDATE',f'EARTH_V12_{role}.png')]):
        with Image.open(OUT/file) as image:
            assert image.size==(1600,900)
            sheet.paste(image,(index*1600,28))
        ImageDraw.Draw(sheet).text((index*1600+16,8),label,fill='#becddf')
    sheet.save(OUT/f'EARTH_V12_VS_FROZEN_{role}.png')
with Image.open(OUT/'EARTH_V12_HOME.png') as image:
    image.resize((640,360),Image.Resampling.LANCZOS).save(OUT/'EARTH_V12_SMALL_READ.png')
files=['EARTH_V12_VS_FROZEN_HOME','EARTH_V12_VS_FROZEN_CLOSEUP','EARTH_V12_HOME','EARTH_V12_CLOSEUP',
       'EARTH_V12_SURFACE','EARTH_V12_CITY','EARTH_V12_CLOUD','EARTH_V12_ATMOSPHERE','EARTH_V12_SMALL_READ',
       'EARTH_V12_LEFT','EARTH_V12_CENTER','EARTH_V12_RIGHT','EARTH_V12_ASSET_MAPS']
runtime='/?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1'
html='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Earth Orbital V1.2 Review</title>
<style>body{margin:20px auto;max-width:1600px;background:#060b12;color:#c8d6e8;font:16px system-ui}h1,h2{font-weight:400}img,video{width:100%;height:auto}a{color:#abd1ea}figure{margin:24px 0 44px}</style>
<h1>Earth Orbital V1.2 — Human Review</h1><p>Real Edge captures. A/B uses identical observed camera, viewport and frozen rotation. No screenshot grading.</p>'''
html+=f'<p><a href="{runtime}">Open live HOME candidate</a> · <a href="{runtime}&debugEarthV3Closeup=1">Live Earth closeup</a></p>'
for name in files:html+=f'<figure><h2>{name}</h2><a href="{name}.png"><img loading="lazy" src="{name}.png" alt="{name}"></a></figure>'
if (OUT/'EARTH_V12_ORBITAL.mp4').exists():html+='<h2>Actual runtime motion (not performance measurement)</h2><video controls src="EARTH_V12_ORBITAL.mp4"></video>'
(OUT/'index.html').write_text(html,encoding='utf-8')
print('Full-resolution A/B, small-read and local review gallery saved.')
