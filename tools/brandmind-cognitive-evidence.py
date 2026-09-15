"""Assemble native PNG evidence without grading or sharpening. No runtime assets."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

OUT = Path(__file__).resolve().parents[1] / "art" / "brandmind-v11"


def pair(left, right, name, labels):
    a, b = [Image.open(OUT / (p + ".png")).convert("RGB") for p in (left, right)]
    assert a.size == b.size
    canvas = Image.new("RGB", (a.width * 2, a.height + 28), "#050b13")
    canvas.paste(a, (0, 28))
    canvas.paste(b, (a.width, 28))
    draw = ImageDraw.Draw(canvas)
    for x, label in zip((12, a.width + 12), labels):
        draw.text((x, 8), label, fill="#adc2d0")
    canvas.save(OUT / (name + ".png"))


pair("BEFORE_FIXED", "BRANDMIND_V11_OVERVIEW", "BRANDMIND_V11_BEFORE_AFTER",
     ("Frozen V1 / same camera, t=12", "Candidate B / same camera, t=12 / art spacing tightened"))
pair("BACKGROUND_OFF", "BACKGROUND_ON", "BRANDMIND_V11_BACKGROUND_OFF_ON", ("Background OFF", "Background ON"))
pair("BLOOM_OFF", "BLOOM_ON", "BRANDMIND_V11_BLOOM_OFF_ON", ("Bloom OFF", "Bloom ON / shared settings unchanged"))
pair("CANDIDATE_A", "CANDIDATE_B", "CANDIDATE_AB", ("A: Cognitive Lens / correction 1", "B: Memory Bloom / correction 1"))
Image.open(OUT / "BRANDMIND_V11_OVERVIEW.png").resize((640, 360), Image.Resampling.LANCZOS).save(OUT / "BRANDMIND_V11_SMALL_READ.png")
diff = ImageChops.difference(Image.open(OUT / "HOME_CANDIDATE_FIXED.png").convert("RGB"),
                            Image.open(OUT / "HOME_FALLBACK_FIXED.png").convert("RGB"))
summary = {"home_identical": diff.getbbox() is None, "home_mean_absolute_error": ImageStat.Stat(diff).mean,
           "source": "Playwright native PNG, 1600x900 DPR1, no grading/sharpening",
           "comparisons": "3200x928; native-size frames plus 28px labels",
           "small_read": "640x360 downsample, not a separate camera capture"}
(OUT / "evidence.json").write_text(json.dumps(summary, indent=2), encoding="utf8")
images = ["BRANDMIND_V11_OVERVIEW", "BRANDMIND_V11_BEFORE_AFTER", "BRANDMIND_V11_CORE_DETAIL",
          "BRANDMIND_V11_ASSOCIATIONS", "BRANDMIND_V11_FLOW_DETAIL", "BRANDMIND_V11_BACKGROUND_OFF_ON",
          "BRANDMIND_V11_BLOOM_OFF_ON", "BRANDMIND_V11_PANEL_OPEN", "BRANDMIND_V11_SMALL_READ", "CANDIDATE_AB"]
html = '<!doctype html><meta charset="utf-8"><title>Brand Mind V1.1 review</title><style>body{background:#050b13;color:#bdd0df;font:15px system-ui;margin:30px}img,video{max-width:100%;height:auto}a{color:#9dcced}section{margin:35px 0}</style><h1>Brand Mind V1.1 — experimental / NOT READY</h1><p>Same-camera evidence. No post grading. Default Brand Mind unchanged.</p><p><a href="/?scene=brandmind&brandMindCognitiveV11=B">Open candidate</a> · <a href="/?scene=brandmind">Open frozen fallback</a></p>'
for name in images:
    html += f'<section><h2>{name}</h2><a href="{name}.png"><img loading="lazy" src="{name}.png"></a></section>'
html += '<section><h2>Continuous real-time browser capture</h2><video controls preload="metadata" src="BRANDMIND_V11_DEMO.mp4"></video></section>'
(OUT / "index.html").write_text(html, encoding="utf8")
print(json.dumps(summary))
