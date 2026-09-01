import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOURCE_TYPES, VERIFICATION_STATUSES } from '../contracts/brandUniverseContract.js';
import { validateConsumerCompatibility } from '../contracts/consumerContracts.js';
import { adaptSource } from '../adapters/sourceAdapterRegistry.js';
import { SOURCE_ADAPTER_TYPES } from '../adapters/sourceAdapterContract.js';
import { buildFiveADataPanelViewModel } from '../../ui/fiveA-data-panel/fiveADataPanelViewModel.js';
import { buildBrandMindDataPanelViewModel } from '../../ui/brandMind-data-panel/brandMindDataPanelViewModel.js';
import { buildVisualState } from '../mapping/buildVisualState.js';
import {
  CANONICAL_BRAND_MIND_MOCK,
  CANONICAL_FIVE_A_MOCK,
  CANONICAL_GEO_MOCK
} from '../mock/canonicalFixtures.js';
import {
  BRAND_MIND_SOURCE_MOCK,
  FIVE_A_SOURCE_MOCK
} from '../mock/sourceAdapterFixtures.js';
import { createV2ConsumerProvider } from '../runtime/consumerProvider.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('FiveA canonical snapshot drives panel ViewModel', () => {
  const consumer = createV2ConsumerProvider().getFiveA();
  const panel = buildFiveADataPanelViewModel(consumer.snapshot, consumer.derivedMetrics);
  assert.deepEqual(panel.stageRows.map((row) => row.stageId), ['A1', 'A2', 'A3', 'A4', 'A5']);
});

test('FiveA canonical snapshot drives VisualState', () => {
  const visual = createV2ConsumerProvider().getFiveA().buildVisualState();
  assert.equal(visual.availability.fiveA, true);
  assert.equal(Object.keys(visual.fiveA.transitions).length, 4);
});

test('FiveA consumers preserve the same snapshot identity', () => {
  const consumer = createV2ConsumerProvider().getFiveA();
  const panel = buildFiveADataPanelViewModel(consumer.snapshot, consumer.derivedMetrics);
  const visual = consumer.buildVisualState();
  assert.equal(panel.header.brand, visual.metadata.brandId);
  assert.equal(panel.header.snapshotId, visual.metadata.snapshotId);
  assert.equal(panel.header.sourceType, visual.metadata.sourceType);
});

test('higher A3 population increases panel population and VisualState density', () => {
  const before = buildFiveAConsumers(CANONICAL_FIVE_A_MOCK);
  const changed = clone(CANONICAL_FIVE_A_MOCK);
  changed.fiveA.stages.A3.population.value += 2000;
  const after = buildFiveAConsumers(changed);
  assert.ok(stage(after.panel, 'A3').population > stage(before.panel, 'A3').population);
  assert.ok(after.visual.fiveA.stages.A3.density > before.visual.fiveA.stages.A3.density);
});

test('lower A2 to A3 rate lowers flow strength and raises panel drop-off', () => {
  const before = buildFiveAConsumers(CANONICAL_FIVE_A_MOCK);
  const changed = clone(CANONICAL_FIVE_A_MOCK);
  changed.fiveA.transitions.A2_TO_A3.rate.value = 0.31;
  const after = buildFiveAConsumers(changed);
  assert.ok(transition(after.panel, 'A2_TO_A3').conversionRate < transition(before.panel, 'A2_TO_A3').conversionRate);
  assert.ok(transition(after.panel, 'A2_TO_A3').dropOffRate > transition(before.panel, 'A2_TO_A3').dropOffRate);
  assert.ok(after.visual.fiveA.transitions.A2_TO_A3.flowStrength < before.visual.fiveA.transitions.A2_TO_A3.flowStrength);
});

test('FiveA opportunity pool never becomes A6', () => {
  const { panel, visual } = buildFiveAConsumers(CANONICAL_FIVE_A_MOCK);
  assert.equal(panel.opportunityPool.isStage, false);
  assert.equal(panel.stageRows.some((row) => row.stageId === 'A6'), false);
  assert.equal(visual.fiveA.opportunityPool.isStage, false);
});

test('FiveA missing confidence stays unavailable and uses safe visual fallback', () => {
  const partial = partialFiveASnapshot();
  const { panel, visual } = buildFiveAConsumers(partial);
  assert.equal(stage(panel, 'A3').confidence, null);
  assert.equal(stage(panel, 'A3').confidenceLabel, '未提供');
  assert.equal(Number.isFinite(visual.fiveA.stages.A3.activity), true);
});

test('Brand Mind canonical snapshot drives panel ViewModel', () => {
  const consumer = createV2ConsumerProvider().getBrandMind();
  const panel = buildBrandMindDataPanelViewModel(consumer.snapshot, consumer.derivedMetrics);
  assert.equal(panel.associationRows.length, consumer.snapshot.brandMind.associations.length);
});

