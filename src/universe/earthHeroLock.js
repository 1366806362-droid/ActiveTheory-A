import * as THREE from 'three';
import { getInteractionState } from './interaction.js';
import { renderState } from '../engine/renderState.js';
import { resolveHomeRuntimeSearch } from './homeRuntimeProfile.js';

export const EARTH_HERO_STRATEGIES=Object.freeze({
  A:Object.freeze({curve:'smooth',damping:'exponential',xPixels:24,yPixels:11,orientation:.16,cloud:.015}),
  B:Object.freeze({curve:'tanh',damping:'critical',xPixels:20,yPixels:10,orientation:.65,cloud:.035}),
  C:Object.freeze({curve:'piecewise',damping:'critical',xPixels:13,yPixels:7,orientation:1.8,cloud:.06})
});
export function readEarthHeroLock(search=''){
  const p=new URLSearchParams(resolveHomeRuntimeSearch(search));
  if(!['earthHeroLock','earthHybrid','earthHybridProd','earthV2','earthV3','earthOrbital','earthV13'].every(k=>p.get(k)==='1'))return null;
  return Object.hasOwn(EARTH_HERO_STRATEGIES,p.get('earthHeroStrategy'))?p.get('earthHeroStrategy'):'B';
}
export function cinematicCurve(x,kind='tanh'){
  if(!Number.isFinite(x))return 0;
  const a=Math.abs(x),sign=Math.sign(x);
  if(kind==='smooth')return sign*(a<=1?a*(1.45-.45*a*a):1+.1*(1-Math.exp(1-a)));
  if(kind==='piecewise')return sign*(a<=.25?1.5*a:.375+.625*(1-Math.exp(-2.4*(a-.25))));
  return Math.tanh(1.8*x);
}
export function dampCritical(state,target,dt,omega=24){
  const t=Math.max(0,Number.isFinite(dt)?dt:0),d=state.x-target,c=state.v+omega*d,e=Math.exp(-omega*t);
  state.x=target+(d+c*t)*e;state.v=(state.v-omega*c*t)*e;return state.x;
}
// State snapshots persist only inside this application session; there is no
// independent timer, storage polling, listener or render loop.
const sessions=new Map();
export function earthHeroSession(key='B'){
  if(!sessions.has(key))sessions.set(key,{time:0,x:{x:0,v:0},y:{x:0,v:0}});
  return sessions.get(key);
}
export function heroLockPhases(time,surfaceInitial,cloudInitial){
  const t=Math.max(0,time),drift=THREE.MathUtils.degToRad(2.2)*Math.tanh(t/90);
  return {surfaceAngle:surfaceInitial-drift,cloudAngle:cloudInitial-drift-THREE.MathUtils.degToRad(.16)*Math.sin(t/35)};
}

