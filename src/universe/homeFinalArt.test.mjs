import assert from 'node:assert/strict';
import { createGalaxyPlanets, createV4HomeConfigs } from './galaxyPlanets.js';
import { readGalaxyV3State, HOME_FINAL_ART_M3_CONFIG, GALAXY_V3_REPAIRED_M3_CONFIG } from './galaxy-v3/galaxyV3Config.js';
import { limitHeroPointerParallax } from './galaxy-v3/galaxyV3HeroAsset.js';
const results=[];
function test(name,fn){try{fn();results.push({name,status:'pass'})}catch(e){results.push({name,status:'fail',message:e.stack})}}
test('candidate is explicitly opt-in and never replaces default or historical heroes',()=>{
  for(const query of ['', '?homeArt=final','?galaxyV3=1&galaxyHero=v5_1&homeArt=final','?galaxyV3=1&galaxyHero=repaired_m3'])assert.equal(readGalaxyV3State(query).finalArtDirection,false);
  assert.equal(readGalaxyV3State('?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final').finalArtDirection,true);
});
test('asset swap preserves camera-relative transforms, LDI semantics and core bloom',()=>{
  const a=HOME_FINAL_ART_M3_CONFIG.galaxyHeroAsset,b=GALAXY_V3_REPAIRED_M3_CONFIG.galaxyHeroAsset;
  for(const key of ['position','scale','rotation','opacity','parallaxStrength','registerLdiProjection','coreBloomCalibration','linearTextureGain','bakedAtmosphere'])assert.deepEqual(a[key],b[key]);
  assert.equal(a.layers.length,5);
  a.layers.forEach((layer,i)=>{assert.match(layer.source,/home-final-art/);for(const k of ['id','z','renderOrder','parallaxFactor'])assert.equal(layer[k],b.layers[i][k])});
});
test('three identities retain particle inventory, labels, drift and depth',()=>{
  const before=createV4HomeConfigs(),after=createV4HomeConfigs(true);
  assert.deepEqual(after.map(x=>x.homeIdentity.mode),['signal','flow','memory']);
  after.forEach((a,i)=>{
    for(const k of ['coreStars','visibleCoreCount','coreCount','mainArmCount','auxiliaryArmCount','dustCount','nebulaCount','nodeCount','labelScale','label','driftPeriod','spin'])assert.equal(a[k],before[i][k]);
    assert.equal(a.anchor[2],before[i].anchor[2]);
  });
  assert.deepEqual(after[0].anchor,before[0].anchor);
});
test('legacy composition remains immutable when candidate configs are created',()=>{
  const snapshot=JSON.stringify(createV4HomeConfigs());createV4HomeConfigs(true);
  assert.equal(JSON.stringify(createV4HomeConfigs()),snapshot);
});
test('nested business groups consistently honor the existing V3 presentation order',()=>{
  const previous=globalThis.document;
  const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{})});
  globalThis.document={createElement:()=>({width:64,height:64,getContext:()=>context})};
  let oldArt,newArt;
  try{
    oldArt=createGalaxyPlanets({homeComposition:'v4'});
    newArt=createGalaxyPlanets({homeComposition:'v4',finalArtDirection:true});
    assert.equal(newArt.pointCount,oldArt.pointCount);
    for(const orbit of newArt.group.children)orbit.traverse(o=>{if(o.isGroup)assert.equal(o.renderOrder,7)});
    const count=art=>{let n=0;art.group.traverse(o=>{if(o.isPoints||o.isSprite)n++});return n};
    assert.equal(count(newArt),count(oldArt));
    newArt.group.traverse(o=>{if(o.geometry?.attributes.position)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite))});
    assert.equal(newArt.getPlanetInteractionTarget({x:0,y:-.60,active:1}),'Brand Mind Nebula');
    assert.equal(newArt.getPlanetInteractionTarget({x:.15,y:.64,active:1}),'5A Nebula');
  }finally{newArt?.dispose();oldArt?.dispose();globalThis.document=previous}
});
test('hero-local pointer restraint is continuous, bounded and leaves other modes exact',()=>{
  let previous=-1;
  for(let x=-1;x<=1;x+=.01){const y=limitHeroPointerParallax(x,.12);assert.ok(Math.abs(y)<=.12);assert.ok(y>=previous);previous=y;assert.equal(limitHeroPointerParallax(x,undefined),x)}
  assert.equal(limitHeroPointerParallax(0,.12),0);
});
console.log(JSON.stringify({passed:results.filter(r=>r.status==='pass').length,failed:results.filter(r=>r.status==='fail').length,results},null,2));
if(results.some(r=>r.status==='fail'))process.exitCode=1;
