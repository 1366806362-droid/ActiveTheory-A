import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {EARTH_HANDOFF,createEarthHandoffState,createEarthMaterialHandoff,earthHeroRotation} from './earthHybridHandoff.js';
import {createEarthOrbitalMaterial} from './earthOrbitalMaterial.js';

test('handoff retains hero, smoothly enters complete fallback, and returns',()=>{
  const h=createEarthHandoffState();let previous=0;
  assert.equal(h.update(0).mix,0);
  for(let a=0;a<16;a+=.02){const s=h.update(a);assert.ok(s.mix>=previous);assert.ok(s.mix-previous<.005);previous=s.mix;}
  assert.equal(h.update(16).zone,'FALLBACK');
  for(let a=16;a>=0;a-=.02){const s=h.update(a);assert.ok(s.mix<=previous);assert.ok(previous-s.mix<.005);previous=s.mix;}
  assert.equal(h.update(0).zone,'HERO');assert.equal(h.update(NaN).zone,'FALLBACK');
});

test('angular hysteresis holds small reversals without a visibility switch',()=>{
  const h=createEarthHandoffState(),s=h.update(8);
  for(const angle of [8.1,7.9,8.2,7.8,8])assert.equal(h.update(angle).mix,s.mix);
  assert.ok(h.update(9).mix>s.mix);assert.equal(EARTH_HANDOFF.deadZone,.25);
});

test('long dwell keeps one synchronized geographic state inside capture support without resetting phase',()=>{
  const speed=Math.PI*2/3600,initial=-1.7;let previous=initial;
  assert.deepEqual(earthHeroRotation(0,initial,0,speed),{surfaceAngle:initial,cloudAngle:0});
  for(const t of [1,10,60,600,3600,86400]){
    const r=earthHeroRotation(t,initial,0,speed);assert.ok(r.surfaceAngle<=previous);previous=r.surfaceAngle;
    assert.ok(initial-r.surfaceAngle<=Math.PI/60+1e-12);
    assert.ok(-r.cloudAngle<=Math.PI/60*1.11+1e-12);
    assert.ok(Math.abs(r.cloudAngle/(r.surfaceAngle-initial)-1.11)<1e-10);
  }
});

test('shared geographic/cloud capture phase, texture ownership and opacity survive handoff disposal',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../../public/textures/hero/earth/hybrid-v1/manifest.json',import.meta.url)));
  const materials=['surface','city','cloud'].map(kind=>createEarthOrbitalMaterial(kind));
  const geometry=new THREE.SphereGeometry(1.85,8,8),meshes=materials.map(m=>new THREE.Mesh(geometry,m));
  const [surface,city,cloud]=meshes,maps={surface:new THREE.Texture(),city:new THREE.Texture(),cloud:new THREE.Texture()};
  let disposedMaps=0;Object.values(maps).forEach(t=>t.addEventListener('dispose',()=>disposedMaps++));
  const handoff=createEarthMaterialHandoff({surface,city,cloud,manifest,maps});
  assert.equal(surface.geometry,geometry);assert.equal(cloud.geometry,geometry);assert.equal(city.visible,false);
  assert.equal(surface.material.uniforms.uSurfaceMap,materials[0].uniforms.uSurfaceMap);
  assert.equal(surface.material.uniforms.uCityOpacity,materials[1].uniforms.uOpacity);
  assert.equal(surface.material.uniforms.uHandoff,cloud.material.uniforms.uHandoff);
  const local=new THREE.Vector3(.1,.4,1.7),expected=local.clone().applyAxisAngle(new THREE.Vector3(0,1,0),-1.7).applyMatrix4(new THREE.Matrix4().fromArray(manifest.cameraLocal).invert());
  assert.ok(local.clone().applyMatrix4(surface.material.uniforms.uCapture.value).distanceTo(expected)<1e-10);
  handoff.update(10);assert.ok(surface.material.uniforms.uCalibration.value>0);
  handoff.update(20);assert.ok(surface.material.uniforms.uCalibration.value<1e-10);
  handoff.dispose();assert.equal(surface.material,materials[0]);assert.equal(cloud.material,materials[2]);assert.equal(city.visible,true);assert.equal(disposedMaps,0);
  geometry.dispose();materials.forEach(m=>m.dispose());Object.values(maps).forEach(t=>t.dispose());
});

test('handoff creates neither another sphere, atmosphere, renderer, timer nor listener',()=>{
  const code=fs.readFileSync(new URL('./earthHybridHandoff.js',import.meta.url),'utf8');
  assert.doesNotMatch(code,/new THREE\.(?:Mesh|SphereGeometry|WebGLRenderer)|requestAnimationFrame|setInterval|addEventListener/);
  assert.match(code,/premul\/max\(a,.001\)/);assert.match(code,/supported\(uv\)/);
  const runtime=fs.readFileSync(new URL('./earthCinematicHybrid.js',import.meta.url),'utf8');
  assert.match(runtime,/production\?rotationState\(\)\.time/);
  assert.match(runtime,/get\('earthHybridProd'\)===?'1'/);
});
