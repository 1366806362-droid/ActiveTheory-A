"""Audit decoded WebP coverage and the actual linear/ACES display contract.

Thresholds are measurement-only: no masks or source pixels are modified.
No inference or new galaxy content is generated. Run before/after explicitly.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from galaxy_final_m3 import ROOT, LAYER_NAMES, render, blur, luminance
from m3_display_transfer import decode, encode, aces

def save(path, x):
    Image.fromarray(np.uint8(np.clip(x,0,1)*255+.5)).save(path)

def measurement_blur(value, sigma):
    # Do not quantize dim halo values to 8-bit before measuring retention.
    radius=int(np.ceil(sigma*3))
    x=np.arange(-radius,radius+1,dtype=np.float32)
    kernel=np.exp(-.5*(x/sigma)**2);kernel/=kernel.sum()
    result=value
    for axis in (0,1):
        padding=[(0,0),(0,0)];padding[axis]=(radius,radius)
        result=np.apply_along_axis(lambda row:np.convolve(row,kernel,'valid'),axis,np.pad(result,padding,mode='edge'))
    return result

def analyze(source, reconstructed, coverage, source_alpha, fields):
    _, arm_a, arm_b, _, radius, _, _ = fields
    sl, rl = luminance(source), luminance(reconstructed)
    s_low, r_low = measurement_blur(sl, 12), measurement_blur(rl,12)
    body = s_low > .012
    halo = (s_low > .002) & (s_low < .02) & (radius > .45)
    arm = (np.maximum(arm_a,arm_b) > .15) & (s_low > .006)
    missing = arm & (r_low < s_low*.8)
    hole = (sl > .002) & (coverage == 0)
    # 48 fixed radial bins per source-supported arm, preserving existing gaps.
    bins=[]
    for field in (arm_a,arm_b):
        for i in range(48):
            region=(field>.15)&(radius>=.15+i*.018)&(radius<.15+(i+1)*.018)&(s_low>.006)
            if region.sum()>20:
                bins.append(float(r_low[region].sum()/max(s_low[region].sum(),1e-9)))
    metrics={
        'occupied_area_ratio':float((r_low>.012).sum()/max(body.sum(),1)),
        'display_luminance_ratio':float(rl.sum()/sl.sum()),
        'primary_arm_coverage':float(1-missing.sum()/max(arm.sum(),1)),
        'primary_arm_radial_bin_continuity':float(np.mean(np.array(bins)>.8)),
        'halo_coverage':float(((r_low>=s_low*.8)&halo).sum()/max(halo.sum(),1)),
        'source_supported_zero_alpha_pixels':int(hole.sum()),
        'alpha_coverage_ratio':float(coverage.sum()/source_alpha.sum()),
        'display_rgb_mae_8bit':float(np.abs(source-reconstructed).mean()*255),
        'extra_energy_ratio':float(np.maximum(rl-sl,0).sum()/sl.sum()),
        'source_supported_region_pixels':int(body.sum()),
    }
    loss=np.zeros_like(source)
    loss[...,0]=np.clip((s_low-r_low)/np.maximum(s_low,.006),0,1)
    loss[...,2]=np.clip((r_low-s_low)/np.maximum(s_low,.006),0,1)
    loss[hole]=(1,1,0)
    loss[missing,1]=.35
    return metrics,loss

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--stage',choices=['before','after'],required=True)
    parser.add_argument('--gain',type=float,default=1)
    args=parser.parse_args()
    out=ROOT/'art/m3-ldi-audit'/args.stage
    out.mkdir(parents=True,exist_ok=True)
    _,(rgb,alpha),fields,_=render()
    # The approved preview is the 1280px export of exactly this unaltered source.
    source=np.floor(np.clip(rgb*alpha[...,None],0,1)*255)/255
    save(out/'M3_SOURCE_REFERENCE.png',source)
    linear=np.zeros_like(rgb); encoded=np.zeros_like(rgb)
    coverage=np.zeros_like(alpha); alpha_sum=np.zeros_like(alpha); active=np.zeros_like(alpha)
    for _,filename in LAYER_NAMES:
        layer=np.asarray(Image.open(ROOT/'public/assets/galaxy-v3/hero/final-m3'/filename).convert('RGBA'),np.float32)/255
        a=layer[...,3]
        linear=decode(layer[...,:3])*args.gain*a[...,None]+linear*(1-a[...,None])
        encoded=layer[...,:3]*a[...,None]+encoded*(1-a[...,None])
        coverage=a+coverage*(1-a); alpha_sum+=a; active+=(a>.004)
        suffix=filename.replace('galaxy-final-m3-','').replace('.webp','').replace('-','_').upper()
        save(out/f'M3_LDI_{suffix}_DEBUG.png',encode(aces(decode(layer[...,:3])*args.gain*a[...,None])))
    displayed=encode(aces(linear))
    save(out/'M3_LDI_ALPHA_SUM.png',coverage)
    save(out/'M3_LDI_RAW_ALPHA_SUM.png',alpha_sum/5)
    save(out/'M3_LDI_ENCODED_LEGACY_RECOMPOSITE.png',encoded)
    save(out/'M3_LDI_LINEAR_NO_TONEMAP.png',encode(linear))
    name='M3_LDI_STATIC_RECOMPOSITE_FINAL.png' if args.stage=='after' else 'M3_LDI_STATIC_RECOMPOSITE.png'
    save(out/name,displayed)
    metrics,loss=analyze(source,displayed,coverage,alpha,fields)
    metrics['soft_overlap_pixel_ratio']=float(((active>=2)&(alpha>.004)).sum()/max((alpha>.004).sum(),1))
    metrics['legacy_encoded_luminance_ratio']=float(luminance(encoded).sum()/luminance(source).sum())
    metrics['contract']='sRGB texture decode -> straight alpha over in linear -> ACES .76 -> sRGB output; no fog/bloom/movement'
    metrics['measurement_thresholds']={'occupied_luma':.012,'halo_luma':[.002,.02],'retained_luma_fraction':.8,'continuity_radial_bins':48}
    save(out/('M3_LDI_STRUCTURE_LOSS_FINAL.png' if args.stage=='after' else 'M3_LDI_STRUCTURE_LOSS_MAP.png'),loss)
    compare=Image.new('RGB',(1600,900),'black')
    compare.paste(Image.fromarray(np.uint8(source*255)).resize((800,450)),(0,225))
    compare.paste(Image.fromarray(np.uint8(np.clip(displayed,0,1)*255)).resize((800,450)),(800,225))
    draw=ImageDraw.Draw(compare)
    draw.text((20,190),'SOURCE',fill='white');draw.text((820,190),'LINEAR BLEND + HOME OUTPUT ACES (NO FOG)',fill='white')
    draw.text((20,720),'Loss map: red=lost light; blue=excess light; yellow=new zero-alpha; orange=arm loss',fill='white')
    compare.save(out/'M3_SOURCE_VS_LDI_RECOMPOSITE.png')
    save(out/'M3_PRIMARY_ARM_PROTECTION.png',np.maximum(fields[1],fields[2]))
    (out/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf8')
    print(json.dumps(metrics,indent=2))

if __name__=='__main__':main()
