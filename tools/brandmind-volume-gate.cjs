const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve('art/brandmind-v12'),base=process.env.BRANDMIND_URL||'http://127.0.0.1:5198/';
fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:false}),p=await b.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});const report={errors:[],samples:[]};
try{p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 if(process.argv[2]==='diagnostics'){
  const capture=async(query,name)=>{await p.goto(base+'?scene=brandmind&'+query,{waitUntil:'networkidle'});await p.waitForTimeout(1800);await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__?.sample(12));await p.waitForTimeout(100);await p.screenshot({path:path.join(out,name+'.png')});};
  const query='brandMindVolumeV12=B&brandMindVolumeReview=1&brandMindVolumeOnly=1';
  await capture('brandMindCognitiveV11=B&brandMindCognitiveReview=1','V11_BEFORE_FIXED');
  await capture(query,'BRANDMIND_V12_OVERVIEW');
  await p.screenshot({path:path.join(out,'BRANDMIND_V12_CORE_DETAIL.png'),clip:{x:630,y:245,width:380,height:430}});
  await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__.layers(true,false));await p.waitForTimeout(100);await p.screenshot({path:path.join(out,'VOLUME_ONLY.png')});
  await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__.layers(false,true));await p.waitForTimeout(100);await p.screenshot({path:path.join(out,'SURFACE_ONLY.png')});
  await capture(query+'&showBloom=0','BLOOM_OFF');await capture(query,'BLOOM_ON');
  report.stage='single Core gate only; NOT READY; no peripheral integration';
 }else if(process.argv[2]==='cost'){
  await p.addInitScript(()=>{const m=window.__VOLUME_COST__={on:false,frames:[],gpu:[],draws:0};let gl,ext,pending,last=0;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...a){const r=get.call(this,type,...a);if(type==='webgl2'){gl=r;ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');}return r;};for(const k of ['drawArrays','drawElements']){const original=WebGL2RenderingContext.prototype[k];WebGL2RenderingContext.prototype[k]=function(...a){if(m.on)m.draws++;return original.apply(this,a);};}const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{if(m.on&&last)m.frames.push(t-last);last=t;if(pending&&gl.getQueryParameter(pending,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))m.gpu.push(gl.getQueryParameter(pending,gl.QUERY_RESULT)/1e6);gl.deleteQuery(pending);pending=null;}let q;if(m.on&&gl&&ext&&!pending){q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);}cb(t);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending=q;}});});
  for(const [name,query,hide]of [['V11','brandMindCognitiveV11=B',false],['B24','brandMindVolumeV12=B&brandMindVolumeSteps=24',false],['B40','brandMindVolumeV12=B&brandMindVolumeSteps=40',false],['CORE_OFF','brandMindVolumeV12=B&brandMindVolumeSteps=40',true]]){
   await p.goto(base+'?scene=brandmind&'+query,{waitUntil:'networkidle'});await p.bringToFront();await p.waitForTimeout(5000);
   if(hide)await p.evaluate(async()=>{const s=(await import('/src/engine/scenes.js')).getActiveScene();s.getObjectByName('BrandMindVolumetricMedium').visible=false;});
   await p.evaluate(()=>{const m=window.__VOLUME_COST__;m.frames=[];m.gpu=[];m.draws=0;m.on=true;});await p.waitForTimeout(10000);
   const cost=await p.evaluate(()=>{const m=window.__VOLUME_COST__;m.on=false;const sorted=a=>a.sort((a,b)=>a-b),q=(a,p)=>a[Math.floor((a.length-1)*p)];const f=sorted(m.frames),g=sorted(m.gpu),gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return{seconds:10,frames:f.length,fps:1000*f.length/f.reduce((n,t)=>n+t,0),median:q(f,.5),p95:q(f,.95),p99:q(f,.99),max:f.at(-1),over50:f.filter(x=>x>50).length,over100:f.filter(x=>x>100).length,draws:m.draws/f.length,gpuMedian:q(g,.5)??null,gpuP95:q(g,.95)??null,gpuSamples:g.length,gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};});report.samples.push({name,...cost});console.log(name,JSON.stringify(cost));
  }
  await p.waitForTimeout(250);
  await p.evaluate(async()=>{const s=(await import('/src/engine/scenes.js')).getActiveScene(),m=s.getObjectByName('BrandMindVolumetricMedium'),gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');window.__CORE_GPU__={samples:[],supported:!!ext};m.visible=true;if(!ext)return;const before=m.onBeforeRender,after=m.onAfterRender;let pending=null,active=null;m.onBeforeRender=function(...args){before.apply(this,args);if(pending&&gl.getQueryParameter(pending,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))window.__CORE_GPU__.samples.push(gl.getQueryParameter(pending,gl.QUERY_RESULT)/1e6);gl.deleteQuery(pending);pending=null;}if(!pending){active=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,active);}};m.onAfterRender=function(...args){after.apply(this,args);if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);pending=active;active=null;}};});
  await p.waitForTimeout(5000);report.coreGpu=await p.evaluate(()=>{const r=window.__CORE_GPU__,a=r.samples.sort((a,b)=>a-b);return{supported:r.supported,samples:a.length,median:a[Math.floor(a.length*.5)]??null,p95:a[Math.floor(a.length*.95)]??null,scope:'Core Mesh GPU draw bracket only; separate from whole-frame query'};});
  report.note='10-second single-Core technical samples only; NOT the requested final 60-second acceptance measurement.';
 }else{
 for(const variant of ['A','B'])for(const steps of [24,40]){
  await p.goto(base+`?scene=brandmind&brandMindVolumeV12=${variant}&brandMindVolumeSteps=${steps}&brandMindVolumeOnly=1&brandMindVolumeReview=1`,{waitUntil:'networkidle'});
  await p.waitForTimeout(2000);await p.evaluate(()=>window.__BRANDMIND_COGNITIVE_REVIEW__.sample(12));await p.waitForTimeout(100);
  await p.screenshot({path:path.join(out,`CORE_${variant}_${steps}.png`)});
  const info=await p.evaluate(async()=>{const c=(await import('/src/engine/camera.js')).getCamera(),T=await import('/node_modules/.vite/deps/three.js'),s=(await import('/src/engine/scenes.js')).getActiveScene(),m=s.getObjectByName('BrandMindVolumetricMedium');const corners=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const v=new T.Vector3(x,y,z).applyMatrix4(m.matrixWorld).project(c);corners.push([(v.x+1)*800,(1-v.y)*450]);}return{review:window.__BRANDMIND_COGNITIVE_REVIEW__.read(),bounds:{left:Math.min(...corners.map(p=>p[0])),right:Math.max(...corners.map(p=>p[0])),top:Math.min(...corners.map(p=>p[1])),bottom:Math.max(...corners.map(p=>p[1]))},camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray()},webgl:document.querySelector('canvas').getContext('webgl2').getParameter(7938)};});report.samples.push({variant,steps,...info});
 }
 }
 assert.equal(report.errors.length,0,report.errors.join('\n'));
}finally{fs.writeFileSync(path.join(out,(process.argv[2]||'core-gate')+'.json'),JSON.stringify(report,null,2));await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
