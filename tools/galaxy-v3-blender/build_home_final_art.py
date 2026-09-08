"""One bounded inter-arm art pass; reuse the repaired M3 LDI transfer unchanged."""
import json
import numpy as np
from PIL import Image
from repair_m3_source import reconstruct, local_window
from build_repaired_m3 import repaired_input
from galaxy_final_m3 import ROOT, build_ldi, LAYER_NAMES, blur, blur_rgb, luminance, smoothstep
from m3_display_transfer import decode, encode, aces, LINEAR_TEXTURE_GAIN
from audit_m3_ldi import analyze

OUT = ROOT/'art/home-final-art'
LAYERS = tuple((role, name.replace('final-m3', 'home-final-art')) for role, name in LAYER_NAMES)

def polish():
    _, source, final, fields = repaired_input()
    *_, material, core = reconstruct()
    yy, xx = np.indices(source.shape[:2], dtype=np.float32)
    window = local_window(xx, yy, 1165, 407, 180, 170)
    window *= smoothstep(180, 255, np.hypot(xx-core[0], yy-core[1]))
    # Existing Master frequency bands only, no new topology or random stars.
    low = blur_rgb(material, 12)
    body = blur_rgb(material, 2)
    donor = np.maximum(low*.10 + (body-low)*.14 + (material-body)*.10, 0)
    # Preserve dust minima and bright ridges. Add only faint secondary support.
    dust = np.clip(luminance(material)/np.maximum(luminance(low), .008), 0, 1)
    deficit = 1-smoothstep(.025, .12, blur(luminance(source), 8))
    addition = np.minimum(donor*.24, .014) * (window*deficit*dust)[...,None]
    result = np.round(np.clip(source+addition, 0, 1)*255)/255
    return source, result, (result/np.maximum(final[1][...,None],1e-8), final[1]), fields, window

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    before, source, final, fields, window = polish()
    target = ROOT/'public/assets/galaxy-v3/hero/home-final-art'
    build_ldi(final, fields, target, LAYERS, source_display=source)
    composite = np.zeros_like(source); coverage = np.zeros(source.shape[:2],np.float32)
    for _,name in LAYERS:
        rgba=np.asarray(Image.open(target/name).convert('RGBA'),np.float32)/255
        a=rgba[...,3]
        composite=decode(rgba[...,:3])*LINEAR_TEXTURE_GAIN*a[...,None]+composite*(1-a[...,None])
        coverage=a+coverage*(1-a)
    result=encode(aces(composite))
    metrics,loss=analyze(source,result,coverage,final[1],fields)
    metrics.update(changed_source_fraction=float(np.any(before!=source,axis=-1).mean()),
        core_max_delta=float(np.max(np.abs(source-before)[fields[5]>.05])),
        source_luminance_ratio=float(luminance(source).sum()/luminance(before).sum()))
    for name,rgb in [('SOURCE.png',source),('RECOMPOSITE.png',result),('LOSS.png',loss),('FOOTPRINT.png',window)]:
        Image.fromarray(np.uint8(np.clip(rgb,0,1)*255+.5)).save(OUT/name)
    (OUT/'asset-report.json').write_text(json.dumps(metrics,indent=2))
    print(json.dumps(metrics,indent=2))
    assert metrics['core_max_delta']==0
    assert metrics['changed_source_fraction']<.10
    assert .98<metrics['occupied_area_ratio']<1.02
    assert .98<metrics['display_luminance_ratio']<1.02
    assert metrics['source_supported_zero_alpha_pixels']==0

if __name__=='__main__':main()
