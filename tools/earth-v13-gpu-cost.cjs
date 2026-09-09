// Per-mesh GPU timers inside the existing render loop. No synthetic benchmark scene / RAF.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const out=path.resolve(__dirname,'../art/earth-v13/final');
(async()=>{
  const runtime=JSON.parse(fs.readFileSync(path.join(out,'runtime-report.json')));
  const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    for(const mode of ['HOME','CLOSEUP'])for(const steps of [8,12,16]){
      const url=runtime.cases.find(c=>c.name==='EARTH_V13_'+mode).url+'&earthAirSteps='+steps;
      await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_V3__?.textureStatus==='ready');
      await page.mouse.move(800,450);await page.waitForTimeout(1500);
      const available=await page.evaluate(async()=>{
        const scene=(await import('/src/engine/scenes.js')).getActiveScene(),root=scene.getObjectByName('EarthRoot');
        const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if(!ext)return false;
        const pending=[],samples={};let frame=0;const before=scene.onBeforeRender;
        scene.onBeforeRender=function(...args){
          before.apply(this,args);frame++;
          while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
            const p=pending.shift();
            if(!gl.getParameter(ext.GPU_DISJOINT_EXT)){
              (samples[p.name]??=[]).push(gl.getQueryParameter(p.query,gl.QUERY_RESULT)/1e6);
              if(samples[p.name].length>240)samples[p.name].shift();
            }
            gl.deleteQuery(p.query);
          }
        };
        root.traverseVisible(mesh=>{
          if(!mesh.isMesh)return;
          const before=mesh.onBeforeRender,after=mesh.onAfterRender;let active=null;
          mesh.onBeforeRender=function(...args){
            before.apply(this,args);
            if(!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)){
              active=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,active);
            }
          };
          mesh.onAfterRender=function(...args){
            if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({name:mesh.name,query:active,frame});active=null;}
            after.apply(this,args);
          };
        });
        window.__EARTH_MESH_TIMES__=samples;return true;
      });
      assert.ok(available,'GPU timer unavailable');await page.waitForTimeout(3200);
      const layers=await page.evaluate(()=>Object.fromEntries(Object.entries(window.__EARTH_MESH_TIMES__).map(([key,v])=>{
        const a=[...v].sort((a,b)=>a-b);return[key,{samples:v.length,meanMs:v.reduce((s,x)=>s+x,0)/v.length,p95Ms:a[Math.floor(a.length*.95)]}];
      })));
      assert.equal(Object.keys(layers).length,4);assert.ok(Object.values(layers).every(l=>l.samples>=200));
      const result={mode,steps,layers,earthDrawGpuMs:Object.values(layers).reduce((s,l)=>s+l.meanMs,0)};
      results.push(result);console.log(JSON.stringify(result));
    }
    assert.equal(errors.length,0);
  }finally{await browser.close();fs.writeFileSync(path.join(out,'gpu-cost-report.json'),JSON.stringify({results,errors,note:'Per Earth mesh TIME_ELAPSED query; includes GPU commands within four draw calls, excludes compositor. Instrumentation overhead and device power state apply.'},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
