import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {readEarthCinematicHybrid,decodeEarthHybridMesh,createEarthCinematicHybrid} from './earthCinematicHybrid.js';
const assets=new URL('../../public/textures/hero/earth/hybrid-v1/',import.meta.url);
const buffer=name=>{const b=fs.readFileSync(new URL(name,assets));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',assets)));

test('hybrid is the final default and partial explicit Earth paths retain prior behavior',()=>{
  assert.equal(readEarthCinematicHybrid(''),true);
  for(const p of ['?earthHybrid=1','?earthV2=1&earthHybrid=1','?earthV2=1&earthV3=1'])assert.equal(readEarthCinematicHybrid(p),false);
  assert.equal(readEarthCinematicHybrid('?earthV2=1&earthV3=1&earthHybrid=1'),true);
});
test('hero body is a quantized, curved 3D surface, not a billboard',()=>{
  const g=decodeEarthHybridMesh(buffer('earth-hybrid-body-mesh.bin'),buffer('earth-hybrid-body-index.bin'),manifest);
  const p=g.attributes.position,uv=g.attributes.uv,cam=new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(manifest.cameraLocal));
  let near=Infinity,far=0;
  for(let i=0;i<p.count;i++){
    const v=new THREE.Vector3().fromBufferAttribute(p,i),d=v.distanceTo(cam);near=Math.min(near,d);far=Math.max(far,d);
    assert.ok(Math.abs(v.length()-manifest.localRadius)<.0001);assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1&&uv.getY(i)>=0&&uv.getY(i)<=1);
  }
  assert.ok(far-near>1);assert.equal(p.count,43009);assert.equal(g.index.count,256896);g.dispose();
});
test('malformed depth mesh is rejected before GPU allocation',()=>{
  assert.throws(()=>decodeEarthHybridMesh(new Float32Array(5).buffer,new Uint32Array([0]).buffer,manifest),/size mismatch/);
  assert.throws(()=>decodeEarthHybridMesh(new Float32Array([0,NaN,0,.5,.5]).buffer,new Uint32Array([0]).buffer,{vertices:1,indices:1}),/Invalid/);
  assert.throws(()=>decodeEarthHybridMesh(new Float32Array([0,1,0,.5,.5]).buffer,new Uint32Array([2]).buffer,{vertices:1,indices:1}),/Invalid/);
});
test('failed asset loading retains fallback and disposal removes only owned objects',async()=>{
  const previousFetch=globalThis.fetch,previousWindow=globalThis.window;
  globalThis.window={};globalThis.fetch=async()=>{throw new Error('test asset unavailable');};
  const root=new THREE.Group(),fallback=new THREE.Group(),air=new THREE.Mesh();root.add(fallback,air);
  try{
    const h=createEarthCinematicHybrid(root,{fallbackGroups:[fallback],atmosphere:air});await h.promise;h.update(.016);
    assert.equal(h.getStatus().ready,false);assert.equal(fallback.visible,true);assert.equal(h.group.visible,false);
    assert.equal(window.__ACTIVE_THEORY_EARTH_HYBRID__.fallback,true);h.dispose();assert.equal(root.children.length,2);assert.equal(air.visible,true);
  }finally{globalThis.fetch=previousFetch;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});
test('linear EXR, associated alpha and independent bounded cloud use the existing renderer loop',()=>{
  const code=fs.readFileSync(new URL('./earthCinematicHybrid.js',import.meta.url),'utf8');
  assert.match(code,/LinearSRGBColorSpace/);assert.match(code,/c\.rgb\/max\(c\.a,.001\)/);
  assert.match(code,/length\(vLocal-uReferenceCamera\)/);assert.match(code,/1\.-smoothstep\(.31,.47/);
  assert.doesNotMatch(code,/new THREE\.WebGLRenderer|requestAnimationFrame|addEventListener|tonemapping_fragment|colorspace_fragment/);
  assert.match(code,/Math\.cos\(8\*Math\.PI\/180\)/);
});
