import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {cinematicCurve,dampCritical,earthHeroSession,heroLockPhases,readEarthHeroLock,createEarthHeroLock} from './earthHeroLock.js';
import {renderState} from '../engine/renderState.js';
import {getInteractionState} from './interaction.js';
const flags='earthHeroLock=1&earthHybrid=1&earthHybridProd=1&earthV2=1&earthV3=1&earthOrbital=1&earthV13=1';
test('explicit opt-in; historical paths are unchanged',()=>{
  assert.equal(readEarthHeroLock(''),null);assert.equal(readEarthHeroLock(flags),'B');
  for(const f of flags.split('&'))assert.equal(readEarthHeroLock(flags.replace(f,'')),null);
  assert.equal(readEarthHeroLock(flags+'&earthHeroStrategy=C'),'C');
});
test('three nonlinear curves are continuous, monotonic, odd and C1 at joins',()=>{
 for(const kind of ['smooth','tanh','piecewise']){
  let previous=-Infinity;for(let x=-3;x<=3;x+=.001){const y=cinematicCurve(x,kind);assert.ok(y>=previous);assert.ok(Math.abs(y+cinematicCurve(-x,kind))<1e-12);previous=y}
  for(const x of [.25,1]){const e=1e-6,l=(cinematicCurve(x,kind)-cinematicCurve(x-e,kind))/e,r=(cinematicCurve(x+e,kind)-cinematicCurve(x,kind))/e;assert.ok(Math.abs(l-r)<1e-4)}
  assert.ok(cinematicCurve(100,kind)<=1.100001);assert.equal(cinematicCurve(NaN,kind),0);
 }
});
test('critical response is invariant at 30/60/120 Hz, monotonic and rapidly settled',()=>{
 const ends=[];for(const hz of [30,60,120]){const s={x:0,v:0};let old=0;for(let n=0;n<hz/2;n++){dampCritical(s,1,1/hz);assert.ok(s.x>=old&&s.x<=1);old=s.x}ends.push(s.x);assert.ok(1-s.x<.0001)}
 assert.ok(Math.max(...ends)-Math.min(...ends)<1e-12);
});
test('rapid reversal has bounded inertia and no accumulated drift',()=>{
 const s={x:0,v:0};for(let n=0;n<7200;n++){dampCritical(s,n%120<60?1:-1,1/120);assert.ok(Math.abs(s.x)<=1.00001);assert.ok(Number.isFinite(s.v))}
 for(let n=0;n<120;n++)dampCritical(s,0,1/120);assert.ok(Math.abs(s.x)<1e-7);
});
test('surface phase is bounded while cloud retains independent long-term motion',()=>{
 const first=heroLockPhases(0,-1.7,0);assert.deepEqual(first,{surfaceAngle:-1.7,cloudAngle:0});
 for(const t of [30,60,600,3600,86400]){const p=heroLockPhases(t,-1.7,0);assert.ok(Math.abs(p.surfaceAngle+1.7)<=2.2*Math.PI/180+1e-12);assert.ok(Math.abs(p.cloudAngle)<2.37*Math.PI/180)}
 assert.notEqual(heroLockPhases(3600,-1.7,0).cloudAngle,heroLockPhases(3630,-1.7,0).cloudAngle);
});
test('scene recreation borrows session phase without another clock or listener',()=>{
 const session=earthHeroSession('B'),old=session.time;session.time=123;
 const root=new THREE.Group(),motion=new THREE.Group(),mesh=new THREE.Mesh();root.add(motion);motion.add(mesh);const before=mesh.onBeforeRender;
 const a=createEarthHeroLock(root,motion,mesh,{session});a.dispose();assert.equal(mesh.onBeforeRender,before);
 const b=createEarthHeroLock(root,motion,mesh);assert.equal(b.session.time,123);b.dispose();session.time=old;
 const source=readFileSync(new URL('./earthHeroLock.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/requestAnimationFrame\(|addEventListener\(|setInterval\(/);
 assert.doesNotMatch(source,/camera\.(?:position|quaternion|rotation)\.(?:set|copy|add)/);
});
test('late Earth transform leaves global camera and composition untouched; foreign camera bypasses it',()=>{
 const scene=new THREE.Scene(),hero=new THREE.Group(),universe=new THREE.Group(),root=new THREE.Group(),motion=new THREE.Group(),mesh=new THREE.Mesh();
 scene.add(hero);hero.add(universe);universe.add(root);root.add(motion);motion.add(mesh);root.position.set(-18.3,-12.4,.65);root.scale.setScalar(5.35);
 const c=new THREE.PerspectiveCamera(60,16/9,.1,1000),r=renderState;
 c.position.set(r.cameraPosition.x+r.cameraOffset.x,r.cameraPosition.y+r.cameraOffset.y,r.cameraPosition.z+r.cameraOffset.z);
 c.lookAt(r.cubePosition.x+r.cameraOffset.targetX,r.cubePosition.y+r.cameraOffset.targetY,r.cubePosition.z+r.cameraOffset.targetZ);c.updateMatrixWorld(true);scene.updateMatrixWorld(true);
 const renderer={domElement:{clientWidth:1600,clientHeight:900},info:{programs:[]}},cp=c.position.clone(),cq=c.quaternion.clone(),rp=root.position.clone();
 const input=getInteractionState(),old=input.targetX;input.targetX=.9;
 const lock=createEarthHeroLock(root,motion,mesh,{session:{time:0,x:{x:0,v:0},y:{x:0,v:0}}});lock.update(.5);mesh.onBeforeRender(renderer,scene,c);
 assert.equal(motion.userData.heroLock.active,true);assert.ok(motion.position.length()>0);assert.ok(motion.rotation.y!==0);
 assert.ok(c.position.equals(cp)&&c.quaternion.equals(cq)&&root.position.equals(rp));
 c.rotateY(.3);c.updateMatrixWorld(true);mesh.onBeforeRender(renderer,scene,c);assert.equal(motion.userData.heroLock.active,false);assert.equal(motion.position.length(),0);
 lock.dispose();input.targetX=old;
});
