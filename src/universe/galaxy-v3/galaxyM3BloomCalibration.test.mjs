import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LuminosityHighPassShader } from 'three/examples/jsm/shaders/LuminosityHighPassShader.js';
import { createM3BloomCalibration } from './galaxyM3BloomCalibration.js';
import { GALAXY_V3_REPAIRED_M3_CONFIG as repaired, GALAXY_V3_FINAL_M3_CONFIG as original, readGalaxyV3State } from './galaxyV3Config.js';

const results=[];
function test(name,fn){try{fn();results.push({name,status:'pass'});}catch(e){results.push({name,status:'fail',error:e.stack});}}
function fixture(enabled=true){
  const scene=new THREE.Scene(),parent=new THREE.Group(),owner=new THREE.Group();
  owner.name='GalaxyV3HeroAssetV4LDI';
  if(enabled)owner.userData.coreBloomCalibration=repaired.galaxyHeroAsset.coreBloomCalibration;
  parent.add(owner);scene.add(parent);
  const camera=new THREE.PerspectiveCamera(45,16/9,.01,100);camera.position.z=3;camera.updateMatrixWorld();
  const material={fragmentShader:LuminosityHighPassShader.fragmentShader,uniforms:THREE.UniformsUtils.clone(LuminosityHighPassShader.uniforms)};
  const bloom={materialHighPassFilter:material,strength:.3,radius:.11,threshold:.78};
  return {scene,parent,owner,camera,material,bloom,controller:createM3BloomCalibration(bloom,scene,camera)};
}
test('Repaired candidate is independently opt-in; original rollback and transforms remain',()=>{
  assert.equal(readGalaxyV3State('?galaxyV3=1&galaxyHero=repaired_m3').heroVersion,'repaired_m3');
  assert.equal(readGalaxyV3State('?galaxyHero=repaired_m3').enabled,false);
  assert.equal(repaired.galaxyHeroAsset.layers.length,5);
  for(const key of ['position','rotation','scale','parallaxStrength'])assert.deepEqual(repaired.galaxyHeroAsset[key],original.galaxyHeroAsset[key]);
  assert.ok(original.galaxyHeroAsset.layers.every(l=>l.source.includes('/final-m3/')));
  assert.ok(repaired.galaxyHeroAsset.layers.every(l=>l.source.includes('/repaired-m3/')));
});
test('Legacy hero and non-M3 scenes leave bloom shader byte-identical',()=>{
  const f=fixture(false),before=f.material.fragmentShader;f.controller.update();
  assert.equal(f.material.fragmentShader,before);assert.equal(f.material.uniforms.m3CoreEnabled,undefined);
});
test('M3 calibration changes high-pass eligibility, not exposure or global parameters',()=>{
  const f=fixture();f.controller.update();
  assert.equal(f.bloom.strength,.3);assert.equal(f.bloom.threshold,.78);assert.equal(f.bloom.radius,.11);
  assert.equal(f.material.uniforms.m3CoreRetention.value,.12);
  assert.match(f.material.fragmentShader,/alpha \*= mix\(1.0, m3CoreRetention/);
  assert.equal(f.material.uniforms.m3CoreEnabled.value,1);
});
test('Bloom region follows the current world projection without changing camera',()=>{
  const f=fixture();f.controller.update();const before=f.material.uniforms.m3CoreCenter.value.x;
  const position=f.camera.position.clone();f.owner.position.x=.1;f.controller.update();
  assert.ok(f.material.uniforms.m3CoreCenter.value.x>before);assert.deepEqual(f.camera.position,position);
});
test('Entering another scene or hiding the universe disables local calibration',()=>{
  const f=fixture();f.controller.update();f.parent.visible=false;f.controller.update();
  assert.equal(f.material.uniforms.m3CoreEnabled.value,0);
  f.parent.visible=true;f.controller.update();assert.equal(f.material.uniforms.m3CoreEnabled.value,1);
});
test('Repeated updates install the shader only once and disposal restores it',()=>{
  const f=fixture(),before=f.material.fragmentShader;
  for(let i=0;i<100;i++)f.controller.update();
  assert.equal((f.material.fragmentShader.match(/uniform vec2 m3CoreCenter/g)||[]).length,1);
  f.controller.dispose();assert.equal(f.material.fragmentShader,before);
  assert.equal(f.material.uniforms.m3CoreEnabled,undefined);
});
const failed=results.filter(r=>r.status==='fail');
console.log(JSON.stringify({passed:results.length-failed.length,failed:failed.length,results},null,2));
if(failed.length)process.exitCode=1;
