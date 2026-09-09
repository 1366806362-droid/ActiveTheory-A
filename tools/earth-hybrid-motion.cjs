// Capture actual runtime frames. No image interpolation and no second runtime RAF.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');const {chromium}=require('playwright');
const out=path.resolve(__dirname,'../art/earth-hybrid/final');
(async()=>{
  const gate=JSON.parse(fs.readFileSync(path.join(out,'runtime-report.json')));
  const url=gate.cases.find(c=>c.name==='EARTH_HYBRID_HOME').url.replace('&earthFreeze=1','');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});
  const frames=[],errors=[],samples=[];let initial,final,fallback,seconds;
  try{
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await p.goto(url,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.ready);
    await p.mouse.move(720,440);await p.waitForTimeout(4000);
    const state=()=>p.evaluate(async()=>{
      const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera();
      const root=s.getObjectByName('EarthRoot'),body=s.getObjectByName('EarthHybridDepthBody'),cloud=s.getObjectByName('EarthHybridCloud');
      const T=await import('/node_modules/.vite/deps/three.js');
      if(!window.__HYBRID_TRACKED_VERTICES__){
        const visible=[];
        for(let id=0;id<body.geometry.attributes.position.count;id+=43){
          const v=new T.Vector3().fromBufferAttribute(body.geometry.attributes.position,id);body.localToWorld(v);const distance=v.distanceTo(c.position);v.project(c);
          const x=(v.x+1)*800,y=(1-v.y)*450;
          if(x>20&&x<400&&y>520&&y<875&&v.z>-1&&v.z<1)visible.push({id,distance});
        }
        visible.sort((a,b)=>a.distance-b.distance);
        window.__HYBRID_TRACKED_VERTICES__=[0,.25,.5,.75,1].map(t=>visible[Math.floor(t*(visible.length-1))].id);
      }
      const ids=window.__HYBRID_TRACKED_VERTICES__;const points=ids.map(id=>{
        const v=new T.Vector3().fromBufferAttribute(body.geometry.attributes.position,id);body.localToWorld(v);v.project(c);return[(v.x+1)*800,(1-v.y)*450];
      });
      return {time:cloud.material.uniforms.uTime.value,ids,points,fallback:window.__ACTIVE_THEORY_EARTH_HYBRID__.fallback,
        earthPosition:root.position.toArray()};
    });
    initial=await state();const cdp=await context.newCDPSession(p);
    cdp.on('Page.screencastFrame',e=>{frames.push(Buffer.from(e.data,'base64'));void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
    const start=Date.now();await cdp.send('Page.startScreencast',{format:'jpeg',quality:95,maxWidth:1600,maxHeight:900,everyNthFrame:4});
    for(let i=0;i<20;i++){await p.mouse.move(720+160*i/19,440+20*i/19);await p.waitForTimeout(500);samples.push(await state());}
    await cdp.send('Page.stopScreencast');seconds=(Date.now()-start)/1000;final=await state();
    fallback=await p.evaluate(async()=>{
      const T=await import('/node_modules/.vite/deps/three.js'),{createEarthCinematicHybrid}=await import('/src/universe/earthCinematicHybrid.js');
      const root=new T.Group(),old=new T.Group(),air=new T.Mesh();root.add(old,air);
      const h=createEarthCinematicHybrid(root,{fallbackGroups:[old],atmosphere:air});await h.promise;
      const camera=new T.PerspectiveCamera();camera.position.set(0,0,-20);camera.updateMatrixWorld(true);h.update(.016,camera);
      const result={fallbackVisible:old.visible,hybridVisible:h.group.visible,ready:h.getStatus().ready};h.dispose();return result;
    });
  }finally{await context.close();await browser.close();}
  fs.writeFileSync(path.join(out,'motion-check.json'),JSON.stringify({errors,initial,final,fallback,seconds,frames:frames.length},null,2));
  assert.equal(errors.length,0,errors.join('\n'));assert.ok(frames.length>30);assert.ok(final.time>initial.time+8);
  assert.ok(samples.every(s=>s.fallback===false));assert.deepEqual(fallback,{fallbackVisible:true,hybridVisible:false,ready:true});
  const displacements=initial.points.map((p,i)=>[final.points[i][0]-p[0],final.points[i][1]-p[1]]);
  const differential=Math.max(...displacements.map(d=>Math.hypot(d[0]-displacements[0][0],d[1]-displacements[0][1])));
  assert.ok(differential>.01,'Surface points must not move as one rigid 2D plate');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(frames.length/seconds),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'EARTH_HYBRID_ORBITAL.mp4')],{input:Buffer.concat(frames)});
  fs.writeFileSync(path.join(out,'motion-report.json'),JSON.stringify({url,seconds,frames:frames.length,initial,final,displacements,differential,fallback,errors,
    recording:'Real CDP frames; performance measured separately without video capture. Hero angle only, not free orbit.'},null,2));
  console.log(JSON.stringify({seconds,frames:frames.length,differential,fallback,errors}));
})().catch(e=>{console.error(e);process.exitCode=1});
