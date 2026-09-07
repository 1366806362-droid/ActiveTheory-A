"""Local M3 source continuity repair. Original sources and LDI stay untouched.

No procedural stars, geometry search, external images or generative APIs.
Only clean-Master frequency bands contribute inside a bounded repair footprint.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from galaxy_final_m3 import (ROOT,WORK_SIZE,MASTER_SIZE,MASTER_CORE,render,
                            find_v51_core,blur,blur_rgb,luminance,smoothstep)

OUT=ROOT/'art/m3-source-repair'

def local_window(xx,yy,cx,cy,rx,ry):
    r=np.sqrt(((xx-cx)/rx)**2+((yy-cy)/ry)**2)
    return 1-smoothstep(.55,1,r)

def reconstruct():
    base,(rgb,alpha),fields,_=render()
    source=np.floor(rgb*alpha[...,None]*255)/255
    core=find_v51_core(*base)
    sx,sy=WORK_SIZE[0]/MASTER_SIZE[0],WORK_SIZE[1]/MASTER_SIZE[1]
    master=Image.open(ROOT/'art/visual-gate/home-target-v1/GALAXY_MASTER_REFERENCE_V1.png').convert('RGB')
    aligned=master.transform(WORK_SIZE,Image.Transform.AFFINE,
        (1/sx,0,MASTER_CORE[0]-core[0]/sx,0,1/sy,MASTER_CORE[1]-core[1]/sy),Image.Resampling.BICUBIC)
    material=np.asarray(aligned,np.float32)/255
    yy,xx=np.indices(alpha.shape,dtype=np.float32)
    # Bound the repair to the documented upper-right cutout and outer-right tail.
    upper=local_window(xx,yy,1240,240,310,240)
    outer=local_window(xx,yy,1310,475,225,250)
    footprint=np.maximum(upper,outer)
    footprint*=smoothstep(150,235,np.sqrt((xx-core[0])**2+(yy-core[1])**2))
    low=blur_rgb(material,14)
    mid=blur_rgb(material,2)-low
    fine=material-blur_rgb(material,2)
    # Reconstruct bands, not an opaque copied patch. Retain donor dust/clumps.
    donor=np.maximum(low*.52+mid*.48+fine*.42,0)
    # Match the silver/steel-blue M3 palette locally; bright violet pockets recede.
    violet=np.maximum(donor[...,0]-donor[...,1]*1.10,0)
    donor[...,0]-=violet*.55
    donor[...,2]-=violet*.20
    arm=np.maximum(fields[1],fields[2])
    outer_fade=1-smoothstep(.90,1.15,fields[4])
    # Existing M3 topology and Master texture jointly gate local support.
    support=(.30+.70*np.sqrt(np.clip(blur(arm,10),0,1)))*outer_fade
    donor*=support[...,None]
    sl=blur(luminance(source),10)
    dl=blur(luminance(donor),10)
    deficit=np.clip(1-sl/np.maximum(dl,.001),0,1)
    weight=footprint*deficit
    repaired=source+(donor-source)*weight[...,None]
    repaired=np.clip(repaired,0,1)
    # Quantize once; pixels outside local support are byte-identical.
    repaired=np.round(repaired*255)/255
    return source,repaired,weight,fields,alpha,material,core

def save(name,rgb):
    Image.fromarray(np.uint8(np.clip(rgb,0,1)*255+.5)).save(OUT/name)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    source,repaired,weight,fields,alpha,material,core=reconstruct()
    save('M3_SOURCE_ORIGINAL.png',source)
    save('M3_SOURCE_REPAIRED_PREVIEW.png',repaired)
    Image.fromarray(np.uint8(repaired*255+.5)).resize((640,360),Image.Resampling.LANCZOS).save(OUT/'M3_SOURCE_REPAIRED_SMALL_READ.png')
    save('M3_REPAIR_FOOTPRINT.png',weight)
    save('M3_ALIGNED_MASTER_MATERIAL.png',material)
    audit=Image.fromarray(np.uint8(source*255+.5));d=ImageDraw.Draw(audit)
    for label,xy,point in [
        ('Primary Arm A',(675,85),(995,190)),('Primary Arm B',(435,795),(810,650)),
        ('Right Outer Arm',(1330,520),(1325,430)),('Halo',(1430,675),(1400,580)),
        ('Continuity Gap',(1170,55),(1255,205)),('Core',(790,360),core)]:
        d.line([xy,point],fill=(255,185,70),width=2)
        d.ellipse((point[0]-4,point[1]-4,point[0]+4,point[1]+4),fill=(255,185,70))
        d.text(xy,label,fill=(245,245,245))
    audit.save(OUT/'M3_SOURCE_CONTINUITY_AUDIT.png')
    changed=np.any(source!=repaired,axis=-1)
    metrics={'changed_pixel_fraction':float(changed.mean()),'unchanged_pixel_fraction':float(1-changed.mean()),
        'core_max_delta':float(np.max(np.abs(repaired-source)[fields[5]>.05])),
        'source_luminance_ratio':float(luminance(repaired).sum()/luminance(source).sum()),
        'source_correction_count':0,'geometry':'M3 unchanged','method':'local aligned Master frequency reconstruction; deficit-weighted soft footprint'}
    (OUT/'source-repair.json').write_text(json.dumps(metrics,indent=2))
    print(json.dumps(metrics,indent=2))

if __name__=='__main__':main()
