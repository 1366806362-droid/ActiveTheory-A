// Real browser input, existing RAF telemetry only. No application Camera changes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const BASE=process.env.EARTH_LOCK_BASE||'http://127.0.0.1:5189/';
const OUT=path.resolve(__dirname,'../art/earth-hero-lock/final');
const QUERY='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1&earthHeroLock=1';
function instrument(){
 let last=0,calls=0,gl=null,timer=null;const queries=[];window.__LOCK_FRAMES__=[];window.__LOCK_GPU__=[];
 window.__LOCK_LONG_TASKS__=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.__LOCK_LONG_TASKS__.push({start:e.startTime,duration:e.duration})}).observe({entryTypes:['longtask']});
 const listeners=[];const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
 EventTarget.prototype.addEventListener=function(t,f,o){if((this===window||this===document)&&!new Error().stack.includes('addHitTargetInterceptorListeners'))listeners.push({target:this,t,f,o});return add.call(this,t,f,o)};
 EventTarget.prototype.removeEventListener=function(t,f,o){const i=listeners.findIndex(r=>r.target===this&&r.t===t&&r.f===f);if(i>=0)listeners.splice(i,1);return remove.call(this,t,f,o)};
 window.__LOCK_LISTENERS__=()=>Object.fromEntries(['wheel','pointermove','pointerdown','pointerup'].map(t=>[t,listeners.filter(r=>r.t===t&&!r.o?.signal?.aborted).length]));
 for(const n of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const f=WebGL2RenderingContext.prototype[n];WebGL2RenderingContext.prototype[n]=function(...a){if(!gl){gl=this;timer=gl.getExtension('EXT_disjoint_timer_query_webgl2')}calls++;return f.apply(this,a)}}
 const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf.call(window,t=>{
  while(queries.length&&gl.getQueryParameter(queries[0],gl.QUERY_RESULT_AVAILABLE)){const q=queries.shift();if(!gl.getParameter(timer.GPU_DISJOINT_EXT))window.__LOCK_GPU__.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q)}
  const q=timer?gl.createQuery():null;if(q)gl.beginQuery(timer.TIME_ELAPSED_EXT,q);const start=performance.now(),before=calls;cb(t);const cpu=performance.now()-start;if(q){gl.endQuery(timer.TIME_ELAPSED_EXT);queries.push(q)}
  if(calls>before){const h=window.__ACTIVE_THEORY_EARTH_HYBRID__,d=window.__ACTIVE_THEORY_EARTH_HERO_LOCK__;
   if(last)window.__LOCK_FRAMES__.push({t,dt:t-last,cpu,calls:calls-before,angle:h?.measured,mix:h?.mix,zone:h?.zone,clock:h?.time,cloud:h?.rotation?.cloudAngle,surface:h?.rotation?.surfaceAngle,offset:d?.offsetPx?.slice(),screen:d?.screen?.slice(),orientation:d?.orientationDegrees?.slice(),cloudPointer:d?.cloudPointerDegrees,finite:d?.finite,active:d?.active,programs:d?.programs});last=t;
   if(window.__LOCK_FRAMES__.length>25000)window.__LOCK_FRAMES__.shift();if(window.__LOCK_GPU__.length>25000)window.__LOCK_GPU__.shift();
  }
 });
}
function stats(frames,gpu=[]){
 const valid=frames.filter(f=>Number.isFinite(f.dt)&&Number.isFinite(f.angle)),q=(a,p)=>a.slice().sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))],mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
 let triggers=0,previous=false;for(const f of valid){const fallback=f.mix>0;if(fallback&&!previous)triggers++;previous=fallback}
 return {duration:valid.reduce((n,f)=>n+f.dt,0)/1000,frames:valid.length,fps:1000/mean(valid.map(f=>f.dt)),p95:q(valid.map(f=>f.dt),.95),p99:q(valid.map(f=>f.dt),.99),maxFrame:Math.max(...valid.map(f=>f.dt)),cpuMs:mean(valid.map(f=>f.cpu)),gpuMs:gpu.length?mean(gpu):null,drawCalls:mean(valid.map(f=>f.calls)),maxViewAngle:Math.max(...valid.map(f=>f.angle)),fallbackTriggerCount:triggers,fallbackFrames:valid.filter(f=>f.mix>0).length,maxEarthOffsetPx:Math.max(...valid.map(f=>Math.hypot(...(f.offset||[0,0])))),maxCloudPointerDeg:Math.max(...valid.map(f=>Math.abs(f.cloudPointer||0))),nonfinite:valid.filter(f=>f.finite===false||![f.angle,f.cloud,f.surface,...(f.offset||[])].every(Number.isFinite)).length,programs:[...new Set(valid.map(f=>f.programs))],first:valid[0],last:valid.at(-1)};
}
async function snapshot(p){return p.evaluate(async()=>{
 const T=await import('/node_modules/.vite/deps/three.js'),s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera(),r=s.getObjectByName('EarthRoot'),objects={};
 for(const n of ['EarthRoot','EarthHeroMotion','HeroAssetLayer','GEONebula','5ANebula','BrandMindNebula']){const o=s.getObjectByName(n);if(o){const v=o.getWorldPosition(new T.Vector3()),q=v.clone().project(c);objects[n]={world:v.toArray(),screen:[(q.x+1)*innerWidth/2,(1-q.y)*innerHeight/2]}}}
 const meshes=[],textures=new Map();r.traverseVisible(o=>{if(o.isMesh){meshes.push(o.name);for(const u of Object.values(o.material.uniforms||{}))if(u.value?.isTexture)textures.set(u.value.uuid,{size:[u.value.image?.width,u.value.image?.height],source:u.value.name})}});
 const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
 return {objects,meshes,textureCount:textures.size,textures:[...textures.values()],size:[innerWidth,innerHeight,devicePixelRatio],gpu:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),hybrid:{...window.__ACTIVE_THEORY_EARTH_HYBRID__},lock:structuredClone(window.__ACTIVE_THEORY_EARTH_HERO_LOCK__),canvas:document.querySelectorAll('canvas').length,loop:(await import('/src/engine/loop.js')).getLoopStatus(),listeners:window.__LOCK_LISTENERS__(),visibility:document.visibilityState};
})}
async function clear(p){await p.evaluate(()=>{window.__LOCK_FRAMES__=[];window.__LOCK_GPU__=[]})}
async function measure(p){const x=await p.evaluate(()=>({frames:window.__LOCK_FRAMES__,gpu:window.__LOCK_GPU__}));return stats(x.frames,x.gpu)}
async function load(p,extra=''){await p.goto(BASE+'?'+QUERY+extra,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.production&&window.__ACTIVE_THEORY_EARTH_HERO_LOCK__?.active);await p.mouse.move(800,450);await p.waitForTimeout(2500);await clear(p)}
async function motion(p,seconds,kind){
 const start=Date.now(),v=p.viewportSize();let index=0;
 while(Date.now()-start<seconds*1000){const t=(Date.now()-start)/1000;let x,y;
  if(kind==='slow'){x=Math.sin(t*Math.PI/6)*.96;y=Math.sin(t*Math.PI/9)*.45}
  else if(kind==='fast'){const corner=Math.floor(t*3)%4;[x,y]=[[-.985,-.985],[.985,.985],[-.985,.985],[.985,-.985]][corner]}
  else if(kind==='natural'){x=.64*Math.sin(t*.7)+.27*Math.sin(t*1.91);y=.65*Math.cos(t*.51)+.2*Math.sin(t*2.3)}
  else {const phase=Math.floor(t/12)%5;if(phase===0){x=Math.sin(t*2.4)*.98;y=0}else if(phase===1){[x,y]=[[-.98,-.98],[.98,.98],[-.98,.98],[.98,-.98]][Math.floor(t*4)%4]}else if(phase===2){x=.98*Math.cos(t*2);y=.98*Math.sin(t*2)}else if(phase===3){x=Math.floor(t*6)%2?.98:-.98;y=.6*Math.sin(t)}else{x=.97*Math.sin(t*.32);y=.2*Math.cos(t*.24)}}
  await p.mouse.move((x+1)*v.width/2,(1-y)*v.height/2);index++;await p.waitForTimeout(25);
 }
 return {events:index,wallSeconds:(Date.now()-start)/1000};
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true}),report={errors:[],candidates:[],responsive:[],videos:[],expectedResourceErrors:[]};
 const make=async(options={})=>{const ctx=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1,...options});await ctx.addInitScript(instrument);const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'){if(process.argv[2]==='asset-failure'&&m.text().includes('net::ERR_FAILED'))report.expectedResourceErrors.push(m.text());else report.errors.push(m.text())}});return {ctx,p}};
 try{
 const mode=process.argv[2]||'candidates';
 if(!['candidates','stress','responsive','safety','lifecycle','videos','final','asset-failure'].includes(mode))throw new Error('Unknown gate mode. Native visibility uses earth-hero-lock-visibility.cjs.');
 if(mode==='candidates'){
  const {ctx,p}=await make();for(const strategy of ['A','B','C']){
   await load(p,'&earthHeroStrategy='+strategy);const samples=[];
   for(const input of [0,.25,.5,.75,.999]){await p.mouse.move(800+input*800,450);await p.waitForTimeout(500);samples.push({input,...await snapshot(p)});await p.screenshot({path:path.join(OUT,`CANDIDATE_${strategy}_${Math.round(input*100)}.png`)})}
   await clear(p);await motion(p,6,'natural');report.candidates.push({strategy,samples,performance:await measure(p)});console.log(JSON.stringify({strategy,performance:report.candidates.at(-1).performance}));
  }await ctx.close();
 }else if(mode==='stress'){
  const {ctx,p}=await make();await load(p);report.before=await snapshot(p);assert.match(report.before.gpu,/NVIDIA.*5060/);
  await p.waitForTimeout(4000);report.neutral=await measure(p);await clear(p);
  report.input=await motion(p,61,'stress');report.stress=await measure(p);report.after=await snapshot(p);
  const bounds={start:report.stress.first.t,end:report.stress.last.t};
  report.worstFrames=await p.evaluate(({start,end})=>window.__LOCK_FRAMES__.filter(f=>f.t>=start&&f.t<=end).sort((a,b)=>b.dt-a.dt).slice(0,12),bounds);
  report.longTasks=await p.evaluate(({start,end})=>window.__LOCK_LONG_TASKS__.filter(x=>x.start>=start&&x.start<=end),bounds);
  report.screenRange=await p.evaluate(({start,end})=>{const s=window.__LOCK_FRAMES__.filter(f=>f.screen&&f.t>=start&&f.t<=end).map(f=>f.screen);return {x:[Math.min(...s.map(v=>v[0])),Math.max(...s.map(v=>v[0]))],y:[Math.min(...s.map(v=>v[1])),Math.max(...s.map(v=>v[1]))],note:'Includes frozen global idle camera; offsetPx is Earth-local input contribution only'}},bounds);
  await p.screenshot({path:path.join(OUT,'EARTH_HERO_LOCK_STRESS_END.png')});
  await p.mouse.move(1550,850);await p.waitForTimeout(500);report.leaveBefore=await snapshot(p);
  await p.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerleave')));await p.waitForTimeout(450);report.leaveAfter=await snapshot(p);
  await clear(p);await p.mouse.move(12,12);await p.waitForTimeout(450);report.reentry=await measure(p);
  report.vram=execFileSync('nvidia-smi',['--query-gpu=memory.used,memory.total','--format=csv,noheader'],{encoding:'utf8'}).trim();
  assert.ok(report.stress.duration>=60);assert.equal(report.stress.fallbackTriggerCount,0);assert.equal(report.stress.nonfinite,0);assert.equal(report.after.canvas,1);assert.equal(report.after.loop.activeRafChains,1);assert.equal(report.after.listeners.wheel,1);
  await ctx.close();console.log(JSON.stringify(report.stress));
 }else if(mode==='responsive'){
  const {ctx,p}=await make();await load(p);
  for(const size of [[1366,768],[1600,900],[1920,1080],[2560,1440],[3440,1440]]){await p.setViewportSize({width:size[0],height:size[1]});await p.mouse.move(size[0]-2,2);await p.waitForTimeout(1800);await clear(p);await p.waitForTimeout(1500);report.responsive.push({...await snapshot(p),performance:await measure(p)});await p.screenshot({path:path.join(OUT,'VIEWPORT_'+size.join('x')+'.png')});console.log(JSON.stringify(report.responsive.at(-1)))}await ctx.close();
  for(const dpr of [1.25,1.5,2]){const {ctx,p}=await make({deviceScaleFactor:dpr});await load(p);await p.mouse.move(1598,898);await clear(p);await p.waitForTimeout(2500);report.responsive.push({...await snapshot(p),performance:await measure(p)});await p.screenshot({path:path.join(OUT,`DPR_${dpr}.png`)});await ctx.close()}
  for(const s of report.responsive){assert.equal(s.hybrid.mix,0);assert.equal(s.lock.finite,true);assert.equal(s.canvas,1);assert.equal(s.loop.activeRafChains,1)}
 }else if(mode==='safety'){
  const {ctx,p}=await make();await load(p);report.range=[];report.extreme=[];
  await p.evaluate(async()=>{
   const s=(await import('/src/engine/scenes.js')).getActiveScene(),r=s.getObjectByName('EarthRoot'),m=s.getObjectByName('EarthTextureSurface');
   window.__LOCK_ROOT_QUAT__=r.quaternion.toArray();const before=m.onBeforeRender;
   m.onBeforeRender=function(...a){before.apply(this,a);if(window.__LOCK_FORCE_HYBRID__){m.material.uniforms.uHandoff.value=0;m.material.uniforms.uCalibration.value=0}};
  });
  for(const forceHybrid of [true,false]){
   await p.evaluate(v=>window.__LOCK_FORCE_HYBRID__=v,forceHybrid);
   for(const angle of forceHybrid?[0,2,4,6,8,10]:[0,6,10,16,20,10,4,0]){
    await p.evaluate(async a=>{const T=await import('/node_modules/.vite/deps/three.js'),r=(await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('EarthRoot');r.quaternion.fromArray(window.__LOCK_ROOT_QUAT__).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),a*Math.PI/180));r.updateMatrixWorld(true)},angle);
    await clear(p);await p.waitForTimeout(650);const v={angle,...await snapshot(p),performance:await measure(p)};(forceHybrid?report.range:report.extreme).push(v);
    await p.screenshot({path:path.join(OUT,`${forceHybrid?'SAFE_RANGE':'EXTREME'}_${angle}.png`)});
   }
  }
  assert.ok(report.extreme.some(s=>s.hybrid.mix===1));assert.equal(report.extreme.at(-1).hybrid.mix,0);
  report.programs=report.extreme.map(s=>s.lock.programs);assert.equal(new Set(report.programs).size,1);
  report.textureCounts=report.extreme.map(s=>s.textureCount);assert.equal(new Set(report.textureCounts).size,1);
  // An external camera orientation change must not be compensated as ordinary input.
  await p.evaluate(async()=>{const s=(await import('/src/engine/scenes.js')).getActiveScene(),f=s.onBeforeRender;s.onBeforeRender=function(renderer,scene,camera,...a){f.call(this,renderer,scene,camera,...a);camera.rotateY(.3);camera.updateMatrixWorld(true)}});
  await p.waitForTimeout(300);report.foreignCamera=await snapshot(p);assert.equal(report.foreignCamera.lock.active,false);await ctx.close();
 }else if(mode==='lifecycle'){
  const {ctx,p}=await make();await load(p);await p.waitForTimeout(2000);report.before=await snapshot(p);
  await p.evaluate(async()=>{(await import('/src/engine/index.js')).initializeEngine()});
  await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.production&&window.__ACTIVE_THEORY_EARTH_HERO_LOCK__?.active);await p.waitForTimeout(1500);report.recreated=await snapshot(p);
  assert.ok(report.recreated.hybrid.time>=report.before.hybrid.time);assert.equal(report.recreated.canvas,1);assert.equal(report.recreated.loop.activeRafChains,1);assert.equal(report.recreated.listeners.wheel,1);
  const other=await ctx.newPage();await other.goto('about:blank');await other.bringToFront();await p.waitForTimeout(1000);report.background=await snapshot(p);await p.bringToFront();await p.waitForTimeout(1000);report.foreground=await snapshot(p);await other.close();
  report.visibilityWasReal=report.background.visibility==='hidden';
  assert.ok(report.foreground.hybrid.time>=report.recreated.hybrid.time);assert.equal(report.foreground.hybrid.mix,0);
  // Mid-session phase at one hour without introducing a second clock.
  report.phaseInjection=await p.evaluate(async()=>{const source=await(await fetch('/src/universe/earthHorizon.js')).text(),url=source.match(/from\s+["']([^"']*earthHeroLock\.js[^"']*)["']/)[1];const h=await import(url),engine=await import('/src/engine/index.js');h.earthHeroSession('B').time=3600;engine.initializeEngine();return {module:url,time:h.earthHeroSession('B').time}});
  await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.production);await p.waitForTimeout(1200);report.oneHour=await snapshot(p);await p.screenshot({path:path.join(OUT,'EARTH_HERO_LOCK_ONE_HOUR.png')});
  assert.ok(report.oneHour.hybrid.time>=3600);assert.equal(report.oneHour.hybrid.mix,0);assert.equal(report.oneHour.canvas,1);assert.equal(report.oneHour.loop.activeRafChains,1);
  report.longDwellCorners=[];for(const [x,y]of [[2,2],[1598,2],[1598,898],[2,898]]){await p.mouse.move(x,y);await p.waitForTimeout(650);report.longDwellCorners.push(await snapshot(p))}for(const s of report.longDwellCorners)assert.equal(s.hybrid.mix,0);await ctx.close();
 }else if(mode==='asset-failure'){
  const {ctx,p}=await make();await ctx.route('**/textures/hero/earth/hybrid-v1/manifest.json',route=>route.abort('failed'));
  await p.goto(BASE+'?'+QUERY,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.fallback&&window.__ACTIVE_THEORY_EARTH_V3__?.textureStatus==='ready');await p.waitForTimeout(1500);
  report.fallback=await snapshot(p);await p.screenshot({path:path.join(OUT,'EARTH_HERO_ASSET_FAILURE.png')});assert.equal(report.fallback.hybrid.ready,false);assert.equal(report.fallback.hybrid.fallback,true);assert.equal(report.fallback.meshes.length,4);assert.equal(report.fallback.canvas,1);assert.equal(report.fallback.loop.activeRafChains,1);assert.equal(report.fallback.listeners.wheel,1);await ctx.close();
 }else if(mode==='videos'){
  const only=process.env.EARTH_VIDEO_ONLY;if(only&&fs.existsSync(path.join(OUT,'videos-report.json')))report.videos=JSON.parse(fs.readFileSync(path.join(OUT,'videos-report.json'))).videos.filter(v=>v.name!==only);
  for(const [name,seconds]of [['slow',12],['fast',12],['natural',24]].filter(([n])=>!only||n===only)){const {ctx,p}=await make({recordVideo:{dir:path.join(OUT,'video-raw'),size:{width:1600,height:900}}});await load(p);await clear(p);const m=await motion(p,seconds,name);report.videos.push({name,...m,performance:await measure(p)});const raw=await p.video().path();await ctx.close();execFileSync('ffmpeg',['-y','-sseof',String(-m.wallSeconds),'-i',raw,'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(OUT,`EARTH_HERO_LOCK_${name.toUpperCase()}.mp4`)],{stdio:'pipe'});console.log(JSON.stringify(report.videos.at(-1)))}
 }else if(mode==='final'){
  const {ctx,p}=await make();await load(p);
  for(const [name,x,y]of [['CENTER',800,450],['EDGE',1598,450],['CORNER',1598,2]]){await p.mouse.move(x,y);await p.waitForTimeout(600);await p.screenshot({path:path.join(OUT,`EARTH_HERO_LOCK_${name}.png`)});report[name]=await snapshot(p)}
  await p.mouse.move(800,450);await p.waitForTimeout(600);await p.screenshot({path:path.join(OUT,'HOME_EARTH_HERO_LOCK.png')});
  await p.screenshot({path:path.join(OUT,'EARTH_HERO_LOCK_ROI.png'),clip:{x:0,y:430,width:620,height:470}});
  await p.screenshot({path:path.join(OUT,'EARTH_HERO_LOCK_CLOUD_DEPTH.png'),clip:{x:0,y:520,width:400,height:350}});
  await p.screenshot({path:path.join(OUT,'EARTH_HERO_LOCK_ATMOSPHERE.png'),clip:{x:240,y:600,width:260,height:300}});
  report.after=await snapshot(p);await ctx.close();
 }
 assert.equal(report.errors.length,0,report.errors.join('\n'));
 }finally{const mode=process.argv[2]||'candidates';fs.writeFileSync(path.join(OUT,mode==='stress'?'EARTH_HERO_LOCK_STRESS_REPORT.json':mode+'-report.json'),JSON.stringify(report,null,2));await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
