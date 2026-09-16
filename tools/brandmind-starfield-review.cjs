const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve('art/brandmind-starfield');fs.mkdirSync(out,{recursive:true});
const base=process.env.BRANDMIND_URL||'http://127.0.0.1:5201/';
const mode=process.argv[2]||'baseline';
const report={mode,errors:[]};
const candidate='brandMindStarfield=A&brandMindStarfieldReview=1';
async function perspectiveReview(p) {
 await p.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera();
  const pivot=s.getObjectByName('BrandMindMindCore').getWorldPosition(new T.Vector3()),before=s.onBeforeRender,after=s.onAfterRender,original=c.clone(),eye=c.position.clone(),orientation=c.quaternion.clone(),axis=new T.Vector3(0,1,0),rotation=new T.Quaternion(),start=performance.now();
  const log=window.__STARFIELD_VIEW__={frames:0,min:0,max:0,scope:'QA scene-camera +/-0.08 radians; no production camera change'};
  s.onBeforeRender=function(r,scene,c,...args){before.call(this,r,scene,c,...args);original.copy(c);const angle=.08*Math.sin(Math.min(1,(performance.now()-start)/8000)*Math.PI*2);rotation.setFromAxisAngle(axis,angle);c.position.copy(eye).sub(pivot).applyQuaternion(rotation).add(pivot);c.quaternion.copy(orientation).premultiply(rotation);c.updateMatrixWorld();log.frames++;log.min=Math.min(log.min,angle);log.max=Math.max(log.max,angle);};
  s.onAfterRender=function(r,scene,c,...args){after.call(this,r,scene,c,...args);c.copy(original);c.updateMatrixWorld();};
  window.__STOP_STARFIELD_VIEW__=()=>{s.onBeforeRender=before;s.onAfterRender=after;};
 });
 await p.waitForTimeout(8100);
 const evidence=await p.evaluate(()=>{window.__STOP_STARFIELD_VIEW__();return window.__STARFIELD_VIEW__;});
 assert.ok(evidence.min<-.075&&evidence.max>.075);return evidence;
}
async function go(p,query){await p.goto(base+'?'+query,{waitUntil:'networkidle'});await p.waitForTimeout(2200);}
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png')});}
async function inspect(p){return p.evaluate(async()=>{const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera(),g=s.getObjectByName('BrandMindScene');let particles=0,draws=0;g.traverse(o=>{if(o.isPoints)particles+=o.geometry.attributes.position.count;if(o.isMesh||o.isPoints||o.isLine||o.isSprite)draws++;});return{exposure:(await import('/src/engine/renderState.js')).renderState.exposure,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,captureFormat:'native PNG',camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov},objects:draws,particles,review:g.userData.cognitiveReview?.read(),tour:window.__GALAXY_TOUR_STATUS__};});}
async function clickCore(p){const xy=await p.evaluate(async()=>{const T=await import('/node_modules/.vite/deps/three.js'),s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera(),v=s.getObjectByName('BrandMindCoreVolume').getWorldPosition(new T.Vector3()).project(c);return[(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];});await p.mouse.click(...xy);await p.waitForFunction(()=>window.__ACTIVE_THEORY_BRAND_MIND_DATA_PANEL__.isOpen());await p.waitForTimeout(1500);}
async function enter(p){const xy=await p.evaluate(async()=>{const T=await import('/node_modules/.vite/deps/three.js'),s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera(),v=s.getObjectByName('BrandMindNebula').getWorldPosition(new T.Vector3()).project(c);return[(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];});await p.mouse.click(...xy);await p.waitForFunction(()=>window.__GALAXY_TOUR_STATUS__.activeScene==='BrandMindScene'&&!window.__GALAXY_TOUR_STATUS__.transitionTo);await p.waitForTimeout(1200);}
async function back(p){for(let i=0;i<30;i++){if(await p.evaluate(()=>window.__GALAXY_TOUR_STATUS__.activeScene==='HeroScene'&&window.__GALAXY_TOUR_STATUS__.routeIndex===0&&!window.__GALAXY_TOUR_STATUS__.transitionTo))break;await p.mouse.wheel(0,-500);await p.waitForTimeout(230);}await p.waitForFunction(()=>window.__GALAXY_TOUR_STATUS__.activeScene==='HeroScene'&&window.__GALAXY_TOUR_STATUS__.routeIndex===0);await p.waitForTimeout(1500);}
async function instrument(p){await p.addInitScript(()=>{
 const registrations=[],add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
 EventTarget.prototype.addEventListener=function(type,listener,options){const capture=typeof options==='boolean'?options:!!options?.capture;if((this===window||this===document)&&!registrations.some(r=>r.target===this&&r.type===type&&r.listener===listener&&r.capture===capture))registrations.push({target:this,type,listener,capture,signal:options?.signal,stack:new Error().stack});return add.call(this,type,listener,options);};
 EventTarget.prototype.removeEventListener=function(type,listener,options){const capture=typeof options==='boolean'?options:!!options?.capture;const i=registrations.findIndex(r=>r.target===this&&r.type===type&&r.listener===listener&&r.capture===capture);if(i>=0)registrations.splice(i,1);return remove.call(this,type,listener,options);};
 window.__BM_LISTENERS__=()=>Object.fromEntries(['wheel','pointermove','pointerdown','pointerup','keydown','resize'].map(type=>[type,registrations.filter(r=>r.type===type&&!r.signal?.aborted&&!r.stack.includes('addHitTargetInterceptorListeners')).length]));
 const probe=window.__BM_PERF__={on:false,frames:[],draws:0,live:{},gpu:[],gpuEnabled:false,disjoint:0};let gl=null,ext=null,pending=null,last=0;
 const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const value=get.call(this,type,...args);if(type==='webgl2'&&value){gl=value;ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');}return value;};
 for(const kind of ['Buffer','Texture','Program','Framebuffer','Renderbuffer','VertexArray']){const a=WebGL2RenderingContext.prototype['create'+kind],d=WebGL2RenderingContext.prototype['delete'+kind],live=new Set();probe.live[kind]=0;WebGL2RenderingContext.prototype['create'+kind]=function(...args){const o=a.apply(this,args);live.add(o);probe.live[kind]=live.size;return o;};WebGL2RenderingContext.prototype['delete'+kind]=function(o){live.delete(o);probe.live[kind]=live.size;return d.call(this,o);};}
 for(const key of ['drawArrays','drawElements']){const old=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...args){if(probe.on)probe.draws++;return old.apply(this,args);};}
 const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{if(probe.on&&last)probe.frames.push(t-last);last=t;
  if(pending&&gl.getQueryParameter(pending,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))probe.gpu.push(gl.getQueryParameter(pending,gl.QUERY_RESULT)/1e6);else probe.disjoint++;gl.deleteQuery(pending);pending=null;}
  let query=null;if(probe.gpuEnabled&&gl&&ext&&!pending){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}cb(t);if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending=query;}
 });
 });}
