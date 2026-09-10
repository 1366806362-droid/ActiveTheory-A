import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readEarthRealism, EARTH_REALISM_PROFILES, createEarthRealismMaterial } from './earthRealismMaterial.js';
import { createEarthTextureLayers } from './earthTextureMaterial.js';
import { createEarthFinalMaterial } from './earthFinalMaterial.js';

test('realism remains explicit opt-in, with bounded candidate selection', () => {
  for (const q of ['', '?earthRealism=1', '?earthV3=1&earthRealism=1', '?earthV2=1&earthV3=1']) assert.equal(readEarthRealism(q), null);
  const flags='?earthV2=1&earthV3=1&earthRealism=1';
  assert.equal(readEarthRealism(flags), 'B');
  assert.equal(readEarthRealism(flags+'&earthRealismCandidate=invalid'), 'B');
  for (const c of Object.keys(EARTH_REALISM_PROFILES)) assert.equal(readEarthRealism(flags+'&earthRealismCandidate='+c), c);
});

function layers(candidate) {
  const geometry=new THREE.SphereGeometry(1,8,6);
  return {geometry, layer:createEarthTextureLayers({surfaceGeometry:geometry,cityGeometry:geometry,cloudGeometry:geometry,
    sunDirection:new THREE.Vector3(.72,.56,-.44),finalCandidate:'B',realismCandidate:candidate})};
}

test('no flag preserves the frozen material source, blending and uniforms', () => {
  const {geometry,layer}=layers(null);
  for(const kind of ['surface','city','cloud']) {
    const frozen=createEarthFinalMaterial(kind,{candidate:'B'}),actual=layer.materials[kind==='cloud'?'clouds':kind];
    assert.equal(actual.fragmentShader,frozen.fragmentShader);
    assert.equal(actual.vertexShader,frozen.vertexShader);
    assert.equal(actual.blending,frozen.blending);
    assert.deepEqual(Object.keys(actual.uniforms),Object.keys(frozen.uniforms));
    frozen.dispose();
  }
  layer.dispose();geometry.dispose();
});

test('all three candidates use the same four layers and shared sun frame', () => {
  for(const candidate of Object.keys(EARTH_REALISM_PROFILES)) for(const kind of ['surface','city','cloud','atmosphere']) {
    const m=createEarthRealismMaterial(kind,{candidate});
    assert.match(m.fragmentShader,/vec3\(\.72,\.56,-\.44\)/);
    assert.ok(!m.fragmentShader.includes('tonemapping_fragment')); // OutputPass owns display transform.
    assert.ok(!m.fragmentShader.includes('colorspace_fragment'));
    assert.equal(m.depthWrite,kind==='surface');
    assert.equal(m.blending,['city','atmosphere'].includes(kind)?THREE.AdditiveBlending:THREE.NormalBlending);
    m.dispose();
  }
  assert.throws(()=>createEarthRealismMaterial('invalid'));
  assert.throws(()=>createEarthRealismMaterial('surface',{candidate:'invalid'}));
});

test('cloud occlusion shares the weather map without owning texture lifetime', () => {
  const {geometry,layer}=layers('B');
  const maps={surface:new THREE.Texture(),city:new THREE.Texture(),clouds:new THREE.Texture()};
  layer.setVisibility({surface:true,city:true,clouds:true});assert.equal(layer.surface.visible,false);
  layer.setTextures(maps);assert.equal(layer.isReady(),true);
  for(const kind of ['surface','city','clouds']) assert.equal(layer.materials[kind].uniforms.uCloudMap.value,maps.clouds);
  layer.setWeights({surface:1,city:.64,clouds:.62});
  layer.setVisibility({surface:true,city:true,clouds:true});
  assert.equal(layer.clouds.visible,true);assert.equal(layer.materials.city.uniforms.uOpacity.value,.64);
  let disposed=0;Object.values(layer.materials).forEach(m=>m.addEventListener('dispose',()=>disposed++));
  layer.dispose();assert.equal(disposed,3);
  Object.values(maps).forEach(t=>t.dispose());geometry.dispose();
});

test('surface and city shadow track relative cloud rotation with one shared uniform', () => {
  const cloudOffset={value:0},sharedTime={value:0};
  const a=createEarthRealismMaterial('surface',{cloudOffset,sharedTime});
  const b=createEarthRealismMaterial('city',{cloudOffset,sharedTime});
  for(let i=0;i<600;i++){cloudOffset.value=i/600;sharedTime.value=i/120;}
  assert.equal(a.uniforms.uCloudOffset,cloudOffset);assert.equal(b.uniforms.uCloudOffset,cloudOffset);
  assert.equal(a.uniforms.uTime,sharedTime);assert.equal(b.uniforms.uTime,sharedTime);
  a.dispose();b.dispose();
});
