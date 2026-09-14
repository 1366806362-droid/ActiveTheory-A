"""Assemble native browser evidence; no exposure, grading or sharpening."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import json, shutil
root=Path('art/fivea-particle-stars')
def compare(files, labels, output, columns=2):
    images=[Image.open(root/f).convert('RGB') for f in files]
    w,h=images[0].size
    assert all(im.size==(w,h) for im in images)
    canvas=Image.new('RGB',(w*columns,(h+26)*((len(images)+columns-1)//columns)),(4,9,17))
    draw=ImageDraw.Draw(canvas)
    for i,(im,label) in enumerate(zip(images,labels)):
        x,y=(i%columns)*w,(i//columns)*(h+26)
        draw.text((x+12,y+6),label,fill=(175,201,220));canvas.paste(im,(x,y+26))
    canvas.save(root/output)
compare(['BEFORE_SOLID.png','FIVEA_PARTICLE_STARS_OVERVIEW.png'],['OLD SOLID / SAME CAMERA + SNAPSHOT + T=12','LUMINOUS PARTICLES / SAME CAMERA + SNAPSHOT + T=12'],'FIVEA_PARTICLE_STARS_BEFORE_AFTER.png')
compare(['BLOOM_OFF.png','BLOOM_ON.png'],['EXISTING BLOOM OFF','EXISTING BLOOM ON / NO BLOOM PARAMETERS CHANGED'],'FIVEA_PARTICLE_STARS_BLOOM_OFF_ON.png')
compare(['stage_low.png','stage_high.png','flow_low.png','flow_high.png'],['A3 LOW / REAL SNAPSHOT','A3 HIGH / REAL SNAPSHOT','A3_TO_A4 LOW / REAL SNAPSHOT','A3_TO_A4 HIGH / REAL SNAPSHOT'],'FIVEA_PARTICLE_STARS_DATA_COMPARE.png')
Image.open(root/'FIVEA_PARTICLE_STARS_OVERVIEW.png').resize((640,360),Image.Resampling.LANCZOS).save(root/'FIVEA_PARTICLE_STARS_SMALL_READ.png')
if (root/'FIVEA_ORBITAL_DEMO.mp4').exists():shutil.copyfile(root/'FIVEA_ORBITAL_DEMO.mp4',root/'FIVEA_PARTICLE_STARS_DEMO.mp4')
names=['FIVEA_PARTICLE_STARS_'+s+'.png' for s in ['OVERVIEW','BEFORE_AFTER','CORE_DETAIL','SATELLITE_DETAIL','BLOOM_OFF_ON','PANEL_SAFE','DATA_COMPARE','SMALL_READ']]
report={}
for name in names:
    image=Image.open(root/name);assert image.format=='PNG';report[name]={'size':list(image.size),'format':'PNG'};image.verify()
if (root/'HOME_FROZEN.png').exists():
    delta=ImageChops.difference(Image.open(root/'HOME_FROZEN.png').convert('RGB'),Image.open(root/'HOME_CANDIDATE.png').convert('RGB'))
    report['home_unchanged']=delta.getbbox() is None;assert report['home_unchanged']
html='<!doctype html><meta charset="utf-8"><title>FiveA Particle Stars</title><style>body{background:#040912;color:#b6cde0;font:15px system-ui;margin:24px}img,video{display:block;max-width:100%;margin:10px 0 32px}a{color:#b7d7eb}h1{font-size:24px}</style><h1>FiveA Luminous Particle Stars — Candidate Review</h1><p>Not HUMAN PASS. Native PNG; detail crops retain original pixels. Small Read is a resized derivative. No post-brightening.</p>'
for name in names:html+=f'<h2><a href="{name}">{name}</a></h2><a href="{name}"><img src="{name}" loading="lazy"></a>'
html+='<h2>Real-time browser video</h2><video src="FIVEA_PARTICLE_STARS_DEMO.mp4" controls preload="metadata"></video>'
html=html.replace('Candidate Review','NOT READY / Experimental Review')
html=html.replace('Not HUMAN PASS.', 'NOT READY: particle structure and panel bounds improved; integrated stellar glow remains insufficient. Initial frame-pacing anomaly retained in the report. Not HUMAN PASS.')
(root/'index.html').write_text(html,encoding='utf8');(root/'image-integrity.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))
