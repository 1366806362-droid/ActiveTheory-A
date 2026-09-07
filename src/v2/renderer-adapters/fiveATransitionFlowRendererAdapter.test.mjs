import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createFiveAScene } from '../../scenes/fiveAScene.js';
import { createFiveAStageRendererAdapter } from './fiveAStageRendererAdapter.js';
import { createFiveATransitionFlowRendererAdapter, FIVE_A_FLOW_TRANSITION_IDS as IDS } from './fiveAFlowRendererAdapter.js';
import { createFiveATransitionsDemoSnapshot, resolveFiveATransitionsDemo } from '../runtime/fiveAFlowDemo.js';
import { CANONICAL_FIVE_A_MOCK } from '../mock/canonicalFixtures.js';
import { createV2ConsumerProvider } from '../runtime/consumerProvider.js';
import { buildVisualBindingPlan } from '../binding/bindingPlanner.js';
import { buildFiveADataPanelViewModel } from '../../ui/fiveA-data-panel/fiveADataPanelViewModel.js';

globalThis.window = { location: { search: '' } };
globalThis.document = { createElement: () => ({ getContext: () => ({ clearRect() {}, fillText() {} }) }) };
const results = [];
function test(name, run) { try { run(); results.push({ name, status: 'pass' }); } catch (error) { results.push({ name, status: 'fail', error: error.stack }); } }
function pipeline(id, state) {
  const consumer = createV2ConsumerProvider({ fiveASnapshot: createFiveATransitionsDemoSnapshot(id, state) }).getFiveA();
  const visual = consumer.buildVisualState();
  return { consumer, visual, plan: buildVisualBindingPlan(visual), panel: buildFiveADataPanelViewModel(consumer.snapshot, consumer.derivedMetrics) };
}
const scene = createFiveAScene();
const adapter = createFiveATransitionFlowRendererAdapter(scene.resolveTransitionRendererTarget);
const stageAdapter = createFiveAStageRendererAdapter(scene.resolveStageRendererTarget);
const tick = (time = 12, progress = 1) => scene.update({ cameraOffset: { x: 0, y: 0, z: 0, targetY: 0 } }, 0, time, progress);
tick();
const originalSegments = scene.readTransitionRendererStates();
const gpu = scene.group.getObjectByName('FiveACoreReleaseParticleFlow');
const resource = { geometry: gpu.geometry.uuid, material: gpu.material.uuid, count: gpu.geometry.attributes.position.count, vertex: gpu.material.vertexShader, fragment: gpu.material.fragmentShader, positions: [...gpu.geometry.attributes.position.array] };
const stageBaseline = pipeline('A1_TO_A2', 'baseline'); stageAdapter.apply(stageBaseline.plan); tick(); const originalStages = stageAdapter.getReport().renderer;
const evidence = {};

