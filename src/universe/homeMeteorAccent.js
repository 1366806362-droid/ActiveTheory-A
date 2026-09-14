import * as THREE from 'three';

export const HOME_METEOR_TIMING = Object.freeze({ minInterval: 17, maxInterval: 29, duration: 1.15 });
// Screen-relative deep-space corridors, outside the frozen composition bodies.
export const HOME_METEOR_PATHS = Object.freeze([
  [[.53,.065],[.64,.105]], [[.74,.07],[.84,.13]], [[.62,.93],[.73,.965]]
]);
export function resolveHomeMeteorAccent(search='') {
  const value=new URLSearchParams(search).get('homeMeteors');
  return value!=='0'&&value!=='false';
}
export function meteorPathClear(path, rectangles) {
  const minX=Math.min(path[0][0],path[1][0])-.055,maxX=Math.max(path[0][0],path[1][0])+.012;
  const minY=Math.min(path[0][1],path[1][1])-.025,maxY=Math.max(path[0][1],path[1][1])+.012;
  return rectangles.every(r=>maxX<r[0]||minX>r[2]||maxY<r[1]||minY>r[3]);
}

export function createMeteorClock(seed=27183) {
  let rng=seed|0,remaining=0,age=-1,enabled=false,lastTime=null,sequence=0;
  const random=()=>((rng=Math.imul(rng,1664525)+1013904223|0)>>>0)/4294967296;
  const schedule=()=>{remaining=17+random()*12;age=-1;};
  return {update(delta,time,active,hidden,reduced,trigger=false){
    const allowed=active&&!hidden&&!reduced;
    const gap=lastTime!==null&&time-lastTime>.5;lastTime=time;
    if(!allowed){enabled=false;age=-1;return {phase:-1,start:false,sequence};}
    if(!enabled||gap){enabled=true;schedule();}
    let start=false;
    if(trigger&&age<0){age=0;start=true;sequence++;}
    else if(age<0){remaining-=Math.min(.05,Math.max(0,delta));if(remaining<=0){age=0;start=true;sequence++;}}
    else {age+=Math.min(.05,Math.max(0,delta));if(age>HOME_METEOR_TIMING.duration)schedule();}
    return {phase:age<0?-1:age/HOME_METEOR_TIMING.duration,start,sequence,remaining};
  }, cancel(){age=-1;remaining=17+random()*12;}};
}

export function createHomeMeteorAccent({seed=27183,exclusions=()=>[]}={}) {
  const clock=createMeteorClock(seed),motion=globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const geometry=new THREE.PlaneGeometry(1,1);
  const uniforms={uStart:{value:new THREE.Vector2()},uEnd:{value:new THREE.Vector2()},uPhase:{value:0},uAspect:{value:16/9}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,fog:false,
    vertexShader:`uniform vec2 uStart,uEnd;uniform float uPhase,uAspect;varying vec2 vUv;
      void main(){vUv=uv;vec2 a=uStart*vec2(2.,-2.)+vec2(-1.,1.),b=uEnd*vec2(2.,-2.)+vec2(-1.,1.);vec2 head=mix(a,b,uPhase);vec2 dir=normalize((b-a)*vec2(uAspect,1.));vec2 tangent=dir/vec2(uAspect,1.),normal=vec2(-dir.y,dir.x)/vec2(uAspect,1.);vec2 p=head+tangent*(uv.x-1.)*.072+normal*(uv.y-.5)*.008;gl_Position=vec4(p,.998,1.);}`,
    fragmentShader:`uniform float uPhase;varying vec2 vUv;void main(){float cross=abs(vUv.y-.5)*2.;float width=mix(.10,.65,pow(vUv.x,1.5));float tail=pow(vUv.x,2.2)*(1.-smoothstep(width*.1,width,cross));float head=exp(-pow((vUv.x-.96)*26.,2.)-pow(cross*3.,2.));float envelope=smoothstep(0.,.18,uPhase)*(1.-smoothstep(.65,1.,uPhase));gl_FragColor=vec4(vec3(.47,.62,.79),(.35*tail+.58*head)*envelope);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='HomeSubtleMeteor';mesh.frustumCulled=false;mesh.visible=false;mesh.raycast=()=>{};
  let pending=false,last={phase:-1},path=null,disposed=false;
  const debug={triggerOnce(){if(!disposed)pending=true;},read:()=>({...last,path,normalInterval:[17,29],duration:1.15})};
  return {mesh,debug,update(delta,time,active){
    if(disposed)return;
    last=clock.update(delta,time,active,globalThis.document?.hidden===true,motion?.matches===true,pending);pending=false;
    if(last.start){const blocked=exclusions();const candidates=HOME_METEOR_PATHS.filter(p=>meteorPathClear(p,blocked));path=candidates.length?candidates[last.sequence%candidates.length]:null;
      if(!path){clock.cancel();mesh.visible=false;return;}uniforms.uStart.value.fromArray(path[0]);uniforms.uEnd.value.fromArray(path[1]);}
    uniforms.uPhase.value=Math.max(0,last.phase);uniforms.uAspect.value=(globalThis.window?.innerWidth||1600)/(globalThis.window?.innerHeight||900);mesh.visible=last.phase>=0&&!!path;
  },dispose(){disposed=true;geometry.dispose();material.dispose();mesh.removeFromParent();}};
}
