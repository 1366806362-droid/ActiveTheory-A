"""Deterministic 4K derivatives of attributed Solar System Scope 8K source maps.

Sources are deliberately local art inputs; no hidden downloads or new random cities.
Usage: python tools/earth-orbital-assets.py
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/earth-v12'
SOURCES=ART/'sources'
OUT=ROOT/'public/textures/hero/earth/orbital-v12'
SIZE=(4096,2048)
FILES=['8k_earth_daymap.jpg','8k_earth_nightmap.jpg','8k_earth_clouds.jpg','8k_earth_normal_map.tif','8k_earth_specular_map.tif']

def read(name):
    return np.asarray(Image.open(SOURCES/name).convert('RGB').resize(SIZE,Image.Resampling.LANCZOS),np.float32)/255

def blur(a,radius):
    pad=int(radius*4)
    a=np.pad(a,((0,0),(pad,pad)),mode='wrap')
    result=Image.fromarray(np.uint8(np.clip(a,0,1)*255+.5)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(result,np.float32)[:,pad:-pad]/255

def save(name,a):
    image=Image.fromarray(np.uint8(np.clip(a,0,1)*255+.5))
    # Alpha is land DATA, not transparency: retain valid normal RGB above ocean.
    image.save(OUT/name,lossless=True,exact=True,method=6)
    return {'file':name,'size':image.size,'bytes':(OUT/name).stat().st_size,
            'sha256':hashlib.sha256((OUT/name).read_bytes()).hexdigest()}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    day,night,cloud,normal,spec=map(read,FILES)
    # The source specular atlas is white for ocean and black on land. Keep coasts soft.
    land=np.clip(1-spec.mean(axis=-1),0,1)
    density=cloud.mean(axis=-1)
    broad=blur(density,3)
    weather=blur(density,18)
    # Night photographs contain faint blue non-emissive ground/ocean. Extract warm emission.
    signal=np.clip((night[...,0]-.55*night[...,2])/.68,0,1)**1.18
    signal*=np.clip((land-.65)/.35,0,1)
    region=blur(signal,7)
    # Packed levels preserve existing urban geography; no synthetic dot distribution.
    metro=np.clip(region/.12,0,1)*signal
    hero=np.clip((signal-.64)/.36,0,1)**2*np.clip(region/.06,0,1)
    results=[save('earth-orbital-surface.webp',day),
      save('earth-orbital-normal-land.webp',np.dstack([normal,land])),
      save('earth-orbital-city.webp',np.dstack([signal,metro,hero])),
      save('earth-orbital-cloud.webp',np.dstack([density,broad,weather]))]
    manifest={'author':'Solar System Scope / INOVE','license':'CC BY 4.0',
      'licenseUrl':'https://creativecommons.org/licenses/by/4.0/',
      'sourcePage':'https://www.solarsystemscope.com/textures/',
      'changes':'4K Lanczos resampling; normal+land packing; urban emission tiers; continuous multiscale cloud packing. No sharpening or random synthesis.',
      'sources':[{'file':f,'size':Image.open(SOURCES/f).size,'sha256':hashlib.sha256((SOURCES/f).read_bytes()).hexdigest()} for f in FILES],
      'outputs':results,'estimatedMipRGBABytes':len(results)*SIZE[0]*SIZE[1]*4*4/3,
      'cityOceanMax':float(signal[land<.65].max())}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    sheet=Image.new('RGB',(1600,850),'#080c12');draw=ImageDraw.Draw(sheet)
    for i,(label,array) in enumerate([('DAY ALBEDO',day),('NORMAL / LAND',np.dstack([land]*3)),
      ('NIGHT EMISSION',np.dstack([signal]*3)),('CLOUD DENSITY',np.dstack([density]*3)),
      ('SOURCE NORMAL',normal),('CLOUD WEATHER',np.dstack([weather]*3))]):
        frame=Image.fromarray(np.uint8(np.clip(array,0,1)*255)).resize((800,256),Image.Resampling.LANCZOS)
        x=(i%2)*800;y=(i//2)*282;sheet.paste(frame,(x,y+24));draw.text((x+12,y+5),label,fill='white')
    sheet.save(ART/'EARTH_V12_ASSET_MAPS.png')
    print(json.dumps(manifest,indent=2))

if __name__=='__main__':main()
