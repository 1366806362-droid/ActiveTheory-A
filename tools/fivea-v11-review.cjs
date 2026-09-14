const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const out=path.resolve('art/fivea-v11');
const home=process.env.FIVEA_URL||'http://127.0.0.1:5191/?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1&earthHeroLock=1';
const url=home+'&fiveACinematic=B&fiveACinematicReview=1&v2FiveAState=balanced';
const report={errors:[],records:[],events:[],format:'native browser PNG; 1600x900 DPR1; video WebM recorded by Playwright then transcoded to MP4 without speed or color changes'};
const status=p=>p.evaluate(()=>({...window.__GALAXY_TOUR_STATUS__}));
async function fixture(p,kind,state,id){
  await p.evaluate(args=>window.__FIVEA_CINEMATIC_REVIEW__.applyFixture(...args),[kind,state,id]);
  await p.waitForTimeout(200);
  const r=await p.evaluate(()=>window.__FIVEA_CINEMATIC_REVIEW__.read());
  for(const [id,s]of Object.entries(r.stages.renderer))for(const key of ['scale','energy'])assert.equal(s.binding[key],r.plan.fiveA.stages.find(e=>e.targetId===id&&e.channel===`FIVEA_STAGE_${key.toUpperCase()}`).value);
  for(const [id,f]of Object.entries(r.flows.renderer)){assert.equal(f.binding.flowStrength,r.plan.fiveA.transitions.find(e=>e.targetId===id&&e.channel==='FIVEA_TRANSITION_FLOW_STRENGTH').value);f.alphas.forEach((v,i)=>assert.ok(Math.abs(v-f.baseAlphas[i]*f.binding.flowStrength)<1e-6));}
  report.records.push(r);report.events.push({kind,state,id,wallTime:Date.now()});return r;
}
async function point(p,name){return p.evaluate(async name=>{
  const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera();const T=await import('/node_modules/.vite/deps/three.js');
  s.updateMatrixWorld(true);const v=s.getObjectByName(name).getWorldPosition(new T.Vector3()).project(c);return [(v.x+1)*800,(1-v.y)*450];
},name);}
async function instrument(p){
  p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await p.addInitScript(()=>{
    const rows=[],add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener=function(type,fn,opt){const cap=typeof opt==='boolean'?opt:!!opt?.capture;if(type==='wheel'&&(this===window||this===document)&&!rows.some(r=>r.obj===this&&r.fn===fn&&r.cap===cap))rows.push({obj:this,fn,cap,signal:opt?.signal});return add.call(this,type,fn,opt);};
    EventTarget.prototype.removeEventListener=function(type,fn,opt){const cap=typeof opt==='boolean'?opt:!!opt?.capture;const i=rows.findIndex(r=>r.obj===this&&r.fn===fn&&r.cap===cap);if(type==='wheel'&&i>=0)rows.splice(i,1);return remove.call(this,type,fn,opt);};
    window.__FIVEA_WHEEL_COUNT__=()=>rows.filter(r=>!r.signal?.aborted).length;
  });
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:false});
  try {
    const c=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});const p=await c.newPage();await instrument(p);
    await p.goto(url+'&scene=fivea&v2FiveACapture=1',{waitUntil:'networkidle'});await p.waitForFunction(()=>document.documentElement.dataset.v2FiveAStagesProof);await p.waitForTimeout(1500);
    await p.screenshot({path:path.join(out,'FIVEA_V11_OVERVIEW.png')});
    report.flowProjection=await p.evaluate(async()=>{
      const r=window.__FIVEA_CINEMATIC_REVIEW__.read();const s=(await import('/src/engine/scenes.js')).getActiveScene();const c=(await import('/src/engine/camera.js')).getCamera();const T=await import('/node_modules/.vite/deps/three.js');const o=s.getObjectByName('FiveACoreReleaseParticleFlow');const a=o.geometry.attributes.position;
      return Object.fromEntries(Object.entries(r.flows.renderer).map(([id,f])=>[id,{alpha:f.alphas.reduce((a,b)=>a+b,0)/f.alphas.length,screen:f.particleIndices.map(i=>{const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(c);return [(v.x+1)*800,(1-v.y)*450];})}]));
    });
    for(const [kind,state,id,file] of [
      ['stage','low',null,'STAGE_LOW'],['stage','high',null,'STAGE_HIGH'],
      ['flow','low','A3_TO_A4','FLOW_LOW'],['flow','high','A3_TO_A4','FLOW_HIGH'],
      ['stages','contrast',null,'CONTRAST'],['stages','partial',null,'FIVEA_V11_PARTIAL']]) {
      await fixture(p,kind,state,id);await p.screenshot({path:path.join(out,file+'.png')});
    }
    const partialPanel=await p.evaluate(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.viewModel);report.partialPanel=partialPanel;
    await c.close();
    const lossless=process.env.FIVEA_LOSSLESS_VIDEO==='1';
    const videoContext=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1,...(!lossless?{recordVideo:{dir:path.join(out,'recording'),size:{width:1600,height:900}}}:{})});
    const v=await videoContext.newPage();await instrument(v);
    const frames=[];let cdp,frameDir;
    if(lossless){
      frameDir=path.join(out,'recording-lossless',String(Date.now()));fs.mkdirSync(frameDir,{recursive:true});
      cdp=await videoContext.newCDPSession(v);await cdp.send('Page.enable');
      cdp.on('Page.screencastFrame',event=>{
        const file=`frame-${String(frames.length).padStart(5,'0')}.png`;
        fs.writeFileSync(path.join(frameDir,file),Buffer.from(event.data,'base64'));
        frames.push({file,time:event.metadata.timestamp,width:event.metadata.deviceWidth,height:event.metadata.deviceHeight});
        cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
      });
      await cdp.send('Page.startScreencast',{format:'png',maxWidth:1600,maxHeight:900,everyNthFrame:4});
    }
    await v.goto(url,{waitUntil:'networkidle'});await v.waitForTimeout(2000);
    await v.mouse.click(...await point(v,'5ANebula'));
    await v.waitForFunction(()=>window.__GALAXY_TOUR_STATUS__?.activeScene==='FiveAScene'&&!window.__GALAXY_TOUR_STATUS__?.transitionTo);
    await v.waitForTimeout(3000);report.entry=await status(v);
    await fixture(v,'stage','low');await v.waitForTimeout(2200);
    await fixture(v,'stage','high');await v.waitForTimeout(2200);
    await fixture(v,'flow','low','A3_TO_A4');await v.waitForTimeout(2200);
    await fixture(v,'flow','high','A3_TO_A4');await v.waitForTimeout(2200);
    await v.mouse.click(...await point(v,'FiveACorePrimaryHitTarget'));
    await v.waitForFunction(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());await v.waitForTimeout(1000);
    await v.screenshot({path:path.join(out,'FIVEA_V11_PANEL_OPEN.png')});
    report.panelBeforeWheel=await status(v);await v.mouse.move(1350,500);await v.mouse.wheel(0,800);await v.waitForTimeout(500);report.panelAfterWheel=await status(v);
    assert.equal(report.panelBeforeWheel.routeIndex,report.panelAfterWheel.routeIndex);assert.equal(report.panelAfterWheel.activeScene,'FiveAScene');
    await v.keyboard.press('Escape');assert.equal(await v.evaluate(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen()),false);
    await v.waitForTimeout(900);
    for(let i=0;i<32;i++){const s=await status(v);if(s.activeScene==='HeroScene'&&s.routeIndex===0&&!s.transitionTo)break;await v.mouse.wheel(0,-500);await v.waitForTimeout(220);}
    await v.waitForFunction(()=>window.__GALAXY_TOUR_STATUS__?.routeIndex===0&&!window.__GALAXY_TOUR_STATUS__?.transitionTo,{timeout:15000});
    await v.waitForTimeout(1200);report.return=await status(v);assert.equal(report.return.activeScene,'HeroScene');assert.equal(report.return.routeIndex,0);
    report.runtime=await v.evaluate(async()=>({...(await import('/src/engine/loop.js')).getLoopStatus(),canvas:document.querySelectorAll('canvas').length,wheel:window.__FIVEA_WHEEL_COUNT__()}));
    assert.equal(report.runtime.canvas,1);assert.equal(report.runtime.activeRafChains,1);assert.equal(report.runtime.wheel,1);assert.equal(report.errors.length,0);
    if(lossless){
      await cdp.send('Page.stopScreencast');
      const concat=frames.map((f,i)=>`file '${f.file}'\nduration ${Math.max(.001,(frames[i+1]?.time??f.time+.04)-f.time).toFixed(6)}\n`).join('')+`file '${frames.at(-1).file}'\n`;
      const manifest=path.join(frameDir,'timeline.txt');fs.writeFileSync(manifest,concat);
      report.losslessCapture={manifest,frames:frames.length,duration:frames.at(-1).time-frames[0].time,format:'CDP PNG native frames; original timestamp durations, not retimed'};
      fs.writeFileSync(path.join(frameDir,'timestamps.json'),JSON.stringify(frames));
      await videoContext.close();
      const encoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',manifest,
        '-fps_mode','vfr','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709',
        '-c:v','libx264','-threads','2','-crf','16','-pix_fmt','yuv420p','-color_range','tv',
        '-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',
        path.join(out,'FIVEA_V11_JOURNEY_DEMO.mp4')],{encoding:'utf8'});
      assert.equal(encoded.status,0,encoded.stderr);
    }else{const video=v.video();await videoContext.close();await video.saveAs(path.join(out,'FIVEA_V11_JOURNEY_DEMO.webm'));}
    console.log(JSON.stringify({runtime:report.runtime,entry:report.entry.activeScene,return:report.return.activeScene,errors:report.errors,records:report.records.length}));
  }finally{fs.writeFileSync(path.join(out,'review-report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
