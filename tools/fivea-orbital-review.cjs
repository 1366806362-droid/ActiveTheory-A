const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const out=path.resolve('art/fivea-orbital');fs.mkdirSync(out,{recursive:true});
const home='http://127.0.0.1:5192/?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1&earthHeroLock=1';
const candidate=home+'&fiveAOrbital=B&fiveACinematic=B&fiveACinematicReview=1&v2FiveAState=balanced';
const mode=process.argv[2]||'capture';
const report={mode,errors:[],viewport:[1600,900],dpr:1};
async function settled(p,url){await p.goto(url,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__GALAXY_TOUR_STATUS__?.activeScene==='FiveAScene'&&!window.__GALAXY_TOUR_STATUS__?.transitionTo);await p.waitForTimeout(1200);}
async function read(p){return p.evaluate(async()=>{
  const s=(await import('/src/engine/scenes.js')).getActiveScene();return s.getObjectByName('FiveAScene')?.userData.orbital?.();
});}
async function watch(p){p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});}
async function point(p,name){return p.evaluate(async name=>{const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera(),T=await import('/node_modules/.vite/deps/three.js');s.updateMatrixWorld(true);const v=s.getObjectByName(name).getWorldPosition(new T.Vector3()).project(c);return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];},name);}
async function fixture(p,kind,state,id){
 await p.evaluate(args=>window.__FIVEA_CINEMATIC_REVIEW__.applyFixture(...args),[kind,state,id]);await p.waitForTimeout(120);
 const r=await p.evaluate(()=>window.__FIVEA_CINEMATIC_REVIEW__.read());
 for(const [id,s]of Object.entries(r.stages.renderer))for(const key of ['scale','energy'])assert.equal(s.binding[key],r.plan.fiveA.stages.find(e=>e.targetId===id&&e.channel===`FIVEA_STAGE_${key.toUpperCase()}`).value);
 for(const [id,f]of Object.entries(r.flows.renderer)){assert.equal(f.binding.flowStrength,r.plan.fiveA.transitions.find(e=>e.targetId===id&&e.channel==='FIVEA_TRANSITION_FLOW_STRENGTH').value);f.alphas.forEach((v,i)=>assert.ok(Math.abs(v-f.baseAlphas[i]*f.binding.flowStrength)<1e-6));}
 (report.data??=[]).push({kind,state,id,orbital:await read(p),readback:r});return r;
}
async function returnHome(p){for(let i=0;i<40;i++){if(await p.evaluate(()=>window.__GALAXY_TOUR_STATUS__?.routeIndex===0&&!window.__GALAXY_TOUR_STATUS__?.transitionTo))break;await p.mouse.wheel(0,-500);await p.waitForTimeout(240);}await p.waitForFunction(()=>window.__GALAXY_TOUR_STATUS__?.routeIndex===0&&!window.__GALAXY_TOUR_STATUS__?.transitionTo);}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:false});
 try{
  if(mode==='skeleton'){
   const c=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1600,height:900}}});
   const p=await c.newPage();await watch(p);await settled(p,candidate+'&orbitalSkeleton=1&scene=fivea');
   report.start=await read(p);await p.screenshot({path:path.join(out,'SKELETON_B.png')});
   await p.waitForTimeout(30000);report.end=await read(p);
   for(const id of Object.keys(report.start.stages))assert.notDeepEqual(report.start.stages[id].position,report.end.stages[id].position);
   const video=p.video();await c.close();await video.saveAs(path.join(out,'SKELETON_REALTIME.webm'));
  }else if(mode==='checks'){
   const c=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});const p=await c.newPage();await watch(p);
   for(const name of ['FROZEN','CANDIDATE']){await p.goto(home+'&v2FiveAState=balanced&v2FiveACapture=1'+(name==='CANDIDATE'?'&fiveAOrbital=B':''),{waitUntil:'networkidle'});await p.waitForTimeout(2000);await p.screenshot({path:path.join(out,`HOME_${name}.png`)});}
   await settled(p,candidate+'&scene=fivea&orbitalReview=1');
   await p.evaluate(async()=>{const s=(await import('/src/engine/scenes.js')).getActiveScene();s.getObjectByName('FiveAScene').userData.setOrbitalSampleTime(12);});
   await fixture(p,'stages','partial');report.partialPanel=await p.evaluate(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.viewModel);
   report.inventory=await p.evaluate(async()=>{const s=(await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene'),rows=[];s.traverse(o=>{if(o.geometry&&o.visible)rows.push({name:o.name,type:o.type,vertices:o.geometry.attributes.position.count,points:!!o.isPoints});});return rows;});
   report.layout=[];
   for(const [width,height]of [[1600,900],[1366,768],[1920,1080]]){
    await p.setViewportSize({width,height});await p.waitForTimeout(300);await p.mouse.click(...await point(p,'FiveACorePrimaryHitTarget'));await p.waitForFunction(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());await p.waitForTimeout(1000);
    await p.screenshot({path:path.join(out,`PANEL_LAYOUT_${width}.png`)});
    const r=await p.evaluate(async()=>{const T=await import('/node_modules/.vite/deps/three.js'),{ORBITAL_STAGES,orbitalPose}=await import('/src/scenes/fiveAOrbitalArt.js');const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera(),g=s.getObjectByName('FiveAScene');g.updateMatrixWorld(true);
     const panel=document.querySelector('.fivea-data-panel').getBoundingClientRect(),outside=[];
     for(let i=0;i<240;i++)for(const [id,a]of Object.entries(ORBITAL_STAGES)){const v=orbitalPose(id,i/239*216.662,new T.Vector3(),'B').applyMatrix4(g.matrixWorld),z=v.clone().applyMatrix4(c.matrixWorldInverse).z;v.project(c);const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2,r=a.size*1.25*g.scale.x*c.projectionMatrix.elements[5]*innerHeight/2/-z;
      if(x-r<0||x+r>panel.left||y-r<0||y+r>innerHeight)outside.push({id,time:i/239*216.662,x,y,r});}
     return {viewport:[innerWidth,innerHeight],panelLeft:panel.left,outside};
    });report.layout.push(r);
    await p.keyboard.press('Escape');await p.waitForTimeout(1000);
   }
   report.result=report.layout.some(r=>r.outside.length)?'NOT READY: panel A5 extreme-phase clipping':'PASS';
   await p.setViewportSize({width:1600,height:900});await p.evaluate(async()=>{const s=(await import('/src/engine/scenes.js')).getActiveScene();s.getObjectByName('FiveAScene').userData.setOrbitalSampleTime(99);});
   await p.waitForTimeout(100);await p.mouse.click(...await point(p,'FiveACorePrimaryHitTarget'));await p.waitForFunction(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());await p.waitForTimeout(1100);await p.screenshot({path:path.join(out,'PANEL_EXTREME_PHASE_99.png')});
   await c.close();
  }else if(mode==='video'){
   const c=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});const p=await c.newPage();await watch(p);
   const cdp=await c.newCDPSession(p),frames=[],frameDir=path.join(out,'recording',String(Date.now()));fs.mkdirSync(frameDir,{recursive:true});await cdp.send('Page.enable');
   cdp.on('Page.screencastFrame',e=>{const file=`f-${String(frames.length).padStart(6,'0')}.png`;fs.writeFileSync(path.join(frameDir,file),Buffer.from(e.data,'base64'));frames.push({file,time:e.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
   await p.goto(candidate,{waitUntil:'networkidle'});await p.waitForTimeout(2000);
   await cdp.send('Page.startScreencast',{format:'png',maxWidth:1600,maxHeight:900,everyNthFrame:4});
   await p.mouse.click(...await point(p,'5ANebula'));await p.waitForFunction(()=>window.__GALAXY_TOUR_STATUS__?.activeScene==='FiveAScene'&&!window.__GALAXY_TOUR_STATUS__?.transitionTo);
   report.orbitMotion=[];
   for(let i=0;i<9;i++){report.orbitMotion.push({wallTime:Date.now(),...await read(p)});if(i<8)await p.waitForTimeout(4000);}
   assert.ok(report.orbitMotion.at(-1).wallTime-report.orbitMotion[0].wallTime>=32000);
   for(const id of Object.keys(report.orbitMotion[0].stages))assert.notDeepEqual(report.orbitMotion[0].stages[id].position,report.orbitMotion.at(-1).stages[id].position);
   await fixture(p,'stage','low');await p.waitForTimeout(900);await fixture(p,'stage','high');await p.waitForTimeout(900);
   await fixture(p,'flow','low','A3_TO_A4');await p.waitForTimeout(900);await fixture(p,'flow','high','A3_TO_A4');await p.waitForTimeout(900);
   await p.mouse.move(...await point(p,'FiveACorePrimaryHitTarget'));await p.waitForTimeout(500);
   report.hover=await p.evaluate(async()=>{const s=(await import('/src/engine/scenes.js')).getActiveScene();return s.getObjectByName('FiveACorePrimaryHitTarget').material.uniforms.uHover.value;});assert.ok(report.hover>.8);
   await p.mouse.click(...await point(p,'FiveACorePrimaryHitTarget'));await p.waitForFunction(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());await p.waitForTimeout(1300);
   const paused=await read(p);await p.mouse.move(1350,500);await p.mouse.wheel(0,500);await p.waitForTimeout(500);assert.equal((await read(p)).time,paused.time);
   await p.screenshot({path:path.join(out,'FIVEA_ORBITAL_PANEL_OPEN.png')});report.panelPaused=paused;
   await p.getByRole('button',{name:'关闭 5A 数据表',exact:true}).click();await p.waitForTimeout(300);const resumed=await read(p);assert.ok(resumed.time>paused.time&&resumed.time-paused.time<.5);report.resumeDelta=resumed.time-paused.time;
   await p.waitForTimeout(1000);await p.mouse.click(...await point(p,'FiveACorePrimaryHitTarget'));await p.waitForFunction(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());await p.keyboard.press('Escape');await p.waitForTimeout(1000);assert.equal(await p.evaluate(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen()),false);
   await returnHome(p);report.return1=await p.evaluate(()=>window.__GALAXY_TOUR_STATUS__);
   await p.mouse.click(...await point(p,'5ANebula'));await p.waitForFunction(()=>window.__GALAXY_TOUR_STATUS__?.activeScene==='FiveAScene'&&!window.__GALAXY_TOUR_STATUS__?.transitionTo);await p.waitForTimeout(1200);report.reentry=await read(p);
   await returnHome(p);await p.waitForTimeout(700);report.return2=await p.evaluate(()=>window.__GALAXY_TOUR_STATUS__);
   report.loop=await p.evaluate(async()=>({...(await import('/src/engine/loop.js')).getLoopStatus(),canvas:document.querySelectorAll('canvas').length}));
   await cdp.send('Page.stopScreencast');await c.close();
   const manifest=path.join(frameDir,'timeline.txt');fs.writeFileSync(manifest,frames.map((f,i)=>`file '${f.file}'\nduration ${Math.max(.001,(frames[i+1]?.time??f.time+.04)-f.time).toFixed(6)}\n`).join('')+`file '${frames.at(-1).file}'\n`);
   report.video={source:'native CDP PNG frames with original timestamps',frames:frames.length,duration:frames.at(-1).time-frames[0].time,manifest};fs.writeFileSync(path.join(frameDir,'timestamps.json'),JSON.stringify(frames));
   const encode=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',manifest,'-fps_mode','vfr','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709','-c:v','libx264','-threads','2','-crf','16','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',path.join(out,'FIVEA_ORBITAL_DEMO.mp4')],{encoding:'utf8'});assert.equal(encode.status,0,encode.stderr);
  }else if(mode==='cycle'){
   const c=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});const p=await c.newPage();await watch(p);
   await settled(p,candidate+'&scene=fivea&orbitalReview=1&v2FiveACapture=1');
   report.cycle=await p.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js');const {ORBITAL_STAGES,orbitalPose}=await import('/src/scenes/fiveAOrbitalArt.js');
    const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera(),g=s.getObjectByName('FiveAScene');
    const result={duration:2*Math.PI/.029,steps:240,offscreen:[],collisions:[],occlusion:{},labelOverlaps:0,minSeparation:999,samples:[]};
    const ids=Object.keys(ORBITAL_STAGES),v=new T.Vector3(),w=new T.Vector3();
    for(let k=0;k<=240;k++){
     const t=k/240*result.duration;const poses=ids.map(id=>orbitalPose(id,t,new T.Vector3(),'B'));
     const screen=poses.map((pos,i)=>{
      v.copy(pos).applyMatrix4(g.matrixWorld);w.copy(v).applyMatrix4(c.matrixWorldInverse);v.project(c);
      const r=ORBITAL_STAGES[ids[i]].size*1.25*g.scale.x*c.projectionMatrix.elements[5]*450/-w.z;
      return {id:ids[i],x:(v.x+1)*800,y:(1-v.y)*450,r};
     });
     for(let i=0;i<5;i++){
      const a=screen[i];if(a.x-a.r<20||a.x+a.r>1580||a.y-a.r-40<20||a.y+a.r>850)result.offscreen.push({t,...a});
      const coreView=new T.Vector3().setFromMatrixPosition(g.matrixWorld).applyMatrix4(c.matrixWorldInverse);
      const coreRadius=.48*g.scale.x*c.projectionMatrix.elements[5]*450/-coreView.z;
      const overlap=Math.hypot(a.x-800,a.y-450)<coreRadius-a.r;if(overlap)(result.occlusion[a.id]??=[]).push(t);
      for(let j=i+1;j<5;j++){
       const d=poses[i].distanceTo(poses[j])-1.25*(ORBITAL_STAGES[ids[i]].size+ORBITAL_STAGES[ids[j]].size);result.minSeparation=Math.min(d,result.minSeparation);
       if(d<0)result.collisions.push({t,a:ids[i],b:ids[j],d});
       if(Math.abs(a.x-screen[j].x)<105&&Math.abs(a.y-a.r-screen[j].y+screen[j].r)<20)result.labelOverlaps++;
      }
     }
     if(k%40===0)result.samples.push({t,screen});
    }
    return result;
   });
   for(const t of [0,36,72,108,144,180,216]){await p.evaluate(async t=>{const s=(await import('/src/engine/scenes.js')).getActiveScene();s.getObjectByName('FiveAScene').userData.setOrbitalSampleTime(t);},t);await p.waitForTimeout(100);await p.screenshot({path:path.join(out,`DEBUG_CYCLE_${t}.png`)});}
   await c.close();assert.equal(report.cycle.offscreen.length,0);assert.equal(report.cycle.collisions.length,0);console.log(JSON.stringify(report.cycle));
  }else{
   const c=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});const p=await c.newPage();await watch(p);
   await settled(p,home+'&fiveACinematic=B&v2FiveAState=balanced&scene=fivea&v2FiveACapture=1');await p.screenshot({path:path.join(out,'BEFORE_V11.png')});
   await settled(p,candidate+'&scene=fivea&v2FiveACapture=1');await p.screenshot({path:path.join(out,'FIVEA_ORBITAL_OVERVIEW.png')});report.fixed=await read(p);
   report.camera=await p.evaluate(async()=>{const c=(await import('/src/engine/camera.js')).getCamera();return {position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov};});
   const xy=await point(p,'FiveACorePrimaryHitTarget');await p.screenshot({path:path.join(out,'FIVEA_ORBITAL_CORE_CLOSEUP.png'),clip:{x:xy[0]-155,y:xy[1]-155,width:310,height:310}});
   for(const [kind,state,id,file]of [['stage','low',null,'STAGE_LOW'],['stage','high',null,'STAGE_HIGH'],['flow','low','A3_TO_A4','FLOW_LOW'],['flow','high','A3_TO_A4','FLOW_HIGH'],['stages','partial',null,'PARTIAL']]){await fixture(p,kind,state,id);await p.screenshot({path:path.join(out,file+'.png')});assert.equal((await read(p)).time,12);}
   report.layouts=[];
   for(const [width,height]of [[1366,768],[1920,1080]]){await p.setViewportSize({width,height});await p.waitForTimeout(500);await p.screenshot({path:path.join(out,`LAYOUT_${width}.png`)});report.layouts.push([width,height]);}
   await c.close();
  }
 }finally{fs.writeFileSync(path.join(out,mode+'-report.json'),JSON.stringify(report,null,2));await browser.close();}
 assert.equal(report.errors.length,0);console.log(mode,report.result||'PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