export function createEarthHeroLock(root,motionRoot,surfaceMesh,{strategy='B',session=earthHeroSession(strategy),afterApply=()=>{}}={}){
  const p=EARTH_HERO_STRATEGIES[strategy],neutral=new THREE.PerspectiveCamera();
  const origin=new THREE.Vector3(),target=new THREE.Vector3(),pointerWorld=new THREE.Vector3(),parentOrigin=new THREE.Vector3(),look=new THREE.Vector3(),expected=new THREE.Vector3();
  const before=surfaceMesh.onBeforeRender,previousDiagnostic=typeof window==='undefined'?undefined:window.__ACTIVE_THEORY_EARTH_HERO_LOCK__;
  const diagnostic={strategy,active:false,finite:true};let enabled=true,disposed=false;
  surfaceMesh.onBeforeRender=function(renderer,scene,camera,...rest){
    before.call(this,renderer,scene,camera,...rest);if(disposed)return;
    const i=getInteractionState(),r=renderState;
    expected.set(r.cameraPosition.x+r.cameraOffset.x,r.cameraPosition.y+r.cameraOffset.y,r.cameraPosition.z+r.cameraOffset.z);
    neutral.copy(camera,false);neutral.position.copy(expected);
    look.set(r.cubePosition.x+r.cameraOffset.targetX,r.cubePosition.y+r.cameraOffset.targetY,r.cubePosition.z+r.cameraOffset.targetZ);
    neutral.lookAt(look);
    // Do not hide a debug/foreign camera change by following it with Earth.
    const ordinary=enabled&&camera.position.distanceTo(expected)<.02&&camera.quaternion.angleTo(neutral.quaternion)<.0001&&Math.abs(camera.fov-60)<.01
      &&root.parent?.parent?.scale.x>.999;
    motionRoot.position.set(0,0,0);motionRoot.rotation.set(0,0,0);
    let offsetX=0,offsetY=0;
    if(ordinary){
      root.updateWorldMatrix(true,false);root.getWorldPosition(origin);
      // UniverseRoot's known pointer translation is removed only for Earth.
      pointerWorld.set(i.parallaxX*.04,i.parallaxY*.025,0);
      const parent=root.parent.parent;
      parentOrigin.set(0,0,0).applyMatrix4(parent.matrixWorld);
      pointerWorld.applyMatrix4(parent.matrixWorld).sub(parentOrigin);origin.sub(pointerWorld);
      neutral.copy(camera,false);neutral.position.set(camera.position.x-i.parallaxX*.16,camera.position.y-i.parallaxY*.065,camera.position.z-i.strength*.085);
      look.set(r.cubePosition.x+r.cameraOffset.targetX-i.parallaxX*.075,r.cubePosition.y+r.cameraOffset.targetY-i.parallaxY*.045,r.cubePosition.z+r.cameraOffset.targetZ);
      neutral.lookAt(look);neutral.updateMatrixWorld(true);
      target.copy(origin).project(neutral);
      const h=renderer.domElement.clientHeight||900,w=renderer.domElement.clientWidth||1600;
      offsetX=session.x.x*p.xPixels*h/900;offsetY=-session.y.x*p.yPixels*h/900;
      target.x+=offsetX*2/w;target.y-=offsetY*2/h;
      target.unproject(camera);root.worldToLocal(target);
      if([target.x,target.y,target.z].every(Number.isFinite)){
        motionRoot.position.copy(target);motionRoot.rotation.set(THREE.MathUtils.degToRad(session.y.x*p.orientation*.45),THREE.MathUtils.degToRad(-session.x.x*p.orientation),0);
      }else diagnostic.finite=false;
    }
    motionRoot.updateMatrixWorld(true);afterApply(camera);
    motionRoot.getWorldPosition(origin).project(camera);
    Object.assign(diagnostic,{active:ordinary,input:[i.targetX,i.targetY],response:[session.x.x,session.y.x],offsetPx:[offsetX,offsetY],
      orientationDegrees:[session.y.x*p.orientation*.45,-session.x.x*p.orientation],cloudPointerDegrees:session.x.x*p.cloud,
      localPosition:motionRoot.position.toArray(),screen:[(origin.x+1)*renderer.domElement.clientWidth/2,(1-origin.y)*renderer.domElement.clientHeight/2],programs:renderer.info.programs.length,sharedClock:session.time});
    motionRoot.userData.heroLock=diagnostic;
    if(typeof window!=='undefined')window.__ACTIVE_THEORY_EARTH_HERO_LOCK__=diagnostic;
  };
  return {session,update(dt,active=true){
    enabled=active;const i=getInteractionState();
    for(const [state,value]of [[session.x,active?i.targetX:0],[session.y,active?i.targetY:0]]){
      const target=cinematicCurve(value,p.curve);
      if(p.damping==='critical')dampCritical(state,target,dt);
      else {state.x+=(target-state.x)*(1-Math.exp(-14*Math.max(0,dt)));state.v=0;}
    }
  },cloudOffset:()=>THREE.MathUtils.degToRad(session.x.x*p.cloud),
  dispose(){disposed=true;surfaceMesh.onBeforeRender=before;
    if(typeof window!=='undefined'&&window.__ACTIVE_THEORY_EARTH_HERO_LOCK__===diagnostic){
      if(previousDiagnostic)window.__ACTIVE_THEORY_EARTH_HERO_LOCK__=previousDiagnostic;else delete window.__ACTIVE_THEORY_EARTH_HERO_LOCK__;
    }
  }};
}
