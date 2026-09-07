"""Build only the reviewed local repair into independent, reversible assets."""
import json
import numpy as np
from PIL import Image
from repair_m3_source import reconstruct,OUT,save
from galaxy_final_m3 import ROOT,build_ldi,LAYER_NAMES,blur,luminance,smoothstep
from m3_display_transfer import decode,encode,aces,LINEAR_TEXTURE_GAIN
from audit_m3_ldi import analyze

LAYERS=tuple((role,name.replace('final-m3','repaired-m3')) for role,name in LAYER_NAMES)

def repaired_input():
    source,repaired,weight,fields,old_alpha,_,_=reconstruct()
    # Increase coverage only where new local source support exists; do not
    # extend coverage over the inter-arm valley or add a background plate.
    support=smoothstep(.0005,.07,blur(luminance(repaired),3))*.90
    alpha=np.maximum(old_alpha,support*weight)
    # RGBA8's five alpha channels need representable support for newly restored
    # faint texels. RGB is compensated below, so this does not brighten them.
    alpha=np.where((weight>0)&(repaired.max(axis=-1)>0),np.maximum(alpha,.02),alpha)
    # Display source is authoritative; straight RGB is merely a carrier here.
    rgb=repaired/np.maximum(alpha[...,None],1e-8)
    return source,repaired,(rgb,alpha),fields

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    _,source,final,fields=repaired_input()
    target=ROOT/'public/assets/galaxy-v3/hero/repaired-m3'
    build_ldi(final,fields,target,LAYERS,source_display=source)
    composite=np.zeros_like(source);coverage=np.zeros(source.shape[:2],np.float32)
    active=np.zeros_like(coverage)
    for _,name in LAYERS:
        image=np.asarray(Image.open(target/name).convert('RGBA'),np.float32)/255
        a=image[...,3]
        composite=decode(image[...,:3])*LINEAR_TEXTURE_GAIN*a[...,None]+composite*(1-a[...,None])
        coverage=a+coverage*(1-a);active+=a>.004
    result=encode(aces(composite))
    metrics,loss=analyze(source,result,coverage,final[1],fields)
    metrics['soft_overlap_ratio']=float(((active>=2)&(final[1]>.004)).sum()/max((final[1]>.004).sum(),1))
    save('M3_REPAIRED_SOURCE_REFERENCE.png',source)
    save('M3_REPAIRED_LDI_RECOMPOSITE.png',result)
    save('M3_REPAIRED_LDI_LOSS_MAP.png',loss)
    (OUT/'repaired-ldi.json').write_text(json.dumps(metrics,indent=2))
    print(json.dumps(metrics,indent=2))
    assert .98<metrics['occupied_area_ratio']<1.02
    assert .98<metrics['display_luminance_ratio']<1.02
    assert metrics['source_supported_zero_alpha_pixels']==0
    assert metrics['primary_arm_coverage']>.98
    assert metrics['halo_coverage']>.97

if __name__=='__main__':main()
