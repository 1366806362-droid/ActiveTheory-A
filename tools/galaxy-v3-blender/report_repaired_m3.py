"""Read actual same-camera GPU captures; export small read and core evidence."""
import json
import numpy as np
from PIL import Image,ImageDraw
from repair_m3_source import OUT
from build_repaired_m3 import repaired_input,LAYERS,ROOT
from audit_m3_ldi import analyze

source_original,source,final,fields=repaired_input()
y,x=np.indices(source.shape[:2])
core=((x-908.38092)/65)**2+((y-409.80392)/48)**2<1
luma=lambda a:a@np.array([.2126,.7152,.0722])
base=luma(source)
metrics={}
coverage=np.zeros_like(final[1])
for _,name in LAYERS:
    a=np.asarray(Image.open(ROOT/'public/assets/galaxy-v3/hero/repaired-m3'/name).convert('RGBA'),np.float32)[...,3]/255
    coverage=a+coverage*(1-a)
for mode in ('OFF','ORIGINAL','CALIBRATED'):
    rgb=np.asarray(Image.open(OUT/f'M3_CORE_BLOOM_{mode}.png').convert('RGB'),np.float32)/255
    lum=luma(rgb)
    metrics[mode]={'core_mean_ratio':float(lum[core].mean()/base[core].mean()),
                   'core_high_area_pixels':int(((lum>.7)&core).sum())}
    if mode=='OFF':
        conserved,_=analyze(source,rgb,coverage,final[1],fields)
        (OUT/'gpu-static-conservation.json').write_text(json.dumps(conserved,indent=2))
        assert .98<conserved['display_luminance_ratio']<1.02
        assert conserved['primary_arm_coverage']>.98
metrics['source_core_high_area_pixels']=int(((base>.7)&core).sum())
metrics['calibration']='Only core-region high-pass eligibility .12; original global bloom .3/.11/.78 and ACES/exposure unchanged'
(OUT/'core-bloom-measurements.json').write_text(json.dumps(metrics,indent=2))
Image.open(OUT/'HOME_M3_REPAIRED_RUNTIME.png').resize((640,360),Image.Resampling.LANCZOS).save(OUT/'HOME_M3_REPAIRED_SMALL_READ.png')
panel=Image.new('RGB',(1600,900),'black');draw=ImageDraw.Draw(panel)
for i,mode in enumerate(('OFF','ORIGINAL','CALIBRATED')):
    # Same crop and zoom: evidence only, not a final art screenshot.
    crop=Image.open(OUT/f'M3_CORE_BLOOM_{mode}.png').crop((748,300,1068,520)).resize((512,352))
    panel.paste(crop,(i*534,220));draw.text((i*534+15,190),mode,fill='white')
panel.save(OUT/'M3_SOURCE_VS_RUNTIME_CORE_AUDIT.png')
print(json.dumps(metrics,indent=2))
