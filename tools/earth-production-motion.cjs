// Browser-only diagnostic transforms. No production Camera/controller modifications.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const out=path.resolve(__dirname,'../art/earth-prod/final');
const base=process.env.EARTH_PROD_BASE||'http://127.0.0.1:5188/';
const query='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1';
const pose=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../art/earth-prod/baseline/runtime-report.json'))).cases.find(c=>c.name==='EARTH_HYBRID_HOME').camera;
function instrumentation(){
 let last=0,calls=0;window.__PROD_FRAMES__=[];
 for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const f=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...a){calls++;return f.apply(this,a)}}
 const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf.call(window,t=>{const start=calls;cb(t);if(calls>start){if(last)window.__PROD_FRAMES__.push({dt:t-last,calls:calls-start});last=t;if(window.__PROD_FRAMES__.length>300)window.__PROD_FRAMES__.shift()}});
}
async function snapshot(p){return p.evaluate(async()=>{
 const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera();
 const T=await import('/node_modules/.vite/deps/three.js');const projected={};
 for(const name of ['EarthRoot','HeroAssetLayer']){const v=s.getObjectByName(name).getWorldPosition(new T.Vector3()).project(c);projected[name]=[(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2]}
 const f=window.__PROD_FRAMES__.slice(-240),d=f.map(x=>x.dt).sort((a,b)=>a-b),meshes=[];
 s.getObjectByName('EarthRoot').traverseVisible(o=>{if(o.isMesh)meshes.push(o.name)});
 return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,projected,hybrid:{...window.__ACTIVE_THEORY_EARTH_HYBRID__},fps:f.length*1000/f.reduce((n,x)=>n+x.dt,0),p95:d[Math.floor(.95*d.length)],drawCalls:f.reduce((n,x)=>n+x.calls,0)/f.length,meshes,canvas:document.querySelectorAll('canvas').length,loop:(await import('/src/engine/loop.js')).getLoopStatus()};
})}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true}),report={errors:[],mouse:[],resize:[]};
 try{
 const ctx=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});await ctx.addInitScript(instrumentation);
 const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await p.goto(base+'?'+query,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.production);await p.waitForTimeout(2500);
 for(const [label,x,y]of [['LEFT',720,440],['CENTER',800,450],['RIGHT',880,460],['TOP_LEFT',1,1],['BOTTOM_RIGHT',1598,898]]){
   await p.mouse.move(x,y);await p.waitForTimeout(700);const s=await snapshot(p);report.mouse.push({label,...s});await p.screenshot({path:path.join(out,'MOTION_'+label+'.png')});
 }
 for(const size of [[1600,900],[1920,1080],[2560,1440],[1000,900]]){
   await p.setViewportSize({width:size[0],height:size[1]});await p.mouse.move(size[0]/2,size[1]/2);await p.waitForTimeout(2600);report.resize.push(await snapshot(p));await p.screenshot({path:path.join(out,`RESIZE_${size.join('x')}.png`)});
 }
 await ctx.close();
 const high=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:2});await high.addInitScript(instrumentation);const hp=await high.newPage();hp.on('pageerror',e=>report.errors.push(e.message));hp.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await hp.goto(base+'?'+query,{waitUntil:'networkidle'});await hp.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.production);await hp.mouse.move(800,450);await hp.waitForTimeout(3000);report.resize.push(await snapshot(hp));await hp.screenshot({path:path.join(out,'DPR2_HOME.png')});await high.close();
 const video=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1,recordVideo:{dir:path.join(out,'video-raw'),size:{width:1600,height:900}}});await video.addInitScript(instrumentation);
 const vp=await video.newPage();vp.on('pageerror',e=>report.errors.push(e.message));vp.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await vp.goto(base+'?'+query,{waitUntil:'networkidle'});await vp.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.production);await vp.mouse.move(800,450);await vp.waitForTimeout(1500);
 await vp.evaluate(async pose=>{
   const T=await import('/node_modules/.vite/deps/three.js'),s=(await import('/src/engine/scenes.js')).getActiveScene(),r=s.getObjectByName('EarthRoot'),q=r.quaternion.clone(),axis=new T.Vector3(0,1,0),before=s.onBeforeRender,start=performance.now();
   window.__PROD_SWEEP__=[];
   s.onBeforeRender=function(renderer,scene,camera,...rest){before.call(this,renderer,scene,camera,...rest);camera.position.fromArray(pose.position);camera.quaternion.fromArray(pose.quaternion);camera.updateMatrixWorld(true);
     const t=Math.min((performance.now()-start)/1000,12),angle=9*(1-Math.cos(2*Math.PI*t/12));r.quaternion.copy(q).multiply(new T.Quaternion().setFromAxisAngle(axis,angle*Math.PI/180));r.updateMatrixWorld(true);
     const d=window.__ACTIVE_THEORY_EARTH_HYBRID__;window.__PROD_SWEEP__.push({time:t,localAngle:angle,measured:d.measured,mix:d.mix,zone:d.zone,surfaceAngle:d.rotation.surfaceAngle,cloudAngle:d.rotation.cloudAngle});
   };
 },pose);
 await vp.waitForTimeout(12100);report.sweep=await vp.evaluate(()=>window.__PROD_SWEEP__);report.videoPerformance=await snapshot(vp);const raw=await vp.video().path();await video.close();
 execFileSync('ffmpeg',['-y','-sseof','-12','-i',raw,'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'EARTH_HYBRID_PRODUCTION_HANDOFF.mp4')],{stdio:'pipe'});
 report.vram=execFileSync('nvidia-smi',['--query-gpu=memory.used,memory.total','--format=csv,noheader'],{encoding:'utf8'}).trim();
 for(const s of [...report.mouse,...report.resize]){assert.equal(s.canvas,1);assert.equal(s.loop.activeRafChains,1);assert.equal(s.meshes.length,3)}
 assert.ok(report.sweep.some(x=>x.zone==='FALLBACK'));assert.equal(report.sweep.at(-1).zone,'HERO');assert.equal(report.errors.length,0,report.errors.join('\n'));
 }finally{fs.writeFileSync(path.join(out,'motion-report.json'),JSON.stringify(report,null,2));await b.close()}
 console.log(JSON.stringify({mouse:report.mouse.map(x=>({label:x.label,angle:x.hybrid.measured,zone:x.hybrid.zone})),resize:report.resize.map(x=>({size:[x.width,x.height,x.dpr],fps:x.fps,p95:x.p95,angle:x.hybrid.measured})),errors:report.errors}));
})().catch(e=>{console.error(e);process.exitCode=1});
