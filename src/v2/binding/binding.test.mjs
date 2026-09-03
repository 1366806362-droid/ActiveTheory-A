import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BINDING_CHANNEL,
  BINDING_CHANNELS,
  BINDING_GUARDRAILS,
  CANONICAL_BRAND_MIND_MOCK,
  CANONICAL_FIVE_A_MOCK,
  CANONICAL_GEO_MOCK,
  FIVE_A_SOURCE_MOCK,
  RENDERER_BINDING_MANIFEST,
  RENDERER_CAPABILITY_CONTRACT,
  SNAPSHOT_COMPLETENESS,
  SOURCE_ADAPTER_TYPES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  adaptSource,
  buildVisualBindingPlan,
  buildVisualState,
  getBindingPlanEntries,
  validateBindingCapabilities,
  validateVisualBindingPlan
} from '../index.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const baseVisual = buildVisualState(CANONICAL_FIVE_A_MOCK);
const basePlan = buildVisualBindingPlan(baseVisual);

test('VisualState to Binding Plan is deterministic', () => {
  assert.deepEqual(buildVisualBindingPlan(baseVisual), buildVisualBindingPlan(baseVisual));
});

test('same serialized input creates the same serialized plan', () => {
  const copy = clone(baseVisual);
  assert.equal(JSON.stringify(buildVisualBindingPlan(copy)), JSON.stringify(basePlan));
});

