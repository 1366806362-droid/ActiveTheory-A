import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BINDING_CHANNEL } from '../binding/bindingChannels.js';
import { rollbackBindingApply } from './bindingRollback.js';
import { applyBindingPlan, diffRendererState } from './bindingExecutor.js';
import {
  clonePlan,
  createDefaultFakeRendererState,
  createShuffledFakeRendererState,
  getReplayPlan,
  withoutCapability,
  runReplayToFakeRenderer
} from './dryRunFixtures.js';
import { relationshipTargetKey } from './fakeRendererState.js';
import { createRendererDryRunReport, formatRendererDryRunReport } from './dryRunReport.js';

const results = [];
const growthPlan = getReplayPlan('FIVEA_A3_GROWTH', 2);
const brandMindPlan = getReplayPlan('BRAND_MIND_ASSOCIATION_GROWTH', 2);
const geoPlan = getReplayPlan('GEO_CITATION_STRENGTH', 2);

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', error: error.message });
  }
}

function entry(plan, channel, targetId) {
  const value = allEntries(plan).find((item) => item.channel === channel && item.targetId === targetId);
  assert.ok(value, `Missing binding entry ${channel}:${targetId}`);
  return value;
}

function allEntries(plan) {
  return [
    ...plan.home.entries, ...plan.geo.entries, ...plan.fiveA.stages,
    ...plan.fiveA.transitions, ...plan.fiveA.opportunityPool,
    ...plan.brandMind.core, ...plan.brandMind.nodes, ...plan.brandMind.paths
  ];
}

test('apply is deterministic', () => {
  const first = applyBindingPlan(growthPlan, createDefaultFakeRendererState(growthPlan));
  const second = applyBindingPlan(growthPlan, createDefaultFakeRendererState(growthPlan));
  assert.equal(JSON.stringify(first.nextState), JSON.stringify(second.nextState));
});

test('reapply is idempotent', () => {
  const first = applyBindingPlan(growthPlan, createDefaultFakeRendererState(growthPlan));
  const second = applyBindingPlan(growthPlan, first.nextState);
  assert.equal(JSON.stringify(first.nextState), JSON.stringify(second.nextState));
});

test('atomic validation leaves state unchanged', () => {
  const state = createDefaultFakeRendererState(growthPlan);
  const before = JSON.stringify(state);
  const invalid = clonePlan(growthPlan);
  invalid.fiveA.stages.find((item) => item.targetId === 'A3').value = Number.NaN;
  const result = applyBindingPlan(invalid, state);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result.nextState), before);
  assert.equal(JSON.stringify(state), before);
});

test('rollback fully restores the previous state', () => {
  const state = createDefaultFakeRendererState(growthPlan);
  const result = applyBindingPlan(growthPlan, state);
  const rollback = rollbackBindingApply(result);
  assert.equal(rollback.ok, true);
  assert.equal(JSON.stringify(rollback.state), JSON.stringify(state));
});

test('unsupported channel fails explicitly', () => {
  const channel = BINDING_CHANNEL.FIVEA_STAGE_SCALE;
  const result = applyBindingPlan(growthPlan, createDefaultFakeRendererState(growthPlan), withoutCapability(channel));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === 'UNSUPPORTED_CHANNEL' && item.channel === channel));
});

test('unknown target fails explicitly', () => {
  const state = createDefaultFakeRendererState(growthPlan);
  delete state.fiveA.stages.A3;
  const result = applyBindingPlan(growthPlan, state);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === 'TARGET_NOT_FOUND' && item.targetId === 'A3'));
});

test('A6 is never created as a fake renderer stage', () => {
  const plan = clonePlan(growthPlan);
  plan.fiveA.stages.find((item) => item.targetId === 'A3').targetId = 'A6';
  const state = createDefaultFakeRendererState(growthPlan);
  const result = applyBindingPlan(plan, state);
  assert.equal(result.ok, false);
  assert.equal(Object.hasOwn(state.fiveA.stages, 'A6'), false);
});

test('NaN binding values are rejected', () => {
  const plan = clonePlan(growthPlan);
  plan.geo.entries[0].value = Number.NaN;
  const result = applyBindingPlan(plan, createDefaultFakeRendererState(plan));
  assert.ok(result.errors.some((item) => item.code === 'INVALID_VALUE'));
});

test('Infinity binding values are rejected', () => {
  const plan = clonePlan(growthPlan);
  plan.geo.entries[0].value = Number.POSITIVE_INFINITY;
  const result = applyBindingPlan(plan, createDefaultFakeRendererState(plan));
  assert.ok(result.errors.some((item) => item.code === 'INVALID_VALUE'));
});

