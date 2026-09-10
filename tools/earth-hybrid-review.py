"""Assemble native-pixel evidence only; no grading, sharpening or comparison resize."""
from pathlib import Path
import json, shutil
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'art/earth-hybrid'; OUT=A/'final'; OUT.mkdir(parents=True,exist_ok=True)
sources=[('FROZEN',A/'baselines/baseline-802f/FROZEN_HOME.png'),
         ('802f',A/'baselines/baseline-802f/EARTH_V12_HOME.png'),
         ('V13',A/'baselines/EARTH_V13_HOME.png'),
         ('HYBRID',OUT/'EARTH_HYBRID_HOME.png')]
roi=(0,470,460,900)
images=[]
for name,file in sources:
    im=Image.open(file).convert('RGB');assert im.size==(1600,900)
    images.append((name,im))
sheet=Image.new('RGB',(460*4,460),(3,8,14));d=ImageDraw.Draw(sheet)
for i,(name,im) in enumerate(images):
    sheet.paste(im.crop(roi),(460*i,30));d.text((460*i+12,8),name,fill='white')
sheet.save(OUT/'EARTH_HYBRID_ROI_NATIVE.png')
for i,key in enumerate(['FROZEN','802','V13']):
    sheet=Image.new('RGB',(3200,930),(3,8,14));d=ImageDraw.Draw(sheet)
    for x,(name,im) in zip([0,1600],[images[i],images[-1]]):
        sheet.paste(im,(x,30));d.text((x+12,8),name,fill='white')
    sheet.save(OUT/f'EARTH_HYBRID_VS_{key}.png')
for name in ['A','B','C']:
    shutil.copyfile(A/f'blender-preview/EARTH_HYBRID_GT_{name}.png',OUT/f'EARTH_HYBRID_GT_{name}.png')
shutil.copyfile(A/'passes/EARTH_HYBRID_BEAUTY.png',OUT/'EARTH_HYBRID_GROUND_TRUTH.png')
(OUT/'comparison-method.json').write_text(json.dumps({'roi':roi,'pixelScale':1,'comparisonResize':False,'postGrade':False,
    'reference':'Same recorded HOME camera / Earth root transform / global exposure; archived baseline runtime PNGs',
    'closeup':'Debug-only re-aim of captured hero cap; not a free-orbit claim or closeup geographic A/B'},indent=2))
files=sorted(p.name for p in OUT.glob('*.png'))
html='<!doctype html><meta charset="utf-8"><title>Earth Hybrid Gate</title><style>body{background:#03080e;color:#ccd8e8;font:16px system-ui;margin:24px}img{max-width:100%;height:auto}a{color:#a7d7ff}figure{margin:24px 0}video{max-width:100%}</style><h1>Earth Hybrid Cinematic V1 — Review evidence</h1><p>Native-pixel ROI compares archived baselines with current runtime. Click images for originals. Closeup inspects the captured hero view, not free orbit.</p>'
for name in files:html+=f'<figure><figcaption><a href="{name}">{name}</a></figcaption><a href="{name}"><img loading="lazy" src="{name}"></a></figure>'
if (OUT/'EARTH_HYBRID_ORBITAL.mp4').exists():html+='<video controls src="EARTH_HYBRID_ORBITAL.mp4"></video>'
(OUT/'index.html').write_text(html,encoding='utf-8')
print(OUT/'EARTH_HYBRID_ROI_NATIVE.png')
