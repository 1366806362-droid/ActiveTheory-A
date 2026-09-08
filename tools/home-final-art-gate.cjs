// Current-runtime evidence only; no second renderer/loop in the application.
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,process.env.HOME_ART_OUTPUT||'art/home-final-art/candidate-a');
const query='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1';
const base=process.env.M3_BASE_URL||'http://127.0.0.1:5180/';
async function state(page){return page.evaluate(async()=>{
  const {getActiveScene}=await import('/src/engine/scenes.js');
  const {getCamera}=await import('/src/engine/camera.js');
  const T=await import('/node_modules/.vite/deps/three.js');
  const camera=getCamera(),scene=getActiveScene();
  const project=v=>{v.project(camera);return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2]};
  const nodes=['GEONebula','5ANebula','BrandMindNebula'].map(name=>{
    const object=scene.getObjectByName(name),box=new T.Box3().setFromObject(object);
    const corners=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(project(new T.Vector3(x,y,z)));
    return {name,center:project(object.getWorldPosition(new T.Vector3())),world:object.getWorldPosition(new T.Vector3()).toArray(),
      bounds:[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))]};
  });
  return {time:performance.now(),loop:(await import('/src/engine/loop.js')).getLoopStatus(),canvas:document.querySelectorAll('canvas').length,
    galaxy:window.__ACTIVE_THEORY_GALAXY_V3__,tour:window.__GALAXY_TOUR_STATUS__,nodes,composition:window.__ACTIVE_THEORY_UNIVERSE_COMPOSITION__};
})}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const report={};
  try{
    for(const mode of ['runtime','isolated']){
      const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
      const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});
      page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
      const params=new URLSearchParams(query);
      if(mode==='isolated')for(const [k,v] of Object.entries({debugV4Isolated:1,debugV3BusinessNebula:0,debugBusinessLabels:0,v3UseGpuStars:0,earthV2:0,earthV3:0}))params.set(k,v);
      const url=base+'?'+params;
      await page.goto(url,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.__ACTIVE_THEORY_GALAXY_V3__?.mode==='home-final-art-candidate');
      await page.mouse.move(800,450);await page.waitForTimeout(2000);
      const before=await state(page);await page.waitForTimeout(2000);const after=await state(page);
      await page.screenshot({path:path.join(out,mode==='runtime'?'HOME_FINAL_ART_RUNTIME.png':'HOME_FINAL_ART_GALAXY_ISOLATED.png')});
      report[mode]={url,errors,warnings,...after,fps:(after.loop.frames-before.loop.frames)*1000/(after.time-before.time)};
      if(mode==='runtime'){
        for(const [name,x,y] of [['LEFT',740,430],['CENTER',800,450],['RIGHT',860,470]]){
          await page.mouse.move(x,y);await page.waitForTimeout(650);
          await page.screenshot({path:path.join(out,`HOME_FINAL_ART_PARALLAX_${name}.png`)});
        }
        await page.mouse.move(800,450);await page.waitForTimeout(650);
        await page.evaluate(nodes=>{
          for(const [index,node] of nodes.entries()){
            const box=document.createElement('div'),[x0,y0,x1,y1]=node.bounds;
            box.style.cssText=`position:fixed;pointer-events:none;left:${x0}px;top:${y0}px;width:${x1-x0}px;height:${y1-y0}px;border:1px solid #9bc3d4;z-index:9999;color:#c9dce6;font:12px Arial;`;
            box.textContent=`${['GEO / Signal','5A / Journey','Brand Mind / Memory'][index]} z=${node.world[2].toFixed(2)}`;
            document.body.append(box);
          }
        },after.nodes);
        await page.screenshot({path:path.join(out,'HOME_FINAL_ART_NEBULAE_DEBUG.png')});
      }
      console.log(JSON.stringify({mode,fps:report[mode].fps,errors,nodes:after.nodes}));await page.close();
    }
    fs.writeFileSync(path.join(out,'runtime-report.json'),JSON.stringify(report,null,2));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
