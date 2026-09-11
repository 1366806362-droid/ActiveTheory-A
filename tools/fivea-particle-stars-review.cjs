const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve('art/fivea-particle-stars');fs.mkdirSync(out,{recursive:true});
const home='http://127.0.0.1:5193/?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1&earthHeroLock=1';
const base=home+'&fiveAOrbital=B&fiveACinematic=B&fiveACinematicReview=1&v2FiveAState=balanced&scene=fivea&v2FiveACapture=1&orbitalReview=1';
const mode=process.argv[2]||'capture',report={mode,errors:[],viewport:[1600,900],dpr:1};
async function position(p,name){return p.evaluate(async name=>{const T=await import('/node_modules/.vite/deps/three.js'),s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera();s.updateMatrixWorld(true);const v=s.getObjectByName(name).getWorldPosition(new T.Vector3()).project(c);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};},name);}
async function go(p,url){await p.goto(url,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__GALAXY_TOUR_STATUS__?.activeScene==='FiveAScene'&&!window.__GALAXY_TOUR_STATUS__?.transitionTo);await p.waitForTimeout(1800);}
async function shot(p,file){await p.screenshot({path:path.join(out,file+'.png')});}
(async()=>{const b=await chromium.launch({channel:'msedge',headless:false});try{const c=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 if(mode==='home'){
  for(const name of ['FROZEN','CANDIDATE']){await p.goto(home+'&v2FiveAState=balanced&v2FiveACapture=1'+(name==='CANDIDATE'?'&fiveAOrbital=B&fiveAParticleStars=B':''),{waitUntil:'networkidle'});await p.waitForTimeout(2000);await shot(p,'HOME_'+name);}
 }else if(mode==='safety'){
  report.layouts=[];
  for(const [width,height]of [[1366,768],[1600,900],[1920,1080]]){
   await p.setViewportSize({width,height});await go(p,base.replace('&v2FiveACapture=1','')+'&fiveAParticleStars=B');
   for(const state of ['low','high','partial']){
    await p.evaluate(state=>window.__FIVEA_CINEMATIC_REVIEW__.applyFixture(state==='partial'?'stages':'stage',state),state);
    const xy=await position(p,'FiveACorePrimaryHitTarget');await p.mouse.click(xy.x,xy.y);await p.waitForFunction(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());await p.waitForTimeout(1100);
    const result=await p.evaluate(async()=>{
     const T=await import('/node_modules/.vite/deps/three.js'),{ORBITAL_STAGES,orbitalPose}=await import('/src/scenes/fiveAOrbitalArt.js'),g=(await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene'),c=(await import('/src/engine/camera.js')).getCamera();g.updateMatrixWorld(true);
     const left=document.querySelector('.fivea-data-panel').getBoundingClientRect().left,outside=[];let minimumMargin=Infinity;
     for(let t=0;t<=750;t+=.5)for(const [id,a]of Object.entries(ORBITAL_STAGES)){
      const v=orbitalPose(id,t,new T.Vector3(),'B').applyMatrix4(g.matrixWorld),depth=-v.clone().applyMatrix4(c.matrixWorldInverse).z;v.project(c);
      const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2,r=a.size*1.25*1.104*g.scale.x*c.projectionMatrix.elements[5]*innerHeight/2/depth;
      minimumMargin=Math.min(minimumMargin,x-r,left-x-r,x-84,left-x-84,y-r-40,innerHeight-y-r);
      if(x-r<10||x+r>left-10||x-84<0||x+84>left||y-r-40<0||y+r>innerHeight)outside.push({t,id,x,y,r});
     }return {outside,minimumMargin,fit:g.userData.particlePanelFit,scale:g.scale.x};
    });report.layouts.push({width,height,state,...result});assert.equal(result.outside.length,0);const paused=await p.evaluate(async()=> (await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.orbital().time);
    await p.mouse.move(width-100,300);await p.mouse.wheel(0,500);await p.waitForTimeout(180);assert.equal(await p.evaluate(async()=> (await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.orbital().time),paused);
    await p.screenshot({path:path.join(out,`PANEL_${width}_${state}.png`)});await p.keyboard.press('Escape');await p.waitForTimeout(1000);
   }
  }
  await p.setViewportSize({width:1600,height:900});await go(p,base.replace('&v2FiveACapture=1','')+'&fiveAParticleStars=B');
  for(const t of [0,36,72,99,108,144,180,216]){await p.evaluate(async t=>(await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.setOrbitalSampleTime(t),t);await p.waitForTimeout(100);await shot(p,'DEPTH_PHASE_'+t);}
  await p.evaluate(async()=> (await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.setOrbitalSampleTime(null));
  for(let n=0;n<6;n++){const xy=await position(p,'FiveACorePrimaryHitTarget');await p.mouse.click(xy.x,xy.y);await p.waitForFunction(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());await p.waitForTimeout(70);await p.keyboard.press('Escape');await p.waitForTimeout(600);assert.equal(await p.evaluate(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen()),false);}
  report.loop=await p.evaluate(async()=>({...(await import('/src/engine/loop.js')).getLoopStatus(),canvas:document.querySelectorAll('canvas').length}));
 }else if(mode==='prototype'){
  for(const v of ['A','B']){await go(p,base+'&fiveAParticleStars='+v);await shot(p,'MATERIAL_'+v);const core=await position(p,'FiveACorePrimaryHitTarget');await p.screenshot({path:path.join(out,'MATERIAL_'+v+'_CORE.png'),clip:{x:Math.round(core.x-160),y:Math.round(core.y-160),width:320,height:320}});}
 }else{
  await go(p,base);await shot(p,'BEFORE_SOLID');
  await go(p,base+'&fiveAParticleStars=B');await shot(p,'FIVEA_PARTICLE_STARS_OVERVIEW');
  for(const [name,file,size]of [['FiveACorePrimaryHitTarget','FIVEA_PARTICLE_STARS_CORE_DETAIL',320],['FiveAOrbitalBodyA3','FIVEA_PARTICLE_STARS_SATELLITE_DETAIL',180]]){const xy=await position(p,name);await p.screenshot({path:path.join(out,file+'.png'),clip:{x:Math.max(0,Math.round(xy.x-size/2)),y:Math.max(0,Math.round(xy.y-size/2)),width:size,height:size}});}
  for(const [kind,state,id]of [['stage','low','A3'],['stage','high','A3'],['flow','low','A3_TO_A4'],['flow','high','A3_TO_A4'],['stages','partial',null]]){
   await p.evaluate(args=>window.__FIVEA_CINEMATIC_REVIEW__.applyFixture(...args),[kind,state,id]);await p.waitForTimeout(150);await shot(p,kind+'_'+state);
   const r=await p.evaluate(()=>window.__FIVEA_CINEMATIC_REVIEW__.read());for(const [target,s]of Object.entries(r.stages.renderer))for(const key of ['scale','energy'])assert.equal(s.binding[key],r.plan.fiveA.stages.find(e=>e.targetId===target&&e.channel===`FIVEA_STAGE_${key.toUpperCase()}`).value);
   for(const [target,f]of Object.entries(r.flows.renderer)){assert.equal(f.binding.flowStrength,r.plan.fiveA.transitions.find(e=>e.targetId===target&&e.channel==='FIVEA_TRANSITION_FLOW_STRENGTH').value);f.alphas.forEach((v,i)=>assert.ok(Math.abs(v-f.baseAlphas[i]*f.binding.flowStrength)<1e-6));}(report.data??=[]).push({kind,state,id,readback:r});
  }
  await go(p,base+'&fiveAParticleStars=B&showBloom=0');await shot(p,'BLOOM_OFF');
  await go(p,base+'&fiveAParticleStars=B');await shot(p,'BLOOM_ON');
  await go(p,base.replace('&v2FiveACapture=1','')+'&fiveAParticleStars=B');
  await p.evaluate(async()=>{(await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.setOrbitalSampleTime(12);});
  const xy=await position(p,'FiveACorePrimaryHitTarget');await p.mouse.click(xy.x,xy.y);await p.waitForFunction(()=>window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());await p.waitForTimeout(1300);await shot(p,'FIVEA_PARTICLE_STARS_PANEL_SAFE');
  report.panel=await p.evaluate(async()=>{const g=(await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene');return {position:g.position.toArray(),scale:g.scale.x,fit:g.userData.particlePanelFit};});
  await p.keyboard.press('Escape');await p.waitForTimeout(1000);
 }
 await c.close();}finally{await b.close();fs.writeFileSync(path.join(out,mode+'-report.json'),JSON.stringify(report,null,2));}assert.equal(report.errors.length,0,report.errors.join('\n'));console.log(mode,'PASS',report.panel||'');})().catch(e=>{console.error(e);process.exitCode=1;});
