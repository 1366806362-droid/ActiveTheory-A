"""Native browser evidence layout only: crop/resize/labels, no image enhancement."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageStat
import json

OUT = Path('art/brandmind-core-clarity')
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 22)

def pair(files, labels, output, crop=None):
    images = [Image.open(OUT / (f + '.png')).convert('RGB') for f in files]
    if crop:
        images = [im.crop(crop) for im in images]
    width, height = images[0].size
    canvas = Image.new('RGB', (width * len(images), height + 42), '#030a13')
    draw = ImageDraw.Draw(canvas)
    for i, (im, label) in enumerate(zip(images, labels)):
        canvas.paste(im, (i * width, 42))
        draw.text((i * width + 10, 8), label, font=font, fill='#b9cadb')
    canvas.save(OUT / output)

Image.open(OUT / 'CLARITY_FINAL.png').save(OUT / 'BRANDMIND_CLARITY_OVERVIEW.png')
Image.open(OUT / 'CLARITY_FINAL.png').resize((640, 360), Image.Resampling.LANCZOS).save(OUT / 'BRANDMIND_CLARITY_SMALL.png')
pair(['BEFORE', 'CLARITY_FINAL'], ['昨晚 Before：87dcfb5', '本轮 After：单核心未达到视觉要求'], 'BRANDMIND_CLARITY_BEFORE_AFTER.png')
pair(['BEFORE_NO_BLOOM', 'CLARITY_FINAL_NO_BLOOM'], ['Before：关闭 Bloom', 'After：关闭 Bloom'], 'BRANDMIND_CLARITY_INTERNAL.png', (630, 245, 1010, 675))
pair(['CLARITY_FINAL_NO_BLOOM', 'CLARITY_FINAL'], ['Bloom 关闭', 'Bloom 开启（全局参数未改）'], 'BRANDMIND_CLARITY_BLOOM.png', (630, 245, 1010, 675))
pair(['BEFORE_SOURCE','BEFORE_TRANSMISSION','BEFORE_DENSITY_SLICE','BEFORE_CONTOUR'], ['内光贡献','透过率（亮=透）','中点密度切片 /4.1','轮廓贡献'], 'DIAGNOSIS_BEFORE.png', (630,245,1010,675))
pair(['AFTER_SOURCE','AFTER_TRANSMISSION','AFTER_DENSITY_SLICE','AFTER_CONTOUR'], ['内光贡献','透过率（亮=透）','中点密度切片 /4.1','轮廓贡献'], 'DIAGNOSIS_AFTER.png', (630,245,1010,675))
metrics={}
for label, a, b in [('sampling24vs40','AFTER_24','AFTER_40'),('beforeBloom','BEFORE','BEFORE_NO_BLOOM'),('afterBloom','CLARITY_FINAL','CLARITY_FINAL_NO_BLOOM')]:
    x=Image.open(OUT/(a+'.png')).convert('RGB').crop((650,280,975,640))
    y=Image.open(OUT/(b+'.png')).convert('RGB').crop((650,280,975,640))
    metrics[label]={'meanAbsoluteDifference8bit':ImageStat.Stat(ImageChops.difference(x,y)).mean,'roi':[650,280,975,640]}
(OUT/'image-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
files=['BRANDMIND_CLARITY_OVERVIEW.png','BRANDMIND_CLARITY_BEFORE_AFTER.png','BRANDMIND_CLARITY_INTERNAL.png','BRANDMIND_CLARITY_BLOOM.png','BRANDMIND_CLARITY_SMALL.png','DIAGNOSIS_BEFORE.png','DIAGNOSIS_AFTER.png']
html='<meta charset="utf-8"><title>品牌心智核心修正：未达到视觉要求</title><style>body{background:#030a13;color:#bbc9dc;font:16px sans-serif;margin:24px}img,video{max-width:100%;display:block;margin:20px 0}a{color:#a9d1ee}</style><h1>单核心未达到视觉要求</h1><p>原生1600×900 PNG；局部图为原尺寸裁切，缩略图640×360。无调色/锐化。未恢复周边，未做完整场景验收。</p>'
for name in files:
    html+=f'<h2>{name}</h2><a href="{name}">打开原图</a><img src="{name}">'
html+='<h2>局部诊断视差（真实透视相机 ±0.10 world X，仅Core draw；非正式交互验收）</h2><video controls src="BRANDMIND_CLARITY_DEMO.mp4"></video>'
(OUT/'index.html').write_text(html,encoding='utf-8')
print(json.dumps(metrics))
