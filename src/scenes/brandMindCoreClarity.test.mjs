import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {resolveVolumetricCore,createVolumetricCore,integrateConstantEmission,COGNITIVE_VOLUME_AXES} from './brandMindVolumetricCore.js';

test('clarity requires explicit flag; default and V12 Before remain separate',()=>{
  assert.equal(resolveVolumetricCore(''),null);
  assert.equal(resolveVolumetricCore('?brandMindCoreClarity=0'),null);
  assert.equal(resolveVolumetricCore('?brandMindCoreClarity=unknown'),null);
  assert.equal(resolveVolumetricCore('?brandMindVolumeV12=B').profile,0);
  assert.equal(resolveVolumetricCore('?brandMindCoreClarity=1').profile,1);
  assert.equal(resolveVolumetricCore('?brandMindCoreClarity=B').profile,2);
});
test('candidate stays Core-only and retains quality/diagnostic switches',()=>{
  const c=resolveVolumetricCore('?brandMindCoreClarity=A&brandMindVolumeSteps=24');
  assert.equal(c.coreOnly,true);assert.equal(c.steps,24);
  assert.equal(resolveVolumetricCore('?brandMindCoreClarity=A&brandMindVolumeOnly=0').coreOnly,false);
});
test('independent emission integrates identically at 24 and 40 steps',()=>{
  for(const density of [0,.04,.8,3]){
    const a=integrateConstantEmission(density,1.65,.7,1.7,24),b=integrateConstantEmission(density,1.65,.7,1.7,40);
    assert.ok(Math.abs(a.radiance-b.radiance)<1e-12);assert.ok(Math.abs(a.transmission-b.transmission)<1e-12);
    const s=density*1.65,expected=s?(.7/s)*(1-Math.exp(-s*1.7)):.7*1.7;
    assert.ok(Math.abs(a.radiance-expected)<1e-12);
  }
});
test('vacuum does not erase the source; positive density attenuates it',()=>{
  const clear=integrateConstantEmission(0,1.65,2,1,40),dense=integrateConstantEmission(2,1.65,2,1,40);
  assert.equal(clear.transmission,1);assert.ok(clear.radiance>dense.radiance);assert.ok(dense.radiance>0);
});
test('single existing box, unchanged axes, no texture/target allocation',()=>{
  const a=createVolumetricCore(resolveVolumetricCore('?brandMindCoreClarity=A'));
  assert.deepEqual(a.mesh.scale.toArray(),COGNITIVE_VOLUME_AXES);
  assert.ok(a.mesh.geometry instanceof THREE.BoxGeometry);assert.equal(a.mesh.material.defines.VOLUME_STEPS,40);
  assert.equal(a.mesh.material.blending,THREE.NormalBlending);assert.equal(a.mesh.material.premultipliedAlpha,false);
  assert.equal(Object.values(a.mesh.material.uniforms).some(u=>u.value?.isTexture||u.value?.isWebGLRenderTarget),false);a.dispose();
});
test('each candidate owns uniforms and diagnostics, invalid debug modes fail',()=>{
  const a=createVolumetricCore(resolveVolumetricCore('?brandMindCoreClarity=A')),b=createVolumetricCore(resolveVolumetricCore('?brandMindCoreClarity=B'));
  a.diagnostic(2);assert.equal(b.mesh.material.uniforms.uDebug.value,0);
  assert.equal(a.mesh.material.uniforms.uProfile.value,1);assert.equal(b.mesh.material.uniforms.uProfile.value,2);
  assert.throws(()=>a.diagnostic(5));assert.throws(()=>a.diagnostic(.5));a.dispose();b.dispose();
});
test('candidate keeps stable resources and dispose is idempotent',()=>{
  const a=createVolumetricCore(resolveVolumetricCore('?brandMindCoreClarity=A')),g=a.mesh.geometry,m=a.mesh.material;
  let gd=0,md=0;g.addEventListener('dispose',()=>gd++);m.addEventListener('dispose',()=>md++);
  for(let i=0;i<1000;i++)a.update(i/120,1);
  assert.equal(a.mesh.geometry,g);assert.equal(a.mesh.material,m);a.dispose();a.dispose();assert.equal(gd,1);assert.equal(md,1);
});
