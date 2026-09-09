import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { getCamera } from '../engine/camera.js';

export function readEarthCinematicHybrid(search=''){
  const p=new URLSearchParams(search);
  return p.get('earthHybrid')==='1'&&p.get('earthV2')==='1'&&p.get('earthV3')==='1';
}

export function decodeEarthHybridMesh(vertexBuffer,indexBuffer,manifest){
  const data=new Float32Array(vertexBuffer),indices=new Uint32Array(indexBuffer);
  if(data.length!==manifest.vertices*5||indices.length!==manifest.indices)throw new Error('Hybrid mesh size mismatch');
  if(!data.every(Number.isFinite)||indices.some(i=>i>=manifest.vertices))throw new Error('Invalid hybrid depth mesh');
  const positions=new Float32Array(manifest.vertices*3),uv=new Float32Array(manifest.vertices*2);
  for(let i=0;i<manifest.vertices;i++){
    positions.set(data.subarray(i*5,i*5+3),i*3);uv.set(data.subarray(i*5+3,i*5+5),i*2);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(new THREE.BufferAttribute(indices,1));g.computeVertexNormals();g.computeBoundingSphere();
  return g;
}

export function createEarthCinematicHybrid(root,{search='',fallbackGroups=[],atmosphere=null}={}){
  const params=new URLSearchParams(search),debug=params.get('earthHybridDebug');
  const group=new THREE.Group();group.name='EarthCinematicHybrid';group.visible=false;root.add(group);
  const base='/textures/hero/earth/hybrid-v1/',abort=new AbortController();
  let disposed=false,ready=false,error=null,time=0,geometry=null,body=null,cloud=null,aligned=false;
  let diagnostic=null;const previousDiagnostic=window.__ACTIVE_THEORY_EARTH_HYBRID__;
  const textures=[];const originals=fallbackGroups.map(g=>[g,g.visible]);
  const atmosphereVisible=atmosphere?.visible;
  const referenceView=new THREE.Vector3(),currentView=new THREE.Vector3();
  const common=/*glsl*/`varying vec2 vUv;varying vec3 vLocal;
    vec3 orbitalGrade(vec3 c){float y=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(y)*vec3(.83,.94,1.08),c,.30);}`;
  const vertex=/*glsl*/`varying vec2 vUv;varying vec3 vLocal;void main(){vUv=uv;vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const load=async file=>{const r=await fetch(base+file,{signal:abort.signal});if(!r.ok)throw new Error('Hybrid asset '+file+': '+r.status);return r;};
  const texture=async file=>{
    const t=new EXRLoader().parse(await(await load(file)).arrayBuffer());
    if(disposed||abort.signal.aborted)throw new Error('Hybrid load cancelled');
    const map=new THREE.DataTexture(t.data,t.width,t.height,t.format,t.type);
    map.colorSpace=THREE.LinearSRGBColorSpace;map.flipY=false;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
    map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;textures.push(map);return map;
  };
  const promise=(async()=>{
    try{
      const manifest=await(await load('manifest.json')).json();
      const [v,i,s,c,w]=await Promise.all([load('earth-hybrid-body-mesh.bin').then(r=>r.arrayBuffer()),load('earth-hybrid-body-index.bin').then(r=>r.arrayBuffer()),
        texture('earth-hybrid-surface.exr'),texture('earth-hybrid-city.exr'),texture('earth-hybrid-cloud.exr')]);
      if(disposed){textures.forEach(t=>t.dispose());return;}
      geometry=decodeEarthHybridMesh(v,i,manifest);
      const sun=new THREE.Vector3().fromArray(manifest.sunLocal).normalize();
      const referenceCamera=new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(manifest.cameraLocal));
      const worldScale=new THREE.Vector3().setFromMatrixScale(new THREE.Matrix4().fromArray(manifest.earthWorld)).x;
      const material=new THREE.ShaderMaterial({name:'EarthHybrid-DepthBody',vertexShader:vertex,
        uniforms:{uSurface:{value:s},uCity:{value:c},uSun:{value:sun},uReferenceCamera:{value:referenceCamera},
          uDepthRange:{value:new THREE.Vector2(manifest.depthNear/worldScale,manifest.depthFar/worldScale)},
          uDebug:{value:debug==='depth'?1:['cloud','atmosphere'].includes(debug)?2:debug==='city'?3:debug==='surface'?4:0}},
        fragmentShader:common+/*glsl*/`uniform sampler2D uSurface,uCity;uniform vec3 uSun,uReferenceCamera;uniform vec2 uDepthRange;uniform float uDebug;
          void main(){vec4 s=texture2D(uSurface,vUv),c=texture2D(uCity,vUv);if(s.a<.01)discard;
          vec3 N=normalize(vLocal);float night=1.-smoothstep(-.16,.16,dot(N,uSun));
          vec3 color=orbitalGrade(s.rgb/max(s.a,.01))+c.rgb*night;
          if(uDebug>.5&&uDebug<1.5)color=vec3(1.-clamp((length(vLocal-uReferenceCamera)-uDepthRange.x)/(uDepthRange.y-uDepthRange.x),0.,1.));
          if(uDebug>1.5&&uDebug<2.5)color=vec3(.001,.002,.004);
          if(uDebug>2.5&&uDebug<3.5)color=c.rgb*night;
          if(uDebug>3.5)color=orbitalGrade(s.rgb/max(s.a,.01));
          gl_FragColor=vec4(color,1.);}`,
        side:THREE.DoubleSide,depthWrite:true,fog:false});
      body=new THREE.Mesh(geometry,material);body.name='EarthHybridDepthBody';body.renderOrder=2;group.add(body);
      const cloudMaterial=new THREE.ShaderMaterial({name:'EarthHybrid-Cloud',vertexShader:vertex,
        uniforms:{uCloud:{value:w},uTime:{value:0}},fragmentShader:common+/*glsl*/`uniform sampler2D uCloud;uniform float uTime;
          void main(){float edge=1.-smoothstep(.31,.47,length(vUv-.5));
          vec2 drift=vec2(sin(uTime*.025)*.0010,sin(uTime*.019)*.0004)*edge;
          vec4 c=texture2D(uCloud,vUv+drift);if(c.a<.001)discard;
          // EXR associated alpha is converted exactly once for normal alpha blending.
          gl_FragColor=vec4(orbitalGrade(c.rgb/max(c.a,.001)),c.a);}`,
        transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false});
      cloud=new THREE.Mesh(geometry,cloudMaterial);cloud.name='EarthHybridCloud';cloud.scale.setScalar(1.00249);cloud.renderOrder=4;group.add(cloud);
      group.userData.referenceCamera=new THREE.Matrix4().fromArray(manifest.cameraLocal);
      group.userData.manifest=manifest;ready=true;
      diagnostic={ready:true,candidate:manifest.candidate,vertices:manifest.vertices,drawCalls:3,depth:'quantized 16-bit sphere-ray mesh',cameraLimited:true};
      window.__ACTIVE_THEORY_EARTH_HYBRID__=diagnostic;
    }catch(e){abort.abort();textures.forEach(t=>t.dispose());if(!disposed){error=e.message;diagnostic={ready:false,error,fallback:true};window.__ACTIVE_THEORY_EARTH_HYBRID__=diagnostic;}}
  })();
  return {group,promise,
    update(dt,camera){
      if(!ready||disposed)return;time+=Math.max(0,Math.min(dt,.1));
      camera??=getCamera();
      cloud.visible=!['depth','surface','city','atmosphere'].includes(debug);
      if(atmosphere)atmosphere.visible=!['depth','surface','city','cloud'].includes(debug);
      cloud.material.uniforms.uTime.value=time;
      // Debug-only re-centering keeps the baked hero view; not a free-orbit claim.
      if(!aligned&&params.get('debugEarthV3Closeup')==='1'&&camera){
        root.updateWorldMatrix(true,false);
        const ref=new THREE.Vector3().setFromMatrixPosition(group.userData.referenceCamera).normalize();
        const view=root.worldToLocal(camera.getWorldPosition(new THREE.Vector3())).normalize();
        group.quaternion.setFromUnitVectors(ref,view);aligned=true;
      }
      // A captured hero is not a free-orbit Earth. Outside its small supported view
      // cone, expose the retained real-time spheres instead of stretching the cap.
      let supported=true;
      if(camera&&!aligned){
        root.updateWorldMatrix(true,false);
        referenceView.setFromMatrixPosition(group.userData.referenceCamera).normalize();
        currentView.copy(camera.getWorldPosition(currentView));root.worldToLocal(currentView).normalize();
        supported=referenceView.dot(currentView)>=Math.cos(8*Math.PI/180);
      }
      group.visible=supported;
      for(const[g,visible]of originals)g.visible=supported?false:visible;
      diagnostic.fallback=!supported;
    },
    getStatus:()=>({ready,error,time}),
    dispose(){disposed=true;abort.abort();textures.forEach(t=>t.dispose());body?.material.dispose();cloud?.material.dispose();geometry?.dispose();
      for(const[g,visible]of originals)g.visible=visible;if(atmosphere)atmosphere.visible=atmosphereVisible;root.remove(group);
      if(window.__ACTIVE_THEORY_EARTH_HYBRID__===diagnostic){if(previousDiagnostic)window.__ACTIVE_THEORY_EARTH_HYBRID__=previousDiagnostic;else delete window.__ACTIVE_THEORY_EARTH_HYBRID__;}}
  };
}
