import assert from 'node:assert/strict';
import {
  BRAND_MIND_SOURCE_MOCK,
  CANONICAL_BRAND_MIND_MOCK,
  CANONICAL_FIVE_A_MOCK,
  CANONICAL_GEO_MOCK,
  CONSUMER_CONTRACTS,
  FIVE_A_SOURCE_MOCK,
  GEO_SOURCE_MOCK,
  SOURCE_ADAPTER_TYPES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  adaptSource,
  buildVisualState,
  deriveBrandMindMetrics,
  deriveBusinessMetrics,
  deriveFiveAMetrics,
  deriveGeoMetrics,
  validateConsumerCompatibility,
  validateSnapshot,
  validateVisualState
} from '../index.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('consumer contracts record the three authoritative inputs', () => {
  assert.match(CONSUMER_CONTRACTS.geo.sourceContract, /GeoDashboardDataset/);
  assert.match(CONSUMER_CONTRACTS.fiveA.sourceContract, /V1\.1/);
  assert.match(CONSUMER_CONTRACTS.brandMind.sourceContract, /V1\.1/);
});

test('canonical GEO fixture is Panel-compatible and VisualState-compatible', () => {
  dualConsumer(CANONICAL_GEO_MOCK, 'geo');
});

test('canonical FiveA fixture is Panel-compatible and VisualState-compatible', () => {
  dualConsumer(CANONICAL_FIVE_A_MOCK, 'fiveA');
});

test('canonical Brand Mind fixture is Panel-compatible and VisualState-compatible', () => {
  dualConsumer(CANONICAL_BRAND_MIND_MOCK, 'brandMind');
});

test('higher source FiveA population preserves monotonic canonical population', () => {
  const low = clone(FIVE_A_SOURCE_MOCK);
  const high = clone(FIVE_A_SOURCE_MOCK);
  low.fiveA.stages.A3.population = 100;
  high.fiveA.stages.A3.population = 1000;
  assert.ok(adapt(SOURCE_ADAPTER_TYPES.FIVE_A, high).fiveA.stages.A3.population.value
    > adapt(SOURCE_ADAPTER_TYPES.FIVE_A, low).fiveA.stages.A3.population.value);
});

test('FiveA canonical stages are exactly A1-A5', () => {
  assert.deepEqual(Object.keys(CANONICAL_FIVE_A_MOCK.fiveA.stages), ['A1', 'A2', 'A3', 'A4', 'A5']);
});

test('FiveA canonical transitions are exactly four adjacent paths', () => {
  assert.deepEqual(Object.keys(CANONICAL_FIVE_A_MOCK.fiveA.transitions), [
    'A1_TO_A2', 'A2_TO_A3', 'A3_TO_A4', 'A4_TO_A5'
  ]);
});

test('Opportunity Pool remains separate and is never A6', () => {
  assert.equal(CANONICAL_FIVE_A_MOCK.fiveA.opportunityPool.isStage, false);
  assert.equal(CANONICAL_FIVE_A_MOCK.fiveA.stages.A6, undefined);
  assert.equal(deriveFiveAMetrics(CANONICAL_FIVE_A_MOCK).opportunityPool.isStage, false);
});

test('missing FiveA change stays canonical MISSING', () => {
  const point = CANONICAL_FIVE_A_MOCK.fiveA.stages.A1.changeVsLast;
  assert.equal(point.value, null);
  assert.equal(point.verificationStatus, VERIFICATION_STATUSES.MISSING);
});

test('missing FiveA confidence stays canonical MISSING', () => {
  const fixture = clone(FIVE_A_SOURCE_MOCK);
  delete fixture.fiveA.stages.A2.confidence;
  const point = adapt(SOURCE_ADAPTER_TYPES.FIVE_A, fixture).fiveA.stages.A2.confidence;
  assert.equal(point.value, null);
  assert.equal(point.verificationStatus, VERIFICATION_STATUSES.MISSING);
});

test('FiveA derivation is deterministic and exposes no presentation copy', () => {
  const left = deriveFiveAMetrics(CANONICAL_FIVE_A_MOCK);
  const right = deriveFiveAMetrics(CANONICAL_FIVE_A_MOCK);
  assert.deepEqual(left, right);
  assert.equal(JSON.stringify(left).includes('流转率'), false);
});

test('Brand Mind association label and category are preserved', () => {
  const association = CANONICAL_BRAND_MIND_MOCK.brandMind.associations[0];
  assert.equal(association.label, 'Mock Association A');
  assert.equal(association.category, 'synthetic-functional');
});

test('Brand Mind strength and source weight are preserved independently', () => {
  const association = CANONICAL_BRAND_MIND_MOCK.brandMind.associations[0];
  assert.equal(association.strength.value, 0.74);
  assert.equal(association.weight.value, 74);
});

test('Brand Mind relationship IDs are preserved', () => {
  const relationship = CANONICAL_BRAND_MIND_MOCK.brandMind.relationships[0];
  assert.equal(relationship.id, 'brand-core--mock-association-a');
  assert.equal(relationship.sourceId, 'brand-core');
  assert.equal(relationship.targetId, 'mock-association-a');
});

test('missing Brand Mind history does not invent trend', () => {
  const fixture = clone(BRAND_MIND_SOURCE_MOCK);
  delete fixture.brandMind.history;
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.BRAND_MIND, fixture);
  const metrics = deriveBrandMindMetrics(snapshot);
  assert.equal(snapshot.brandMind.history.available, false);
  assert.equal(metrics.driftSummary.available, false);
  assert.equal(metrics.driftSummary.changedAssociationCount, null);
  assert.equal(metrics.opportunitySignals.some((item) => item.type === 'GROWTH'), false);
  assert.equal(metrics.opportunitySignals.some((item) => item.type === 'DEFEND'), false);
});

