"""Unretouched screenshot derivatives only: small-read and before/after review."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art/home-final-v1'
final = Image.open(OUT / 'final/HOME_FINAL_V1_RUNTIME.png').convert('RGB')
assert final.size == (1600, 900)
final.resize((640, 360), Image.Resampling.LANCZOS).save(OUT / 'final/HOME_FINAL_V1_SMALL_READ.png')
before = Image.open(OUT / 'baseline/HOME_BRANDMIND_MEMORY_RUNTIME.png').convert('RGB')
sheet = Image.new('RGB', (1600, 474), '#030810')
for index, (label, frame) in enumerate([('BEFORE', before), ('CANDIDATE', final)]):
    sheet.paste(frame.resize((800, 450), Image.Resampling.LANCZOS), (800 * index, 24))
    ImageDraw.Draw(sheet).text((800 * index + 12, 6), label, fill='#bac8d4')
sheet.save(OUT / 'final/HOME_FINAL_V1_BEFORE_AFTER.png')
print('Small Read and ungraded before/after generated.')