(async()=>{const b=await chromium.launch({channel:'msedge',headless:false});try{const c=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 if(mode==='baseline'){await go(p,'scene=brandmind&v2FiveAState=balanced&v2FiveACapture=1');await shot(p,'BEFORE_FIXED');report.before=await inspect(p);await go(p,'scene=brandmind');await clickCore(p);await shot(p,'BEFORE_PANEL');await p.keyboard.press('Escape');await go(p,'');await shot(p,'HOME_BEFORE');}
 if(mode==='candidates'){report.candidates={};for(const variant of ['A','B']){await go(p,`scene=brandmind&brandMindStarfield=${variant}&brandMindStarfieldReview=1`);await p.evaluate(()=>{const r=window.__BRANDMIND_COGNITIVE_REVIEW__;r.sample(12);});await shot(p,'CANDIDATE_'+variant);report.candidates[variant]=await inspect(p);await clickCore(p);await shot(p,'PANEL_'+variant);}}
 if(mode==='final'){
  await go(p,'scene=brandmind&'+candidate+'&v2FiveAState=balanced&v2FiveACapture=1');await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__.sample(12));await p.waitForTimeout(100);await shot(p,'BRANDMIND_STARFIELD_OVERVIEW');report.after=await inspect(p);
  await p.screenshot({path:path.join(out,'BRANDMIND_STARFIELD_CORE_DETAIL.png'),clip:{x:590,y:290,width:500,height:370}});
  await p.screenshot({path:path.join(out,'BRANDMIND_STARFIELD_ASSOCIATIONS.png'),clip:{x:250,y:155,width:1080,height:660}});
  await p.screenshot({path:path.join(out,'BRANDMIND_STARFIELD_FLOW_DETAIL.png'),clip:{x:350,y:260,width:590,height:310}});
  await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__.background(false));await p.waitForTimeout(100);await shot(p,'BACKGROUND_OFF');await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__.background(true));await p.waitForTimeout(100);await shot(p,'BACKGROUND_ON');
  await go(p,'scene=brandmind&'+candidate);await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__.sample(12));
  for(const [width,height]of [[1366,768],[1600,900],[1920,1080]]){await p.setViewportSize({width,height});await clickCore(p);await shot(p,'PANEL_'+width);if(width===1600)await shot(p,'BRANDMIND_STARFIELD_PANEL_OPEN');await p.keyboard.press('Escape');await p.waitForTimeout(1400);}
  await p.setViewportSize({width:1600,height:900});await go(p,'scene=brandmind&'+candidate+'&showBloom=0&v2FiveAState=balanced&v2FiveACapture=1');await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__.sample(12));await p.waitForTimeout(100);await shot(p,'BLOOM_OFF');
  await go(p,'scene=brandmind&'+candidate+'&v2FiveAState=balanced&v2FiveACapture=1');await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__.sample(12));await p.waitForTimeout(100);await shot(p,'BLOOM_ON');
  await go(p,'brandMindStarfield=A&v2FiveAState=balanced&v2FiveACapture=1&homeMeteors=0');await shot(p,'HOME_CANDIDATE_FIXED');
  await go(p,'v2FiveAState=balanced&v2FiveACapture=1&homeMeteors=0');await shot(p,'HOME_FALLBACK_FIXED');
 }
 if(mode==='qa'){
  await instrument(p);await go(p,candidate);report.cycles=[];
  const read=()=>p.evaluate(async()=>{const s=(await import('/src/engine/scenes.js')).getActiveScene(),g=s.getObjectByName('BrandMindScene');let objects=0,active=0;s.traverse(o=>{objects++;if(o.name==='BrandMindMemoryCloud'){let visible=true;for(let a=o;a;a=a.parent)visible=visible&&a.visible;active+=Number(visible);}});return{scene:window.__GALAXY_TOUR_STATUS__.activeScene,objects,active,uuid:g.uuid,clock:window.__BRANDMIND_COGNITIVE_REVIEW__.read().clock,live:window.__BM_PERF__.live,listeners:window.__BM_LISTENERS__(),loop:(await import('/src/engine/loop.js')).getLoopStatus().activeRafChains,canvas:document.querySelectorAll('canvas').length,meteor:window.__HOME_METEOR_REVIEW__?.read()};});
  for(let i=0;i<10;i++){await enter(p);const inside=await read();assert.equal(inside.active,1);assert.equal(inside.meteor.phase,-1);
   if(i===0||i===9){await clickCore(p);const before=await read();await p.mouse.move(1300,420);await p.mouse.wheel(0,600);await p.waitForTimeout(300);assert.equal((await read()).clock,before.clock);for(let k=0;k<5;k++){await p.evaluate(()=>{const a=window.__ACTIVE_THEORY_BRAND_MIND_DATA_PANEL__;a.close();a.open('repeat-gate');});}await p.keyboard.press('Escape');await p.waitForTimeout(500);assert.ok((await read()).clock>before.clock);}
   await back(p);const outside=await read();await p.waitForTimeout(100);assert.equal((await read()).clock,outside.clock);assert.equal(outside.active,0);assert.equal(outside.canvas,1);assert.equal(outside.loop,1);assert.equal(outside.listeners.wheel,1);report.cycles.push({inside,outside});
   if(i>1){assert.deepEqual(outside.live,report.cycles[1].outside.live);assert.deepEqual(outside.listeners,report.cycles[1].outside.listeners);assert.equal(outside.objects,report.cycles[1].outside.objects);assert.equal(outside.uuid,report.cycles[1].outside.uuid);}console.log('cycle',i+1,'PASS');
  }
  await enter(p);await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(100);const frozen=await read();await p.waitForTimeout(350);assert.equal((await read()).clock,frozen.clock);report.reducedMotion=true;
 }
 if(mode==='perf'){
  await instrument(p);report.samples={};
  for(const [name,query]of [['BEFORE','scene=brandmind'],['STEADY','scene=brandmind&brandMindStarfield=A'],['INTERACTION','scene=brandmind&brandMindStarfield=A']].filter(([name])=>!process.env.BRANDMIND_PERF_CASE||process.env.BRANDMIND_PERF_CASE===name)){
   await go(p,query);await p.bringToFront();await p.waitForTimeout(10000);
   report.environment=await p.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return{gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,browser:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,visible:document.visibilityState,focus:document.hasFocus()};});
   await p.evaluate(()=>{const x=window.__BM_PERF__;x.frames=[];x.draws=0;x.on=true;});const start=Date.now();let step=-1;
   while(Date.now()-start<60000){const next=Math.floor((Date.now()-start)/8000);if(name==='INTERACTION'&&next!==step){step=next;if(next%2)await clickCore(p);else if(next)await p.keyboard.press('Escape');}if(name==='INTERACTION')await p.mouse.move(790+150*Math.sin((Date.now()-start)/1800),440);await p.waitForTimeout(180);}
   report.samples[name]=await p.evaluate(()=>{const x=window.__BM_PERF__;x.on=false;const a=x.frames.sort((a,b)=>a-b),q=p=>a[Math.floor((a.length-1)*p)];return{frames:a.length,fps:1000*a.length/a.reduce((s,t)=>s+t,0),median:q(.5),p95:q(.95),p99:q(.99),max:a.at(-1),over50:a.filter(t=>t>50).length,over100:a.filter(t=>t>100).length,drawCalls:x.draws/a.length,live:x.live};});console.log(name,JSON.stringify(report.samples[name]));
  }
  await p.keyboard.press('Escape');await p.waitForTimeout(1000);await p.evaluate(()=>{window.__BM_PERF__.gpuEnabled=true;});await p.waitForTimeout(5000);report.gpu=await p.evaluate(()=>{const p=window.__BM_PERF__;p.gpuEnabled=false;const a=p.gpu.sort((a,b)=>a-b);return{samples:a.length,median:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null,disjoint:p.disjoint};});
 }
 if(mode==='environment'){
  await go(p,candidate);await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.ready);
  report.earth=await p.evaluate(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__);assert.equal(report.earth.mix,0);
  const initial=await p.evaluate(()=>window.__HOME_METEOR_REVIEW__.read());await p.waitForTimeout(60000);report.meteor={initial,after:await p.evaluate(()=>window.__HOME_METEOR_REVIEW__.read())};assert.ok(report.meteor.after.sequence-initial.sequence>=2);
  await enter(p);report.inactiveMeteor=await p.evaluate(()=>window.__HOME_METEOR_REVIEW__.read());assert.equal(report.inactiveMeteor.phase,-1);await back(p);
  await go(p,candidate+'&homeMeteors=0');report.disabled=await p.evaluate(()=>window.__HOME_METEOR_REVIEW__?.read()??null);assert.equal(report.disabled,null); // Disabled system is not created, including its DEV diagnostic.
  await go(p,'scene=brandmind&brandMindStarfield=0&v2FiveAState=balanced&v2FiveACapture=1');await shot(p,'FALLBACK_FINAL_FIXED');
 }
 if(mode==='video'||mode==='baseline-motion'){
  const {spawnSync}=require('node:child_process');await go(p,mode==='video'?candidate:'scene=brandmind');
  const cdp=await c.newCDPSession(p),frames=[],dir=path.join(out,mode+'-frames',String(Date.now()));fs.mkdirSync(dir,{recursive:true});
  await cdp.send('Page.enable');cdp.on('Page.screencastFrame',e=>{const file=`f-${String(frames.length).padStart(6,'0')}.png`;fs.writeFileSync(path.join(dir,file),Buffer.from(e.data,'base64'));frames.push({file,time:e.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});await cdp.send('Page.startScreencast',{format:'png',maxWidth:1600,maxHeight:900,everyNthFrame:4});const start=Date.now();report.actions=[];const mark=name=>report.actions.push({name,seconds:(Date.now()-start)/1000});
  if(mode==='video'){await p.waitForTimeout(1000);mark('HOME click Brand Mind');await enter(p);mark('Cognitive Core and association fibers');await p.waitForTimeout(8500);mark('QA small scene-camera perspective');report.perspective=await perspectiveReview(p);await p.waitForTimeout(1400);mark('Core click');await clickCore(p);await p.waitForTimeout(5500);mark('ESC close');await p.keyboard.press('Escape');await p.waitForTimeout(2500);mark('Return HOME');await back(p);}else await p.waitForTimeout(10000);
  await cdp.send('Page.stopScreencast');assert.ok(frames.length>20);const manifest=path.join(dir,'timeline.txt');fs.writeFileSync(manifest,frames.map((f,i)=>`file '${f.file}'\nduration ${Math.max(.001,(frames[i+1]?.time??f.time+.04)-f.time).toFixed(6)}\n`).join('')+`file '${frames.at(-1).file}'\n`);
  report.video={seconds:frames.at(-1).time-frames[0].time,frames:frames.length,input:'native PNG',speed:1};
  const ff=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',manifest,'-fps_mode','vfr','-c:v','libx264','-threads','2','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,mode==='video'?'BRANDMIND_STARFIELD_DEMO.mp4':'BEFORE_MOTION.mp4')],{encoding:'utf8'});assert.equal(ff.status,0,ff.stderr);
 }
 assert.equal(report.errors.length,0,report.errors.join('\n'));await c.close();}finally{await b.close();const suffix=mode==='perf'&&process.env.BRANDMIND_PERF_CASE?'-'+process.env.BRANDMIND_PERF_CASE:'';fs.writeFileSync(path.join(out,mode+suffix+'.json'),JSON.stringify(report,null,2));}console.log(mode+' CHECKS PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
