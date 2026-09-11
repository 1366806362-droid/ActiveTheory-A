import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFiveAScene } from './fiveAScene.js';
import { resolveFiveACinematicArt, cinematicFlowTravel } from './fiveACinematicArt.js';
import { createFiveACinematicReview } from '../v2/runtime/fiveACinematicReview.js';
import { buildFiveADataPanelViewModel } from '../ui/fiveA-data-panel/fiveADataPanelViewModel.js';
globalThis.window = { location: { search: '' } };
globalThis.document = { createElement: () => ({ getContext: () => ({ clearRect() {}, fillText() {} }) }) };
const ids=['A1','A2','A3','A4','A5'];
const tick=s=>s.update({cameraOffset:{x:0,y:0,z:0,targetY:0}},0,12,1);
test('candidate is opt-in; A retains art positions; B uses stable IDs',()=>{
  assert.equal(resolveFiveACinematicArt(''),null);
  assert.equal(resolveFiveACinematicArt('?fiveACinematic=garbage'),null);
  assert.equal(resolveFiveACinematicArt('?fiveACinematic=A').offsets,null);
  assert.deepEqual(Object.keys(resolveFiveACinematicArt('?fiveACinematic=B').offsets),ids);
});
for(const variant of ['A','B']) {
  test(`${variant}: fixed particle budget, real adapters, idempotence and disposal`,()=>{
    const scene=createFiveAScene({cinematicArt:resolveFiveACinematicArt('?fiveACinematic='+variant)});
    tick(scene);
    const gpu=scene.group.getObjectByName('FiveAStageGpuParticleSpheres');
    const original=Object.fromEntries(ids.map(id=>[id,scene.resolveStageRendererTarget(id).read()]));
    assert.equal(gpu.geometry.attributes.position.count,4500);
    assert.equal(scene.group.getObjectByName('FiveACoreReleaseParticleFlow').geometry.attributes.position.count,432);
    let panel;
    const review=createFiveACinematicReview({scene,replacePanel:c=>{panel=c;}});
    const resources=[gpu.geometry.uuid,gpu.material.uuid];
    review.applyFixture('stage','low');tick(scene);const low=review.read();
    review.applyFixture('stage','high');tick(scene);const high=review.read();
    assert.ok(high.stages.renderer.A3.opacity>low.stages.renderer.A3.opacity);
    assert.ok(high.stages.renderer.A3.pointScale>low.stages.renderer.A3.pointScale);
    for(const id of ids.filter(id=>id!=='A3'))assert.deepEqual(high.stages.renderer[id],low.stages.renderer[id]);
    for(let i=0;i<100;i++)review.applyFixture('stage','high');
    assert.deepEqual(review.read().stages.renderer,high.stages.renderer);
    assert.equal(panel.snapshot.metadata.snapshotId,high.snapshotId);
    assert.equal(buildFiveADataPanelViewModel(panel.snapshot,panel.derivedMetrics).stageRows.find(r=>r.stageId==='A3').population,panel.snapshot.fiveA.stages.A3.population.value);
    assert.deepEqual(resources,[gpu.geometry.uuid,gpu.material.uuid]);
    review.dispose();tick(scene);
    for(const id of ids)assert.deepEqual(scene.resolveStageRendererTarget(id).read(),original[id]);
    assert.throws(()=>review.applyFixture('stage','low'));
    scene.dispose();assert.throws(()=>scene.resolveStageRendererTarget('A3'));
  });
  test(`${variant}: four alpha-only flows, stable endpoints and missing diagnostics`,()=>{
    const scene=createFiveAScene({cinematicArt:resolveFiveACinematicArt('?fiveACinematic='+variant)});tick(scene);
    const review=createFiveACinematicReview({scene,replacePanel:()=>{}});
    for(const id of ['A1_TO_A2','A2_TO_A3','A3_TO_A4','A4_TO_A5']) {
      review.applyFixture('flow','low',id);tick(scene);const a=review.read();
      review.applyFixture('flow','high',id);tick(scene);const b=review.read();
      assert.ok(b.flows.renderer[id].binding.flowStrength>a.flows.renderer[id].binding.flowStrength);
      for(const [key,flow] of Object.entries(b.flows.renderer)) {
        const [source,target]=key.split('_TO_');assert.equal(flow.sourceId,source);assert.equal(flow.targetId,target);
        assert.equal(flow.particleIndices.length,108);
        flow.alphas.forEach((v,i)=>assert.ok(Math.abs(v-flow.baseAlphas[i]*flow.binding.flowStrength)<1e-6));
        if(key!==id)assert.deepEqual(flow,a.flows.renderer[key]);
      }
    }
    review.applyFixture('stages','partial');tick(scene);const partial=review.read();
    assert.equal(partial.snapshot.fiveA.stages.A2.strength.value,null);
    assert.ok(partial.stages.metadata.sourceMissingPaths.length>0);
    assert.equal(scene.resolveStageRendererTarget('O'),null);
    review.dispose();scene.dispose();
  });
  test(`${variant}: GPU matrices and visible child roots remain coincident under scale binding`,()=>{
    const scene=createFiveAScene({cinematicArt:resolveFiveACinematicArt('?fiveACinematic='+variant)});tick(scene);
    const review=createFiveACinematicReview({scene,replacePanel:()=>{}});review.applyFixture('stages','contrast');tick(scene);
    scene.group.updateMatrixWorld(true);
    const gpu=scene.group.getObjectByName('FiveAStageGpuParticleSpheres');
    for(const id of ids){
      const matrix=new THREE.Matrix4().fromArray(scene.resolveStageRendererTarget(id).read().matrix).premultiply(gpu.matrixWorld);
      const child=scene.group.getObjectByName('FiveAStageNode'+id);
      matrix.elements.forEach((v,i)=>assert.ok(Math.abs(v-child.matrixWorld.elements[i])<1e-9));
    }
    const all=scene.readTransitionRendererStates();assert.equal(all.CORE_TO_O.particleIndices.length,0);assert.equal(all.O_TO_A1.particleIndices.length,0);
    review.dispose();scene.dispose();
  });
}
test('continuous art phase moves forward, is bounded and independent of binding',()=>{
  const a=cinematicFlowTravel(12,.1,0),b=cinematicFlowTravel(12.5,.1,0);
  assert.ok(b>a);assert.ok(b-a<.04);
  for(let t=0;t<100;t++)assert.ok(cinematicFlowTravel(t,.9,20)>=0&&cinematicFlowTravel(t,.9,20)<1);
});
test('failed first review publication restores original bindings and fails closed',()=>{
  const scene=createFiveAScene({cinematicArt:resolveFiveACinematicArt('?fiveACinematic=B')});tick(scene);
  const before=Object.fromEntries(ids.map(id=>[id,scene.resolveStageRendererTarget(id).read().binding]));
  const review=createFiveACinematicReview({scene,replacePanel:()=>{throw new Error('publish failed');}});
  assert.throws(()=>review.applyFixture('stage','high'),/publish failed/);
  for(const id of ids)assert.deepEqual(scene.resolveStageRendererTarget(id).read().binding,before[id]);
  assert.throws(()=>review.applyFixture('stage','low'),/disposed/);
  review.dispose();scene.dispose();
});
