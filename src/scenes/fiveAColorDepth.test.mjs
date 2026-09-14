import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { FIVE_A_IDENTITY_COLORS, FIVE_A_COLOR_CORE_RADIUS, makeFiveAIdentityPalette, resolveFiveAColorDepth, createFiveAEnvironment } from './fiveAColorDepth.js';
import { createFiveAScene } from './fiveAScene.js';
import { resolveFiveAOrbital, ORBITAL_STAGES, orbitalPose } from './fiveAOrbitalArt.js';
import { createFiveACinematicReview } from '../v2/runtime/fiveACinematicReview.js';
globalThis.window={location:{search:''}};
globalThis.document={hidden:false,createElement:()=>({getContext:()=>({clearRect(){},fillText(){}})})};
const ids=Object.keys(ORBITAL_STAGES);
const cfg=resolveFiveAOrbital('?fiveAOrbital=B&fiveAColorDepth=A');
const tick=s=>s.update({cameraOffset:{x:0,y:0,z:0,targetY:0}},.016,12,1);
test('identity palette resolves by stable ID; normal FiveA selects reviewed default and legacy remains explicit',()=>{
 assert.equal(resolveFiveAColorDepth(''),null);assert.equal(resolveFiveAOrbital('?fiveAColorDepth=A').colorDepth.variant,'A');
 assert.equal(resolveFiveAOrbital('?fiveAOrbital=0'),null);
 assert.equal(cfg.energyStars,'A');assert.equal(cfg.particleStars,'B');assert.equal(resolveFiveAColorDepth('?fiveAColorDepth=A&fiveABackground=0').background,false);
 const reversed=ids.slice().reverse(),palette=makeFiveAIdentityPalette(reversed);
 reversed.forEach((id,i)=>assert.equal(palette[i+1].getHexString(),new T.Color(FIVE_A_IDENTITY_COLORS[id]).getHexString()));
 assert.throws(()=>makeFiveAIdentityPalette(['O']));
});
test('real snapshot writes alter scale/energy but never identity, art core radius or orbit',()=>{
 const s=createFiveAScene({orbitalArt:cfg});tick(s);const p=s.group.getObjectByName('FiveAOrbitalSurfaceParticles');
 const colors=p.material.uniforms.uIdentityColors.value.map(c=>c.getHexString());
 const r=createFiveACinematicReview({scene:s,replacePanel(){}});
 const core=s.group.getObjectByName('FiveACorePrimaryHitTarget');assert.equal(core.scale.x,FIVE_A_COLOR_CORE_RADIUS);
 assert.equal(p.geometry.attributes.position.count,14750);
 for(const [kind,state,id]of [['stage','low','A3'],['stage','high','A3'],['stages','partial',null],['flow','high','A3_TO_A4']]){
  r.applyFixture(kind,state,id);tick(s);assert.deepEqual(p.material.uniforms.uIdentityColors.value.map(c=>c.getHexString()),colors);
  assert.equal(core.scale.x,FIVE_A_COLOR_CORE_RADIUS);assert.equal(p.material.uniforms.uMatrices.value[0].elements[0],FIVE_A_COLOR_CORE_RADIUS);
 }
 r.applyFixture('stage','high','A3');tick(s);const a=s.resolveStageRendererTarget('A3').read();r.applyFixture('stage','high','A3');tick(s);const b=s.resolveStageRendererTarget('A3').read();assert.deepEqual(b.binding,a.binding);assert.equal(b.pointScale,a.pointScale);assert.equal(b.opacity,a.opacity);
 r.dispose();s.dispose();assert.equal(s.group.children.length,0);
 const again=createFiveAScene({orbitalArt:cfg});tick(again);assert.deepEqual(again.group.getObjectByName('FiveAOrbitalSurfaceParticles').material.uniforms.uIdentityColors.value.map(c=>c.getHexString()),colors);again.dispose();
});
test('expanded Core has physical clearance from every maximum-scale satellite throughout 750 seconds',()=>{
 const p=new T.Vector3();for(let t=0;t<=750;t+=.5)for(const id of ids){orbitalPose(id,t,p,'B');assert.ok(p.length()-FIVE_A_COLOR_CORE_RADIUS*1.14-ORBITAL_STAGES[id].size*1.25*1.14>.20);}
});
test('environment is local, non-pickable, bounded and freezes under hidden/reduced-motion/inactive',()=>{
 const e=createFiveAEnvironment('A');assert.equal(e.group.children.length,2);let disposed=0;e.group.children.forEach(o=>{o.geometry.addEventListener('dispose',()=>disposed++);assert.equal(o.raycast(),undefined);});
 const u=e.group.children[0].material.uniforms;e.update(.03,1,0,false,false);const t=u.uTime.value;
 e.update(.03,1,0,true,false);e.update(.03,1,0,false,true);e.update(.03,0,0,false,false);assert.equal(u.uTime.value,t);assert.equal(e.group.visible,false);
 e.update(0,1,1,false,false);assert.ok(Math.abs(u.uOpacity.value-.45)<1e-9);e.dispose();assert.equal(disposed,2);assert.equal(e.group.children.length,0);
});
