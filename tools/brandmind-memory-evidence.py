"""Lossless evidence layout only; no exposure, grade, sharpening, or visual repair."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / 'art' / 'brandmind-memory'
for folder in ROOT.iterdir():
    runtime = folder / 'HOME_BRANDMIND_MEMORY_RUNTIME.png'
    if runtime.is_file():
        with Image.open(runtime) as im:
            im.resize((640, 360), Image.Resampling.LANCZOS).save(folder / 'HOME_BRANDMIND_MEMORY_SMALL_READ.png')

sheet = Image.new('RGB', (1600, 840), '#02050a')
draw = ImageDraw.Draw(sheet)
for i, candidate in enumerate(['baseline', 'A', 'B', 'C']):
    x, y = (i % 2) * 800, (i // 2) * 420
    with Image.open(ROOT / candidate / 'HOME_BRANDMIND_MEMORY_ISOLATED.png') as im:
        # Magnification for audit; final deliverables remain uncropped 1600x900.
        region = im.crop((530, 560, 1080, 900)).resize((640, 396), Image.Resampling.LANCZOS)
        sheet.paste(region, (x + 80, y + 24))
    draw.text((x+20, y+8), candidate, fill='#cbddeb')
sheet.save(ROOT / 'CANDIDATE_STRUCTURE_COMPARISON.png')

if (ROOT / 'final' / 'HOME_BRANDMIND_MEMORY_RUNTIME.png').exists():
    pair = Image.new('RGB', (1600, 450))
    for i, candidate in enumerate(['baseline', 'final']):
        with Image.open(ROOT / candidate / 'HOME_BRANDMIND_MEMORY_RUNTIME.png') as im:
            pair.paste(im.resize((800, 450), Image.Resampling.LANCZOS), (i*800, 0))
    pair.save(ROOT / 'BASELINE_FINAL_COMPARISON.png')
