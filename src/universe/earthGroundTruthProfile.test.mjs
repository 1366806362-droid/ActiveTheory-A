import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readEarthGroundTruth,EARTH_V13_PROFILES,EARTH_V13_PHASES} from './earthGroundTruthProfile.js';
import {createEarthOrbitalMaterial} from './earthOrbitalMaterial.js';
import {createEarthTextureLayers} from './earthTextureMaterial.js';
const prefix='?earthV2=1&earthV3=1&earthOrbital=1&earthV13=1';
test('V1.3 is explicit, bounded, and does not replace either earlier Earth route',()=>{
  for(const s of ['', '?earthV13=1',prefix.replace('&earthV13=1',''),prefix.replace('&earthV3=1','')])assert.equal(readEarthGroundTruth(s),null);
  const p=readEarthGroundTruth(prefix);assert.equal(p.candidate,'B');assert.equal(p.steps,12);assert.equal(p.phaseDegrees,0);
  for(const phase of EARTH_V13_PHASES)assert.equal(readEarthGroundTruth(prefix+'&earthPhase='+phase).phaseDegrees,phase);
  assert.equal(readEarthGroundTruth(prefix+'&earthPhase=15&earthAirSteps=100&earthV13Candidate=bad').phaseDegrees,0);
  assert.equal(readEarthGroundTruth(prefix+'&earthAirSteps=100').steps,12);
  assert.equal(p.rotationPeriod,3600);assert.ok(360*10/p.rotationPeriod<=1);
});
test('three bounded optical profiles use shared four-layer topology and one display transform',()=>{
  for(const candidate of Object.keys(EARTH_V13_PROFILES)){
    const p=readEarthGroundTruth(prefix+'&earthV13Candidate='+candidate);
    for(const kind of ['surface','city','cloud','atmosphere']){
      const m=createEarthOrbitalMaterial(kind,{groundTruth:p});
      assert.match(m.name,/EarthGroundTruth/);assert.equal(m.fog,false);assert.equal(m.depthWrite,kind==='surface');
      assert.doesNotMatch(m.fragmentShader,/tonemapping_fragment|colorspace_fragment|random\(|noise\(/);
      if(kind==='atmosphere'){
        assert.match(m.fragmentShader,new RegExp('i<'+p.steps));assert.match(m.fragmentShader,/leave=min\(leave,ground.x\)/);
        assert.match(m.fragmentShader,/dFdx\(vLocal\)/);assert.ok(p.airHeight<.008);
      }
      m.dispose();
    }
  }
  for(const steps of [8,12,16])assert.equal(readEarthGroundTruth(prefix+'&earthAirSteps='+steps).steps,steps);
});
test('screen-scale compensation preserves geographic masks and cloud optical depth',()=>{
  const p=readEarthGroundTruth(prefix),city=createEarthOrbitalMaterial('city',{groundTruth:p});
  assert.match(city.fragmentShader,/land\*night\*transmission/);
  assert.match(city.fragmentShader,/1\.\+\.14\*minification/);
  assert.match(city.fragmentShader,/exp\(-tau\/sqrt/);
  assert.doesNotMatch(city.fragmentShader,/texture2DLod|textureLod|gl_FragCoord/);
  const surface=createEarthOrbitalMaterial('surface',{groundTruth:p}),cloud=createEarthOrbitalMaterial('cloud',{groundTruth:p});
  assert.match(surface.fragmentShader,/earthshine[^]*night/);
  assert.match(surface.fragmentShader,/mix\(water,terrain,land\)/);
  assert.match(cloud.fragmentShader,/1\.-exp\(-tau\)/);
  assert.match(cloud.fragmentShader,/max\(2\.,footprint\(\)\)/);
  for(const m of [city,surface,cloud])m.dispose();
});
test('V1.3 texture children receive exactly one shared geographic cloud offset',()=>{
  const geometry=new THREE.SphereGeometry(1,8,6),offset={value:.24},p=readEarthGroundTruth(prefix);
  const layers=createEarthTextureLayers({surfaceGeometry:geometry,cityGeometry:geometry,cloudGeometry:geometry,
    sunDirection:new THREE.Vector3(1,1,1),orbitalCandidate:'B',groundTruth:p,cloudOffset:offset});
  assert.equal(layers.surface.material.name,'EarthGroundTruth-surface-B');
  assert.equal(layers.city.material.uniforms.uCloudOffset,offset);
  assert.equal(layers.surface.material.uniforms.uCloudOffset,offset);
  const old=createEarthOrbitalMaterial('surface');assert.equal(old.name,'EarthOrbital-surface-B');
  assert.doesNotMatch(old.fragmentShader,/float footprint/);
  layers.dispose();geometry.dispose();old.dispose();
});
