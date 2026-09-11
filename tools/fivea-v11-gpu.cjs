// Separate GPU timing probe, not part of frame-pacing measurements or the app.
const {chromium}=require('playwright');const fs=require('node:fs');
const base='http://127.0.0.1:5191/?scene=fivea&v2FiveAState=balanced';
(async()=>{
  const b=await chromium.launch({channel:'msedge',headless:false});const report={};
  try{for(const variant of ['baseline','B']){
    const c=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});const p=await c.newPage();
    await p.addInitScript(()=>{
      let gl=null,ext=null,frame=0;const pool=[],pending=[],samples=[];
      const state={enabled:false,samples,supported:false,disjoint:0};window.__GPU_PROBE__=state;
      const context=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(...args){const result=context.apply(this,args);if(!gl&&args[0]==='webgl2'&&result){gl=result;ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');state.supported=!!ext;if(ext)for(let i=0;i<3;i++)pool.push(gl.createQuery());}return result;};
      const raf=requestAnimationFrame.bind(window);
      window.requestAnimationFrame=cb=>raf(t=>{
        if(!ext)return cb(t);
        const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
        for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(!disjoint&&state.enabled)samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);else if(disjoint)state.disjoint++;pending.splice(i,1);pool.push(q);}}
        const q=state.enabled&&++frame%30===0?pool.pop():null;
        if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
        try{cb(t);}finally{if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}}
      });
    });
    await p.goto(base+(variant==='B'?'&fiveACinematic=B':''),{waitUntil:'networkidle'});await p.waitForTimeout(10000);
    await p.evaluate(()=>{window.__GPU_PROBE__.enabled=true;});await p.waitForTimeout(15000);
    report[variant]=await p.evaluate(()=>{const s=window.__GPU_PROBE__;s.enabled=false;const a=s.samples.slice().sort((a,b)=>a-b);const q=p=>a[Math.floor((a.length-1)*p)];return {supported:s.supported,count:a.length,medianMs:q(.5),p95Ms:q(.95),p99Ms:q(.99),maxMs:a.at(-1),disjoint:s.disjoint,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};});
    console.log(variant,JSON.stringify(report[variant]));await c.close();
  }}finally{fs.writeFileSync('art/fivea-v11/gpu-report.json',JSON.stringify({method:'EXT_disjoint_timer_query_webgl2; entire main render callback incl Composer; separate 15s sample after 10s warmup; 3-query pool, every 30th frame; not individual shader time',...report},null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
