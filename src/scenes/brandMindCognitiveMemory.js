import * as THREE from 'three';
import { getCamera } from '../engine/camera.js';

export function resolveCognitiveMemory(search='') {
  const q=new URLSearchParams(search),value=q.get('brandMindCognitiveV11');
  if(!['1','A','B'].includes(value))return null;
  return Object.freeze({variant:value==='A'?'A':'B',background:q.get('brandMindCognitiveBackground')!=='0'});
}
const TAU=Math.PI*2;
const noise=n=>{const v=Math.sin(n*127.13+43.73)*43758.5453;return v-Math.floor(v);};
const mix=THREE.MathUtils.lerp;
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const palette=['#d2e4ee','#729dbd','#7586ab','#a8c5d7'].map(c=>new THREE.Color(c));

// Pure art curves: finite, open sheets with wide voids. No business values.
export function cognitiveShellPoint(variant,layer,t,v,out=new THREE.Vector3()) {
  const angles=variant==='A'?[-.35,2.3,.8,3.8]:[.2,2.7,4.0,1.5];
  const angle=angles[layer]+t*(variant==='A'?3.75:2.55);
  const radius=(.52+layer*.13)*(1+(variant==='A'?.045:.15)*Math.sin(t*7+layer));
  const width=(variant==='A'?.105:.22)*Math.pow(Math.sin(Math.PI*t),.7)*(variant==='A'?1:.7+.3*Math.sin(t*9+layer));
  const r=radius+(v-.5)*width*2;
  out.set(Math.cos(angle)*r*(variant==='A'?1.18:.94),
    Math.sin(angle)*r*(variant==='A'?.61:.87)+(layer-1.5)*.09,
    Math.sin(angle+.7+layer*.43)*r*.44+(layer-1.5)*.075);
  out.z+=(v-.5)*.1*Math.sin(t*7+layer);
  if(variant==='B'){out.x+=Math.sin(t*5+layer)*.11;out.y+=Math.sin(t*8+layer)*.06;out.z+=Math.cos(t*4+layer)*.12;}
  return out;
}
function particleBatch(name,records,{motion=.018,alpha=1}={}) {
  const geometry=new THREE.BufferGeometry(),positions=[],colors=[],data=[],owners=[];
  records.forEach((r,i)=>{positions.push(...r.p);const c=r.c||palette[i%palette.length];colors.push(c.r,c.g,c.b);data.push(r.size??.012,r.alpha??.65,noise(i+71)*TAU,r.soft??0);owners.push(r.owner??-1);});
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('aData',new THREE.Float32BufferAttribute(data,4));
  geometry.setAttribute('aOwner',new THREE.Float32BufferAttribute(owners,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,vertexColors:true,
    blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uReveal:{value:0},uHeight:{value:900},uDpr:{value:1},uMotion:{value:motion},uAlpha:{value:alpha},uNodes:{value:Array.from({length:16},()=>new THREE.Vector3())}},
    vertexShader:`attribute vec4 aData;attribute float aOwner;uniform float uTime,uReveal,uHeight,uDpr,uMotion,uAlpha;uniform vec3 uNodes[16];varying vec3 vColor;varying float vAlpha,vSoft;
    void main(){vec3 p=position;float phase=aData.z; p+=uMotion*vec3(sin(uTime*.073+phase),cos(uTime*.057+phase*1.3),sin(uTime*.043+phase*.7));if(aOwner>=0.)p+=uNodes[int(aOwner+.5)];vec4 mv=modelViewMatrix*vec4(p,1.);float scale=length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aData.x*scale*uHeight*uDpr*projectionMatrix[1][1]/max(.3,-mv.z),1.,72.*uDpr);vColor=color;vAlpha=aData.y*uReveal*uAlpha*(.94+.06*sin(uTime*.18+phase));vSoft=aData.w;}`,
    fragmentShader:`varying vec3 vColor;varying float vAlpha,vSoft;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float shape=mix(exp(-r*r*5.)*(1.-smoothstep(.68,1.,r)),exp(-r*r*3.)*(1.-smoothstep(.4,1.,r)),vSoft);gl_FragColor=vec4(vColor,shape*vAlpha);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')});
  const points=new THREE.Points(geometry,material);points.name=name;points.frustumCulled=false;points.raycast=()=>{};
  const size=new THREE.Vector2();points.onBeforeRender=r=>{r.getSize(size);material.uniforms.uHeight.value=size.y;material.uniforms.uDpr.value=r.getPixelRatio();};
  return{points,material,geometry,dispose(){geometry.dispose();material.dispose();}};
}
function makeMembranes(variant) {
  const positions=[],uv=[],layers=[];const tmp=new THREE.Vector3();
  const push=(l,t,v)=>{cognitiveShellPoint(variant,l,t,v,tmp);positions.push(...tmp.toArray());uv.push(t,v);layers.push(l);};
  for(let l=0;l<4;l++)for(let i=0;i<100;i++){
    const t=i/100;
    for(let j=0;j<6;j++){const a=j/6,b=(j+1)/6,n=(i+1)/100;push(l,t,a);push(l,n,a);push(l,t,b);push(l,t,b);push(l,n,a);push(l,n,b);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('aLayer',new THREE.Float32BufferAttribute(layers,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false,
    uniforms:{uTime:{value:0},uReveal:{value:0}},
    vertexShader:`attribute float aLayer;uniform float uTime;varying vec2 vUv;varying float vLayer;void main(){vUv=uv;vLayer=aLayer;vec3 p=position;p.z+=sin(uv.x*7.+uTime*.08+aLayer)*.012;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float uTime,uReveal;varying vec2 vUv;varying float vLayer;void main(){float edge=pow(max(0.,sin(vUv.y*3.14159)),2.4);float ends=smoothstep(0.,.15,vUv.x)*(1.-smoothstep(.77,1.,vUv.x));float folds=.5+.5*sin(vUv.x*17.+sin(vUv.y*8.+vLayer)*2.);float gaps=1.-.95*exp(-pow((vUv.x-.34-vLayer*.017)*22.,2.));gaps*=1.-.93*exp(-pow((vUv.x-.77+vLayer*.023)*21.,2.));float variation=.55+.45*sin(vUv.x*8.+vLayer)*sin(vUv.x*11.-vLayer);vec3 c=mix(vec3(.10,.15,.26),vec3(.44,.62,.72),folds);c=mix(c,vec3(.28,.22,.39),vLayer*.065);gl_FragColor=vec4(c,edge*ends*gaps*variation*uReveal*.29);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='BrandMindCognitiveVeil';mesh.raycast=()=>{};return{mesh,material,dispose(){geometry.dispose();material.dispose();}};
}
function makeEnvironment(variant) {
  const records=[];for(let i=0;i<220;i++)records.push({p:[(noise(i*7+20)-.5)*12,(noise(i*13+44)-.5)*7,-2-noise(i*3+18)*4],size:.008+noise(i)*.012,alpha:.14+noise(i*19)*.18,c:palette[1]});
  const stars=particleBatch('BrandMindCognitiveVoid',records,{motion:.008});
  const geometry=new THREE.PlaneGeometry(11,7),material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,
    uniforms:{uTime:{value:0},uReveal:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uTime,uReveal;float blob(vec2 p,vec2 c,vec2 s){return exp(-dot((p-c)*s,(p-c)*s));}void main(){vec2 p=vUv;float a=blob(p,vec2(.32,.54),vec2(4.,6.));float b=blob(p,vec2(.67,.48),vec2(5.,4.));float c=blob(p,vec2(.51,.68),vec2(5.,8.));float grain=.8+.2*sin(p.x*29.+sin(p.y*15.)*2.+uTime*.012);float f=(a*.55+b*.37+c*.25)*grain;float edge=smoothstep(0.,.15,p.x)*smoothstep(0.,.15,1.-p.x)*smoothstep(0.,.15,p.y)*smoothstep(0.,.15,1.-p.y);gl_FragColor=vec4(mix(vec3(.019,.029,.058),vec3(.041,.032,.068),b),f*edge*uReveal*.37);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
  const cloud=new THREE.Mesh(geometry,material);cloud.name='BrandMindMemoryCloud';cloud.position.z=-3.2;cloud.raycast=()=>{};
  return{stars,cloud,material,dispose(){stars.dispose();geometry.dispose();material.dispose();}};
}

export function createCognitiveMemoryScene(config,registry,interactionTarget,label=null) {
  const group=new THREE.Group();group.name='BrandMindScene';group.position.set(0,-.06,-.82);
  const variant=config.variant,volume=config.volumeCore,core=new THREE.Group();core.name='BrandMindMindCore';
  if(label)group.add(label.sprite);
  const hit=new THREE.Mesh(new THREE.SphereGeometry(.61,24,18),new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}));hit.name='BrandMindCoreVolume';core.add(hit);
  if(volume){core.add(volume.mesh);hit.scale.set(...volume.axes.map(a=>a*.89/.61));hit.rotation.copy(volume.mesh.rotation);}
  const nodeMap=new Map(),pathMap=new Map(),definitions=new Map(),nodeRecords=[];
  registry.nodes.forEach((d,slot)=>{
    const node=new THREE.Group();node.name=d.visualId;node.userData.visualId=d.visualId;node.userData.associationId=null;
    const position=new THREE.Vector3(d.position[0]*(variant==='A'?.95:.88),d.position[1]*.81,d.position[2]);
    definitions.set(d.visualId,{...d,slot,base:position});node.position.copy(position);nodeMap.set(d.visualId,node);group.add(node);
    const identitySeed=[...d.visualId].reduce((n,c)=>n*1.17+c.charCodeAt(0),0);
    for(let i=0;i<160;i++){const t=noise(i*3.9+identitySeed*11),a=noise(i*5.1+identitySeed)*TAU,rad=Math.pow(noise(i*9.7+identitySeed*21),.78)*d.scale;
      const k=i%3,clump=(k-1)*d.scale*.21;const p=[Math.cos(a)*rad*.52+clump,Math.sin(a)*rad*.34+Math.sin(t*5)*d.scale*.13,(t-.5)*rad*1.45];
      const bright=i%41===0;nodeRecords.push({p,owner:slot,size:bright?.016:.006+noise(i+identitySeed)*.006,alpha:(d.depth==='far'?.43:.72)*(bright?1:.7),c:bright?palette[0]:palette[(i%7===0)?2:1]});
    }
  });
  const knots=particleBatch('BrandMindMemoryKnots',nodeRecords,{motion:.007});group.add(knots.points);
  const coreRecords=[];for(let i=0;i<(volume?0:1800);i++){
    const layer=i%4,t=noise(i*2.37),v=noise(i*4.13);let p;
    if(i<1000){const a=(t-.5)*2,phase=layer*1.05;p=[a*(.25+layer*.042)+.035,Math.sin(a*2.35+phase)*(.105+layer*.031)+(v-.5)*.046,Math.cos(a*2.1+phase)*.14+(v-.5)*.03];}
    else {const point=cognitiveShellPoint(variant,layer,t,v);p=point.toArray();p[0]+=(noise(i*17)-.5)*.04;p[1]+=(noise(i*19)-.5)*.04;}
    const hero=i%173===0,gaps=(1-.95*Math.exp(-Math.pow((t-.34-layer*.017)*22,2)))*(1-.93*Math.exp(-Math.pow((t-.77+layer*.023)*21,2)));
    coreRecords.push({p,size:hero?.018:(i<1000?.007:.0045)+noise(i*23)*.005,alpha:(hero?.9:i<1000?.66:.36)*(i<1000?1:gaps),c:hero?palette[0]:i<1000?palette[3]:palette[i%11===0?2:1]});
  }
  const nuclei=volume?null:particleBatch('BrandMindCognitiveNucleusAndShell',coreRecords,{motion:.004});if(nuclei)core.add(nuclei.points);
  const membranes=volume?null:makeMembranes(variant);if(membranes)core.add(membranes.mesh);group.add(core);
  const haloRecords=[];for(let i=0;i<(volume?0:720);i++){
    const layer=i%3,t=noise(i*3.73),angle=(variant==='A'?-.5:.3)+layer*1.85+t*1.8;
    const r=.85+layer*.36+noise(i*7.9)*.24;
    haloRecords.push({p:[Math.cos(angle)*r*1.18,Math.sin(angle)*r*.74,(-.3-layer*.36)+Math.sin(angle*1.2)*.22],size:.0045+noise(i*9.2)*.007,alpha:.16+noise(i*5.2)*.21,c:palette[i%7===0?2:1]});
  }
  const halo=particleBatch('BrandMindBrokenMemoryHalo',haloRecords,{motion:.012});group.add(halo.points);
  const environment=makeEnvironment(variant);group.add(environment.cloud,environment.stars.points);environment.cloud.visible=environment.stars.points.visible=config.background;
  // Existing THREE visual edges only. Keys explicitly retain their endpoints.
  const flowPositions=[],flowColors=[],flowT=[],flowOwners=[];const flowNodes=[];
  registry.paths.forEach((d,i)=>{
    if(!nodeMap.has(d.targetVisualId)||d.sourceVisualId!=='BrandMindCoreVolume')throw new Error('Unknown existing visual path endpoint');
    const holder=new THREE.Group();holder.name=d.visualId;holder.userData.sourceVisualId=d.sourceVisualId;holder.userData.targetVisualId=d.targetVisualId;
    const key=d.sourceVisualId+'>'+d.targetVisualId;pathMap.set(key,holder);group.add(holder);flowNodes.push(definitions.get(d.targetVisualId).slot);
    for(let j=0;j<96;j++){flowPositions.push(0,0,0);flowT.push(j/95);flowOwners.push(i);const c=palette[i%3+1];flowColors.push(c.r,c.g,c.b);}
  });
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(flowPositions,3));fg.setAttribute('color',new THREE.Float32BufferAttribute(flowColors,3));fg.setAttribute('aT',new THREE.Float32BufferAttribute(flowT,1));fg.setAttribute('aPath',new THREE.Float32BufferAttribute(flowOwners,1));
  const fm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,vertexColors:true,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uReveal:{value:0},uHeight:{value:900},uDpr:{value:1},uEnds:{value:flowNodes.map(()=>new THREE.Vector3())}},
    vertexShader:`attribute float aT,aPath;uniform float uTime,uReveal,uHeight,uDpr;uniform vec3 uEnds[3];varying vec3 vColor;varying float vAlpha;void main(){float t=aT;vec3 end=uEnds[int(aPath+.5)];vec3 p=end*t;p.y+=sin(t*3.14159)*(.13+aPath*.045);p.z+=sin(t*3.14159)*(.14-aPath*.17);float cycle=mod(uTime*.043+aPath*.31,1.42);float packet=exp(-pow((t-cycle)*38.,2.));float gap=smoothstep(.3,.65,.5+.5*sin(t*47.+aPath*2.));float edge=smoothstep(.22,.39,t)*(1.-smoothstep(.9,1.,t));vAlpha=uReveal*edge*(.16*gap+packet*.88);vColor=mix(color,vec3(.72,.86,.92),packet*.6);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=max(1.,(.006+packet*.012)*length(modelViewMatrix[0].xyz)*uHeight*uDpr*projectionMatrix[1][1]/max(.3,-mv.z));}`,
    fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(vColor,exp(-r*r*5.)*(1.-smoothstep(.65,1.,r))*vAlpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
  const flow=new THREE.Points(fg,fm);flow.name='BrandMindCognitiveFibers';flow.frustumCulled=false;flow.raycast=()=>{};group.add(flow);
  if(config.coreOnly){knots.points.visible=false;halo.points.visible=false;flow.visible=false;environment.stars.points.visible=false;environment.cloud.visible=false;if(label)label.sprite.visible=false;}
  const flowSize=new THREE.Vector2();flow.onBeforeRender=r=>{r.getSize(flowSize);fm.uniforms.uHeight.value=flowSize.y;fm.uniforms.uDpr.value=r.getPixelRatio();};
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),reference=new THREE.Vector3(0,-.06,-.82),fitTarget=reference.clone(),fitTemp=new THREE.Vector3();
  const motion=globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)');
  let panelOpen=false,panelMix=0,clock=0,disposed=false,sample=null,fitScale=1;
  const batches=[nuclei,knots,halo,environment.stars].filter(Boolean);
  function fitPanel(){const camera=getCamera();if(!camera)return;const w=window.innerWidth,h=window.innerHeight;
    const panel=document.querySelector('.brandmind-data-panel'),right=panel?.getBoundingClientRect().left||w*.35;
    const center=fitTemp.copy(reference).applyMatrix4(camera.matrixWorldInverse),depth=-center.z,radius=2.35,pad=24;
    const half=Math.max(30,Math.min((right-pad*2)/2,(h-100)/2)),focal=camera.projectionMatrix.elements[5]*h/2;
    fitScale=Math.min(.76,half*depth/(radius*(focal+half)));
    center.x=(right*.5/w*2-1)*depth/camera.projectionMatrix.elements[0];center.y=0;fitTarget.copy(center.applyMatrix4(camera.matrixWorld));
  }
  function update(renderState,delta,time,progress=1){if(disposed)return;const dt=Math.max(0,delta),reveal=smooth((progress-.06)/.88);
    if(sample!==null)clock=sample;else if(!panelOpen&&!motion?.matches&&(!volume||!globalThis.document?.hidden))clock+=dt;
    panelMix+=(Number(panelOpen)-panelMix)*(1-Math.exp(-dt*12));if(panelOpen)fitPanel();
    group.visible=progress>.001;group.position.copy(reference).lerp(fitTarget,panelMix);group.scale.setScalar((.78+reveal*.22)*mix(1,fitScale,panelMix));
    group.rotation.set(Math.sin(clock*.013+.8)*.008,Math.sin(clock*.018)*.018,0);
    core.rotation.y=Math.sin(clock*.023)*.022;core.rotation.z=Math.sin(clock*.017)*.018;
    for(const [id,d]of definitions){const node=nodeMap.get(id);node.position.copy(d.base);node.position.x+=Math.sin(clock*.031+d.phase)*.022;node.position.y+=Math.sin(clock*.023+d.phase*1.3)*.018;node.position.z+=Math.cos(clock*.019+d.phase)*.022;knots.material.uniforms.uNodes.value[d.slot].copy(node.position);}
    registry.paths.forEach((d,i)=>fm.uniforms.uEnds.value[i].copy(nodeMap.get(d.targetVisualId).position));
    for(const b of batches){b.material.uniforms.uTime.value=clock;b.material.uniforms.uReveal.value=reveal;}
    halo.points.rotation.y=Math.sin(clock*.011)*.018;if(membranes){membranes.material.uniforms.uTime.value=clock;membranes.material.uniforms.uReveal.value=reveal;}volume?.update(clock,reveal);
    environment.material.uniforms.uTime.value=clock;environment.material.uniforms.uReveal.value=reveal*(1-panelMix*.6);environment.stars.material.uniforms.uReveal.value=reveal*(1-panelMix*.6);
    fm.uniforms.uTime.value=clock;fm.uniforms.uReveal.value=reveal;if(label)label.material.opacity=smooth((reveal-.72)/.24)*.54;renderState.exposure+=reveal*.008;
  }
  const read=()=>({variant,volume:volume?{variant:volume.config.variant,steps:volume.config.steps,axes:volume.axes}:null,clock,panelOpen,panelMix,fitScale,particleCount:recordsCount(),visualNodeIds:[...nodeMap.keys()],visualPathKeys:[...pathMap.keys()],canonicalRegistryStatus:'NEEDS_STABLE_REGISTRY_HOOK',nodes:[...nodeMap].map(([id,n])=>({id,position:n.position.toArray()}))});
  function recordsCount(){return batches.reduce((n,b)=>n+b.geometry.attributes.position.count,0)+fg.attributes.position.count;}
  const review={read,sample(value){if(value!==null&&(!Number.isFinite(value)||value<0))throw new Error('Invalid sample time');sample=value;},layers(interior,surface){volume?.layers(interior,surface);},background(on){environment.cloud.visible=environment.stars.points.visible=!!on;}};
  if(import.meta.env?.DEV&&['brandMindCognitiveReview','brandMindVolumeReview'].some(key=>new URLSearchParams(window.location.search).get(key)==='1')){group.userData.cognitiveReview=review;window.__BRANDMIND_COGNITIVE_REVIEW__=review;}
  return{name:'BrandMindScene',group,isShell:false,primaryInteractionTargetName:interactionTarget.objectName,
    getPrimaryInteractionTarget({x,y,camera}){if(disposed||!group.visible||!camera||!Number.isFinite(x)||!Number.isFinite(y))return null;camera.updateMatrixWorld();group.updateWorldMatrix(true,true);pointer.set(x,y);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObject(hit,false).length?interactionTarget:null;},
    setPanelPresentationOpen(value){panelOpen=!!value;},getPanelPresentationState:()=>({open:panelOpen,progress:panelMix,position:group.position.toArray(),scale:group.scale.x}),
    resolveVisualNode:id=>disposed?null:nodeMap.get(id)||null,
    resolveVisualPath:(source,target)=>disposed?null:pathMap.get(source+'>'+target)||null,
    readVisualRegistry:read,update,
    dispose(){if(disposed)return;disposed=true;for(const b of batches)b.dispose();membranes?.dispose();volume?.dispose();environment.cloud.geometry.dispose();environment.material.dispose();fg.dispose();fm.dispose();hit.geometry.dispose();hit.material.dispose();label?.dispose();nodeMap.clear();pathMap.clear();group.clear();if(globalThis.window?.__BRANDMIND_COGNITIVE_REVIEW__===review)delete window.__BRANDMIND_COGNITIVE_REVIEW__;delete group.userData.cognitiveReview;}
  };
}
