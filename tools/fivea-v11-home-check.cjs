const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('art/fivea-v11');
const base=process.env.FIVEA_URL||'http://127.0.0.1:5191/?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1&earthHeroLock=1';
(async()=>{
  const b=await chromium.launch({channel:'msedge',headless:false});const report={};
  try{
    const p=await b.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
    for(const mode of ['FROZEN','CANDIDATE']){
      await p.goto(base+'&v2FiveAState=balanced&v2FiveACapture=1'+(mode==='CANDIDATE'?'&fiveACinematic=B':''),{waitUntil:'networkidle'});await p.waitForTimeout(4000);
      await p.screenshot({path:path.join(out,`HOME_${mode}.png`)});
      report[mode]=await p.evaluate(async()=>{
        const s=(await import('/src/engine/scenes.js')).getActiveScene();const f=s.getObjectByName('FiveAScene');let points=0,textures=new Map();
        f.traverse(o=>{if(o.isPoints)points+=o.geometry.attributes.position.count;const m=o.material;if(m?.map)textures.set(m.map.uuid,[m.map.image?.width,m.map.image?.height]);});
        return {status:window.__GALAXY_TOUR_STATUS__,fiveAPoints:points,fiveALabelTextures:[...textures.values()]};
      });
    }
  }finally{fs.writeFileSync(path.join(out,'home-preservation.json'),JSON.stringify(report,null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
