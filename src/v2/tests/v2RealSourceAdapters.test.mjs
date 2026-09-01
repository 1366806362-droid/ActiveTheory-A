import assert from 'node:assert/strict';
import {
  BRAND_MIND_SOURCE_MOCK,
  FIVE_A_SOURCE_MOCK,
  GEO_SOURCE_MOCK,
  SNAPSHOT_COMPLETENESS,
  SOURCE_ADAPTER_IDS,
  SOURCE_ADAPTER_TYPES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  adaptSource,
  buildVisualState,
  listSourceAdapterTypes,
  validateSnapshot,
  validateVisualState
} from '../index.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('GEO adapter produces the four canonical GEO signals', () => {
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.GEO, GEO_SOURCE_MOCK);
  assert.deepEqual(Object.keys(snapshot.geo), ['answer', 'citation', 'keyword', 'signalCore']);
  assert.equal(snapshot.fiveA, null);
  assert.equal(snapshot.brandMind, null);
});

test('5A adapter preserves exactly A1 through A5 and four transitions', () => {
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.FIVE_A, FIVE_A_SOURCE_MOCK);
  assert.deepEqual(Object.keys(snapshot.fiveA.stages), ['A1', 'A2', 'A3', 'A4', 'A5']);
  assert.deepEqual(
    Object.keys(snapshot.fiveA.transitions),
    ['A1_TO_A2', 'A2_TO_A3', 'A3_TO_A4', 'A4_TO_A5']
  );
  assert.equal(snapshot.fiveA.opportunityPool.isStage, false);
});

test('Brand Mind adapter preserves open association vocabulary and source', () => {
  const fixture = clone(BRAND_MIND_SOURCE_MOCK);
  fixture.brandMind.associations[0].label = 'Unrestricted Synthetic Term';
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.BRAND_MIND, fixture);
  assert.equal(snapshot.brandMind.associations[0].label, 'Unrestricted Synthetic Term');
  assert.equal(snapshot.brandMind.associations[0].source, 'brandmind-source-mock');
});

test('PARTIAL source identity and completeness are explicit', () => {
  const fixture = clone(GEO_SOURCE_MOCK);
  fixture.metadata.sourceType = SOURCE_TYPES.PARTIAL;
  fixture.metadata.verificationStatus = VERIFICATION_STATUSES.UNVERIFIED;
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.GEO, fixture);
  assert.equal(snapshot.metadata.sourceType, SOURCE_TYPES.PARTIAL);
  assert.equal(snapshot.metadata.completeness, SNAPSHOT_COMPLETENESS.PARTIAL);
  assert.equal(snapshot.metadata.lineage.sourceType, SOURCE_TYPES.PARTIAL);
});

test('missing source metrics become canonical MISSING points without guesses', () => {
  const fixture = clone(GEO_SOURCE_MOCK);
  delete fixture.geo.answer.quality;
  delete fixture.geo.keyword;
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.GEO, fixture);
  assert.equal(snapshot.geo.answer.quality.value, null);
  assert.equal(snapshot.geo.answer.quality.source, null);
  assert.equal(snapshot.geo.answer.quality.verificationStatus, VERIFICATION_STATUSES.MISSING);
  assert.equal(snapshot.geo.keyword.volume.value, null);
  assert.equal(validateSnapshot(snapshot).ok, true);
});

test('invalid sixth 5A stage id is rejected', () => {
  const fixture = clone(FIVE_A_SOURCE_MOCK);
  fixture.fiveA.stages.A6 = { population: 999, strength: 99, confidence: 1 };
  assert.throws(
    () => adapt(SOURCE_ADAPTER_TYPES.FIVE_A, fixture),
    /unsupported id\(s\): A6/
  );
});

test('unknown adapter type is rejected instead of guessed', () => {
  assert.throws(
    () => adaptSource({ type: 'AUTO_DETECT', payload: GEO_SOURCE_MOCK }),
    /Unknown source adapter type/
  );
});

test('adapter registry exposes only the three explicit source types', () => {
  assert.deepEqual(listSourceAdapterTypes(), [
    SOURCE_ADAPTER_TYPES.GEO,
    SOURCE_ADAPTER_TYPES.FIVE_A,
    SOURCE_ADAPTER_TYPES.BRAND_MIND
  ]);
});