test('binding modules do not import Three.js or renderer classes', () => {
  const directory = fileURLToPath(new URL('./', import.meta.url));
  for (const file of listJavaScriptFiles(directory).filter((name) => !name.endsWith('.test.mjs'))) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(/(?:from\s+|import\s*)['"]three['"]/.test(source), false, file);
    assert.equal(/WebGLRenderer|ShaderMaterial|BufferGeometry|EffectComposer|new\s+Scene\s*\(|new\s+Mesh\s*\(/.test(source), false, file);
  }
});

test('HOME cannot bind position', () => {
  assert.equal(JSON.stringify(basePlan.home).toLowerCase().includes('position'), false);
});

test('HOME cannot bind camera', () => {
  assert.equal(JSON.stringify(basePlan.home).toLowerCase().includes('camera'), false);
});

test('FiveA binding uses exact A1-A5 stage IDs', () => {
  assert.deepEqual(unique(basePlan.fiveA.stages.map((entry) => entry.stageId)), ['A1', 'A2', 'A3', 'A4', 'A5']);
});

test('FiveA binding never creates A6', () => {
  assert.equal(JSON.stringify(basePlan.fiveA).includes('A6'), false);
  assert.ok(basePlan.fiveA.opportunityPool.every((entry) => entry.targetId === 'OPPORTUNITY_POOL'));
});

test('FiveA binding preserves exactly four transitions', () => {
  assert.deepEqual(unique(basePlan.fiveA.transitions.map((entry) => entry.transitionId)), [
    'A1_TO_A2', 'A2_TO_A3', 'A3_TO_A4', 'A4_TO_A5'
  ]);
});

test('stage scale values remain in the existing guardrail range', () => {
  assertChannelRange(basePlan, BINDING_CHANNEL.FIVEA_STAGE_SCALE);
});

test('stage energy values remain in the existing guardrail range', () => {
  assertChannelRange(basePlan, BINDING_CHANNEL.FIVEA_STAGE_ENERGY);
});

test('A3 scale binding is monotonic pass-through', () => {
  assertMonotonic(baseVisual, 'fiveA.stages.A3.scale', BINDING_CHANNEL.FIVEA_STAGE_SCALE, 'A3');
});

test('transition flow binding is monotonic pass-through', () => {
  assertMonotonic(baseVisual, 'fiveA.transitions.A2_TO_A3.flowStrength', BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH, 'A2_TO_A3');
});

test('GEO citation energy binding is monotonic pass-through', () => {
  const visual = buildVisualState(CANONICAL_GEO_MOCK);
  assertMonotonic(visual, 'geo.citationStream.energy', BINDING_CHANNEL.GEO_CITATION_ENERGY, 'citationStream');
});

test('GEO missing source uses safe value and retains missing diagnostic', () => {
  const snapshot = clone(CANONICAL_GEO_MOCK);
  snapshot.geo.citation.strength.value = null;
  snapshot.geo.citation.strength.verificationStatus = VERIFICATION_STATUSES.MISSING;
  const plan = buildVisualBindingPlan(buildVisualState(snapshot));
  const item = findEntry(plan, BINDING_CHANNEL.GEO_CITATION_ENERGY, 'citationStream');
  assert.equal(item.missing, true);
  assert.equal(item.value, BINDING_GUARDRAILS[item.channel].min);
  assert.ok(plan.diagnostics.sourceMissingPaths.includes('geo.citationStream.energy'));
});

test('partial GEO source is also visible in HOME binding diagnostics', () => {
  const snapshot = clone(CANONICAL_GEO_MOCK);
  snapshot.geo.citation.volume.value = null;
  snapshot.geo.citation.volume.verificationStatus = VERIFICATION_STATUSES.MISSING;
  const plan = buildVisualBindingPlan(buildVisualState(snapshot));
  const item = findEntry(plan, BINDING_CHANNEL.HOME_GEO_DENSITY, 'geoNebula');
  assert.equal(item.missing, true);
  assert.ok(plan.diagnostics.sourceMissingPaths.includes('home.geoNebula.density'));
});

test('Brand Mind association IDs are preserved as stable targets', () => {
  const plan = brandMindPlan();
  assert.deepEqual(unique(plan.brandMind.nodes.map((entry) => entry.associationId)), ['mock-association-a', 'mock-association-b']);
});

test('association brightness binding is monotonic pass-through', () => {
  const visual = buildVisualState(CANONICAL_BRAND_MIND_MOCK);
  assertMonotonic(visual, 'brandMind.associations.0.node.brightness', BINDING_CHANNEL.BRAND_MIND_NODE_BRIGHTNESS, 'mock-association-a');
});

test('relationship source and target IDs are preserved', () => {
  const paths = brandMindPlan().brandMind.paths;
  assert.ok(paths.length > 0);
  assert.ok(paths.every((entry) => entry.sourceId === 'brand-core' && entry.targetId === 'mock-association-a'));
});

test('Brand Mind core concentration binding is monotonic pass-through', () => {
  const visual = buildVisualState(CANONICAL_BRAND_MIND_MOCK);
  assertMonotonic(visual, 'brandMind.core.concentration', BINDING_CHANNEL.BRAND_MIND_CORE_CONCENTRATION, 'BRAND_MIND_CORE');
});

test('PARTIAL metadata is preserved', () => {
  const source = clone(FIVE_A_SOURCE_MOCK);
  source.metadata.sourceType = SOURCE_TYPES.PARTIAL;
  source.metadata.verificationStatus = VERIFICATION_STATUSES.UNVERIFIED;
  const plan = buildVisualBindingPlan(buildVisualState(adaptSource({ type: SOURCE_ADAPTER_TYPES.FIVE_A, payload: source })));
  assert.equal(plan.metadata.sourceType, SOURCE_TYPES.PARTIAL);
  assert.equal(plan.metadata.lineage.sourceType, SOURCE_TYPES.PARTIAL);
  assert.equal(plan.metadata.lineage.completeness, SNAPSHOT_COMPLETENESS.PARTIAL);
});

test('MOCK metadata is preserved', () => {
  assert.equal(basePlan.metadata.sourceType, SOURCE_TYPES.MOCK);
  assert.equal(basePlan.metadata.lineage.verificationStatus, VERIFICATION_STATUSES.SYNTHETIC);
});

test('lineage is preserved without rewriting', () => {
  assert.deepEqual(basePlan.metadata.lineage, baseVisual.metadata.lineage);
});

test('binding plan contains no NaN', () => {
  assert.equal(numbers(basePlan).some(Number.isNaN), false);
});

test('binding plan contains no Infinity', () => {
  assert.equal(numbers(basePlan).every(Number.isFinite), true);
});

test('unsupported renderer channel is reported explicitly', () => {
  const capabilities = {
    supportedChannels: RENDERER_CAPABILITY_CONTRACT.supportedChannels.filter((channel) => channel !== BINDING_CHANNEL.FIVEA_STAGE_SCALE)
  };
  const validation = validateBindingCapabilities(basePlan, capabilities);
  assert.equal(validation.ok, false);
  assert.deepEqual(validation.unsupportedChannels, [BINDING_CHANNEL.FIVEA_STAGE_SCALE]);
});

test('complete renderer capability contract passes', () => {
  const validation = validateBindingCapabilities(basePlan, RENDERER_CAPABILITY_CONTRACT);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
});

test('binding plan is JSON serializable', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(basePlan)), basePlan);
});

