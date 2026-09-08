// Actual Edge GPU runtime capture. Never grades screenshot pixels or changes the app camera.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const out=path.resolve(__dirname,'..',process.env.HOME_FINAL_OUTPUT||'art/home-final-v1/final');
const base=process.env.HOME_FINAL_BASE||'http://127.0.0.1:5182/';
const query='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1';
const extra=process.env.HOME_FINAL_PARAMS||'homeFinalV1=1';
async function projectionState(page){return page.evaluate(async()=>{
  const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera();
  const T=await import('/node_modules/.vite/deps/three.js');
  const names=['EarthRoot','5ANebula','GEONebula','BrandMindNebula','HeroAssetLayer'];
  return {camera:c.position.toArray(),targets:Object.fromEntries(names.map(name=>{
    const o=s.getObjectByName(name),v=o.getWorldPosition(new T.Vector3()).project(c);
    return [name,{world:o.getWorldPosition(new T.Vector3()).toArray(),screen:[(v.x+1)*800,(1-v.y)*450]}];
  }))};
})}
async function state(page){return page.evaluate(async()=>{
  const scene=(await import('/src/engine/scenes.js')).getActiveScene(),canvas=document.querySelector('canvas');
  const gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
  const samples=window.__HOME_FINAL_SAMPLES__.slice(-240),dt=samples.map(x=>x.dt).sort((a,b)=>a-b);
  let particles=0,pointBatches=0;const meshNames=[];
  scene.traverseVisible(o=>{if(o.isPoints){particles+=o.geometry.drawRange.count===Infinity?o.geometry.attributes.position.count:o.geometry.drawRange.count;pointBatches++}if(o.isMesh)meshNames.push(o.name)});
  return {gpu:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),fps:samples.length*1000/samples.reduce((a,b)=>a+b.dt,0),
    p95:dt[Math.floor(dt.length*.95)],drawCalls:samples.reduce((a,b)=>a+b.calls,0)/samples.length,particles,pointBatches,
    loop:(await import('/src/engine/loop.js')).getLoopStatus(),canvas:document.querySelectorAll('canvas').length,
    earth:window.__ACTIVE_THEORY_EARTH_V3__,journey:scene.getObjectByName('FiveAHomepageJourney')?.userData.journey,
    memory:scene.getObjectByName('BrandMindContinuousMemoryField')?.userData.memoryField,galaxy:window.__ACTIVE_THEORY_GALAXY_V3__,meshNames};
})}
async function isolate(page,names){await page.evaluate(async names=>{
  const scene=(await import('/src/engine/scenes.js')).getActiveScene(),keep=new Set();
  for(const name of names){const o=scene.getObjectByName(name);if(!o)throw new Error(`Missing ${name}`);o.traverse(n=>keep.add(n))}
  scene.traverse(o=>{if((o.isMesh||o.isPoints||o.isSprite||o.isLine)&&!keep.has(o))o.layers.set(31)});
  document.querySelectorAll('.hero-copy,.hero-scroll-hint').forEach(el=>el.style.visibility='hidden');
},names)}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});const report={errors:[]};
  try{
    const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
    page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
    page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
    await page.addInitScript(()=>{
      let calls=0,last=0;window.__HOME_FINAL_SAMPLES__=[];
      for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...a){calls++;return fn.apply(this,a)}}
      const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf.call(window,t=>{const before=calls;cb(t);if(calls>before){if(last)window.__HOME_FINAL_SAMPLES__.push({dt:t-last,calls:calls-before});last=t;if(window.__HOME_FINAL_SAMPLES__.length>600)window.__HOME_FINAL_SAMPLES__.shift()}});
    });
    report.url=base+'?'+query+'&'+extra;
    await page.goto(report.url,{waitUntil:'networkidle'});await page.mouse.move(600,400);await page.waitForTimeout(3800);
    report.runtime=await state(page);assert.match(report.runtime.gpu,/NVIDIA.*5060/i);
    report.vramWholeGpu=execFileSync('nvidia-smi',['--query-gpu=memory.used,memory.total,utilization.gpu','--format=csv,noheader'],{encoding:'utf8'}).trim();
    await page.screenshot({path:path.join(out,'HOME_FINAL_V1_RUNTIME.png')});
    report.parallax=[];
    if(process.env.HOME_FINAL_FAST!=='1')for(const [name,x,y] of [['LEFT',720,440],['CENTER',800,450],['RIGHT',880,460]]){
      await page.mouse.move(x,y);await page.waitForTimeout(650);report.parallax.push({name,...await projectionState(page)});
      await page.screenshot({path:path.join(out,`HOME_FINAL_V1_${name}.png`)});
    }
    await page.mouse.move(600,400);await page.waitForTimeout(400);
    await isolate(page,['GEONebulaOrbit','5ANebulaOrbit','BrandMindNebulaOrbit']);await page.waitForTimeout(350);
    await page.screenshot({path:path.join(out,'HOME_FINAL_V1_BUSINESS_NEBULAE.png')});
    if(process.env.HOME_FINAL_FAST!=='1'){
      await page.goto(report.url,{waitUntil:'networkidle'});await page.waitForTimeout(2200);
      await isolate(page,['HeroAssetLayer']);await page.waitForTimeout(350);
      await page.screenshot({path:path.join(out,'HOME_FINAL_V1_GALAXY_ISOLATED.png')});
      await page.goto(report.url+'&debugEarthV3Closeup=1',{waitUntil:'networkidle'});await page.waitForTimeout(3000);
      await page.screenshot({path:path.join(out,'HOME_FINAL_V1_EARTH_CLOSEUP.png')});
      report.earthCloseup=await state(page);
      await page.goto(base+'?'+query,{waitUntil:'networkidle'});await page.waitForTimeout(2200);
      report.rollback=await state(page);
      assert.equal(report.rollback.journey,undefined);assert.equal(report.rollback.earth.finalCandidate,null);
      assert.deepEqual(report.rollback.galaxy.heroAsset,report.runtime.galaxy.heroAsset);
      await page.goto(base,{waitUntil:'networkidle'});await page.waitForTimeout(1500);
      report.defaultPage=await state(page);
      assert.equal(report.defaultPage.journey,undefined);assert.equal(report.defaultPage.canvas,1);
      assert.equal(report.defaultPage.loop.activeRafChains,1);
    }
    assert.equal(report.errors.length,0);assert.equal(report.runtime.canvas,1);assert.equal(report.runtime.loop.activeRafChains,1);
    console.log(JSON.stringify({url:report.url,...report.runtime,errors:report.errors,vram:report.vramWholeGpu}));
  }finally{fs.writeFileSync(path.join(out,'runtime-report.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