test('Brand Mind canonical snapshot drives VisualState', () => {
  const visual = createV2ConsumerProvider().getBrandMind().buildVisualState();
  assert.equal(visual.availability.brandMind, true);
  assert.equal(visual.brandMind.associations.length, CANONICAL_BRAND_MIND_MOCK.brandMind.associations.length);
});

test('higher association strength increases panel strength and visual emphasis', () => {
  const before = buildBrandMindConsumers(CANONICAL_BRAND_MIND_MOCK);
  const changed = clone(CANONICAL_BRAND_MIND_MOCK);
  changed.brandMind.associations[0].strength.value = 0.94;
  const after = buildBrandMindConsumers(changed);
  assert.ok(association(after.panel, 'mock-association-a').strength > association(before.panel, 'mock-association-a').strength);
  assert.ok(visualAssociation(after.visual, 'mock-association-a').node.emphasis > visualAssociation(before.visual, 'mock-association-a').node.emphasis);
});

test('higher core concentration stays directionally consistent', () => {
  const before = buildBrandMindConsumers(CANONICAL_BRAND_MIND_MOCK);
  const changed = clone(CANONICAL_BRAND_MIND_MOCK);
  changed.brandMind.core.concentration.value = 78;
  const after = buildBrandMindConsumers(changed);
  assert.ok(after.panel.coreMetrics.concentration > before.panel.coreMetrics.concentration);
  assert.equal(after.panel.coreStatus.code, 'CONCENTRATED');
  assert.ok(after.visual.brandMind.core.concentration > before.visual.brandMind.core.concentration);
});

test('Brand Mind relationship IDs are preserved in the canonical panel consumer', () => {
  const panel = buildBrandMindConsumers(CANONICAL_BRAND_MIND_MOCK).panel;
  assert.deepEqual(
    panel.relationshipRows.map((row) => row.id),
    CANONICAL_BRAND_MIND_MOCK.brandMind.relationships.map((row) => row.id)
  );
});

test('missing Brand Mind history does not invent drift or opportunity trend', () => {
  const partial = partialBrandMindSnapshot();
  const { panel, derived, visual } = buildBrandMindConsumers(partial);
  assert.equal(panel.mindDrift.available, false);
  assert.equal(derived.driftSummary.available, false);
  assert.equal(derived.opportunitySignals.some((item) => item.type === 'GROWTH' || item.type === 'DEFEND'), false);
  assert.equal(Object.hasOwn(visual.brandMind, 'activityTrend'), false);
});

test('MOCK identity is identical across Panel and VisualState consumers', () => {
  for (const moduleId of ['fiveA', 'brandMind']) {
    const consumer = createV2ConsumerProvider()[moduleId === 'fiveA' ? 'getFiveA' : 'getBrandMind']();
    const panel = moduleId === 'fiveA'
      ? buildFiveADataPanelViewModel(consumer.snapshot, consumer.derivedMetrics)
      : buildBrandMindDataPanelViewModel(consumer.snapshot, consumer.derivedMetrics);
    const visual = consumer.buildVisualState();
    assert.equal(panel.header.sourceIdentity, 'MOCK / SYNTHETIC');
    assert.equal(visual.metadata.sourceType, SOURCE_TYPES.MOCK);
    assert.equal(visual.metadata.lineage.verificationStatus, VERIFICATION_STATUSES.SYNTHETIC);
  }
});

test('PARTIAL identity is identical across Panel and VisualState consumers', () => {
  const partials = [
    ['fiveA', partialFiveASnapshot()],
    ['brandMind', partialBrandMindSnapshot()]
  ];
  for (const [moduleId, snapshot] of partials) {
    const consumer = createV2ConsumerProvider({ [`${moduleId}Snapshot`]: snapshot })[
      moduleId === 'fiveA' ? 'getFiveA' : 'getBrandMind'
    ]();
    const panel = moduleId === 'fiveA'
      ? buildFiveADataPanelViewModel(snapshot, consumer.derivedMetrics)
      : buildBrandMindDataPanelViewModel(snapshot, consumer.derivedMetrics);
    const visual = consumer.buildVisualState();
    assert.equal(panel.header.sourceType, SOURCE_TYPES.PARTIAL);
    assert.equal(visual.metadata.sourceType, SOURCE_TYPES.PARTIAL);
    assert.equal(panel.header.lineage.sourceType, visual.metadata.lineage.sourceType);
  }
});

test('lineage survives Canonical Snapshot to both consumers', () => {
  const consumer = createV2ConsumerProvider().getBrandMind();
  const panel = buildBrandMindDataPanelViewModel(consumer.snapshot, consumer.derivedMetrics);
  const visual = consumer.buildVisualState();
  for (const key of ['adapterId', 'sourceType', 'sourceId', 'sourceFile', 'capturedAt', 'verificationStatus', 'completeness']) {
    assert.equal(panel.header.lineage[key], consumer.snapshot.metadata.lineage[key]);
    assert.equal(visual.metadata.lineage[key], consumer.snapshot.metadata.lineage[key]);
  }
});