test('binding layer does not recalculate business metrics', () => {
  const item = findEntry(basePlan, BINDING_CHANNEL.FIVEA_STAGE_SCALE, 'A3');
  assert.equal(item.value, baseVisual.fiveA.stages.A3.scale);
  assert.equal(basePlan.diagnostics.recalculatedBusinessMetrics, false);
});

test('binding plan does not expose shader-specific field names', () => {
  const json = JSON.stringify(basePlan).toLowerCase();
  for (const token of ['uniform', 'shader', 'material', 'geometry', 'mesh']) {
    assert.equal(json.includes(token), false, token);
  }
});

test('binding plan validation passes for canonical fixture', () => {
  const validation = validateVisualBindingPlan(basePlan);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
});

test('all 46 channel IDs are stable and have guardrails', () => {
  assert.equal(BINDING_CHANNELS.length, 46);
  assert.equal(new Set(BINDING_CHANNELS).size, 46);
  assert.ok(BINDING_CHANNELS.every((channel) => BINDING_GUARDRAILS[channel]));
});

test('renderer binding manifest documents every channel semantically', () => {
  assert.equal(RENDERER_BINDING_MANIFEST.entries.length, 46);
  assert.deepEqual(RENDERER_BINDING_MANIFEST.entries.map((entry) => entry.channel), BINDING_CHANNELS);
  assert.ok(RENDERER_BINDING_MANIFEST.entries.every((entry) => entry.sourcePathPattern && entry.futureRendererTarget));
});

test('all binding entries use one minimum contract shape', () => {
  for (const entry of getBindingPlanEntries(basePlan)) {
    for (const key of ['channel', 'targetId', 'value', 'sourcePath', 'missing', 'confidence']) {
      assert.ok(Object.hasOwn(entry, key), `${entry.channel}.${key}`);
    }
  }
});

const results = [];
for (const current of tests) {
  try {
    await current.run();
    results.push({ name: current.name, status: 'pass' });
  } catch (error) {
    results.push({ name: current.name, status: 'fail', error: error.stack ?? String(error) });
  }
}

const passed = results.filter((entry) => entry.status === 'pass').length;
const failed = results.length - passed;
console.log(JSON.stringify({ passed, failed, results }, null, 2));
if (failed) process.exitCode = 1;

function brandMindPlan() {
  return buildVisualBindingPlan(buildVisualState(CANONICAL_BRAND_MIND_MOCK));
}

function findEntry(plan, channel, targetId) {
  return getBindingPlanEntries(plan).find((entry) => entry.channel === channel && entry.targetId === targetId);
}

function assertChannelRange(plan, channel) {
  const { min, max } = BINDING_GUARDRAILS[channel];
  const entries = getBindingPlanEntries(plan).filter((entry) => entry.channel === channel);
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.value >= min && entry.value <= max));
}

function assertMonotonic(visual, sourcePath, channel, targetId) {
  const low = clone(visual);
  const high = clone(visual);
  const bounds = BINDING_GUARDRAILS[channel];
  setPath(low, sourcePath, bounds.min);
  setPath(high, sourcePath, bounds.max);
  const lowValue = findEntry(buildVisualBindingPlan(low), channel, targetId).value;
  const highValue = findEntry(buildVisualBindingPlan(high), channel, targetId).value;
  assert.ok(highValue >= lowValue);
  assert.equal(lowValue, bounds.min);
  assert.equal(highValue, bounds.max);
}

function setPath(value, pathValue, nextValue) {
  const segments = pathValue.split('.');
  const key = segments.pop();
  const parent = segments.reduce((current, segment) => current[segment], value);
  parent[key] = nextValue;
}

function unique(values) {
  return [...new Set(values)];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function numbers(value, output = []) {
  if (typeof value === 'number') output.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach((child) => numbers(child, output));
  return output;
}

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(absolute);
    return /\.(?:js|mjs)$/.test(entry.name) ? [absolute] : [];
  });
}
