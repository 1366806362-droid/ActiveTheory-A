// Approved Edge/Playwright current-runtime evidence. No application renderer/RAF added.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const base=process.env.MEMORY_BASE_URL||'http://127.0.0.1:5181/';
const candidate=process.env.MEMORY_CANDIDATE||'C';
const out=path.join(root,process.env.MEMORY_OUTPUT||`art/brandmind-memory/${candidate}`);
const query='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1';
async function inspect(p){return p.evaluate(async()=>{
  const scene=(await import('/src/engine/scenes.js')).getActiveScene();
  const camera=(await import('/src/engine/camera.js')).getCamera();
  const T=await import('/node_modules/.vite/deps/three.js');
  const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
  const memory=scene.getObjectByName('BrandMindContinuousMemoryField');
  const proj=v=>{v.project(camera);return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2]};
  const knots=memory?.userData.memoryField.knots.map((k,i)=>({id:i+1,local:k.slice(0,3),pixel:proj(memory.localToWorld(new T.Vector3(...k.slice(0,3))))}));
  const threadPaths=memory?.userData.memoryField.threads.map(([a,b],index)=>{
    const ka=memory.userData.memoryField.knots[a],kb=memory.userData.memoryField.knots[b];
    return Array.from({length:24},(_,j)=>{
      const t=.12+j/23*.67;
      return proj(memory.localToWorld(new T.Vector3(ka[0]+(kb[0]-ka[0])*t,
        ka[1]+(kb[1]-ka[1])*t+Math.sin(t*Math.PI)*(.065+index*.006),
        ka[2]+(kb[2]-ka[2])*t-Math.sin(t*Math.PI)*.06)));
    });
  });
  let fieldBounds=null;
  if(memory){const box=new T.Box3().setFromObject(memory),corners=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(proj(new T.Vector3(x,y,z)));
    fieldBounds=[Math.min(...corners.map(v=>v[0])),Math.min(...corners.map(v=>v[1])),Math.max(...corners.map(v=>v[0])),Math.max(...corners.map(v=>v[1]))];}
  const stats=window.__MEMORY_RENDER_SAMPLES__.slice(-240),sorted=stats.map(s=>s.dt).sort((a,b)=>a-b);
  return {gpu:{vendor:ext&&gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),renderer:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)},
    canvas:document.querySelectorAll('canvas').length,loop:(await import('/src/engine/loop.js')).getLoopStatus(),
    fps:stats.length*1000/stats.reduce((s,v)=>s+v.dt,0),frameTimeMedian:sorted[Math.floor(sorted.length*.5)],frameTimeP95:sorted[Math.floor(sorted.length*.95)],
    drawCalls:stats.length?stats.reduce((s,v)=>s+v.calls,0)/stats.length:null,
    memory:memory?.userData.memoryField,knots,threadPaths,fieldBounds,galaxy:window.__ACTIVE_THEORY_GALAXY_V3__,tour:window.__GALAXY_TOUR_STATUS__};
})}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const report={candidate};
  try{
    const p=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
    await p.addInitScript(()=>{
      let calls=0,last=0;window.__MEMORY_RENDER_SAMPLES__=[];
      for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
        const original=WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name]=function(...args){calls++;return original.apply(this,args)};
      }
      const raf=window.requestAnimationFrame;
      window.requestAnimationFrame=callback=>raf.call(window,time=>{
        const before=calls;callback(time);const count=calls-before;
        if(count>0){if(last)window.__MEMORY_RENDER_SAMPLES__.push({dt:time-last,calls:count});last=time;
          if(window.__MEMORY_RENDER_SAMPLES__.length>1000)window.__MEMORY_RENDER_SAMPLES__.shift();}
      });
    });
    const url=base+'?'+query+(candidate==='baseline'?'':`&brandMindMemory=${candidate}`);
    await p.goto(url,{waitUntil:'networkidle'});await p.mouse.move(600,380);await p.waitForTimeout(4000);
    report.url=url;report.runtime=await inspect(p);report.errors=errors;
    report.gpuMemoryScope='Whole GPU across all processes, not per-page allocation';
    report.nvidiaSmi=execFileSync('nvidia-smi',['--query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu','--format=csv,noheader'],{encoding:'utf8'}).trim();
    assert.ok(/NVIDIA.*5060/i.test(report.runtime.gpu.renderer),'Hardware RTX 5060 Ti required');
    await p.screenshot({path:path.join(out,'HOME_BRANDMIND_MEMORY_RUNTIME.png')});
    report.parallax=[];
    for(const [name,x,y] of [['LEFT',720,440],['CENTER',800,450],['RIGHT',880,460]]){
      await p.mouse.move(x,y);await p.waitForTimeout(700);
      await p.screenshot({path:path.join(out,`HOME_BRANDMIND_MEMORY_${name}.png`)});
      const state=await inspect(p);report.parallax.push({name,knots:state.knots});
    }
    await p.mouse.move(600,380);await p.waitForTimeout(500);
    if(candidate!=='baseline'){
      await p.evaluate(({knots,memory,threadPaths,fieldBounds})=>{
        for(const k of knots){const el=document.createElement('span');el.className='memory-gate-marker';
          el.style.cssText=`position:fixed;left:${k.pixel[0]}px;top:${k.pixel[1]}px;color:#b7d8e6;font:11px monospace;pointer-events:none;z-index:9999`;
          el.textContent=`${k.id} z ${k.local[2].toFixed(2)}`;document.body.append(el);}
        // DOM measurement marks only: even this debug capture retains one canvas.
        for(const points of threadPaths)for(let i=1;i<points.length;i+=2){
          const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];
          const line=document.createElement('div');line.className='memory-gate-marker';
          line.style.cssText=`position:fixed;left:${a[0]}px;top:${a[1]}px;width:${Math.hypot(dx,dy)}px;height:.6px;background:#63829488;transform:rotate(${Math.atan2(dy,dx)}rad);transform-origin:left center;pointer-events:none;z-index:9998`;
          document.body.append(line);
        }
        const [x0,y0,x1,y1]=fieldBounds,box=document.createElement('div');box.className='memory-gate-marker';
        box.style.cssText=`position:fixed;left:${x0}px;top:${y0}px;width:${x1-x0}px;height:${y1-y0}px;border:1px dashed #50627d66;pointer-events:none;z-index:9998`;document.body.append(box);
        const note=document.createElement('span');note.className='memory-gate-marker';note.style.cssText='position:fixed;left:32px;bottom:28px;color:#b7d8e6;font:12px monospace;pointer-events:none;z-index:9999';
        note.textContent=`MEMORY ${memory.candidate} | ${memory.particles} particles | ${memory.depthSlices} field slices | ${memory.drawCalls} batches`;document.body.append(note);
      },{knots:report.runtime.knots,memory:report.runtime.memory,threadPaths:report.runtime.threadPaths,fieldBounds:report.runtime.fieldBounds});
      await p.screenshot({path:path.join(out,'HOME_BRANDMIND_MEMORY_DEBUG.png')});
      assert.equal(await p.locator('canvas').count(),1);
      await p.evaluate(()=>document.querySelectorAll('.memory-gate-marker').forEach(el=>el.remove()));
    }
    // Screenshot-only visibility isolation: keep the same scene/camera and existing RAF.
    await p.evaluate(async()=>{
      const scene=(await import('/src/engine/scenes.js')).getActiveScene();
      const memory=scene.getObjectByName('BrandMindContinuousMemoryField')||scene.getObjectByName('BrandMindNebula');
      const keep=new Set();memory.traverse(o=>keep.add(o));let ancestor=memory;while(ancestor){keep.add(ancestor);ancestor=ancestor.parent;}
      scene.traverse(o=>{if((o.isMesh||o.isPoints||o.isLine||o.isSprite)&&!keep.has(o))o.layers.set(31)});
      const style=document.createElement('style');style.textContent='body > :not(canvas) { } #app > :not(canvas) { visibility:hidden !important; }';document.head.append(style);
    });
    await p.waitForTimeout(2300);
    await p.screenshot({path:path.join(out,'HOME_BRANDMIND_MEMORY_ISOLATED.png')});
    report.isolated=await inspect(p);
    assert.equal(errors.length,0);assert.equal(report.runtime.canvas,1);assert.equal(report.runtime.loop.activeRafChains,1);
    console.log(JSON.stringify(report));
  }finally{fs.writeFileSync(path.join(out,'runtime-report.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