test('lineage preserves adapter, source, file, capture, and verification fields', () => {
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.GEO, GEO_SOURCE_MOCK);
  assert.deepEqual(snapshot.metadata.lineage, {
    adapterId: SOURCE_ADAPTER_IDS[SOURCE_ADAPTER_TYPES.GEO],
    sourceType: SOURCE_TYPES.MOCK,
    sourceId: 'geo-source-mock',
    sourceFile: 'geo-source-mock.json',
    capturedAt: '2026-09-01T10:30:00+08:00',
    completeness: SNAPSHOT_COMPLETENESS.PARTIAL,
    verificationStatus: VERIFICATION_STATUSES.SYNTHETIC
  });
});

test('MOCK identity remains MOCK through snapshot and VisualState', () => {
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.FIVE_A, FIVE_A_SOURCE_MOCK);
  const state = buildVisualState(snapshot);
  assert.equal(snapshot.metadata.sourceType, SOURCE_TYPES.MOCK);
  assert.equal(state.metadata.sourceType, SOURCE_TYPES.MOCK);
  assert.equal(state.metadata.lineage.sourceId, 'fivea-source-mock');
});

test('verified source status is preserved into metric defaults and lineage', () => {
  const fixture = clone(GEO_SOURCE_MOCK);
  fixture.metadata.sourceType = SOURCE_TYPES.REAL;
  fixture.metadata.verificationStatus = VERIFICATION_STATUSES.VERIFIED;
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.GEO, fixture);
  assert.equal(snapshot.metadata.lineage.verificationStatus, VERIFICATION_STATUSES.VERIFIED);
  assert.equal(snapshot.geo.answer.volume.verificationStatus, VERIFICATION_STATUSES.VERIFIED);
});

test('all three adapter outputs pass validateSnapshot', () => {
  for (const [type, fixture] of adapterCases()) {
    const validation = validateSnapshot(adapt(type, fixture));
    assert.equal(validation.ok, true, validation.errors.join('\n'));
  }
});

test('all three adapter outputs build valid VisualState with lineage', () => {
  for (const [type, fixture] of adapterCases()) {
    const state = buildVisualState(adapt(type, fixture));
    const validation = validateVisualState(state);
    assert.equal(validation.ok, true, validation.errors.join('\n'));
    assert.ok(state.diagnostics.sourceLineage.adapterId);
  }
});

test('adapters never emit NaN or Infinity', () => {
  const fixture = clone(GEO_SOURCE_MOCK);
  fixture.geo.answer.volume = Number.NaN;
  fixture.geo.citation.strength = Number.POSITIVE_INFINITY;
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.GEO, fixture);
  const numbers = findNumbers(snapshot);
  assert.equal(numbers.every(Number.isFinite), true);
  assert.equal(snapshot.geo.answer.volume.value, null);
  assert.equal(snapshot.geo.citation.strength.value, null);
});

test('source adapters do not mutate payloads', () => {
  const fixture = clone(FIVE_A_SOURCE_MOCK);
  const before = JSON.stringify(fixture);
  adapt(SOURCE_ADAPTER_TYPES.FIVE_A, fixture);
  assert.equal(JSON.stringify(fixture), before);
});

test('missing required lineage metadata fails clearly', () => {
  const fixture = clone(BRAND_MIND_SOURCE_MOCK);
  delete fixture.metadata.sourceId;
  assert.throws(
    () => adapt(SOURCE_ADAPTER_TYPES.BRAND_MIND, fixture),
    /payload\.metadata\.sourceId is required/
  );
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

function adapt(type, fixture) {
  return adaptSource({ type, payload: clone(fixture) });
}

function adapterCases() {
  return [
    [SOURCE_ADAPTER_TYPES.GEO, GEO_SOURCE_MOCK],
    [SOURCE_ADAPTER_TYPES.FIVE_A, FIVE_A_SOURCE_MOCK],
    [SOURCE_ADAPTER_TYPES.BRAND_MIND, BRAND_MIND_SOURCE_MOCK]
  ];
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
