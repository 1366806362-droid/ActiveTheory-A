import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ORBITAL_STAGES, orbitalPose, orbitalFlowPoint, advanceOrbitalClock, resolveFiveAOrbital } from './fiveAOrbitalArt.js';
import { makeParticleStars, fitParticleStarPanel, PARTICLE_STAR_BUDGET, ENERGY_STAR_BUDGETS } from './fiveAParticleStars.js';
import { createFiveAScene } from './fiveAScene.js';
import { createFiveACinematicReview } from '../v2/runtime/fiveACinematicReview.js';
globalThis.window={location:{search:''}};
globalThis.document={hidden:false,createElement:()=>({getContext:()=>({clearRect(){},fillText(){}})})};
const ids=Object.keys(ORBITAL_STAGES),cfg={variant:'B',skeleton:false,frozen:true,particleStars:'B'};
const tick=(s,time=12,delta=0)=>s.update({cameraOffset:{x:0,y:0,z:0,targetY:0}},delta,time,1);
const make=()=>{const s=createFiveAScene({orbitalArt:cfg});tick(s);return s;};
test('reviewed orbital path is default with explicit legacy fallback and five stable product IDs',()=>{
 const reviewed=resolveFiveAOrbital('');assert.equal(reviewed.variant,'B');assert.equal(reviewed.particleStars,'B');assert.equal(reviewed.energyStars,'A');assert.equal(reviewed.colorDepth.variant,'A');
 assert.equal(resolveFiveAOrbital('?fiveAOrbital=0'),null);assert.equal(resolveFiveAOrbital('?fiveAOrbital=no'),null);
 assert.equal(resolveFiveAOrbital('?fiveAOrbital=B').variant,'B');assert.deepEqual(ids,['A1','A2','A3','A4','A5']);
 assert.equal(resolveFiveAOrbital('?fiveAOrbital=B&fiveAEnergyStars=A').energyStars,'A');
 assert.equal(resolveFiveAOrbital('?fiveAOrbital=B&fiveAEnergyStars=1').energyStars,'A');
 assert.equal(resolveFiveAOrbital('?fiveAOrbital=B&fiveAEnergyStars=B').particleStars,'B');
 const s=make();assert.equal(s.resolveStageRendererTarget('O'),null);assert.equal(s.group.getObjectByName('FiveAStageNodeO'),undefined);s.dispose();
});
test('five radii increase independently and maximum guardrail bodies never intersect',()=>{
 const p=ids.map(()=>new T.Vector3());
 for(let k=0;k<=1500;k++){
  const time=k*.5;ids.forEach((id,i)=>orbitalPose(id,time,p[i],'B'));
  for(let i=0;i<5;i++){
   assert.ok(Math.abs(p[i].length()-ORBITAL_STAGES[ids[i]].radius)<1e-9);
   assert.ok(p[i].length()>.48+1.25*ORBITAL_STAGES[ids[i]].size);
   for(let j=i+1;j<5;j++)assert.ok(p[i].distanceTo(p[j])>1.25*(ORBITAL_STAGES[ids[i]].size+ORBITAL_STAGES[ids[j]].size));
  }
 }
});
test('orbit clock is framerate independent; hidden, panel and large resume gaps do not jump',()=>{
 let a=0,b=0;for(let i=0;i<1200;i++)a=advanceOrbitalClock(a,1/120);for(let i=0;i<600;i++)b=advanceOrbitalClock(b,1/60);
 assert.ok(Math.abs(a-b)<1e-9);assert.equal(advanceOrbitalClock(a,100,{hidden:true}),a);
 assert.equal(advanceOrbitalClock(a,1,{paused:true}),a);assert.equal(advanceOrbitalClock(a,1,{active:false}),a);
 assert.ok(advanceOrbitalClock(a,300)-a<.051);
});
test('four dynamic curve endpoints match adjacent moving satellite positions and avoid core',()=>{
 const a=new T.Vector3(),b=new T.Vector3();
 for(let time=0;time<750;time+=5)for(let i=0;i<4;i++){
  assert.ok(orbitalFlowPoint(ids[i],ids[i+1],time,0,a,'B').distanceTo(orbitalPose(ids[i],time,b,'B'))<1e-9);
  assert.ok(orbitalFlowPoint(ids[i],ids[i+1],time,1,a,'B').distanceTo(orbitalPose(ids[i+1],time,b,'B'))<1e-9);
  for(let t=0;t<=1;t+=.05)assert.ok(orbitalFlowPoint(ids[i],ids[i+1],time,t,a,'B').length()>.9);
 }
});
test('shared Snapshot stage LOW/HIGH changes actual sphere energy, never orbit or other stages',()=>{
 const s=make();let panel;const review=createFiveACinematicReview({scene:s,replacePanel:c=>panel=c});
 review.applyFixture('stage','low');tick(s);const low=review.read(),pose=s.group.userData.orbital();
 review.applyFixture('stage','high');tick(s);const high=review.read();
 assert.ok(high.stages.renderer.A3.opacity>low.stages.renderer.A3.opacity);
 assert.ok(high.stages.renderer.A3.pointScale>low.stages.renderer.A3.pointScale);
 for(const id of ids){assert.deepEqual(s.group.userData.orbital().stages[id].position,pose.stages[id].position);if(id!=='A3')assert.deepEqual(high.stages.renderer[id],low.stages.renderer[id]);}
 assert.equal(panel.snapshot.metadata.snapshotId,high.snapshotId);
 assert.equal(s.group.getObjectByName('FiveAOrbitalBodyA3').material.uniforms.uEnergy.value,high.stages.renderer.A3.opacity);
 for(let n=0;n<100;n++)review.applyFixture('stage','high');assert.deepEqual(review.read().stages.renderer,high.stages.renderer);
 review.dispose();s.dispose();
});
test('geometry, particles, labels and stage matrices follow the same moving pose, including data scale',()=>{
 const s=make();const review=createFiveACinematicReview({scene:s,replacePanel:()=>{}});review.applyFixture('stages','contrast');
 for(const time of [0,30,90,160]){
  tick(s,time);s.group.updateMatrixWorld(true);const particle=s.group.getObjectByName('FiveAOrbitalSurfaceParticles');
  for(const [i,id]of ids.entries()){
   const node=s.group.getObjectByName('FiveAStageNode'+id),label=s.group.getObjectByName('FiveALabel'+id);
   const state=s.resolveStageRendererTarget(id).read();assert.equal(node.scale.x,state.binding.scale);
   const mat=new T.Matrix4().fromArray(state.matrix).premultiply(particle.matrixWorld);
   mat.elements.forEach((v,k)=>assert.ok(Math.abs(v-node.matrixWorld.elements[k])<1e-9));
   assert.equal(label.position.x,node.parent.position.x);assert.equal(label.position.z,node.parent.position.z);
   const p=new T.Vector3().setFromMatrixPosition(particle.material.uniforms.uMatrices.value[i+1]);assert.ok(p.distanceTo(node.parent.position)<1e-9);
  }
 }
 review.dispose();s.dispose();
});
test('flow LOW/HIGH preserves alpha semantic, particle phase and all other transitions',()=>{
 const s=make(),review=createFiveACinematicReview({scene:s,replacePanel:()=>{}});
 for(const id of ['A1_TO_A2','A2_TO_A3','A3_TO_A4','A4_TO_A5']){
  review.applyFixture('flow','low',id);tick(s);const low=review.read();
  const positions=[...s.group.getObjectByName('FiveACoreReleaseParticleFlow').geometry.attributes.position.array];
  review.applyFixture('flow','high',id);tick(s);const high=review.read();
  assert.deepEqual([...s.group.getObjectByName('FiveACoreReleaseParticleFlow').geometry.attributes.position.array],positions);
  for(const [key,state]of Object.entries(high.flows.renderer)){
   assert.equal(state.particleIndices.length,108);state.alphas.forEach((v,i)=>assert.ok(Math.abs(v-state.baseAlphas[i]*state.binding.flowStrength)<1e-6));
   if(key!==id)assert.deepEqual(state,low.flows.renderer[key]);
  }
 }
 review.dispose();s.dispose();
});
test('PARTIAL lineage stays explicit, rollback and disposal restore original bindings',()=>{
 const s=make(),before=Object.fromEntries(ids.map(id=>[id,s.resolveStageRendererTarget(id).read().binding]));
 const review=createFiveACinematicReview({scene:s,replacePanel:()=>{}});review.applyFixture('stages','partial');
 assert.equal(review.read().snapshot.fiveA.stages.A2.strength.value,null);assert.ok(review.read().stages.metadata.sourceMissingPaths.length>0);
 review.dispose();for(const id of ids)assert.deepEqual(s.resolveStageRendererTarget(id).read().binding,before[id]);
 s.dispose();assert.throws(()=>s.resolveStageRendererTarget('A1'));const newScene=make();assert.deepEqual(newScene.resolveStageRendererTarget('A1').read().binding,before.A1);newScene.dispose();
});
test('opening panel pauses and closing continues orbital phase, no reset',()=>{
 const s=createFiveAScene({orbitalArt:{...cfg,frozen:false}});for(let i=0;i<120;i++)tick(s,0,1/120);
 const before=s.group.userData.orbital().time;s.setPanelPresentationOpen(true);for(let i=0;i<120;i++)tick(s,0,1/120);
 assert.equal(s.group.userData.orbital().time,before);s.setPanelPresentationOpen(false);tick(s,0,1/120);
 assert.ok(Math.abs(s.group.userData.orbital().time-before-1/120)<1e-9);s.dispose();
});
test('core is the original Panel semantic and an opaque depth-writing sphere target',()=>{
 const s=make(),core=s.group.getObjectByName('FiveACorePrimaryHitTarget');assert.equal(s.primaryInteractionTargetName,core.name);
 assert.equal(core.material.depthWrite,true);assert.equal(core.material.transparent,false);
 const camera=new T.PerspectiveCamera(50,16/9,.01,100);camera.position.copy(s.group.position).add(new T.Vector3(0,0,5));camera.lookAt(s.group.position);camera.updateMatrixWorld();
 assert.equal(s.getPrimaryInteractionTarget({x:0,y:0,camera}).semantic,'PRIMARY_DATA_ENTRY');assert.equal(s.getPrimaryInteractionTarget({x:.8,y:.8,camera}),null);s.dispose();
});


