"""Unretouched same-pose comparison and native-pixel Earth ROI evidence.

No grading, exposure, sharpening or selective brightening. Only SMALL_READ is resized.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import shutil

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/earth-v13';OUT=ART/'final';BASE=ART/'baseline-802f'
def sheet(files,labels,destination,crop=None):
    frames=[]
    for file in files:
        frame=Image.open(file).convert('RGB')
        if crop:frame=frame.crop(crop)
        frames.append(frame)
    width,height=frames[0].size
    assert all(i.size==(width,height) for i in frames)
    result=Image.new('RGB',(width*len(frames),height+28),'#060b12')
    for i,(frame,label) in enumerate(zip(frames,labels)):
        result.paste(frame,(width*i,28))
        ImageDraw.Draw(result).text((width*i+10,8),label,fill='#c1cee0')
    result.save(OUT/destination)

home=OUT/'EARTH_V13_HOME.png';close=OUT/'EARTH_V13_CLOSEUP.png'
for mode in ['HOME','CLOSEUP']:
    sheet([BASE/f'FROZEN_{mode}.png',OUT/f'EARTH_V13_{mode}.png'],['FROZEN HOME FINAL V1','V1.3 B - EXPERIMENT'],f'EARTH_V13_VS_FROZEN_{mode}.png')
    sheet([BASE/f'EARTH_V12_{mode}.png',OUT/f'EARTH_V13_{mode}.png'],['802F V1.2','V1.3 B - EXPERIMENT'],f'EARTH_V13_VS_802_{mode}.png')
roi=(0,490,445,900)
Image.open(home).crop(roi).save(OUT/'EARTH_V13_EARTH_ROI.png')
sheet([BASE/'FROZEN_HOME.png',BASE/'EARTH_V12_HOME.png',home],['FROZEN - NATIVE PIXELS','802F - NATIVE PIXELS','V1.3 - NATIVE PIXELS'],'EARTH_V13_ROI_COMPARE.png',roi)
shutil.copyfile(OUT/'EARTH_V13_ROI_COMPARE.png',OUT/'EARTH_ROI_1TO1_COMPARISON.png')
Image.open(close).crop((420,350,900,830)).save(OUT/'EARTH_V13_NIGHT.png')
Image.open(home).resize((640,360),Image.Resampling.LANCZOS).save(OUT/'EARTH_V13_SMALL_READ.png')
for name in ['EARTH_GT_CLOSEUP.png','EARTH_GT_HOME_CROP.png']:
    shutil.copyfile(ART/'ground-truth-1'/name,OUT/name)
shutil.copyfile(OUT/'EARTH_GT_CLOSEUP.png',OUT/'EARTH_V13_GROUND_TRUTH.png')
sheet([ART/'phases'/f'PHASE_{p}_HOME.png' for p in [0,90,180,270]],['PHASE '+str(p) for p in [0,90,180,270]],'EARTH_PHASE_NATIVE_ROI.png',roi)
sheet([ART/'candidates'/f'CANDIDATE_{c}_HOME.png' for c in ['A','B','C']],['A - 8 STEPS','B - 12 STEPS','C - 16 STEPS'],'EARTH_CANDIDATE_NATIVE_ROI.png',roi)
report=json.loads((OUT/'runtime-report.json').read_text())
runtime=next(c['url'] for c in report['cases'] if c['name']=='EARTH_V13_HOME').replace('&earthAudit=1','').replace('&earthFreeze=1','')
names=['EARTH_V13_ROI_COMPARE','EARTH_V13_HOME','EARTH_V13_CLOSEUP','EARTH_V13_GROUND_TRUTH','EARTH_GT_HOME_CROP',
       'EARTH_V13_VS_FROZEN_HOME','EARTH_V13_VS_802_HOME','EARTH_V13_VS_FROZEN_CLOSEUP','EARTH_V13_VS_802_CLOSEUP',
       'EARTH_V13_EARTH_ROI','EARTH_V13_SURFACE','EARTH_V13_CITY','EARTH_V13_CLOUD','EARTH_V13_ATMOSPHERE','EARTH_V13_NIGHT',
       'EARTH_V13_SMALL_READ','EARTH_V13_LEFT','EARTH_V13_CENTER','EARTH_V13_RIGHT','EARTH_PHASE_NATIVE_ROI','EARTH_CANDIDATE_NATIVE_ROI']
html='''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Earth V1.3 - Ground Truth Review</title><style>body{max-width:1600px;margin:24px auto;padding:0 12px;background:#060b12;color:#cbd8e8;font:16px system-ui}h1,h2{font-weight:400}img,video{max-width:100%;height:auto}a{color:#a4c8e5}figure{margin:28px 0 44px}.native{overflow:auto}.native img{max-width:none}</style>
<h1>Earth V1.3 — Orbital Ground-Truth Convergence</h1>
<p><strong>EARTH ROUTE NOT READY / NOT READY FOR PRODUCTION.</strong> 技术与细节有改进，但首页尺度收益不足以替换冻结版；本轮已停止视觉调整。</p>
<p>全部截图来自当前真实 Runtime：1600×900 / DPR1。同 camera / scale / exposure；原生 ROI 不缩放、不提亮。只有 SMALL READ 缩小。</p>
<p>Blender：5.2 / Cycles / OptiX / 64 samples；真实 mesh、UV、camera、sun 对齐。使用 AgX，而 Web 使用既有后处理，因此只作材质/光照结构参考，不是逐像素色彩真值。</p>'''
html+=f'<p><a href="{runtime}">打开当前 V1.3 HOME</a> · <a href="{runtime}&debugEarthV3Closeup=1">打开 V1.3 近景</a></p>'
for name in names:
    file=name+'.png';cls='native' if name in ['EARTH_V13_ROI_COMPARE','EARTH_V13_EARTH_ROI'] else ''
    html+=f'<figure><h2>{name}</h2><div class="{cls}"><a href="{file}"><img loading="lazy" src="{file}" alt="{name}"></a></div></figure>'
if (OUT/'EARTH_V13_ORBITAL.mp4').exists():html+='<h2>10-second actual motion</h2><video controls src="EARTH_V13_ORBITAL.mp4"></video>'
html+='</html>'
(OUT/'index.html').write_text(html,encoding='utf-8')
print(OUT/'index.html')
