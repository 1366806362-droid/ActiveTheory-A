"""Unretouched image derivatives for the Earth-only human review gate."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art/earth-v11'
runtime = Image.open(OUT/'HOME_EARTH_V11_RUNTIME.png').convert('RGB')
assert runtime.size == (1600, 900)
runtime.resize((640, 360), Image.Resampling.LANCZOS).save(OUT/'HOME_EARTH_V11_SMALL_READ.png')
sheet = Image.new('RGB', (1600, 474), '#030810')
for index, (label, file) in enumerate([('FROZEN EARTH', 'before/CLOSEUP.png'), ('CANDIDATE B', 'EARTH_V11_CLOSEUP.png')]):
    frame = Image.open(OUT/file).convert('RGB')
    sheet.paste(frame.resize((800, 450), Image.Resampling.LANCZOS), (800*index, 24))
    ImageDraw.Draw(sheet).text((800*index+12, 6), label, fill='#bac8d4')
sheet.save(OUT/'EARTH_V11_BEFORE_AFTER.png')
print('Ungraded small-read and before/after images saved.')
