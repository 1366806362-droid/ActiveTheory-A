// Real-browser evidence. No synthetic pixels or renderer-value writes.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(process.env.FIVEA_EVIDENCE_OUTPUT || 'art/fivea-v11');
const base = process.env.FIVEA_URL || 'http://127.0.0.1:5191/?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1&earthHeroLock=1';
const variant = process.argv[2] || 'baseline';
const dataInteraction = process.argv.includes('--data-interaction');
const extra = (variant === 'baseline' && !dataInteraction ? '' : `&fiveACinematic=${variant}`)
  + (dataInteraction ? '&fiveACinematicReview=1' : '');
async function initProbe(page) {
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    let last = 0;
    const frames = [];
    window.__FIVEA_TIMING__ = { frames, enabled: false };
    window.requestAnimationFrame = callback => raf(t => {
      if (window.__FIVEA_TIMING__.enabled && last) frames.push(t - last);
      last = t;
      callback(t);
    });
    const proto = WebGL2RenderingContext.prototype;
    const draw = proto.drawArrays, elements = proto.drawElements;
    let calls = 0;
    proto.drawArrays = function(...args) { calls++; return draw.apply(this,args); };
    proto.drawElements = function(...args) { calls++; return elements.apply(this,args); };
    window.__FIVEA_DRAW_COUNT__ = () => calls;
  });
}
async function settled(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__GALAXY_TOUR_STATUS__?.activeScene === 'FiveAScene' && !window.__GALAXY_TOUR_STATUS__?.transitionTo);
  await page.waitForTimeout(3000);
}
async function run() {
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({channel:'msedge',headless:false,args:['--window-size=1600,1000']});
  const report = { variant,viewport:[1600,900],dpr:1,errors:[],gpuTime:'Unavailable; RAF intervals are not GPU timings' };
  try {
    const context = await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await initProbe(page);
    if(!dataInteraction) {
    await settled(page,base+extra+'&scene=fivea&v2FiveAState=balanced&v2FiveACapture=1');
    await page.screenshot({path:path.join(out,`${variant}.png`)});
    report.fixed = await page.evaluate(async () => {
      const s=(await import('/src/engine/scenes.js')).getActiveScene();
      const c=(await import('/src/engine/camera.js')).getCamera();
      const T=await import('/node_modules/.vite/deps/three.js');
      const ids=['A1','A2','A3','A4','A5'];
      return {status:window.__GALAXY_TOUR_STATUS__,proof:JSON.parse(document.documentElement.dataset.v2FiveAStagesProof),
        targets:ids.map(id=>{const o=s.getObjectByName('FiveAStageNode'+id);const v=o.getWorldPosition(new T.Vector3()).project(c);return {id,screen:[(v.x+1)*800,(1-v.y)*450],world:o.getWorldPosition(new T.Vector3()).toArray()};}),camera:c.position.toArray()};
    });
    }
    if(process.env.FIVEA_CAPTURE_ONLY!=='1' || dataInteraction) {
      await settled(page,base+extra+'&scene=fivea&v2FiveAState=balanced');
      if(dataInteraction)await page.evaluate(()=>window.__FIVEA_CINEMATIC_REVIEW__.applyFixture('stages','balanced'));
      await page.waitForTimeout(10000);
      report.environment=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const e=gl.getExtension('WEBGL_debug_renderer_info');return {browser:navigator.userAgent,gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unavailable',visibility:document.visibilityState,dpr:devicePixelRatio};});
      report.performance={};
      for(const mode of (dataInteraction ? ['snapshot-panel-interaction'] : ['steady','interaction'])) {
        const start=Date.now();
        let previousSegment=-1,panelState=false;
        const before=await page.evaluate(()=>{window.__FIVEA_TIMING__.frames.length=0;window.__FIVEA_TIMING__.enabled=true;return window.__FIVEA_DRAW_COUNT__();});
        while(Date.now()-start<60000) {
          if(mode!=='steady') await page.mouse.move(800+320*Math.sin((Date.now()-start)/2400),450+160*Math.cos((Date.now()-start)/3300));
          if(dataInteraction){
            const seconds=(Date.now()-start)/1000,segment=Math.floor(seconds/8),open=seconds%20>10&&seconds%20<13;
            if(segment!==previousSegment){previousSegment=segment;await page.evaluate(segment=>window.__FIVEA_CINEMATIC_REVIEW__.applyFixture(segment%4<2?'stage':'flow',segment%2?'high':'low','A3_TO_A4'),segment);}
            if(open!==panelState){panelState=open;await page.evaluate(open=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__[open?'open':'close']('perf'),open);if(open){await page.mouse.move(1350,500);await page.mouse.wheel(0,300);}}
          }
          await page.waitForTimeout(mode==='steady'?1000:60);
        }
        report.performance[mode]=await page.evaluate(before=>{
          window.__FIVEA_TIMING__.enabled=false;
          const f=window.__FIVEA_TIMING__.frames.slice().sort((a,b)=>a-b);const q=p=>f[Math.floor((f.length-1)*p)];
          return {frames:f.length,durationMs:f.reduce((a,b)=>a+b,0),median:q(.5),p95:q(.95),p99:q(.99),max:f.at(-1),over50:f.filter(x=>x>50).length,over100:f.filter(x=>x>100).length,meanDrawCalls:(window.__FIVEA_DRAW_COUNT__()-before)/f.length};
        },before);
        console.log(variant,mode,JSON.stringify(report.performance[mode]));
      }
      report.loop=await page.evaluate(async()=>({...(await import('/src/engine/loop.js')).getLoopStatus(),canvas:document.querySelectorAll('canvas').length}));
    }
    await context.close();
    if(process.env.FIVEA_CAPTURE_ONLY!=='1' && !dataInteraction) {
      const recorded=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1600,height:900}}});
      const p=await recorded.newPage();await settled(p,base+extra+'&scene=fivea&v2FiveAState=balanced');await p.waitForTimeout(8000);
      const video=p.video();await recorded.close();await video.saveAs(path.join(out,`${variant}-motion.webm`));
    }
  } finally {fs.writeFileSync(path.join(out,`${variant}${dataInteraction?'-data-interaction':''}-report.json`),JSON.stringify(report,null,2));await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
