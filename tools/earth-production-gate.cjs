const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const audit=process.argv.includes('--audit');
const base=process.env.EARTH_PROD_BASE||'http://127.0.0.1:5188/';
const out=path.resolve(__dirname,'../art/earth-prod',process.argv.includes('--audit')?'before':'final');
const query='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthAudit=1&earthFreeze=1';
const baseline=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../art/earth-prod/baseline/runtime-report.json')));
const pose=baseline.cases.find(c=>c.name==='EARTH_HYBRID_HOME').camera;
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],cases=[];
 try{
 const p=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(base+'?'+query+(audit?'':'&earthHybridProd=1'),{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.ready);await p.mouse.move(800,450);await p.waitForTimeout(2500);
 await p.evaluate(async pose=>{
   const T=await import('/node_modules/.vite/deps/three.js');const s=(await import('/src/engine/scenes.js')).getActiveScene(),root=s.getObjectByName('EarthRoot');
   const rotation=root.quaternion.clone(),before=s.onBeforeRender,flags=new Map();root.traverse(x=>{if(x.isMesh)flags.set(x,x.visible);});
   window.__EARTH_SWEEP__={angle:0,path:'auto',layer:'combined'};
   const axis=new T.Vector3(0,1,0);
   // Diagnostic Earth-local view sweep only. The production Camera source is untouched.
   s.onBeforeRender=function(renderer,scene,camera,...rest){
     before.call(this,renderer,scene,camera,...rest);camera.position.fromArray(pose.position);camera.quaternion.fromArray(pose.quaternion);camera.updateMatrixWorld(true);
     const o=window.__EARTH_SWEEP__;root.quaternion.copy(rotation).multiply(new T.Quaternion().setFromAxisAngle(axis,o.angle*Math.PI/180));root.updateMatrixWorld(true);
     const h=s.getObjectByName('EarthCinematicHybrid'),surface=s.getObjectByName('SurfaceGroup'),cloud=s.getObjectByName('CloudGroup');
     const production=window.__ACTIVE_THEORY_EARTH_HYBRID__?.production;
     if(production){
       h.visible=false;surface.visible=cloud.visible=o.path!=='none';
       if(o.path==='hybrid'||o.path==='fallback')for(const name of ['EarthTextureSurface','EarthTextureClouds']){
         const u=s.getObjectByName(name).material.uniforms;u.uHandoff.value=o.path==='hybrid'?0:1;u.uCalibration.value=0;
       }
     }else if(o.path!=='auto'){h.visible=o.path==='hybrid';surface.visible=cloud.visible=o.path==='fallback';}
     const names={surface:['EarthHybridDepthBody','EarthTextureSurface'],city:['EarthHybridDepthBody','EarthTextureCityLights'],cloud:['EarthHybridCloud','EarthTextureClouds'],atmosphere:['EarthAtmosphereRim']};
     root.traverse(x=>{if(x.isMesh)x.visible=flags.get(x)&&(o.layer==='combined'||names[o.layer].includes(x.name));});
     if(o.path==='none')s.getObjectByName('EarthAtmosphereRim').visible=false;
     const mat=s.getObjectByName('EarthHybridDepthBody')?.material;if(mat?.uniforms.uDebug)mat.uniforms.uDebug.value=o.layer==='surface'?4:o.layer==='city'?3:['cloud','atmosphere'].includes(o.layer)?2:0;
   };
 },pose);
 const capture=async(name,angle,path,layer='combined')=>{
   await p.evaluate(o=>Object.assign(window.__EARTH_SWEEP__,o),{angle,path,layer});await p.waitForTimeout(160);
   await p.screenshot({path:require('node:path').join(out,name+'.png')});
   cases.push({name,angle,path,layer,...await p.evaluate(async()=>{
     const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera(),r=s.getObjectByName('EarthRoot');
     return {camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov},position:r.position.toArray(),rotation:r.quaternion.toArray(),hybrid:window.__ACTIVE_THEORY_EARTH_HYBRID__};
   })});
 };
 for(const mode of ['hybrid','fallback'])for(const layer of (audit?['combined','surface','city','cloud','atmosphere']:['combined']))await capture('SAME_'+mode.toUpperCase()+'_'+layer.toUpperCase(),0,mode,layer);
 await capture('NO_EARTH',0,'none');
 for(const angle of [-15,-12,-10,-8,0,3,6,8,10,12,15,18])await capture('RANGE_'+String(angle).replace('-','MINUS_'),angle,process.argv.includes('--audit')?'hybrid':'auto');
 if(!audit)for(const angle of [18,15,12,10,8,6,3,0])await capture('RETURN_'+angle,angle,'auto');
 assert.equal(errors.length,0,errors.join('\n'));
 }finally{fs.writeFileSync(path.join(out,'capture-report.json'),JSON.stringify({errors,cases},null,2));await browser.close();}
 console.log(JSON.stringify({out,errors,captures:cases.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
