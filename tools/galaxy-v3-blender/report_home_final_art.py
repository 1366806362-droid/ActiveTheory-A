"""Package current-run evidence without retouching runtime screenshots."""
import json
import shutil
from PIL import Image, ImageDraw
from galaxy_final_m3 import ROOT

OUT=ROOT/'art/home-final-art'

def main():
    selected=OUT/'candidate-c'
    for source in selected.glob('HOME_FINAL_ART_*.png'):
        shutil.copy2(source,OUT/source.name)
    runtime=Image.open(OUT/'HOME_FINAL_ART_RUNTIME.png').convert('RGB')
    runtime.resize((640,360),Image.Resampling.LANCZOS).save(OUT/'HOME_FINAL_ART_SMALL_READ.png')
    comparison=Image.new('RGB',(1280,720))
    for i,(name,file) in enumerate([
        ('BASELINE',OUT/'baseline/HOME_M3_REPAIRED_RUNTIME.png'),
        ('A',OUT/'candidate-a/HOME_FINAL_ART_PARALLAX_CENTER.png'),
        ('B',OUT/'candidate-b/HOME_FINAL_ART_RUNTIME.png'),
        ('C - NOT READY',selected/'HOME_FINAL_ART_RUNTIME.png')]):
        tile=Image.open(file).convert('RGB').resize((640,360),Image.Resampling.LANCZOS)
        ImageDraw.Draw(tile).text((12,338),name,fill=(205,219,230))
        comparison.paste(tile,((i%2)*640,(i//2)*360))
    comparison.save(OUT/'CANDIDATE_COMPARISON.png')
    (OUT/'visual-review.json').write_text(json.dumps({
        'status':'NOT READY FOR PRODUCTION','candidateCount':3,'correctionCount':2,
        'selected':'none for release; C retained as the final experimental state',
        'strengths':['5A four-cluster journey now visible','GEO signal node remains distinct',
                     'original Galaxy geometry/core preserved','no change to Earth or internal scenes'],
        'blockers':['Brand Mind reads as separated defocused points, not a cohesive memory cloud',
                    'small-read business identity hierarchy is not fully resolved'],
        'limits':['not a full accessibility audit','human final freeze not granted'],
        'next':'separate particle-shell detail from low-frequency memory field; no implementation in this gate'
    },indent=2))

if __name__=='__main__':main()
