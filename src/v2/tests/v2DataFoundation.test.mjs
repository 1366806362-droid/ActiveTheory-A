import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ART_DIRECTION_GUARDRAILS,
  BRAND_UNIVERSE_MOCKS,
  BRAND_UNIVERSE_SCHEMA_VERSION,
  MOCK_BALANCED,
  MOCK_FIVE_A_BOTTLENECK,
  MOCK_GEO_OPPORTUNITY,
  SOURCE_TYPES,
  VISUAL_MAPPING_CONTRACT,
  adaptBrandUniverseSource,
  buildVisualState,
  normalizeBounded,
  normalizeClamped,
  normalizeLinear,
  normalizeLog,
  validateSnapshot,
  validateVisualState
} from '../index.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('valid canonical snapshots pass validation', () => {
  for (const snapshot of Object.values(BRAND_UNIVERSE_MOCKS)) {
    const validation = validateSnapshot(snapshot);
    assert.equal(validation.ok, true, validation.errors.join('\n'));
  }
});

test('partial snapshot passes with explicit fallback warnings', () => {
  const snapshot = partialSnapshot({ fiveA: null, brandMind: null });
  const validation = validateSnapshot(snapshot);
  assert.equal(validation.ok, true);
  assert.ok(validation.warnings.some((warning) => warning.includes('fiveA module is missing')));
  assert.ok(validation.warnings.some((warning) => warning.includes('brandMind module is missing')));
});

test('missing GEO is safe and stays unavailable', () => {
  const state = buildVisualState(partialSnapshot({ geo: null }));
  assert.equal(state.availability.geo, false);
  assert.equal(state.home.geoNebula.availability, 'MISSING');
});

test('missing 5A is safe and preserves all canonical stage outputs', () => {
  const state = buildVisualState(partialSnapshot({ fiveA: null }));
  assert.equal(state.availability.fiveA, false);
  assert.deepEqual(Object.keys(state.fiveA.stages), ['A1', 'A2', 'A3', 'A4', 'A5']);
});

test('missing Brand Mind is safe', () => {
  const state = buildVisualState(partialSnapshot({ brandMind: null }));
  assert.equal(state.availability.brandMind, false);
  assert.deepEqual(state.brandMind.associations, []);
});

test('negative values are accepted with warnings and safely clamped', () => {
  const snapshot = clone(MOCK_BALANCED);
  snapshot.geo.answer.volume.value = -900;
  const validation = validateSnapshot(snapshot);
  assert.equal(validation.ok, true);
  assert.ok(validation.warnings.some((warning) => warning.includes('negative')));
  const state = buildVisualState(snapshot);
  assert.equal(state.geo.answerStream.density, ART_DIRECTION_GUARDRAILS.density.min);
});

test('extreme values clamp to visual maxima', () => {
  const snapshot = clone(MOCK_BALANCED);
  snapshot.geo.citation.strength.value = Number.MAX_VALUE;
  snapshot.fiveA.stages.A3.population.value = Number.MAX_VALUE;
  const state = buildVisualState(snapshot);
  assert.equal(state.geo.citationStream.energy, ART_DIRECTION_GUARDRAILS.energy.max);
  assert.equal(state.fiveA.stages.A3.scale, ART_DIRECTION_GUARDRAILS.stageScale.max);
});

test('VisualState never contains NaN', () => {
  const snapshot = clone(MOCK_BALANCED);
  snapshot.geo.keyword.quality.value = null;
  assert.equal(findNumbers(buildVisualState(snapshot)).some(Number.isNaN), false);
});

test('VisualState never contains Infinity', () => {
  const raw = clone(MOCK_BALANCED);
  raw.geo.keyword.quality.value = Infinity;
  const snapshot = adaptBrandUniverseSource(raw, { expectedSourceType: SOURCE_TYPES.MOCK });
  assert.equal(findNumbers(buildVisualState(snapshot)).every(Number.isFinite), true);
});

test('VisualState generation is deterministic', () => {
  assert.deepEqual(buildVisualState(MOCK_BALANCED), buildVisualState(MOCK_BALANCED));
});

test('higher A3 population cannot produce a smaller A3 visual scale', () => {
  const lower = clone(MOCK_BALANCED);
  const higher = clone(MOCK_BALANCED);
  lower.fiveA.stages.A3.population.value = 12000;
  higher.fiveA.stages.A3.population.value = 72000;
  assert.ok(
    buildVisualState(higher).fiveA.stages.A3.scale
    >= buildVisualState(lower).fiveA.stages.A3.scale
  );
});

test('stronger citation cannot reduce citation energy', () => {
  const weaker = clone(MOCK_BALANCED);
  const stronger = clone(MOCK_BALANCED);
  weaker.geo.citation.strength.value = 20;
  stronger.geo.citation.strength.value = 90;
  assert.ok(
    buildVisualState(stronger).geo.citationStream.energy
    >= buildVisualState(weaker).geo.citationStream.energy
  );
});

test('weak A2_TO_A3 produces weaker transition flow', () => {
  const balancedFlow = buildVisualState(MOCK_BALANCED)
    .fiveA.transitions.A2_TO_A3.flowStrength;
  const bottleneckFlow = buildVisualState(MOCK_FIVE_A_BOTTLENECK)
    .fiveA.transitions.A2_TO_A3.flowStrength;
  assert.ok(bottleneckFlow < balancedFlow);
});