test('safe fallbacks apply while missing provenance is preserved', () => {
  const partialPlan = getReplayPlan('PARTIAL_DATA_DEGRADATION', 2);
  const result = applyBindingPlan(partialPlan, createDefaultFakeRendererState(partialPlan));
  const metadata = result.nextState.bindingMetadata[`${BINDING_CHANNEL.FIVEA_STAGE_ACTIVITY}|A3||`];
  assert.equal(result.ok, true);
  assert.equal(metadata.missing, true);
  assert.ok(result.nextState.diagnostics.sourceMissingPaths.includes('fiveA.stages.A3.activity'));
});

test('FiveA A1 writes by stable target ID', () => {
  const result = applyBindingPlan(growthPlan, createDefaultFakeRendererState(growthPlan));
  assert.equal(result.nextState.fiveA.stages.A1.scale, entry(growthPlan, BINDING_CHANNEL.FIVEA_STAGE_SCALE, 'A1').value);
});

test('FiveA A3 writes by stable target ID', () => {
  const result = applyBindingPlan(growthPlan, createDefaultFakeRendererState(growthPlan));
  assert.equal(result.nextState.fiveA.stages.A3.density, entry(growthPlan, BINDING_CHANNEL.FIVEA_STAGE_DENSITY, 'A3').value);
});

test('FiveA A5 writes by stable target ID', () => {
  const result = applyBindingPlan(growthPlan, createDefaultFakeRendererState(growthPlan));
  assert.equal(result.nextState.fiveA.stages.A5.energy, entry(growthPlan, BINDING_CHANNEL.FIVEA_STAGE_ENERGY, 'A5').value);
});

test('FiveA fake state contains exactly four canonical transitions', () => {
  const state = createDefaultFakeRendererState(growthPlan);
  assert.deepEqual(Object.keys(state.fiveA.transitions), ['A1_TO_A2', 'A2_TO_A3', 'A3_TO_A4', 'A4_TO_A5']);
});

test('FiveA transition flow retains stable transition ID', () => {
  const result = applyBindingPlan(growthPlan, createDefaultFakeRendererState(growthPlan));
  const target = entry(growthPlan, BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH, 'A2_TO_A3');
  assert.equal(result.nextState.fiveA.transitions.A2_TO_A3.flowStrength, target.value);
});

test('Brand Mind association node uses its stable association ID', () => {
  const result = applyBindingPlan(brandMindPlan, createDefaultFakeRendererState(brandMindPlan));
  const target = entry(brandMindPlan, BINDING_CHANNEL.BRAND_MIND_NODE_BRIGHTNESS, 'mock-association-a');
  assert.equal(result.nextState.brandMind.nodes['mock-association-a'].brightness, target.value);
});

test('Brand Mind association object reorder cannot change binding destination', () => {
  const result = applyBindingPlan(brandMindPlan, createShuffledFakeRendererState(brandMindPlan));
  const target = entry(brandMindPlan, BINDING_CHANNEL.BRAND_MIND_NODE_SCALE, 'mock-association-a');
  assert.equal(result.nextState.brandMind.nodes['mock-association-a'].scale, target.value);
});

test('Brand Mind relationship path uses stable source and target IDs', () => {
  const result = applyBindingPlan(brandMindPlan, createDefaultFakeRendererState(brandMindPlan));
  const target = brandMindPlan.brandMind.paths.find((item) => item.channel === BINDING_CHANNEL.BRAND_MIND_PATH_FLOW_STRENGTH);
  const key = relationshipTargetKey(target.sourceId, target.targetId);
  assert.equal(result.nextState.brandMind.paths[key].flowStrength, target.value);
});

test('Brand Mind relationship object reorder cannot change binding destination', () => {
  const result = applyBindingPlan(brandMindPlan, createShuffledFakeRendererState(brandMindPlan));
  const target = brandMindPlan.brandMind.paths[0];
  const key = relationshipTargetKey(target.sourceId, target.targetId);
  assert.equal(result.nextState.brandMind.paths[key].visibility, brandMindPlan.brandMind.paths.find((item) => item.channel === BINDING_CHANNEL.BRAND_MIND_PATH_VISIBILITY).value);
});

test('GEO Answer target receives its current contract channels', () => {
  const result = applyBindingPlan(geoPlan, createDefaultFakeRendererState(geoPlan));
  assert.equal(result.nextState.geo.answer.density, entry(geoPlan, BINDING_CHANNEL.GEO_ANSWER_DENSITY, 'answerStream').value);
});

test('GEO Citation target receives its current contract channels', () => {
  const result = applyBindingPlan(geoPlan, createDefaultFakeRendererState(geoPlan));
  assert.equal(result.nextState.geo.citation.energy, entry(geoPlan, BINDING_CHANNEL.GEO_CITATION_ENERGY, 'citationStream').value);
});

