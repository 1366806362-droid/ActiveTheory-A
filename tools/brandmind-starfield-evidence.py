"""Arrange native browser evidence without color/exposure/sharpening edits."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

OUT = Path('art/brandmind-starfield')

def pair(left, right, name, captions):
    a, b = Image.open(OUT / left).convert('RGB'), Image.open(OUT / right).convert('RGB')
    assert a.size == b.size
    canvas = Image.new('RGB', (a.width * 2, a.height + 30), '#07101c')
    canvas.paste(a, (0, 30)); canvas.paste(b, (a.width, 30))
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 8), captions[0], fill='#c8d4e8')
    draw.text((a.width + 12, 8), captions[1], fill='#c8d4e8')
    canvas.save(OUT / name)

pair('BEFORE_FIXED.png', 'BRANDMIND_STARFIELD_OVERVIEW.png', 'BRANDMIND_STARFIELD_BEFORE_AFTER.png',
     ['SHARED BASELINE / camera unchanged / time 12', 'EXPERIMENT / art layout changed / same camera and time 12'])
pair('BLOOM_OFF.png', 'BLOOM_ON.png', 'BRANDMIND_STARFIELD_BLOOM_COMPARE.png', ['BLOOM OFF', 'EXISTING BLOOM ON'])
Image.open(OUT / 'BRANDMIND_STARFIELD_OVERVIEW.png').resize((640, 360), Image.Resampling.LANCZOS).save(OUT / 'BRANDMIND_STARFIELD_SMALL_READ.png')

baseline = json.loads((OUT / 'baseline.json').read_text())['before']
final = json.loads((OUT / 'final.json').read_text())['after']
assert baseline['camera'] == final['camera']
assert baseline['exposure'] == final['exposure']
assert baseline['viewport'] == final['viewport'] == [1600, 900]
assert baseline['dpr'] == final['dpr'] == 1
checks = {'sameCamera': True, 'sameExposure': final['exposure'], 'time': 12, 'viewport': [1600, 900],
          'capture': 'native PNG; comparisons concatenate originals; Small Read is downsampled',
          'artLayoutChanged': True, 'sceneCameraChanged': False}
for a, b, key in [('HOME_CANDIDATE_FIXED.png', 'HOME_FALLBACK_FIXED.png', 'homeCandidateOffDifference'),
                  ('BEFORE_FIXED.png', 'FALLBACK_FINAL_FIXED.png', 'defaultBrandMindDifference')]:
    if (OUT / a).exists() and (OUT / b).exists():
        diff = ImageChops.difference(Image.open(OUT / a).convert('RGB'), Image.open(OUT / b).convert('RGB'))
        checks[key] = {'boundingBox': diff.getbbox(), 'maximumChannelDifference': max(v[1] for v in diff.getextrema())}
(OUT / 'evidence.json').write_text(json.dumps(checks, indent=2))

items = [
    ('BRANDMIND_STARFIELD_OVERVIEW.png', '全景'), ('BRANDMIND_STARFIELD_BEFORE_AFTER.png', '前后对照：同镜头、时间与曝光，节点美术布局有调整'),
    ('BRANDMIND_STARFIELD_CORE_DETAIL.png', '核心细节：原生像素裁切'), ('BRANDMIND_STARFIELD_BLOOM_COMPARE.png', '辉光关闭 / 开启'),
    ('BRANDMIND_STARFIELD_ASSOCIATIONS.png', '节点与关系'), ('BRANDMIND_STARFIELD_PANEL_OPEN.png', '数据窗口展开'),
    ('BRANDMIND_STARFIELD_SMALL_READ.png', '640×360 缩略图')]
html = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>品牌心智星场 · 实验记录</title><style>body{background:#070c17;color:#d6e2f2;font:16px system-ui;margin:24px auto;max-width:1600px;padding:0 16px}a{color:#a4cfff}img,video{display:block;max-width:100%;height:auto}figure{margin:32px 0}figcaption{margin:10px 0}p{line-height:1.7}</style>
<h1>品牌心智星场：未达到要求</h1><p>实际浏览器候选；不是参考图复制品、人工通过或默认场景。核心仍有壳面细纹与团块感，停止进一步美术调整。六个美术节点、三条历史美术路径；已映射业务节点为零。Panel 仍为 MOCK / SYNTHETIC。</p>
<p><a href="/?scene=brandmind&amp;brandMindStarfield=1">打开实际候选场景</a> · <a href="/?scene=brandmind">原默认 Brand Mind</a> · <a href="/">默认 HOME</a></p>
'''
for file, caption in items:
    html += f'<figure><figcaption>{caption}</figcaption><a href="{file}"><img src="{file}" loading="lazy"></a></figure>'
html += '<h2>真实浏览器演示</h2><p>原速 PNG 帧按采集时间编码。中段 ±0.08 弧度临时审阅视角用于检查三维层次，不修改正式 Camera；其余为真实进入、停留、点击、关闭和返回。</p><video controls preload="metadata" src="BRANDMIND_STARFIELD_DEMO.mp4"></video></html>'
(OUT / 'index.html').write_text(html, encoding='utf-8')
print(json.dumps(checks, indent=2))
