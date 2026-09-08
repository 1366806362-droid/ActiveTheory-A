"""Read encoded WebPs back and verify the M3 transfer, plus export Small Read."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from galaxy_final_m3 import render, LAYER_NAMES, ROOT
from m3_display_transfer import decode,encode,aces,LINEAR_TEXTURE_GAIN
from audit_m3_ldi import analyze

def main():
    _,(rgb,alpha),fields,_=render()
    result=np.zeros_like(rgb)
    coverage=np.zeros_like(alpha)
    for _,name in LAYER_NAMES:
        stored=np.asarray(Image.open(ROOT/'public/assets/galaxy-v3/hero/final-m3'/name).convert('RGBA'),dtype=np.float32)/255
        a=stored[...,3]
        result=decode(stored[...,:3])*LINEAR_TEXTURE_GAIN*a[...,None]+result*(1-a[...,None])
        coverage=a+coverage*(1-a)
    result=encode(aces(result))
    source=np.floor(rgb*alpha[...,None]*255)/255
    error=np.abs(result-source)*255
    report,_=analyze(source,result,coverage,alpha,fields)
    report.update({'decoded_display_mae_8bit':float(error.mean()),'decoded_display_p99_8bit':float(np.quantile(error,.99)),
            'scope':'decoded WebP, linear straight alpha, HOME ACES .76; not legacy encoded-space over'})
    output=ROOT/'art/m3-ldi-audit/after'
    output.mkdir(parents=True,exist_ok=True)
    (output/'ldi-validation.json').write_text(json.dumps(report,indent=2))
    Image.fromarray(np.uint8(result*255)).save(output/'M3_LDI_RECONSTRUCTION.png')
    screenshot=output/'HOME_M3_LDI_FIXED_RUNTIME.png'
    if screenshot.exists():
        Image.open(screenshot).resize((640,360),Image.Resampling.LANCZOS).save(output/'HOME_M3_LDI_FIXED_SMALL_READ.png')
    print(json.dumps(report))
    assert report['decoded_display_mae_8bit']<.3
    assert .99<report['occupied_area_ratio']<1.01
    assert .99<report['display_luminance_ratio']<1.01
    assert report['primary_arm_coverage']>.99
    assert report['primary_arm_radial_bin_continuity']==1
    assert report['source_supported_zero_alpha_pixels']==0
    assert report['halo_coverage']>.97
    gpu=output/'M3_GPU_ZERO_PARALLAX.png'
    if gpu.exists():
        gpu_rgb=np.asarray(Image.open(gpu).convert('RGB'),np.float32)/255
        gpu_report,_=analyze(source,gpu_rgb,coverage,alpha,fields)
        gpu_report['scope']='Actual Edge GPU, five meshes, perspective registration, ACES OutputPass, parallax zero; no bloom/fog'
        (output/'gpu-validation.json').write_text(json.dumps(gpu_report,indent=2))
        print('GPU',json.dumps(gpu_report))
        assert .98<gpu_report['occupied_area_ratio']<1.02
        assert .98<gpu_report['display_luminance_ratio']<1.02
        assert gpu_report['primary_arm_coverage']>.98

if __name__=='__main__':main()