test('GEO Keyword target receives its current contract channels', () => {
  const result = applyBindingPlan(geoPlan, createDefaultFakeRendererState(geoPlan));
  assert.equal(result.nextState.geo.keyword.flowSpeed, entry(geoPlan, BINDING_CHANNEL.GEO_KEYWORD_FLOW_SPEED, 'keywordStream').value);
});

test('GEO Signal Core target receives its current contract channels', () => {
  const result = applyBindingPlan(geoPlan, createDefaultFakeRendererState(geoPlan));
  assert.equal(result.nextState.geo.signalCore.energy, entry(geoPlan, BINDING_CHANNEL.GEO_SIGNAL_CORE_ENERGY, 'signalCore').value);
});

test('HOME position is rejected as outside the binding contract', () => {
  const plan = clonePlan(growthPlan);
  plan.home.entries.push({ channel: 'HOME_POSITION', targetId: 'geoNebula', value: 0, sourcePath: 'home.geoNebula.position', missing: false, confidence: 1 });
  const result = applyBindingPlan(plan, createDefaultFakeRendererState(growthPlan));
  assert.ok(result.errors.some((item) => item.code === 'UNKNOWN_CHANNEL' && item.channel === 'HOME_POSITION'));
});

test('HOME camera is rejected as outside the binding contract', () => {
  const plan = clonePlan(growthPlan);
  plan.home.entries.push({ channel: 'HOME_CAMERA', targetId: 'geoNebula', value: 0, sourcePath: 'home.camera', missing: false, confidence: 1 });
  const result = applyBindingPlan(plan, createDefaultFakeRendererState(growthPlan));
  assert.ok(result.errors.some((item) => item.code === 'UNKNOWN_CHANNEL' && item.channel === 'HOME_CAMERA'));
});

test('Replay to renderer preserves FiveA A3 growth direction', () => {
  const replay = runReplayToFakeRenderer('FIVEA_A3_GROWTH');
  const values = replay.frames.map((frame) => frame.rendererState.fiveA.stages.A3.scale);
  assert.ok(values[0] < values[1] && values[1] < values[2]);
});

test('Replay to renderer preserves Brand Mind node growth direction', () => {
  const replay = runReplayToFakeRenderer('BRAND_MIND_ASSOCIATION_GROWTH');
  const values = replay.frames.map((frame) => frame.rendererState.brandMind.nodes['mock-association-a'].brightness);
  assert.ok(values[0] < values[1] && values[1] < values[2]);
});

test('Replay to renderer preserves GEO citation growth direction', () => {
  const replay = runReplayToFakeRenderer('GEO_CITATION_STRENGTH');
  const values = replay.frames.map((frame) => frame.rendererState.geo.citation.energy);
  assert.ok(values[0] < values[1] && values[1] < values[2]);
});

test('dynamic association targets absent from next plan are marked inactive', () => {
  const state = createDefaultFakeRendererState(brandMindPlan);
  const first = applyBindingPlan(brandMindPlan, state);
  const nextPlan = clonePlan(brandMindPlan);
  nextPlan.brandMind.nodes = nextPlan.brandMind.nodes.filter((item) => item.targetId !== 'mock-association-b');
  const second = applyBindingPlan(nextPlan, first.nextState);
  assert.equal(second.ok, true);
  assert.equal(second.nextState.brandMind.nodes['mock-association-b'].active, false);
});

test('fake renderer state is JSON serializable', () => {
  const result = applyBindingPlan(growthPlan, createDefaultFakeRendererState(growthPlan));
  assert.deepEqual(JSON.parse(JSON.stringify(result.nextState)), result.nextState);
});

test('renderer state diff is compact and identifies changed paths', () => {
  const state = createDefaultFakeRendererState(growthPlan);
  const result = applyBindingPlan(growthPlan, state);
  const diff = diffRendererState(state, result.nextState);
  assert.ok(diff.some((item) => item.path === 'fiveA.stages.A3.scale'));
});

test('dry-run report is compact and explicitly non-rendering', () => {
  const report = createRendererDryRunReport();
  assert.equal(report.doesRender, false);
  assert.match(formatRendererDryRunReport(report), /DOES NOT RENDER/);
});

test('renderer dry-run modules do not import Three.js or renderer classes', () => {
  const directory = fileURLToPath(new URL('./', import.meta.url));
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.js') || name.endsWith('.mjs')).filter((name) => !name.endsWith('.test.mjs'))) {
    const source = readFileSync(new URL(file, new URL('./', import.meta.url)), 'utf8');
    assert.equal(/from\s+['\"]three|WebGLRenderer|ShaderMaterial|BufferGeometry|EffectComposer|new\s+Scene\s*\(/.test(source), false, file);
  }
});

const passed = results.filter((result) => result.status === 'pass').length;
const failed = results.length - passed;
console.log(JSON.stringify({ passed, failed, results }, null, 2));
if (failed > 0) process.exitCode = 1;
