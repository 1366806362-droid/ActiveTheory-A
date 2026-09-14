import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createFiveAScene } from '../../scenes/fiveAScene.js';
import { createFiveAA3RendererAdapter } from './fiveAA3RendererAdapter.js';
import { createFiveAA3DemoSnapshot, resolveFiveAA3Demo } from '../runtime/fiveAA3Demo.js';
import { createV2ConsumerProvider } from '../runtime/consumerProvider.js';
import { buildVisualBindingPlan } from '../binding/bindingPlanner.js';
import { buildFiveADataPanelViewModel } from '../../ui/fiveA-data-panel/fiveADataPanelViewModel.js';
import { CANONICAL_FIVE_A_MOCK } from '../mock/canonicalFixtures.js';

// Canvas text drawing is stubbed, not any Three.js target, matrix, or uniform.
globalThis.window = { location: { search: '' } };
globalThis.document = { createElement: () => ({ getContext: () => ({ clearRect() {}, fillText() {} }) }) };
const tests = [];
function test(name, run) { try { run(); tests.push({ name, status: 'pass' }); } catch (e) { tests.push({ name, status: 'fail', message: e.stack }); } }
function pipeline(state) {
  const consumer = createV2ConsumerProvider({ fiveASnapshot: createFiveAA3DemoSnapshot(state) }).getFiveA();
  const visual = consumer.buildVisualState();
  return { consumer, visual, plan: buildVisualBindingPlan(visual), panel: buildFiveADataPanelViewModel(consumer.snapshot, consumer.derivedMetrics) };
}
const runs = Object.fromEntries(['low', 'baseline', 'high', 'partial'].map((state) => [state, pipeline(state)]));
const scene = createFiveAScene({ orbitalArt: null });
const adapter = createFiveAA3RendererAdapter(scene.resolveStageBindingTarget);
function tick() { scene.update({ cameraOffset: { x: 0, y: 0, z: 0, targetY: 0 } }, 1 / 60, 12, 1); }
function snapshot() {
  const gpu = scene.group.getObjectByName('FiveAStageGpuParticleSpheres');
  return {
    nodes: Object.fromEntries(['A1', 'A2', 'A3', 'A4', 'A5'].map((id) => {
      const node = scene.group.getObjectByName(`FiveAStageNode${id}`);
      return [id, { position: node.position.toArray(), rotation: node.rotation.toArray(), scale: node.scale.toArray() }];
    })),
    matrices: gpu.material.uniforms.uNodeMatrices.value.map((matrix) => matrix.toArray()),
    scales: Array.from(gpu.material.uniforms.uNodeScales.value),
    opacities: Array.from(gpu.material.uniforms.uNodeOpacities.value),
    geometry: gpu.geometry.uuid, material: gpu.material.uuid, count: gpu.geometry.attributes.position.count
  };
}
tick();
const original = snapshot();
const evidence = {};
for (const state of ['low', 'baseline', 'high', 'partial']) {
  adapter.apply(runs[state].plan); tick();
  evidence[state] = { canonical: runs[state].consumer.snapshot.fiveA.stages.A3,
    panel: runs[state].panel.stageRows.find((row) => row.stageId === 'A3'),
    visualState: runs[state].visual.fiveA.stages.A3,
    execution: adapter.getReport(), real: snapshot() };
}
test('A3 stable target found; other targets not exposed for writes', () => {
  assert.equal(scene.resolveStageBindingTarget('A3').stageId, 'A3');
  for (const id of ['A1', 'A2', 'A4', 'A5', 'A6']) assert.equal(scene.resolveStageBindingTarget(id), null);
});
test('real matrix and point-size both receive guarded scale', () => {
  const low = evidence.low.execution.renderer;
  assert.ok(Math.abs(low.pointScale / original.scales[2] - runs.low.visual.fiveA.stages.A3.scale) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...low.matrix.slice(0, 3)) / Math.hypot(...original.matrices[2].slice(0, 3)) - low.binding.scale) < 1e-6);
});
test('real existing opacity receives energy without material replacement', () => {
  assert.ok(Math.abs(evidence.low.execution.renderer.opacity / original.opacities[2] - runs.low.visual.fiveA.stages.A3.energy) < 1e-6);
});
test('low baseline high are monotonic in canonical, visual, binding and actual GPU', () => {
  for (const [a, b] of [['low', 'baseline'], ['baseline', 'high']]) {
    assert.ok(evidence[a].canonical.population.value < evidence[b].canonical.population.value);
    assert.ok(evidence[a].visualState.scale < evidence[b].visualState.scale);
    assert.ok(evidence[a].execution.renderer.pointScale < evidence[b].execution.renderer.pointScale);
    assert.ok(evidence[a].execution.renderer.opacity < evidence[b].execution.renderer.opacity);
  }
});
test('high to low returns exact real renderer state', () => { adapter.apply(runs.high.plan); tick(); adapter.apply(runs.low.plan); tick(); assert.deepEqual(snapshot(), evidence.low.real); });
test('same plan apply is idempotent', () => { const before = adapter.getReport(); adapter.apply(runs.low.plan); assert.deepEqual(adapter.getReport(), before); tick(); assert.deepEqual(snapshot(), evidence.low.real); });
for (const [slot, id] of ['A1', 'A2', 'A3', 'A4', 'A5'].entries()) {
  if (id === 'A3') continue;
  test(`${id} transform and GPU uniforms unchanged`, () => {
    for (const row of Object.values(evidence)) {
      assert.deepEqual(row.real.nodes[id], original.nodes[id]);
      assert.deepEqual(row.real.matrices[slot], original.matrices[slot]);
      assert.equal(row.real.scales[slot], original.scales[slot]);
      assert.equal(row.real.opacities[slot], original.opacities[slot]);
    }
  });
}
test('A3 permanent position and rotation unchanged', () => {
  for (const row of Object.values(evidence)) { assert.deepEqual(row.real.nodes.A3.position, original.nodes.A3.position); assert.deepEqual(row.real.nodes.A3.rotation, original.nodes.A3.rotation); }
});
test('no particle geometry, count or material rebuild', () => {
  for (const row of Object.values(evidence)) { assert.equal(row.real.geometry, original.geometry); assert.equal(row.real.material, original.material); assert.equal(row.real.count, original.count); }
});
test('canonical transitions unchanged across demo states; no A6', () => {
  for (const run of Object.values(runs)) {
    assert.deepEqual(run.consumer.snapshot.fiveA.transitions, CANONICAL_FIVE_A_MOCK.fiveA.transitions);
    assert.deepEqual(Object.keys(run.consumer.snapshot.fiveA.stages), ['A1', 'A2', 'A3', 'A4', 'A5']);
  }
});
function invalid(mutator) { const plan = structuredClone(runs.low.plan); mutator(plan); const before = adapter.getReport(); assert.throws(() => adapter.apply(plan)); assert.deepEqual(adapter.getReport(), before); }
test('wrong target rejected atomically', () => invalid((p) => { p.fiveA.stages.find((e) => e.stageId === 'A3').targetId = 'A2'; }));
test('unsupported channel rejected', () => invalid((p) => { p.fiveA.stages.find((e) => e.stageId === 'A3').channel = 'UNKNOWN'; }));
test('duplicate scale rejected', () => invalid((p) => { p.fiveA.stages.push({ ...p.fiveA.stages.find((e) => e.stageId === 'A3') }); }));
test('guardrail violation rejected without mutation', () => invalid((p) => { p.fiveA.stages.find((e) => e.stageId === 'A3').value = 50; }));
for (const value of [NaN, Infinity]) test(`${value} rejected`, () => invalid((p) => { p.fiveA.stages.find((e) => e.stageId === 'A3').value = value; }));
test('partial and missing source remain explicit', () => {
  assert.equal(evidence.partial.canonical.confidence.value, null);
  assert.equal(evidence.partial.execution.metadata.sourceType, 'PARTIAL');
  // The frozen mapping records affected visual paths, not raw source paths.
  assert.ok(evidence.partial.execution.metadata.sourceMissingPaths.includes('fiveA.stages.A3.activity'));
  assert.equal(evidence.partial.execution.metadata.lineage.verificationStatus, 'SYNTHETIC');
});
test('same snapshot drives panel and renderer, with MOCK identity preserved', () => {
  for (const [state, run] of Object.entries(runs)) {
    const row = run.panel.stageRows.find((r) => r.stageId === 'A3');
    assert.equal(row.population, run.consumer.snapshot.fiveA.stages.A3.population.value);
    assert.equal(evidence[state].execution.metadata.snapshotId, run.panel.header.snapshotId);
    assert.equal(evidence[state].execution.renderer.binding.scale, run.visual.fiveA.stages.A3.scale);
  }
});
test('panel presentation open and close do not alter binding source', () => {
  const before = adapter.getReport().metadata;
  scene.setPanelPresentationOpen(true); tick(); scene.setPanelPresentationOpen(false); tick();
  assert.deepEqual(adapter.getReport().metadata, before);
});
test('reordered binding entries preserve stable A3 targeting', () => { const p = structuredClone(runs.high.plan); p.fiveA.stages.reverse(); adapter.apply(p); tick(); assert.deepEqual(snapshot(), evidence.high.real); });
test('target hook refuses out of guardrail / unsupported writes', () => { assert.throws(() => scene.resolveStageBindingTarget('A3').write({ scale: 3, energy: 1 })); assert.throws(() => scene.resolveStageBindingTarget('A3').write({ scale: 1, energy: 1, density: 1 })); });
test('missing population uses declared fallback without converting canonical null to zero', () => {
  const source = structuredClone(createFiveAA3DemoSnapshot('partial'));
  source.fiveA.stages.A3.population = { value: null, source: null, confidence: null, verificationStatus: 'MISSING' };
  const consumer = createV2ConsumerProvider({ fiveASnapshot: source }).getFiveA();
  adapter.apply(buildVisualBindingPlan(consumer.buildVisualState())); tick();
  assert.equal(source.fiveA.stages.A3.population.value, null);
  assert.equal(adapter.getReport().renderer.binding.scale, 0.75);
  assert.ok(adapter.getReport().metadata.entries.find((e) => e.channel === 'FIVEA_STAGE_SCALE').missing);
});
test('target write failure rolls back complete state', () => {
  let state = { scale: 1, energy: 1 };
  let fail = true;
  const target = { stageId: 'A3', read: () => ({ binding: { ...state } }), write(next) { state = { ...next }; if (fail) { fail = false; throw new Error('simulated write failure'); } } };
  const a = createFiveAA3RendererAdapter(() => target);
  assert.throws(() => a.apply(runs.low.plan));
  assert.deepEqual(state, { scale: 1, energy: 1 });
  assert.equal(a.getReport().metadata, null); a.dispose();
});
test('adapter disposal restores frozen art and releases target', () => { adapter.dispose(); tick(); assert.deepEqual(snapshot(), original); adapter.dispose(); assert.equal(adapter.getReport().renderer, null); assert.throws(() => adapter.apply(runs.low.plan)); });
test('destroyed scene target cannot be reused', () => { const target = scene.resolveStageBindingTarget('A3'); scene.dispose(); assert.throws(() => target.read()); assert.throws(() => scene.resolveStageBindingTarget('A3')); });
test('reopening creates an independent real target', () => { const next = createFiveAScene(); const a = createFiveAA3RendererAdapter(next.resolveStageBindingTarget); a.apply(runs.high.plan); assert.equal(a.getReport().renderer.binding.scale, 1.25); a.dispose(); next.dispose(); });
test('normal and production URLs leave frozen art unbound', () => { assert.equal(resolveFiveAA3Demo('?scene=fivea', true), null); assert.equal(resolveFiveAA3Demo('?v2FiveAA3State=high', false), null); });
test('demo states are deterministic; unknown input rejected', () => { assert.deepEqual(createFiveAA3DemoSnapshot('low'), createFiveAA3DemoSnapshot('low')); assert.throws(() => createFiveAA3DemoSnapshot('bogus')); });
test('adapter has no RAF, listeners, renderer, source normalization or panel DOM', () => {
  const source = readFileSync(new URL('./fiveAA3RendererAdapter.js', import.meta.url), 'utf8');
  for (const token of ['requestAnimationFrame', 'addEventListener', 'WebGLRenderer', 'document.', 'normalize', 'deriveFiveA']) assert.ok(!source.includes(token));
});
test('runtime creates adapter only once and disposes before scene manager', () => {
  const source = readFileSync(new URL('../../engine/index.js', import.meta.url), 'utf8');
  assert.equal((source.match(/createFiveAA3RendererAdapter\(/g) ?? []).length, 1);
  assert.ok(source.indexOf('a3Adapter?.dispose()') < source.indexOf('sceneManager.dispose()'));
  assert.ok(source.includes('a3Adapter?.apply(a3Plan)'));
});

const summary = { passed: tests.filter((t) => t.status === 'pass').length, failed: tests.filter((t) => t.status === 'fail').length, results: tests };
console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes('--report')) {
  const folder = new URL('../../../art/v2-3b-fivea-a3/', import.meta.url);
  mkdirSync(folder, { recursive: true });
  writeFileSync(new URL('a3-values.json', folder), JSON.stringify({ ...summary, evidence }, null, 2));
}
if (summary.failed) process.exitCode = 1;
