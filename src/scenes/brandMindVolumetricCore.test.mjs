import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {resolveVolumetricCore,volumeRayInterval,integrateHomogeneousMedium,createVolumetricCore,COGNITIVE_VOLUME_AXES} from './brandMindVolumetricCore.js';
import {createCognitiveMemoryScene} from './brandMindCognitiveMemory.js';
import {BRAND_MIND_ART_REGISTRY as registry,BRAND_MIND_PRIMARY_INTERACTION_TARGET as target} from './brandMindScene.js';
globalThis.window={location:{search:''},matchMedia:()=>({matches:false})};
const config=()=>resolveVolumetricCore('?brandMindVolumeV12=1');
const make=()=>{const volume=createVolumetricCore(config());return createCognitiveMemoryScene({variant:'B',background:true,volumeCore:volume,coreOnly:true},registry,target);};

test('volume is opt-in; default retains frozen scene and explicit candidates remain available',()=>{
  assert.equal(resolveVolumetricCore(''),null);assert.equal(resolveVolumetricCore('?brandMindVolumeV12=0'),null);
  assert.equal(config().variant,'B');assert.equal(config().coreOnly,true);
  assert.equal(resolveVolumetricCore('?brandMindVolumeV12=A&brandMindVolumeSteps=24').steps,24);
  assert.equal(resolveVolumetricCore('?brandMindVolumeV12=B&brandMindVolumeSteps=999').steps,40);
});
test('ray interval clips outside misses and camera-inside rays correctly',()=>{
  assert.deepEqual(volumeRayInterval(new THREE.Vector3(0,0,3),new THREE.Vector3(0,0,-1)),[2,4]);
  assert.deepEqual(volumeRayInterval(new THREE.Vector3(),new THREE.Vector3(0,0,1)),[0,1]);
  assert.equal(volumeRayInterval(new THREE.Vector3(0,0,3),new THREE.Vector3(1,0,0)),null);
});
test('Beer absorption includes actual step length and is invariant at 24 and 40 samples',()=>{
  const a=integrateHomogeneousMedium(.7,1.65,2,24),b=integrateHomogeneousMedium(.7,1.65,2,40);
  assert.ok(Math.abs(a.alpha-b.alpha)<1e-14);assert.ok(Math.abs(a.transmission-Math.exp(-.7*1.65*2))<1e-14);
  assert.equal(integrateHomogeneousMedium(0,1.65,2,40).alpha,0);
});
test('single bounded normal-blended volume, no texture or render target',()=>{
  const v=createVolumetricCore(config());assert.ok(v.mesh.geometry instanceof THREE.BoxGeometry);
  assert.equal(v.mesh.material.blending,THREE.NormalBlending);assert.equal(v.mesh.material.premultipliedAlpha,false);
  assert.equal(v.mesh.material.side,THREE.BackSide);assert.equal(v.mesh.material.depthWrite,false);
  assert.equal(v.mesh.material.defines.VOLUME_STEPS,40);assert.deepEqual(v.mesh.scale.toArray(),COGNITIVE_VOLUME_AXES);
  assert.ok(v.mesh.material.fragmentShader.includes('sigma * ds'));assert.ok(v.mesh.material.fragmentShader.includes('radiance / max(alpha'));
  assert.equal(Object.values(v.mesh.material.uniforms).some(u=>u.value?.isTexture||u.value?.isWebGLRenderTarget),false);v.dispose();
});
test('camera ray is transformed to the same local coordinates as the density',()=>{
  const v=createVolumetricCore(config()),c=new THREE.PerspectiveCamera();c.position.set(1,2,4);c.updateMatrixWorld();v.mesh.position.set(.5,.2,-1);v.mesh.updateMatrixWorld();
  v.mesh.onBeforeRender(null,null,c);const expected=c.position.clone().applyMatrix4(v.mesh.matrixWorld.clone().invert());
  assert.ok(v.mesh.material.uniforms.uCameraLocal.value.distanceTo(expected)<1e-12);v.dispose();
});
test('volume candidate replaces old wire nucleus and wide membrane geometry',()=>{
  const s=make();s.update({exposure:1},1/60,0,1);
  assert.equal(s.group.getObjectByName('BrandMindCognitiveNucleusAndShell'),undefined);
  assert.equal(s.group.getObjectByName('BrandMindCognitiveVeil'),undefined);
  assert.equal(s.group.getObjectByName('BrandMindBrokenMemoryHalo').geometry.attributes.position.count,0);
  assert.equal(s.group.getObjectByName('BrandMindMemoryKnots').visible,false);
  assert.equal(s.group.getObjectByName('BrandMindCognitiveFibers').visible,false);s.dispose();
});
test('historical art registry is preserved without invented canonical association IDs',()=>{
  const s=make();assert.equal(s.readVisualRegistry().canonicalRegistryStatus,'NEEDS_STABLE_REGISTRY_HOOK');
  for(const n of registry.nodes)assert.equal(s.resolveVisualNode(n.visualId).userData.associationId,null);
  for(const p of registry.paths)assert.equal(s.resolveVisualPath(p.sourceVisualId,p.targetVisualId).name,p.visualId);s.dispose();
});
test('hidden tab pauses volume time; Panel retains original pause and resume semantics',()=>{
  const s=make();const update=()=>s.update({exposure:1},.1,0,1);update();const t=s.readVisualRegistry().clock;
  globalThis.document={hidden:true};update();assert.equal(s.readVisualRegistry().clock,t);delete globalThis.document;
  s.setPanelPresentationOpen(true);update();assert.equal(s.readVisualRegistry().clock,t);
  s.setPanelPresentationOpen(false);update();assert.equal(s.readVisualRegistry().clock,t+.1);s.dispose();
});
test('core-only pick proxy shares volume axes and parent, excludes outside haze',()=>{
  const s=make(),h=s.group.getObjectByName('BrandMindCoreVolume'),m=s.group.getObjectByName('BrandMindVolumetricMedium');
  assert.equal(h.parent,m.parent);COGNITIVE_VOLUME_AXES.forEach((a,i)=>assert.ok(Math.abs(h.scale.toArray()[i]*.61-a*.89)<1e-12));s.dispose();
});
test('volume resources are reused and disposed exactly once',()=>{
  const v=createVolumetricCore(config()),g=v.mesh.geometry,m=v.mesh.material;let gd=0,md=0;
  g.addEventListener('dispose',()=>gd++);m.addEventListener('dispose',()=>md++);
  for(let i=0;i<120;i++)v.update(i/60,1);assert.equal(v.mesh.geometry,g);assert.equal(v.mesh.material,m);
  v.dispose();v.dispose();assert.equal(gd,1);assert.equal(md,1);
});
