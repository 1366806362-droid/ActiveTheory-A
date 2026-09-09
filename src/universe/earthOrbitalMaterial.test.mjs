import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readEarthOrbital,EARTH_ORBITAL_PROFILES,EARTH_ORBITAL_URLS,createEarthOrbitalMaterial} from './earthOrbitalMaterial.js';
import {createEarthTextureLoader,EARTH_TEXTURE_URLS} from './earthTextureLoader.js';
import {createEarthTextureLayers} from './earthTextureMaterial.js';

test('orbital opt-in is independent of both frozen Earth and V1.1',()=>{
  for(const q of ['', '?earthRealism=1&earthV2=1&earthV3=1', '?earthOrbital=1', '?earthV2=1&earthOrbital=1'])assert.equal(readEarthOrbital(q),null);
  const prefix='?earthV2=1&earthV3=1&earthOrbital=1';
  assert.equal(readEarthOrbital(prefix),'B');assert.equal(readEarthOrbital(prefix+'&earthOrbitalCandidate=invalid'),'B');
  for(const c of ['A','B','C'])assert.equal(readEarthOrbital(prefix+'&earthOrbitalCandidate='+c),c);
  assert.equal(Object.keys(EARTH_ORBITAL_URLS).length,4);
  for(const u of Object.values(EARTH_ORBITAL_URLS))assert.match(u,/\/orbital-v12\//);
});

test('four materials preserve linear output and bounded atmospheric chord integration',()=>{
  for(const candidate of Object.keys(EARTH_ORBITAL_PROFILES))for(const kind of ['surface','city','cloud','atmosphere']){
    const m=createEarthOrbitalMaterial(kind,{candidate});
    assert.equal(m.depthWrite,kind==='surface');assert.equal(m.fog,false);
    assert.ok(!m.fragmentShader.includes('tonemapping_fragment'));assert.ok(!m.fragmentShader.includes('colorspace_fragment'));
    assert.match(m.vertexShader,/inverse\(modelViewMatrix\)/);
    if(kind==='atmosphere'){assert.match(m.fragmentShader,/i<8/);assert.match(m.fragmentShader,/leave=min\(leave,ground.x\)/);}
    m.dispose();
  }
  assert.throws(()=>createEarthOrbitalMaterial('bad'));assert.throws(()=>createEarthOrbitalMaterial('surface',{candidate:'bad'}));
});

test('loader preserves original color spaces and handles linear packed orbital fields',async()=>{
  const original=THREE.TextureLoader.prototype.load;const loads=[];
  THREE.TextureLoader.prototype.load=function(url,onLoad){const t=new THREE.Texture();loads.push({url,t});queueMicrotask(()=>onLoad(t));return t;};
  try{
    const old=createEarthTextureLoader();const legacy=await old.loadEarthTextures();
    assert.deepEqual(loads.map(x=>x.url),Object.values(EARTH_TEXTURE_URLS));
    assert.equal(legacy.surface.colorSpace,THREE.SRGBColorSpace);assert.equal(legacy.clouds.colorSpace,THREE.SRGBColorSpace);assert.equal(legacy.city.colorSpace,THREE.NoColorSpace);
    old.dispose();loads.length=0;
    const next=createEarthTextureLoader({urls:EARTH_ORBITAL_URLS,anisotropy:8,colorSpaces:{clouds:THREE.NoColorSpace}});
    const maps=await next.loadEarthTextures();assert.equal(loads.length,4);
    assert.equal(maps.surface.colorSpace,THREE.SRGBColorSpace);
    for(const key of ['city','clouds','normal'])assert.equal(maps[key].colorSpace,THREE.NoColorSpace);
    for(const t of Object.values(maps)){assert.equal(t.generateMipmaps,true);assert.equal(t.anisotropy,8);assert.equal(t.wrapS,THREE.RepeatWrapping);assert.equal(t.minFilter,THREE.LinearMipmapLinearFilter);}
    let disposed=0;Object.values(maps).forEach(t=>t.addEventListener('dispose',()=>disposed++));
    assert.equal(await next.loadEarthTextures(),maps);assert.equal(loads.length,4);
    next.dispose();assert.equal(disposed,4);assert.equal(await next.loadEarthTextures(),null);
  }finally{THREE.TextureLoader.prototype.load=original;}
});

test('disposing a pending orbital load releases every delivered texture',async()=>{
  const original=THREE.TextureLoader.prototype.load;const pending=[];
  THREE.TextureLoader.prototype.load=function(url,ready){const t=new THREE.Texture();pending.push({ready,t});return t;};
  try{
    const loader=createEarthTextureLoader({urls:EARTH_ORBITAL_URLS});const promise=loader.loadEarthTextures();
    loader.dispose();let released=0;pending.forEach(({t,ready})=>{t.addEventListener('dispose',()=>released++);ready(t);});
    assert.equal(await promise,null);assert.equal(released,4);
  }finally{THREE.TextureLoader.prototype.load=original;}
});

test('all-or-nothing texture readiness, mask binding and shared cloud rotation',()=>{
  const g=new THREE.SphereGeometry(1,8,6),offset={value:0};
  const layer=createEarthTextureLayers({surfaceGeometry:g,cityGeometry:g,cloudGeometry:g,sunDirection:new THREE.Vector3(1,1,1),orbitalCandidate:'B',cloudOffset:offset});
  const maps={surface:new THREE.Texture(),city:new THREE.Texture(),clouds:new THREE.Texture(),normal:new THREE.Texture()};
  layer.setTextures({...maps,normal:null});assert.equal(layer.isReady(),false);
  layer.setTextures(maps);layer.setVisibility({surface:true,city:true,clouds:true});assert.equal(layer.isReady(),true);
  assert.equal(layer.surface.material.uniforms.uNormalMap.value,maps.normal);assert.equal(layer.city.material.uniforms.uNormalMap.value,maps.normal);
  assert.equal(layer.surface.material.uniforms.uCloudMap.value,maps.clouds);
  offset.value=.32;assert.equal(layer.city.material.uniforms.uCloudOffset.value,.32);
  assert.equal(layer.surface.geometry,g);assert.equal(layer.clouds.geometry,g);
  layer.dispose();g.dispose();Object.values(maps).forEach(t=>t.dispose());
});

test('final urban tiers keep real land masking and nonlinear slant cloud transmission',()=>{
  const m=createEarthOrbitalMaterial('city');
  assert.match(m.fragmentShader,/smoothstep\(\.75,\.98,texture2D\(uNormalMap,vUv\)\.a\)/);
  assert.match(m.fragmentShader,/settlement\+urban\+hero/);
  assert.match(m.fragmentShader,/cloudRayOffset\(vCameraLocal-vLocal,\.0040\)/);
  assert.doesNotMatch(m.fragmentShader,/1\.-\.83\*clouds/);
  // Evaluate the actual simple GLSL expression rather than a separately maintained model.
  const expression=m.fragmentShader.match(/float cloudTransmission[^]*?return ([^;]+);/)[1]
    .replace(/\b(exp|pow|max|sqrt)\(/g,'Math.$1(');
  const transmission=new Function('density','viewCos',`return ${expression}`);
  assert.equal(transmission(0,1),1);
  assert.ok(transmission(.10,1)>.85);
  assert.ok(transmission(1,1)<.05);
  for(const d of [.1,.3,.6,1])assert.ok(transmission(d,.3)<=transmission(d,1));
  m.dispose();
});

test('final clouds and ground use spherical light/view projection and stable geographic relief',()=>{
  const s=createEarthOrbitalMaterial('surface'),c=createEarthOrbitalMaterial('cloud');
  assert.match(s.fragmentShader,/cloudRayOffset\(vSunLocal,\.0046\)/);
  assert.match(s.fragmentShader,/nightZone\*skyReach/);
  assert.match(s.fragmentShader,/rawSpec\/\(1\.\+rawSpec\/\.20\)/);
  assert.match(c.fragmentShader,/reliefNormal/);
  assert.match(c.fragmentShader,/\.70\*data.g\+\.30\*data.b/);
  assert.match(c.fragmentShader,/sunOffset\*2\./);
  assert.doesNotMatch(c.fragmentShader,/fract\(|random\(|noise\(|uTime\s*\*/);
  assert.match(c.fragmentShader,/1\.\/4096\./);
  s.dispose();c.dispose();
});

test('atmosphere redistributes the same eight samples and keeps the night arc attenuated',()=>{
  const m=createEarthOrbitalMaterial('atmosphere');
  assert.match(m.fragmentShader,/i<8/);
  assert.match(m.fragmentShader,/t1-t0/);
  assert.match(m.fragmentShader,/\.004\*airglow\+lit\*1\.45/);
  assert.match(m.fragmentShader,/leave=min\(leave,ground.x\)/);
  const edges=Array.from({length:9},(_,i)=>.5-.5*Math.cos(Math.PI*i/8));
  assert.equal(edges[0],0);assert.equal(edges[8],1);
  assert.ok(edges[1]-edges[0]<edges[4]-edges[3]);
  assert.ok(Object.values(EARTH_ORBITAL_PROFILES).every(p=>p.aerosol<.4&&p.relief<=.28));
  m.dispose();
});
