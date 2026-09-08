import assert from 'node:assert/strict';
import {createBrandMindMemoryField,createMemoryParticleData,memoryDensity,readMemoryFieldCandidate,MEMORY_COUNTS,MEMORY_CANDIDATES,MEMORY_THREAD_PAIRS} from './brandMindMemoryField.js';
import {createGalaxyPlanets} from './galaxyPlanets.js';
const results=[];
function test(name,fn){try{fn();results.push({name,status:'pass'})}catch(e){results.push({name,status:'fail',message:e.stack})}}
test('memory flag is explicit; unknown/default values preserve rollback',()=>{
  for(const q of ['', '?homeArt=final','?brandMindMemory=0','?brandMindMemory=unknown'])assert.equal(readMemoryFieldCandidate(q),null);
  assert.equal(readMemoryFieldCandidate('?brandMindMemory=1'),'C');
  for(const c of ['A','B','C'])assert.equal(readMemoryFieldCandidate(`?brandMindMemory=${c}`),c);
});
test('three structural candidates retain six noncoplanar irregular association knots and sparse non-complete graph',()=>{
  assert.equal(Object.keys(MEMORY_CANDIDATES).length,3);assert.equal(MEMORY_THREAD_PAIRS.length,6);
  for(const c of Object.values(MEMORY_CANDIDATES)){
    assert.equal(c.knots.length,6);assert.equal(new Set(c.knots.map(k=>k[2])).size,6);
    assert.ok(Math.max(...c.knots.map(k=>k[2]))-Math.min(...c.knots.map(k=>k[2]))>.3);
    assert.ok(new Set(c.knots.map(k=>k[3])).size>=4);
  }
});
test('static density is continuous and retains central banks, voids and faint perimeter',()=>{
  for(const candidate of Object.keys(MEMORY_CANDIDATES)){
    assert.ok(memoryDensity(-.19,.075,0,candidate)>memoryDensity(.8,.5,.3,candidate)*20);
    let maxStep=0,last=memoryDensity(-.6,0,0,candidate);
    for(let x=-.599;x<.6;x+=.001){const value=memoryDensity(x,0,0,candidate);assert.ok(value>=0&&value<=1);maxStep=Math.max(maxStep,Math.abs(value-last));last=value;}
    assert.ok(maxStep<.025);
  }
});
test('deterministic static buffers contain field, knots, dust and interrupted threads',()=>{
  const a=createMemoryParticleData('B'),b=createMemoryParticleData('B');
  assert.equal(a.count,35500);assert.equal(a.count,Object.values(MEMORY_COUNTS).reduce((x,y)=>x+y,0));
  assert.deepEqual(a.positions,b.positions);assert.deepEqual(a.styles,b.styles);
  for(const values of [a.positions,a.styles,a.anchors])assert.ok(values.every(Number.isFinite));
  const roles=[0,0,0,0];for(let i=0;i<a.count;i++)roles[a.styles[i*4]]++;
  assert.deepEqual(roles,Object.values(MEMORY_COUNTS));
  assert.ok(a.styles.some((v,i)=>i%4===1&&v>1));
});
test('GPU implementation uses two draw batches, five shared density slices, no per-frame buffer upload',()=>{
  const memory=createBrandMindMemoryField();const [field,points]=memory.group.children;
  assert.equal(field.count,5);assert.equal(memory.group.userData.memoryField.drawCalls,2);
  assert.equal(points.geometry.attributes.position.usage,35044);
  const versions=Object.values(points.geometry.attributes).map(a=>a.version);
  const positions=points.geometry.attributes.position.array.slice();
  for(let i=0;i<600;i++)memory.update(i/120,.66,.2,.1);
  assert.deepEqual(positions,points.geometry.attributes.position.array);
  assert.deepEqual(versions,Object.values(points.geometry.attributes).map(a=>a.version));
  assert.equal(points.material.uniforms.uVisibility.value,.66);
  assert.equal(points.material.depthWrite,false);assert.equal(field.material.depthWrite,false);
  assert.equal(points.material.toneMapped,false);assert.equal(field.material.toneMapped,false);
  let disposed=0;for(const o of [points,field]){o.geometry.addEventListener('dispose',()=>disposed++);o.material.addEventListener('dispose',()=>disposed++)}
  memory.dispose();assert.equal(disposed,4);assert.equal(memory.group.children.length,0);
});
test('integration replaces only final-art homepage Brand Mind while preserving transforms and entry ownership',()=>{
  const previous=globalThis.document;
  const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{})});
  globalThis.document={createElement:()=>({width:64,height:64,getContext:()=>context})};
  let baseline,candidate,legacy;
  try{
    baseline=createGalaxyPlanets({homeComposition:'v4',finalArtDirection:true});
    candidate=createGalaxyPlanets({homeComposition:'v4',finalArtDirection:true,memoryCandidate:'B'});
    legacy=createGalaxyPlanets({memoryCandidate:'B'});
    assert.ok(!legacy.group.getObjectByName('BrandMindContinuousMemoryField'));
    assert.ok(!baseline.group.getObjectByName('BrandMindContinuousMemoryField'));
    assert.ok(candidate.group.getObjectByName('BrandMindContinuousMemoryField'));
    assert.deepEqual(candidate.getCompositionStatus(),baseline.getCompositionStatus());
    assert.equal(candidate.pointCount-baseline.pointCount,35500-380);
    for(const name of ['GEONebula','5ANebula']){
      const a=[],b=[];baseline.group.getObjectByName(name).traverse(o=>{if(o.geometry)a.push(Array.from(o.geometry.attributes.position.array))});
      candidate.group.getObjectByName(name).traverse(o=>{if(o.geometry)b.push(Array.from(o.geometry.attributes.position.array))});assert.deepEqual(a,b);
    }
    assert.equal(candidate.getPlanetInteractionTarget({x:0,y:-.60,active:1}),'Brand Mind Nebula');
    candidate.setPlanetEntryIntent('Brand Mind Nebula',.5);candidate.update(.016,1,{x:0,y:-.60,active:1});
    const field=candidate.group.getObjectByName('BrandMindContinuousMemoryField');
    assert.equal(field.children[1].material.uniforms.uIntent.value,1);
    candidate.setPlanetEntryProgress('Brand Mind Nebula',1);candidate.update(.016,2,null);assert.equal(field.visible,false);
    candidate.setPlanetEntryProgress(null,0);candidate.update(.016,3,null);assert.equal(field.visible,true);
  }finally{baseline?.dispose();candidate?.dispose();legacy?.dispose();globalThis.document=previous}
});
console.log(JSON.stringify({passed:results.filter(r=>r.status==='pass').length,failed:results.filter(r=>r.status==='fail').length,results},null,2));
if(results.some(r=>r.status==='fail'))process.exitCode=1;