test('Brand Mind adapter does not invent coreStatus', () => {
  assert.equal(Object.hasOwn(CANONICAL_BRAND_MIND_MOCK.brandMind.core, 'coreStatus'), false);
  assert.equal(deriveBrandMindMetrics(CANONICAL_BRAND_MIND_MOCK).coreStatus, 'STABLE');
});

test('Brand Mind adapter does not invent opportunityInsights', () => {
  assert.equal(Object.hasOwn(CANONICAL_BRAND_MIND_MOCK.brandMind, 'opportunityInsights'), false);
  assert.ok(deriveBrandMindMetrics(CANONICAL_BRAND_MIND_MOCK).opportunitySignals.length <= 3);
});

test('GEO signal identities survive adaptation', () => {
  assert.deepEqual(Object.keys(CANONICAL_GEO_MOCK.geo), ['answer', 'citation', 'keyword', 'signalCore']);
});

test('GEO missing verification remains missing', () => {
  const fixture = clone(GEO_SOURCE_MOCK);
  delete fixture.geo.answer.quality;
  const point = adapt(SOURCE_ADAPTER_TYPES.GEO, fixture).geo.answer.quality;
  assert.equal(point.value, null);
  assert.equal(point.verificationStatus, VERIFICATION_STATUSES.MISSING);
});

test('GEO missing metric is not estimated by derivation', () => {
  const fixture = clone(GEO_SOURCE_MOCK);
  delete fixture.geo.keyword.opportunity;
  const metrics = deriveGeoMetrics(adapt(SOURCE_ADAPTER_TYPES.GEO, fixture));
  assert.ok(metrics.missingMetricIds.includes('keyword.opportunity'));
});

test('MOCK remains MOCK through Adapter Snapshot Derived and VisualState', () => {
  const snapshot = CANONICAL_BRAND_MIND_MOCK;
  assert.equal(snapshot.metadata.sourceType, SOURCE_TYPES.MOCK);
  assert.equal(buildVisualState(snapshot).metadata.sourceType, SOURCE_TYPES.MOCK);
  assert.equal(deriveBusinessMetrics(snapshot).brandMind.available, true);
});

test('PARTIAL remains PARTIAL through Adapter and VisualState', () => {
  const fixture = clone(GEO_SOURCE_MOCK);
  fixture.metadata.sourceType = SOURCE_TYPES.PARTIAL;
  fixture.metadata.verificationStatus = VERIFICATION_STATUSES.UNVERIFIED;
  const snapshot = adapt(SOURCE_ADAPTER_TYPES.GEO, fixture);
  const state = buildVisualState(snapshot);
  assert.equal(snapshot.metadata.sourceType, SOURCE_TYPES.PARTIAL);
  assert.equal(state.metadata.sourceType, SOURCE_TYPES.PARTIAL);
});

test('lineage survives Adapter Snapshot and VisualState metadata', () => {
  const snapshot = CANONICAL_GEO_MOCK;
  const state = buildVisualState(snapshot);
  assert.deepEqual(state.metadata.lineage, snapshot.metadata.lineage);
  assert.deepEqual(state.diagnostics.sourceLineage, snapshot.metadata.lineage);
});

test('all canonical fixtures contain no NaN or Infinity', () => {
  for (const snapshot of [CANONICAL_GEO_MOCK, CANONICAL_FIVE_A_MOCK, CANONICAL_BRAND_MIND_MOCK]) {
    assert.ok(findNumbers(snapshot).every(Number.isFinite));
  }
});

test('adapter and derived outputs are deterministic', () => {
  assert.deepEqual(
    adapt(SOURCE_ADAPTER_TYPES.BRAND_MIND, BRAND_MIND_SOURCE_MOCK),
    adapt(SOURCE_ADAPTER_TYPES.BRAND_MIND, BRAND_MIND_SOURCE_MOCK)
  );
  assert.deepEqual(
    deriveBusinessMetrics(CANONICAL_BRAND_MIND_MOCK),
    deriveBusinessMetrics(CANONICAL_BRAND_MIND_MOCK)
  );
});

test('source reserved stage identity cannot overwrite canonical ids', () => {
  const fixture = clone(FIVE_A_SOURCE_MOCK);
  fixture.fiveA.stages.A1.id = 'A6';
  fixture.fiveA.stages.A1.semantic = 'OVERRIDE';
  const stage = adapt(SOURCE_ADAPTER_TYPES.FIVE_A, fixture).fiveA.stages.A1;
  assert.equal(stage.id, 'A1');
  assert.equal(stage.semantic, 'AWARE');
});

test('all three lineage objects include completeness and verification', () => {
  for (const snapshot of [CANONICAL_GEO_MOCK, CANONICAL_FIVE_A_MOCK, CANONICAL_BRAND_MIND_MOCK]) {
    assert.equal(snapshot.metadata.lineage.completeness, snapshot.metadata.completeness);
    assert.equal(snapshot.metadata.lineage.verificationStatus, VERIFICATION_STATUSES.SYNTHETIC);
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

function dualConsumer(snapshot, moduleId) {
  const snapshotValidation = validateSnapshot(snapshot);
  assert.equal(snapshotValidation.ok, true, snapshotValidation.errors.join('\n'));
  const consumerValidation = validateConsumerCompatibility(snapshot, moduleId);
  assert.equal(consumerValidation.ok, true, consumerValidation.errors.join('\n'));
  const visualValidation = validateVisualState(buildVisualState(snapshot));
  assert.equal(visualValidation.ok, true, visualValidation.errors.join('\n'));
}

function adapt(type, fixture) {
  return adaptSource({ type, payload: clone(fixture) });
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