test('Art Direction minimum and maximum guardrails hold', () => {
  const minimum = partialSnapshot({ geo: null, fiveA: null, brandMind: null });
  const maximum = clone(MOCK_GEO_OPPORTUNITY);
  maximum.geo.signalCore.strength.value = Number.MAX_VALUE;
  const minState = buildVisualState(minimum);
  const maxState = buildVisualState(maximum);
  assert.equal(minState.geo.signalCore.energy, ART_DIRECTION_GUARDRAILS.energy.min);
  assert.equal(maxState.geo.signalCore.energy, ART_DIRECTION_GUARDRAILS.energy.max);
});

test('MOCK metadata is preserved through mapping', () => {
  const state = buildVisualState(MOCK_GEO_OPPORTUNITY);
  assert.equal(state.metadata.sourceType, SOURCE_TYPES.MOCK);
  assert.equal(state.metadata.snapshotId, 'mock-geo-opportunity');
});

test('REAL and MOCK status cannot be silently converted', () => {
  assert.throws(
    () => adaptBrandUniverseSource(clone(MOCK_BALANCED), {
      expectedSourceType: SOURCE_TYPES.REAL
    }),
    /cannot be silently converted/
  );
});

test('unsupported schema version fails with a readable error', () => {
  const snapshot = clone(MOCK_BALANCED);
  snapshot.metadata.schemaVersion = '1.0.0';
  const validation = validateSnapshot(snapshot);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes(BRAND_UNIVERSE_SCHEMA_VERSION)));
});

test('unknown 5A stage id fails validation', () => {
  const snapshot = clone(MOCK_BALANCED);
  snapshot.fiveA.stages.A6 = clone(snapshot.fiveA.stages.A5);
  const validation = validateSnapshot(snapshot);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('A6')));
});

test('unknown 5A transition id fails validation', () => {
  const snapshot = clone(MOCK_BALANCED);
  snapshot.fiveA.transitions.A5_TO_A6 = clone(snapshot.fiveA.transitions.A4_TO_A5);
  const validation = validateSnapshot(snapshot);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('A5_TO_A6')));
});

test('duplicate Brand Mind association ids fail validation', () => {
  const snapshot = clone(MOCK_BALANCED);
  snapshot.brandMind.associations[1].id = snapshot.brandMind.associations[0].id;
  const validation = validateSnapshot(snapshot);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('duplicates')));
});

test('generated VisualState passes visual validation', () => {
  for (const snapshot of Object.values(BRAND_UNIVERSE_MOCKS)) {
    const validation = validateVisualState(buildVisualState(snapshot));
    assert.equal(validation.ok, true, validation.errors.join('\n'));
  }
});

test('VisualState contains no composition ownership fields', () => {
  const json = JSON.stringify(buildVisualState(MOCK_BALANCED));
  for (const forbidden of ['"camera"', '"position"', '"route"', '"handoff"', '"composition"']) {
    assert.equal(json.includes(forbidden), false, `Unexpected ${forbidden} in VisualState.`);
  }
});

test('adapter does not mutate raw source input', () => {
  const raw = clone(MOCK_BALANCED);
  const before = JSON.stringify(raw);
  adaptBrandUniverseSource(raw, { expectedSourceType: SOURCE_TYPES.MOCK });
  assert.equal(JSON.stringify(raw), before);
});

test('V2 runtime modules do not import Three.js', () => {
  const v2Root = fileURLToPath(new URL('../', import.meta.url));
  const files = listJavaScriptFiles(v2Root).filter((file) => !file.endsWith('.test.mjs'));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(/(?:from\s+|import\s*)['"]three['"]/.test(source), false, file);
    assert.equal(/WebGLRenderer|ShaderMaterial|new\s+Scene\s*\(|new\s+Mesh\s*\(/.test(source), false, file);
  }
});

test('mapping contract keeps composition under Art Direction ownership', () => {
  assert.equal(VISUAL_MAPPING_CONTRACT.composition.owner, 'ART_DIRECTION');
  assert.equal(VISUAL_MAPPING_CONTRACT.composition.dataControlled, false);
  assert.ok(VISUAL_MAPPING_CONTRACT.composition.prohibitedTargets.includes('camera'));
  assert.ok(VISUAL_MAPPING_CONTRACT.composition.prohibitedTargets.includes('position'));
});

test('linear, log, bounded, and clamp normalization stay within 0..1', () => {
  const values = [
    normalizeLinear(50, { min: 0, max: 100 }),
    normalizeLog(5000, { min: 0, max: 100000 }),
    normalizeBounded(75, { min: 0, max: 100 }),
    normalizeClamped(900, { min: 0, max: 1 })
  ];
  assert.ok(values.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.equal(normalizeLinear(null, { min: 0, max: 100 }), 0);
  assert.equal(normalizeLog(-100, { min: 0, max: 100 }), 0);
});

test('visual validation rejects a state outside Art Direction guardrails', () => {
  const visualState = clone(buildVisualState(MOCK_BALANCED));
  visualState.geo.signalCore.energy = -1;
  const validation = validateVisualState(visualState);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes('geo.signalCore.energy')));
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

function partialSnapshot(overrides = {}) {
  const raw = clone(MOCK_BALANCED);
  raw.metadata.snapshotId = `partial-${Object.keys(overrides).join('-') || 'snapshot'}`;
  raw.metadata.sourceType = SOURCE_TYPES.PARTIAL;
  Object.assign(raw, overrides);
  return adaptBrandUniverseSource(raw, { expectedSourceType: SOURCE_TYPES.PARTIAL });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findNumbers(value, output = []) {
  if (typeof value === 'number') output.push(value);
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => findNumbers(child, output));
  }
  return output;
}

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(absolute);
    return /\.(?:js|mjs)$/.test(entry.name) ? [absolute] : [];
  });
}
