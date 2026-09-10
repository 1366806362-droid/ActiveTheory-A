const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.EARTH_LOCK_BASE||'http://127.0.0.1:5189/';
const OUT=path.resolve(__dirname,'../art/earth-hero-lock');
const QUERY='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1';
async function read(p){return p.evaluate(async()=>{
 const T=await import('/node_modules/.vite/deps/three.js'),scene=(await import('/src/engine/scenes.js')).getActiveScene(),camera=(await import('/src/engine/camera.js')).getCamera();
 const e=scene.getObjectByName('EarthRoot'),motion=scene.getObjectByName('EarthHeroMotion'),objects={};
 for(const name of ['EarthRoot','EarthHeroMotion','HeroAssetLayer','GEONebula','5ANebula','BrandMindNebula']){
   const o=scene.getObjectByName(name);if(!o)continue;const v=o.getWorldPosition(new T.Vector3()),q=v.clone().project(camera);objects[name]={world:v.toArray(),screen:[(q.x+1)*innerWidth/2,(1-q.y)*innerHeight/2],localPosition:o.position.toArray(),localRotation:o.rotation.toArray()};
 }
 const i=(await import('/src/universe/interaction.js')).getInteractionState();
 return {time:performance.now(),viewport:[innerWidth,innerHeight,devicePixelRatio],objects,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov},
   input:{targetX:i.targetX,targetY:i.targetY,x:i.x,y:i.y,parallaxX:i.parallaxX,parallaxY:i.parallaxY},
   hybrid:{...window.__ACTIVE_THEORY_EARTH_HYBRID__},heroLock:window.__ACTIVE_THEORY_EARTH_HERO_LOCK__??null,
   earthState:e.userData.earthRotation,canvas:document.querySelectorAll('canvas').length,loop:(await import('/src/engine/loop.js')).getLoopStatus()};
})}
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});const report={errors:[],samples:[]};
 try{
 const p=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await p.goto(BASE+'?'+QUERY+'&earthAudit=1&earthFreeze=1',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.production);
 for(const [name,x,y]of [['CENTER',800,450],['LEFT',1,450],['RIGHT',1599,450],['TOP',800,1],['BOTTOM',800,899],['TOP_LEFT',1,1],['TOP_RIGHT',1599,1],['BOTTOM_RIGHT',1599,899],['BOTTOM_LEFT',1,899],['CENTER_RETURN',800,450]]){
   await p.mouse.move(x,y);await p.waitForTimeout(3500);const s=await read(p);report.samples.push({name,...s});await p.screenshot({path:path.join(OUT,'AUDIT_'+name+'.png')});
   console.log(JSON.stringify({name,angle:s.hybrid.measured,input:s.input.parallaxX,earth:s.objects.EarthRoot.screen,galaxy:s.objects.HeroAssetLayer.screen}));
 }
 assert.equal(report.errors.length,0,report.errors.join('\n'));
 }finally{fs.writeFileSync(path.join(OUT,'input-audit.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
