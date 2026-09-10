from pathlib import Path
import json, sys
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'art/earth-prod'/('before' if '--audit' in sys.argv else 'final')
box=(0,470,460,900)
if '--audit' not in sys.argv:
    selections=[('RANGE_0','HYBRID CENTER','EARTH_PROD_HYBRID_ROI_CENTER'),('RANGE_10','TRANSITION','EARTH_PROD_HYBRID_ROI_TRANSITION'),('RANGE_18','FALLBACK','EARTH_PROD_FALLBACK_ROI')]
    sheet=Image.new('RGB',(1380,460),(3,8,14));draw=ImageDraw.Draw(sheet)
    for i,(source,label,name) in enumerate(selections):
        im=Image.open(D/(source+'.png')).crop(box);im.save(D/(name+'.png'));sheet.paste(im,(i*460,30));draw.text((i*460+10,8),label,fill='white')
    sheet.save(D/'EARTH_PROD_NATIVE_ROI_CONTACT.png')
    seq=Image.new('RGB',(1840,920),(3,8,14));draw=ImageDraw.Draw(seq)
    for i,a in enumerate([0,3,6,8,10,12,15,18]):
        x=(i%4)*460;y=(i//4)*460
        seq.paste(Image.open(D/f'RANGE_{a}.png').crop(box),(x,y+30));draw.text((x+10,y+8),f'{a} DEG LOCAL SWEEP',fill='white')
    seq.save(D/'EARTH_PROD_TRANSITION_SEQUENCE.png')
    Image.open(D/'RANGE_0.png').save(D/'HOME_EARTH_HYBRID_PROD.png')
    before=D.parent/'before'
    Image.open(before/'EARTH_HYBRID_FALLBACK_COMPARE.png').save(D/'EARTH_HYBRID_FALLBACK_COMPARE.png')
    differences={}
    for mode in ['HYBRID','FALLBACK']:
        old=np.asarray(Image.open(before/f'SAME_{mode}_COMBINED.png').crop(box),float)/255
        new=np.asarray(Image.open(D/f'SAME_{mode}_COMBINED.png').crop(box),float)/255
        delta=np.abs(old-new)
        differences[mode]={'nativeRoiMeanAbsoluteRGBDifference':float(delta.mean()),'p95AbsoluteRGBDifference':float(np.quantile(delta,.95))}
    (D/'center-preservation.json').write_text(json.dumps(differences,indent=2))
    (D/'index.html').write_text('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Earth Hybrid Handoff Review</title>
<style>body{background:#060b13;color:#ccd7e0;font:16px system-ui;margin:24px auto;max-width:1600px}img,video{display:block;max-width:100%;height:auto;margin:18px 0}a{color:#8acaff}small{color:#8f9baa}</style>
<h1>Earth Hybrid — NOT READY FOR PRODUCTION</h1>
<p>Hard switching and geometry discontinuity resolved. Full fallback still loses photographic cloud quality. Experimental engineering checkpoint; frozen HOME is unchanged.</p>
<h2>HOME / 1600 × 900</h2><img src="HOME_EARTH_HYBRID_PROD.png">
<h2>Native ROI: Hero / transition / fallback</h2><img src="EARTH_PROD_NATIVE_ROI_CONTACT.png">
<h2>12-second continuous outward / return sweep</h2><video controls preload="metadata" src="EARTH_HYBRID_PRODUCTION_HANDOFF.mp4"></video>
<small>Actual Edge recording, 25 fps encoded video. Render loop measured separately at approximately 120 fps. Test-only Earth-relative angular sweep; no production camera changes.</small>
<h2>Transition sequence</h2><img src="EARTH_PROD_TRANSITION_SEQUENCE.png">
<h2>Before: identical-view Hybrid / original realtime</h2><img src="EARTH_HYBRID_FALLBACK_COMPARE.png">
<p><a href="motion-report.json">Motion / resize measurements</a> · <a href="../regression/interaction-report.json">Interaction regression</a></p>''',encoding='utf-8')
    print(str(D/'EARTH_PROD_NATIVE_ROI_CONTACT.png'));sys.exit(0)
def read(name):return np.asarray(Image.open(D/(name+'.png')).convert('RGB'),dtype=float)/255
def lum(a):return a@np.array([.2126,.7152,.0722])
background=read('NO_EARTH');data={}
for mode in ['HYBRID','FALLBACK']:
    layers={k:np.maximum(read('SAME_'+mode+'_'+k)-background,0)[470:900,:460] for k in ['COMBINED','SURFACE','CITY','CLOUD','ATMOSPHERE']}
    occupied=lum(layers['SURFACE'])>.002
    cloud=lum(layers['CLOUD']);air=lum(layers['ATMOSPHERE'])
    data[mode]={'surfaceOccupiedPixels':int(occupied.sum()),'meanLuminance':float(lum(layers['COMBINED'])[occupied].mean()),
      'surfaceMean':float(lum(layers['SURFACE'])[occupied].mean()),'cloudCoverageAbove003':float((cloud>.03)[occupied].mean()),
      'cityEnergy':float(lum(layers['CITY']).sum()),'atmosphereEnergy':float(air.sum()),'airApparentAreaPixels':int((air>.004).sum()),
      'limbRGB':layers['ATMOSPHERE'][air>.004].mean(axis=0).tolist()}
a=data['HYBRID'];b=data['FALLBACK'];data['fallbackOverHybrid']={k:b[k]/max(a[k],1e-8) for k in ['surfaceOccupiedPixels','meanLuminance','surfaceMean','cloudCoverageAbove003','cityEnergy','atmosphereEnergy']}
data['notes']='Display-space diagnostic thresholds, not physical opacity. Same camera/root/sun/phase; atmosphere shared. Terminator geometry unchanged; brightness profile differs.'
(D/'baseline-difference.json').write_text(json.dumps(data,indent=2))
sheet=Image.new('RGB',(920,460),(3,8,14));draw=ImageDraw.Draw(sheet)
for i,mode in enumerate(['HYBRID','FALLBACK']):
    sheet.paste(Image.open(D/f'SAME_{mode}_COMBINED.png').crop(box),(i*460,30));draw.text((i*460+10,8),mode,fill='white')
sheet.save(D/'EARTH_HYBRID_FALLBACK_COMPARE.png')
print(json.dumps(data,indent=2))