test('particle sampling is deterministic, finite-thickness, bounded and not a screen disk',()=>{
 const a=makeParticleStars('A'),b=makeParticleStars('B'),g=a.points.geometry;
 assert.equal(g.attributes.position.count,27000);
 assert.deepEqual(g.attributes.position.array,b.points.geometry.attributes.position.array);
 const r=g.attributes.aRadius.array;assert.ok(r.some(v=>v<.3));assert.ok(r.some(v=>v>.98));assert.ok(r.every(v=>v<=1.101&&v>=.1));
 assert.equal(a.material.depthTest,true);assert.equal(a.material.depthWrite,false);
 assert.ok(a.material.vertexShader.includes('starVisibility(mv.xyz,s)'));
 assert.ok(a.material.fragmentShader.includes('<colorspace_fragment>'));a.dispose();b.dispose();
});
test('energy-star candidates reduce count and organize a deterministic four-zone volume',()=>{
 for(const variant of ['A','B']){
  const a=makeParticleStars('B',variant),b=makeParticleStars('B',variant),g=a.points.geometry,budget=ENERGY_STAR_BUDGETS[variant];
  assert.equal(g.attributes.position.count,budget.total);assert.ok(budget.total<PARTICLE_STAR_BUDGET.total);
  assert.deepEqual(g.attributes.position.array,b.points.geometry.attributes.position.array);
  const zones=[...g.attributes.aZone.array],radii=[...g.attributes.aRadius.array];
  assert.deepEqual(new Set(zones),new Set([0,1,2,3]));assert.ok(radii.some(v=>v<.12));assert.ok(radii.some(v=>v>1.05));
  const core=zones.filter(v=>v===0).length,shell=zones.filter(v=>v===2).length;
  assert.ok(core>0&&shell>core*.8);assert.equal(a.material.depthWrite,false);assert.equal(a.energyVariant,variant);
  assert.ok(a.material.vertexShader.includes('centerField'));assert.ok(a.material.fragmentShader.includes('vSharpness'));
  a.dispose();b.dispose();
 }
});
test('whole-orbit panel envelope contains maximum bodies and labels at all sampled phases',()=>{
 const camera=new T.PerspectiveCamera(45,16/9,.01,100);camera.position.set(-2.35,-.22,3);camera.lookAt(-2.35,-.22,-2.08);
 for(const [width,height]of [[1366,768],[1600,900],[1920,1080]]){
  camera.aspect=width/height;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const left=width-Math.min(width*.65,1040)-14,fit=fitParticleStarPanel(camera,width,height,left,[-5,-.05,-1.72]);
  const m=new T.Matrix4().makeScale(fit.scale,fit.scale,fit.scale).setPosition(new T.Vector3(...fit.position));
  assert.ok(fit.scale>.12);
  for(let t=0;t<750;t+=.5)for(const [id,art]of Object.entries(ORBITAL_STAGES)){
   const p=orbitalPose(id,t,new T.Vector3(),'B').applyMatrix4(m),depth=-p.clone().applyMatrix4(camera.matrixWorldInverse).z;
   p.project(camera);const x=(p.x+1)*width/2,y=(1-p.y)*height/2;
   const r=art.size*1.25*1.104*fit.scale*camera.projectionMatrix.elements[5]*height/2/depth;
   assert.ok(x-r>10&&x+r<left-10);assert.ok(x-84>0&&x+84<left);assert.ok(y-r-40>0&&y+r<height);
  }
 }
});
test('actual particle energy slots preserve stable-ID isolation and track shader chunks compile on separate lines',()=>{
 const s=make(),review=createFiveACinematicReview({scene:s,replacePanel:()=>{}}),points=s.group.getObjectByName('FiveAOrbitalSurfaceParticles');
 review.applyFixture('stage','low','A3');tick(s);const before=[...points.material.uniforms.uEnergy.value];
 review.applyFixture('stage','high','A3');tick(s);const after=[...points.material.uniforms.uEnergy.value];
 assert.notEqual(before[3],after[3]);for(const i of [0,1,2,4,5])assert.equal(before[i],after[i]);assert.equal(after[0],1);
 assert.ok(Math.abs(after[3]-s.resolveStageRendererTarget('A3').read().binding.energy)<1e-6);
 const track=s.group.getObjectByName('FiveAOrbitalTracks'),shader={uniforms:{},vertexShader:'#include <common>\n#include <project_vertex>',fragmentShader:'#include <opaque_fragment>'};
 track.material.onBeforeCompile(shader);assert.equal(shader.uniforms.uMatrices.value,points.material.uniforms.uMatrices.value);
 assert.ok(!shader.vertexShader.includes('}#include'));assert.ok(shader.fragmentShader.includes('diffuseColor.a*=vStarVisibility'));
 review.dispose();s.dispose();
});
