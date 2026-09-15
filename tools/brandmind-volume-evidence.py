"""Single-Core diagnostic evidence only. No grading, sharpening or runtime assets."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

OUT = Path(__file__).resolve().parents[1] / "art" / "brandmind-v12"

def comparison(files, labels, output):
    images = [Image.open(OUT / (p + ".png")).convert("RGB") for p in files]
    image = Image.new("RGB", (sum(p.width for p in images), max(p.height for p in images) + 28), "#050b13")
    draw = ImageDraw.Draw(image)
    x = 0
    for im, label in zip(images, labels):
        image.paste(im, (x, 28))
        draw.text((x + 12, 8), label, fill="#c1d5e0")
        x += im.width
    image.save(OUT / (output + ".png"))

comparison(["V11_BEFORE_FIXED", "BRANDMIND_V12_OVERVIEW"],
           ["V1.1 / same camera and t=12", "V1.2 Core-only experiment / surroundings hidden / NOT READY"],
           "BRANDMIND_V12_BEFORE_AFTER")
comparison(["VOLUME_ONLY", "SURFACE_ONLY"], ["Interior volume only", "Thin contour auxiliary only"],
           "BRANDMIND_V12_VOLUME_SURFACE_BREAKDOWN")
comparison(["BLOOM_OFF", "BLOOM_ON"], ["Bloom OFF", "Bloom ON / global settings unchanged"], "BRANDMIND_V12_BLOOM_OFF_ON")
comparison(["CORE_A_40", "CORE_B_40"], ["A: smooth bulk", "B: crossing broad media"], "CORE_AB")
Image.open(OUT / "BRANDMIND_V12_OVERVIEW.png").resize((640,360), Image.Resampling.LANCZOS).save(OUT / "BRANDMIND_V12_SMALL_READ.png")
box=(620,240,1030,690)
a,b=[Image.open(OUT / f"CORE_B_{n}.png").convert("RGB").crop(box) for n in [24,40]]
diff=ImageChops.difference(a,b)
gate=json.loads((OUT / "core-gate.json").read_text(encoding="utf8"))
bounds=next(s["bounds"] for s in gate["samples"] if s["variant"]=="B" and s["steps"]==40)
summary={"B_24_40_RGB_MAE_8bit":ImageStat.Stat(diff).mean,"comparison_roi":box,
         "proxy_screen_bbox":bounds,"proxy_bbox_fraction":(bounds["right"]-bounds["left"])*(bounds["bottom"]-bounds["top"])/(1600*900),
         "status":"SINGLE CORE NOT READY; peripheral integration not started",
         "capture":"native PNG 1600x900 DPR1; detail is native pixel crop; Small Read is disclosed 640x360 downsample"}
(OUT / "evidence.json").write_text(json.dumps(summary,indent=2),encoding="utf8")
names=["BRANDMIND_V12_OVERVIEW","BRANDMIND_V12_CORE_DETAIL","BRANDMIND_V12_BEFORE_AFTER",
       "BRANDMIND_V12_VOLUME_SURFACE_BREAKDOWN","BRANDMIND_V12_BLOOM_OFF_ON","BRANDMIND_V12_SMALL_READ","CORE_AB"]
html='<!doctype html><meta charset="utf-8"><title>Brand Mind V1.2 Core gate</title><style>body{margin:32px;background:#050b13;color:#bdd0de;font:15px system-ui}img{max-width:100%;height:auto}a{color:#9ccbeb}section{margin:32px 0}</style><h1>Brand Mind V1.2 — single Core NOT READY</h1><p>Stopped before peripheral integration. No full-scene, Panel art or final video acceptance claimed.</p><p><a href="/?scene=brandmind&brandMindVolumeV12=1">Open Core experiment</a> · <a href="/?scene=brandmind&brandMindCognitiveV11=1">V1.1 Before</a> · <a href="/?scene=brandmind">Frozen default</a></p>'
for name in names:
    html+=f'<section><h2>{name}</h2><a href="{name}.png"><img loading="lazy" src="{name}.png"></a></section>'
(OUT / "index.html").write_text(html,encoding="utf8")
print(json.dumps(summary))