for (const id of IDS) {
  const baseline = pipeline(id, 'baseline'); const low = pipeline(id, 'low'); const high = pipeline(id, 'high'); const partial = pipeline(id, 'partial');
  evidence[id] = { baseline, low, high, partial };
  test(`${id} uses a stable real target with actual endpoints`, () => {
    const target = scene.resolveTransitionRendererTarget(id); assert.equal(target.transitionId, id);
    assert.deepEqual([target.read().sourceId, target.read().targetId], id.split('_TO_'));
  });
  test(`${id} changes only its synthetic tracked cohort`, () => {
    for (const other of IDS.filter(key => key !== id)) assert.deepEqual(low.consumer.snapshot.fiveA.transitions[other], CANONICAL_FIVE_A_MOCK.fiveA.transitions[other]);
    assert.deepEqual(low.consumer.snapshot.fiveA.stages, CANONICAL_FIVE_A_MOCK.fiveA.stages);
    assert.deepEqual(low.consumer.snapshot.fiveA.opportunityPool, CANONICAL_FIVE_A_MOCK.fiveA.opportunityPool);
    const t = high.consumer.snapshot.fiveA.transitions[id]; assert.equal(t.out.value / t.in.value, t.rate.value); assert.equal(t.strength.value, null);
  });
  test(`${id} LOW business fact maps monotonically to Binding and actual alpha`, () => {
    adapter.apply(low.plan); tick(); const actualLow = adapter.getReport().renderer[id];
    adapter.apply(high.plan); tick(); const actualHigh = adapter.getReport().renderer[id];
    assert.ok(low.panel.transitionRows.find(row => row.transitionId === id).conversionRate < high.panel.transitionRows.find(row => row.transitionId === id).conversionRate);
    assert.ok(low.visual.fiveA.transitions[id].flowStrength < high.visual.fiveA.transitions[id].flowStrength);
    assert.equal(actualLow.binding.flowStrength, low.visual.fiveA.transitions[id].flowStrength);
    assert.equal(actualHigh.binding.flowStrength, high.visual.fiveA.transitions[id].flowStrength);
    assert.ok(actualHigh.alphas.every((value, index) => value >= actualLow.alphas[index]));
  });
  test(`${id} isolated update leaves other three actual transition targets unchanged`, () => {
    adapter.apply(baseline.plan); tick(); const before = adapter.getReport().renderer;
    adapter.apply(low.plan); tick(); const after = adapter.getReport().renderer;
    for (const other of IDS.filter(key => key !== id)) assert.deepEqual(after[other], before[other]);
  });
  test(`${id} PARTIAL preserves missing cohort facts with guarded real fallback`, () => {
    const t = partial.consumer.snapshot.fiveA.transitions[id]; const row = partial.panel.transitionRows.find(value => value.transitionId === id);
    adapter.apply(partial.plan); tick(); const actual = adapter.getReport().renderer[id];
    assert.equal(t.out.value, null); assert.equal(t.rate.value, null); assert.equal(row.outPopulation, null); assert.equal(row.conversionRate, null);
    assert.equal(actual.binding.flowStrength, 0.1); assert.ok(adapter.getReport().metadata.sourceMissingPaths.includes(`fiveA.transitions.${id}.flowStrength`));
  });
}
test('all four targets are allowed; CORE/O Opportunity segments are not', () => {
  assert.deepEqual(adapter.getReport().transitionIds, IDS);
  assert.equal(scene.resolveTransitionRendererTarget('CORE_TO_O'), null); assert.equal(scene.resolveTransitionRendererTarget('O_TO_A1'), null); assert.equal(scene.resolveTransitionRendererTarget('A5_TO_A6'), null);
});
test('same generic plan is idempotent and HIGH LOW switching does not accumulate', () => {
  const high = evidence.A2_TO_A3.high, low = evidence.A2_TO_A3.low;
  for (let index = 0; index < 100; index += 1) { adapter.apply(high.plan); adapter.apply(low.plan); }
  const expected = adapter.getReport(); adapter.apply(low.plan); assert.deepEqual(adapter.getReport(), expected);
});
test('one target write failure rolls all touched transitions back atomically', () => {
  const values = new Map(IDS.map(id => [id, { flowStrength: 1 }])); let calls = 0;
  const failing = createFiveATransitionFlowRendererAdapter(id => ({ transitionId: id, read: () => ({ binding: { ...values.get(id) } }), write: value => { calls += 1; values.set(id, { ...value }); if (calls === 3) throw new Error('simulated failure'); } }));
  assert.throws(() => failing.apply(evidence.A1_TO_A2.low.plan)); assert.deepEqual(Object.fromEntries(values), Object.fromEntries(IDS.map(id => [id, { flowStrength: 1 }]))); failing.dispose();
});
test('illegal target, duplicate channel, NaN and Infinity never partially write', () => {
  for (const mutate of [
    plan => { plan.fiveA.transitions.find(e => e.transitionId === 'A3_TO_A4' && e.channel.endsWith('FLOW_STRENGTH')).targetId = 'bad'; },
    plan => { plan.fiveA.transitions.push(structuredClone(plan.fiveA.transitions.find(e => e.transitionId === 'A3_TO_A4' && e.channel.endsWith('FLOW_STRENGTH')))); },
    plan => { plan.fiveA.transitions.find(e => e.transitionId === 'A3_TO_A4' && e.channel.endsWith('FLOW_STRENGTH')).value = NaN; },
    plan => { plan.fiveA.transitions.find(e => e.transitionId === 'A3_TO_A4' && e.channel.endsWith('FLOW_STRENGTH')).value = Infinity; }
  ]) { const plan = structuredClone(evidence.A3_TO_A4.high.plan); const before = adapter.getReport(); mutate(plan); assert.throws(() => adapter.apply(plan)); assert.deepEqual(adapter.getReport(), before); }
});
test('stage bindings, existing batch resources and all path positions remain art-owned', () => {
  adapter.apply(evidence.A4_TO_A5.high.plan); tick(); assert.deepEqual(stageAdapter.getReport().renderer, originalStages);
  assert.deepEqual({ geometry: gpu.geometry.uuid, material: gpu.material.uuid, count: gpu.geometry.attributes.position.count, vertex: gpu.material.vertexShader, fragment: gpu.material.fragmentShader, positions: [...gpu.geometry.attributes.position.array] }, resource);
});
test('same-time release/capture/stable phase stays continuous; speed is not written', () => {
  for (const progress of [0.3, 0.6, 1]) { adapter.apply(evidence.A1_TO_A2.low.plan); tick(12.25, progress); const before = [...gpu.geometry.attributes.position.array]; adapter.apply(evidence.A1_TO_A2.high.plan); tick(12.25, progress); assert.deepEqual([...gpu.geometry.attributes.position.array], before); }
  assert.deepEqual(Object.keys(adapter.getReport().renderer.A1_TO_A2.binding), ['flowStrength']);
});
test('scene reopen has fresh targets and adapter disposal restores all art', () => {
  const targets = IDS.map(id => scene.resolveTransitionRendererTarget(id)); adapter.dispose(); for (const target of targets) assert.equal(target.read().binding.flowStrength, 1); stageAdapter.dispose(); scene.dispose(); for (const target of targets) assert.throws(() => target.read()); const fresh = createFiveAScene(); for (const id of IDS) assert.equal(fresh.resolveTransitionRendererTarget(id).read().binding.flowStrength, 1); fresh.dispose();
});
test('fixture resolver is development-only, deterministic, and does not calculate per frame', () => {
  assert.deepEqual(createFiveATransitionsDemoSnapshot('A1_TO_A2', 'high'), createFiveATransitionsDemoSnapshot('A1_TO_A2', 'high'));
  assert.equal(resolveFiveATransitionsDemo('', true), null); assert.equal(resolveFiveATransitionsDemo('?v2FiveATransition=A1_TO_A2&v2FiveATransitionState=high', false), null);
  assert.throws(() => createFiveATransitionsDemoSnapshot('CORE_TO_O', 'high'));
  const source = readFileSync(new URL('../../engine/index.js', import.meta.url), 'utf8'); const adapterSource = readFileSync(new URL('./fiveAFlowRendererAdapter.js', import.meta.url), 'utf8');
  assert.equal((source.match(/createV2ConsumerProvider\(/g) || []).length, 1); assert.doesNotMatch(adapterSource, /requestAnimationFrame|normalizeDataPoint|deriveFiveAMetrics|document\./);
});
const summary = { passed: results.filter(result => result.status === 'pass').length, failed: results.filter(result => result.status === 'fail').length, results };
console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes('--report')) { const folder = new URL('../../../art/v2-3b-fivea-transitions/', import.meta.url); mkdirSync(folder, { recursive: true }); writeFileSync(new URL('transition-values.json', folder), JSON.stringify({ summary, evidence }, null, 2)); }
if (summary.failed) process.exitCode = 1;