test('Unified consumer output contains no NaN', () => {
  assert.equal(allNumbers(allConsumerOutputs()).some(Number.isNaN), false);
});

test('Unified consumer output contains no Infinity', () => {
  assert.equal(allNumbers(allConsumerOutputs()).every(Number.isFinite), true);
});

test('Unified consumer output is deterministic', () => {
  assert.deepEqual(allConsumerOutputs(), allConsumerOutputs());
});

test('Panel modules do not import source adapters', () => {
  for (const path of [
    '../../ui/fiveA-data-panel/fiveADataPanel.js',
    '../../ui/fiveA-data-panel/fiveADataPanelViewModel.js',
    '../../ui/brandMind-data-panel/brandMindDataPanel.js',
    '../../ui/brandMind-data-panel/brandMindDataPanelViewModel.js'
  ]) {
    assert.equal(readFileSync(new URL(path, import.meta.url), 'utf8').includes('/adapters/'), false);
  }
});

test('duplicate Panel business-rule implementations are removed', () => {
  const fiveA = readFileSync(new URL('../../ui/fiveA-data-panel/fiveADataPanelViewModel.js', import.meta.url), 'utf8');
  const brandMind = readFileSync(new URL('../../ui/brandMind-data-panel/brandMindDataPanelViewModel.js', import.meta.url), 'utf8');
  assert.equal(fiveA.includes('1 - conversionRate'), false);
  assert.equal(fiveA.includes('compareRateThenId'), false);
  for (const token of ['shiftingCoreChange', 'strengthenStrengthMinimum', 'growthChangeMinimum', 'defendChangeMaximum']) {
    assert.equal(brandMind.includes(token), false);
  }
});

test('GEO canonical fixture remains compatible with the frozen GEO consumer contract', () => {
  assert.equal(validateConsumerCompatibility(CANONICAL_GEO_MOCK, 'geo').ok, true);
  const visual = buildVisualState(CANONICAL_GEO_MOCK);
  assert.equal(visual.availability.geo, true);
  assert.deepEqual(Object.keys(visual.geo), ['answerStream', 'citationStream', 'keywordStream', 'signalCore']);
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

function buildFiveAConsumers(snapshot) {
  const consumer = createV2ConsumerProvider({ fiveASnapshot: snapshot }).getFiveA();
  return {
    panel: buildFiveADataPanelViewModel(snapshot, consumer.derivedMetrics),
    derived: consumer.derivedMetrics,
    visual: consumer.buildVisualState()
  };
}

function buildBrandMindConsumers(snapshot) {
  const consumer = createV2ConsumerProvider({ brandMindSnapshot: snapshot }).getBrandMind();
  return {
    panel: buildBrandMindDataPanelViewModel(snapshot, consumer.derivedMetrics),
    derived: consumer.derivedMetrics,
    visual: consumer.buildVisualState()
  };
}

function partialFiveASnapshot() {
  const source = clone(FIVE_A_SOURCE_MOCK);
  source.metadata.sourceType = SOURCE_TYPES.PARTIAL;
  source.metadata.verificationStatus = VERIFICATION_STATUSES.UNVERIFIED;
  source.fiveA.stages.A3.confidence = null;
  return adaptSource({ type: SOURCE_ADAPTER_TYPES.FIVE_A, payload: source });
}

function partialBrandMindSnapshot() {
  const source = clone(BRAND_MIND_SOURCE_MOCK);
  source.metadata.sourceType = SOURCE_TYPES.PARTIAL;
  source.metadata.verificationStatus = VERIFICATION_STATUSES.UNVERIFIED;
  source.brandMind.history = { available: false };
  return adaptSource({ type: SOURCE_ADAPTER_TYPES.BRAND_MIND, payload: source });
}

function stage(panel, id) {
  return panel.stageRows.find((row) => row.stageId === id);
}

function transition(panel, id) {
  return panel.transitionRows.find((row) => row.transitionId === id);
}

function association(panel, id) {
  return panel.associationRows.find((row) => row.id === id);
}

function visualAssociation(visual, id) {
  return visual.brandMind.associations.find((row) => row.id === id);
}

function allConsumerOutputs() {
  return {
    fiveA: buildFiveAConsumers(CANONICAL_FIVE_A_MOCK),
    brandMind: buildBrandMindConsumers(CANONICAL_BRAND_MIND_MOCK),
    geo: createV2ConsumerProvider().getGeo().buildVisualState()
  };
}

function allNumbers(value, output = []) {
  if (typeof value === 'number') output.push(value);
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => allNumbers(child, output));
  }
  return output;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
