// Real Edge GPU captures; no screenshot grading, camera rewrite or image enhancement.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const base=process.env.EARTH_GATE_BASE||'http://127.0.0.1:5184/';
const out=path.resolve(__dirname,'..',process.env.EARTH_GATE_OUT||'art/earth-v11');
const query='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1';
const cases=process.argv.includes('--candidates')
  ? ['A','B','C'].flatMap(c=>[[`CANDIDATE_${c}_CLOSEUP`,`earthRealismCandidate=${c}&earthFreeze=1&debugEarthV3Closeup=1`],[`CANDIDATE_${c}_HOME`,`earthRealismCandidate=${c}&earthFreeze=1`]])
  : [['EARTH_V11_CLOSEUP','debugEarthV3Closeup=1'],['EARTH_V11_SURFACE_DEBUG','debugEarthV3Closeup=1&earthFreeze=1&earthDebugLayer=surface'],
    ['EARTH_V11_CLOUD_DEBUG','debugEarthV3Closeup=1&earthFreeze=1&earthDebugLayer=cloud'],
    ['EARTH_V11_ATMOSPHERE_DEBUG','debugEarthV3Closeup=1&earthFreeze=1&earthDebugLayer=atmosphere'],
    ['EARTH_V11_CITY_DEBUG','debugEarthV3Closeup=1&earthFreeze=1&earthDebugLayer=city'],['HOME_EARTH_V11_RUNTIME','']];
async function state(p){return p.evaluate(async()=>{
  const scene=(await import('/src/engine/scenes.js')).getActiveScene();
  const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
  const samples=window.__EARTH_GATE_SAMPLES__.slice(-240),dt=samples.map(s=>s.dt).sort((a,b)=>a-b);
  const gpuTimes=window.__EARTH_GATE_GPU_TIMES__||[];
  const root=scene.getObjectByName('EarthRoot'),meshes=[];
  root.traverseVisible(o=>{if(o.isMesh)meshes.push({name:o.name,material:o.material.name,triangles:o.geometry.index.count/3})});
  return {gpu:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),fps:samples.length*1000/samples.reduce((n,s)=>n+s.dt,0),
    p95:dt[Math.floor(dt.length*.95)],drawCalls:samples.reduce((n,s)=>n+s.calls,0)/samples.length,
    gpuFrameMs:gpuTimes.length?gpuTimes.reduce((a,b)=>a+b,0)/gpuTimes.length:null,
    earthDrawCalls:meshes.length,meshes,canvas:document.querySelectorAll('canvas').length,wheel:window.__EARTH_GATE_WHEEL__,
    loop:(await import('/src/engine/loop.js')).getLoopStatus(),earth:window.__ACTIVE_THEORY_EARTH_V3__,
    position:root.position.toArray(),scale:root.scale.toArray(),textures:meshes.filter(x=>x.name.includes('Texture')).map(x=>{
      const m=scene.getObjectByName(x.name).material;return Object.entries(m.uniforms).filter(([k,v])=>v.value?.isTexture).map(([k,v])=>({name:k,size:[v.value.image.width,v.value.image.height],colorSpace:v.value.colorSpace,anisotropy:v.value.anisotropy,minFilter:v.value.minFilter}));})};
})}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true});const report={errors:[],cases:[]};
  try{
    const p=await b.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
    p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
    p.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`)});
    await p.addInitScript(()=>{
      let calls=0,last=0,context=null,timer=null;const queries=[];
      window.__EARTH_GATE_GPU_TIMES__=[];window.__EARTH_GATE_SAMPLES__=[];window.__EARTH_GATE_WHEEL__=0;
      const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
      const ownWheel=new Set();
      EventTarget.prototype.addEventListener=function(t,...a){if(t==='wheel'&&(this===window||this===document)&&!new Error().stack.includes('addHitTargetInterceptorListeners')){ownWheel.add(a[0]);window.__EARTH_GATE_WHEEL__=ownWheel.size;}return add.call(this,t,...a)};
      EventTarget.prototype.removeEventListener=function(t,...a){if(t==='wheel'){ownWheel.delete(a[0]);window.__EARTH_GATE_WHEEL__=ownWheel.size;}return remove.call(this,t,...a)};
      for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...a){if(!context){context=this;timer=this.getExtension('EXT_disjoint_timer_query_webgl2')}calls++;return fn.apply(this,a)}}
      const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf.call(window,t=>{
        while(queries.length&&context.getQueryParameter(queries[0],context.QUERY_RESULT_AVAILABLE)){
          const q=queries.shift();if(!context.getParameter(timer.GPU_DISJOINT_EXT))window.__EARTH_GATE_GPU_TIMES__.push(context.getQueryParameter(q,context.QUERY_RESULT)/1e6);
          context.deleteQuery(q);if(window.__EARTH_GATE_GPU_TIMES__.length>240)window.__EARTH_GATE_GPU_TIMES__.shift();
        }
        const q=timer?context.createQuery():null;if(q)context.beginQuery(timer.TIME_ELAPSED_EXT,q);
        const before=calls;cb(t);if(q){context.endQuery(timer.TIME_ELAPSED_EXT);queries.push(q)}
        if(calls>before){if(last)window.__EARTH_GATE_SAMPLES__.push({dt:t-last,calls:calls-before});last=t;if(window.__EARTH_GATE_SAMPLES__.length>500)window.__EARTH_GATE_SAMPLES__.shift()}
      });
    });
    for(const [name,extra] of cases){
      await p.goto(base+'?'+query+'&earthRealism=1&'+extra,{waitUntil:'networkidle'});
      await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_V3__?.textureStatus==='ready');
      await p.mouse.move(800,450);await p.waitForTimeout(3100);
      const s=await state(p);assert.match(s.gpu,/NVIDIA.*5060/);assert.equal(s.canvas,1);assert.equal(s.loop.activeRafChains,1);assert.equal(s.wheel,1);
      await p.screenshot({path:path.join(out,name+'.png')});report.cases.push({name,url:p.url(),...s});
      console.log(JSON.stringify({name,fps:s.fps,p95:s.p95,drawCalls:s.drawCalls,earth:s.earthDrawCalls,errors:report.errors.length}));
      if(name==='HOME_EARTH_V11_RUNTIME')for(const [label,x,y] of [['LEFT',720,440],['CENTER',800,450],['RIGHT',880,460]]){
        await p.mouse.move(x,y);await p.waitForTimeout(650);await p.screenshot({path:path.join(out,`HOME_EARTH_V11_${label}.png`)});
      }
    }
    report.vram=execFileSync('nvidia-smi',['--query-gpu=memory.used,memory.total,utilization.gpu','--format=csv,noheader'],{encoding:'utf8'}).trim();
    assert.equal(report.errors.length,0);
  }finally{fs.writeFileSync(path.join(out,process.argv.includes('--candidates')?'candidates-report.json':'runtime-report.json'),JSON.stringify(report,null,2));await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
