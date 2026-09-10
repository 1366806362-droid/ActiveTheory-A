// Export the actual Three.js frame into Blender; no camera or art edits.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,process.env.EARTH_REF_OUT||'art/earth-v13/ground-truth-1');
const base=process.env.EARTH_REF_BASE||'http://127.0.0.1:5186/';
const query='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthAudit=1&earthFreeze=1';
(async()=>{
  fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true});
  try{
    const p=await b.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    for(const mode of ['HOME','CLOSEUP']){
      await p.goto(base+'?'+query+(process.env.EARTH_REF_EXTRA||'')+(mode==='CLOSEUP'?'&debugEarthV3Closeup=1':''),{waitUntil:'networkidle'});
      await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_V3__?.textureStatus==='ready');
      await p.mouse.move(800,450);await p.waitForTimeout(700);
      const data=await p.evaluate(async()=>{
        const scene=(await import('/src/engine/scenes.js')).getActiveScene();
        const camera=(await import('/src/engine/camera.js')).getCamera();
        const THREE=await import('/node_modules/three/build/three.module.js');
        scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
        const earth=scene.getObjectByName('EarthRoot');
        const names=['EarthTextureSurface','EarthTextureCityLights','EarthTextureClouds','EarthAtmosphereRim'];
        const meshes=names.map(name=>{const m=scene.getObjectByName(name),g=m.geometry;
          return {name,matrix:m.matrixWorld.toArray(),positions:Array.from(g.attributes.position.array),uv:Array.from(g.attributes.uv.array),indices:Array.from(g.index.array)};});
        return {viewport:[1600,900],camera:{matrix:camera.matrixWorld.toArray(),fov:camera.fov,aspect:camera.aspect},
          earth:{matrix:earth.matrixWorld.toArray(),position:earth.getWorldPosition(new THREE.Vector3()).toArray(),scale:earth.getWorldScale(new THREE.Vector3()).toArray()},
          sun:new THREE.Vector3(.72,.56,-.44).normalize().transformDirection(camera.matrixWorld).toArray(),meshes};
      });
      fs.writeFileSync(path.join(out,mode.toLowerCase()+'-frame.json'),JSON.stringify(data));
      await p.screenshot({path:path.join(out,'WEB_REFERENCE_'+mode+'.png')});
    }
    if(errors.length)throw new Error(errors.join('\n'));
  }finally{await b.close()}
  console.log(out);
})().catch(e=>{console.error(e);process.exitCode=1});
