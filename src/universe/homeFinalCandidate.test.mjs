import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readHomeFinalCandidate } from './homeFinalCandidate.js';
import { createJourneyData, createFiveAJourneyNebula, journeyPoint, JOURNEY_CANDIDATES, JOURNEY_COUNTS } from './fiveAJourneyNebula.js';
import { createGalaxyPlanets } from './galaxyPlanets.js';
import { createEarthFinalMaterial, atmosphericHeight, EARTH_FINAL_CANDIDATES, EARTH_FINAL_RADII } from './earthFinalMaterial.js';
import { createEarthTextureLayers } from './earthTextureMaterial.js';

const results=[];
function test(name,fn){try{fn();results.push({name,status:'pass'})}catch(e){results.push({name,status:'fail',message:e.stack})}}
const flag='?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&homeFinalV1=1';

test('HOME final is the default and explicit historical queries keep their contracts',()=>{
  assert.deepEqual(readHomeFinalCandidate(''),{enabled:true,journey:'B',earth:'B'});
  for(const q of ['?homeFinalV1=1',flag.replace('&homeFinalV1=1',''),flag.replace('repaired_m3','v5_1'),flag.replace('&homeArt=final','')]){
    assert.equal(readHomeFinalCandidate(q).enabled,false);assert.equal(readHomeFinalCandidate(q).journey,null);assert.equal(readHomeFinalCandidate(q).earth,null);
  }
  assert.deepEqual(readHomeFinalCandidate(flag),{enabled:true,journey:'B',earth:'B'});
  assert.deepEqual(readHomeFinalCandidate(flag+'&homeJourney=0&earthFinal=0'),{enabled:true,journey:null,earth:null});
  for(const c of ['A','B','C'])assert.equal(readHomeFinalCandidate(flag+'&homeJourney='+c).journey,c);
});
test('Journey has three genuine 3D structures, five irregular clusters, no internal Stage bindings',()=>{
  assert.equal(Object.keys(JOURNEY_CANDIDATES).length,3);
  for(const [key,c] of Object.entries(JOURNEY_CANDIDATES)){
    assert.equal(c.t.length,5);assert.equal(new Set(c.size).size,5);
    const points=c.t.map(t=>journeyPoint(t,key));
    assert.ok(Math.max(...points.map(p=>p[2]))-Math.min(...points.map(p=>p[2]))>.2);
    assert.ok(Math.max(...c.energy)/Math.min(...c.energy)>2);
    assert.ok(c.t[0]<.1&&c.t.at(-1)>.85);
  }
});
test('Journey static inventory is deterministic and finite with sparse high-energy points',()=>{
  const a=createJourneyData(),b=createJourneyData();
  assert.equal(a.count,18000);assert.deepEqual(a.positions,b.positions);assert.deepEqual(a.styles,b.styles);
  assert.ok(a.positions.every(Number.isFinite));assert.ok(a.styles.every(Number.isFinite));
  const roles=[0,0,0];let hero=0;
  for(let i=0;i<a.count;i++){roles[a.styles[i*4]]++;if(a.styles[i*4+1]>1)hero++}
  assert.deepEqual(roles,Object.values(JOURNEY_COUNTS));assert.ok(hero/a.count<.025);
});
test('Journey shares one GPU batch and updates uniforms without CPU geometry uploads',()=>{
  const j=createFiveAJourneyNebula();const points=j.group.children[0];
  const versions=Object.values(points.geometry.attributes).map(a=>a.version),positions=points.geometry.attributes.position.array.slice();
  for(let i=0;i<600;i++)j.update(i/120,.65,.5,.3);
  assert.deepEqual(positions,points.geometry.attributes.position.array);
  assert.deepEqual(versions,Object.values(points.geometry.attributes).map(a=>a.version));
  assert.equal(j.group.children.length,1);assert.equal(j.group.userData.journey.drawCalls,1);
  assert.equal(j.group.userData.journey.internalStageBinding,false);
  assert.equal(points.material.uniforms.uVisibility.value,.65);
  assert.equal(points.material.uniforms.uHover.value,.5);
  j.update(8,0);assert.equal(j.group.visible,false);
  let disposed=0;points.geometry.addEventListener('dispose',()=>disposed++);points.material.addEventListener('dispose',()=>disposed++);
  j.dispose();assert.equal(disposed,2);assert.equal(j.group.children.length,0);
});
test('Journey integration changes only 5A visual children, not entrance anchors, memory or GEO',()=>{
  const previous=globalThis.document;
  const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{})});
  globalThis.document={createElement:()=>({width:64,height:64,getContext:()=>ctx})};
  let oldArt,newArt;
  try{
    const options={homeComposition:'v4',finalArtDirection:true,memoryCandidate:'C'};
    oldArt=createGalaxyPlanets({...options,journeyCandidate:null});newArt=createGalaxyPlanets({...options,journeyCandidate:'B'});
    assert.equal(newArt.pointCount-oldArt.pointCount,18000-548);
    for(const name of ['GEONebula','5ANebula','BrandMindNebula']){
      const a=oldArt.group.getObjectByName(name),b=newArt.group.getObjectByName(name);
      assert.deepEqual(a.position.toArray(),b.position.toArray());assert.deepEqual(a.scale.toArray(),b.scale.toArray());
    }
    assert.deepEqual(newArt.group.getObjectByName('BrandMindContinuousMemoryField').userData,oldArt.group.getObjectByName('BrandMindContinuousMemoryField').userData);
    assert.equal(newArt.getPlanetInteractionTarget({x:.15,y:.64,active:1}),'5A Nebula');
    assert.equal(newArt.getPlanetInteractionTarget({x:0,y:-.60,active:1}),'Brand Mind Nebula');
    assert.ok(newArt.group.getObjectByName('FiveAJourneyGPU'));assert.equal(oldArt.group.getObjectByName('FiveAJourneyGPU'),undefined);
  }finally{newArt?.dispose();oldArt?.dispose();globalThis.document=previous}
});
test('Earth atmosphere peaks at the actual surface limb, not the expanded shell boundary',()=>{
  const {surface,atmosphere}=EARTH_FINAL_RADII;
  const limbFacing=Math.sqrt(1-(surface/atmosphere)**2);
  assert.ok(Math.abs(atmosphericHeight(limbFacing))<1e-10);
  assert.ok(Math.abs(atmosphericHeight(0)-1)<1e-10);
  let previous=2;
  for(let f=0;f<=1;f+=.001){const height=atmosphericHeight(f);assert.ok(Number.isFinite(height));assert.ok(height<=previous);previous=height}
});
test('Earth reuses existing geometry and four layers with shared space, no new loops',()=>{
  const geometry=new THREE.SphereGeometry(1,8,6),sun=new THREE.Vector3(1,0,0),time={value:0};
  for(const c of Object.keys(EARTH_FINAL_CANDIDATES)){
    const layers=createEarthTextureLayers({surfaceGeometry:geometry,cityGeometry:geometry,cloudGeometry:geometry,sunDirection:sun,cinematic:true,finalCandidate:c,sharedTime:time});
    const atmo=createEarthFinalMaterial('atmosphere',{candidate:c,sharedTime:time});
    assert.equal(layers.surface.geometry,geometry);assert.equal(layers.clouds.geometry,geometry);
    for(const m of [...Object.values(layers.materials),atmo]){assert.equal(m.uniforms.uTime,time);assert.equal(m.fog,false);assert.match(m.fragmentShader,/vec3 sunlight/)}
    assert.equal(layers.materials.surface.depthWrite,true);assert.equal(layers.materials.clouds.depthWrite,false);
    layers.setTextures({surface:new THREE.Texture(),city:new THREE.Texture(),clouds:new THREE.Texture()});
    layers.setVisibility({surface:true,city:true,clouds:true});assert.equal(layers.isReady(),true);
    layers.setSunDirection(new THREE.Vector3(0,1,0));assert.equal(layers.materials.city.uniforms.uSunDirectionObject.value.y,1);
    layers.setWeights({surface:1,city:.64,clouds:.62});assert.equal(layers.materials.clouds.uniforms.uOpacity.value,.62);
    layers.dispose();atmo.dispose();
  }geometry.dispose();
});
test('Earth legacy texture factory is unchanged when final flag is absent',()=>{
  const geometry=new THREE.SphereGeometry(),sun=new THREE.Vector3(1,0,0);
  const legacy=createEarthTextureLayers({surfaceGeometry:geometry,cityGeometry:geometry,cloudGeometry:geometry,sunDirection:sun,cinematic:true});
  for(const material of Object.values(legacy.materials)){assert.equal(material.uniforms.uCinematic.value,1);assert.equal(material.uniforms.uGain,undefined)}
  legacy.dispose();geometry.dispose();
});
console.log(JSON.stringify({passed:results.filter(r=>r.status==='pass').length,failed:results.filter(r=>r.status==='fail').length,results},null,2));
if(results.some(r=>r.status==='fail'))process.exitCode=1;
