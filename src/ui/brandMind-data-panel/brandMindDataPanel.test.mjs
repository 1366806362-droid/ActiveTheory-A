import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOURCE_TYPES } from '../../v2/contracts/brandUniverseContract.js';
import { validateSnapshot } from '../../v2/runtime/validateSnapshot.js';
import { MOCK_BRAND_MIND_PANEL } from './brandMindDataPanelMock.js';
import {
  createBrandMindDataPanelController,
  isBrandMindDataPanelIsolationEvent
} from './brandMindDataPanelController.js';
import { buildBrandMindDataPanelViewModel } from './brandMindDataPanelViewModel.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('ViewModel is deterministic', () => {
  assert.deepEqual(build(), build());
});

test('core metrics stay finite or unavailable', () => {
  const core = build().coreMetrics;
  assert.equal(core.strength, 0.72);
  assert.equal(core.concentration, 0.48);
  assert.equal(core.associationCount, 6);
});

test('coreStatus is deterministic', () => {
  assert.deepEqual(build().coreStatus, build().coreStatus);
});

test('stable core status follows ViewModel rules', () => {
  const snapshot = statusFixture({ concentration: 0.6, stability: 0.84, change: 0.01 });
  assert.equal(buildBrandMindDataPanelViewModel(snapshot).coreStatus.code, 'STABLE');
});

test('concentrated core status follows ViewModel rules', () => {
  const snapshot = statusFixture({ concentration: 0.72, stability: 0.84, change: 0.01 });
  assert.equal(buildBrandMindDataPanelViewModel(snapshot).coreStatus.code, 'CONCENTRATED');
});

test('distributed core status follows ViewModel rules', () => {
  const snapshot = statusFixture({ concentration: 0.48, stability: 0.84, change: 0.01 });
  assert.equal(buildBrandMindDataPanelViewModel(snapshot).coreStatus.code, 'DISTRIBUTED');
});

test('shifting core status follows ViewModel rules', () => {
  const snapshot = statusFixture({ concentration: 0.6, stability: 0.84, change: 0.08 });
  assert.equal(buildBrandMindDataPanelViewModel(snapshot).coreStatus.code, 'SHIFTING');
});

test('associations array is safe when source is missing', () => {
  const snapshot = clone(MOCK_BRAND_MIND_PANEL);
  snapshot.brandMind.associations = null;
  assert.deepEqual(buildBrandMindDataPanelViewModel(snapshot).associationRows, []);
});

test('association vocabulary comes from data rather than ViewModel constants', () => {
  const snapshot = clone(MOCK_BRAND_MIND_PANEL);
  snapshot.brandMind.associations[0].label = '动态测试词';
  assert.equal(
    buildBrandMindDataPanelViewModel(snapshot).associationRows.some((row) => row.association === '动态测试词'),
    true
  );
});

test('relationship rows are safe when relationships are missing', () => {
  const snapshot = clone(MOCK_BRAND_MIND_PANEL);
  delete snapshot.brandMind.relationships;
  assert.equal(buildBrandMindDataPanelViewModel(snapshot).relationshipRows.length, 5);
});

test('relationship top-N selection is deterministic', () => {
  const rows = build().relationshipRows;
  assert.equal(rows.length, 5);
  assert.ok(rows.every((row, index) => index === 0 || rows[index - 1].strength >= row.strength));
});

test('drift missing is explicit and safe', () => {
  const snapshot = clone(MOCK_BRAND_MIND_PANEL);
  delete snapshot.brandMind.history;
  const drift = buildBrandMindDataPanelViewModel(snapshot).mindDrift;
  assert.equal(drift.available, false);
  assert.equal(drift.status, 'NOT PROVIDED');
});

test('synthetic drift categories account for every association', () => {
  const viewModel = build();
  const categorized = viewModel.mindDrift.categories.reduce((sum, item) => sum + item.count, 0);
  assert.equal(categorized, viewModel.associationRows.length);
});

test('MOCK identity is preserved', () => {
  const header = build().header;
  assert.equal(header.sourceType, SOURCE_TYPES.MOCK);
  assert.equal(header.sourceIdentity, 'MOCK / SYNTHETIC');
});

test('opportunity insights are deterministic', () => {
  assert.deepEqual(build().opportunityInsights, build().opportunityInsights);
});

test('strengthen opportunity uses a qualified core association', () => {
  const insight = build().opportunityInsights.find((item) => item.type === 'STRENGTHEN');
  assert.equal(insight?.id, 'strengthen-association-scale');
});

test('growth opportunity uses the strongest qualified positive change', () => {
  const insight = build().opportunityInsights.find((item) => item.type === 'GROWTH');
  assert.equal(insight?.id, 'growth-association-night');
});

test('defend opportunity uses the strongest qualified decline', () => {
  const insight = build().opportunityInsights.find((item) => item.type === 'DEFEND');
  assert.equal(insight?.id, 'defend-association-local');
});

test('opportunity insights never exceed three items', () => {
  assert.ok(build().opportunityInsights.length <= 3);
});

test('missing history is safe and does not invent growth or defend opportunities', () => {
  const snapshot = clone(MOCK_BRAND_MIND_PANEL);
  delete snapshot.brandMind.history;
  const insights = buildBrandMindDataPanelViewModel(snapshot).opportunityInsights;
  assert.equal(insights.some((item) => item.type === 'GROWTH' || item.type === 'DEFEND'), false);
  assert.equal(insights.some((item) => item.type === 'STRENGTHEN'), true);
});

test('opportunity insights preserve MOCK identity', () => {
  assert.ok(build().opportunityInsights.every((item) => item.sourceIdentity === 'MOCK / SYNTHETIC'));
});

test('DOM renderer contains no product-rule thresholds or insight calculations', () => {
  const rendererSource = readFileSync(new URL('./brandMindDataPanel.js', import.meta.url), 'utf8');
  assert.equal(rendererSource.includes('BRAND_MIND_CORE_STATUS_RULES'), false);
  assert.equal(rendererSource.includes('BRAND_MIND_OPPORTUNITY_RULES'), false);
  assert.equal(rendererSource.includes('changeVsLast >='), false);
});

test('REAL MOCK and PARTIAL identity cannot be silently converted', () => {
  for (const sourceType of Object.values(SOURCE_TYPES)) {
    const snapshot = clone(MOCK_BRAND_MIND_PANEL);
    snapshot.metadata.sourceType = sourceType;
    assert.equal(buildBrandMindDataPanelViewModel(snapshot).header.sourceType, sourceType);
  }
});

test('ViewModel contains no NaN', () => {
  assert.equal(findNumbers(build()).some(Number.isNaN), false);
});

test('ViewModel contains no Infinity', () => {
  assert.equal(findNumbers(build()).every(Number.isFinite), true);
});

test('panel mock remains a valid Canonical Snapshot', () => {
  assert.equal(validateSnapshot(MOCK_BRAND_MIND_PANEL).ok, true);
});

test('controller opens panel once', () => {
  const changes = [];
  const controller = createBrandMindDataPanelController({ onStateChange: (state) => changes.push(state) });
  assert.equal(controller.open(), true);
  assert.equal(controller.isOpen(), true);
  assert.equal(changes.length, 1);
});

test('controller closes panel and restores closed state', () => {
  const controller = createBrandMindDataPanelController();
  controller.open();
  assert.equal(controller.close(), true);
  assert.equal(controller.isOpen(), false);
});

test('ESC closes only an open panel', () => {
  const controller = createBrandMindDataPanelController();
  assert.equal(controller.handleKeyDown({ key: 'Escape' }), false);
  controller.open();
  assert.equal(controller.handleKeyDown({ key: 'Escape' }), true);
  assert.equal(controller.isOpen(), false);
});

test('repeated open keeps one logical panel instance', () => {
  const changes = [];
  const controller = createBrandMindDataPanelController({ onStateChange: (state) => changes.push(state) });
  controller.open();
  assert.equal(controller.open(), false);
  assert.equal(changes.length, 1);
});

test('wheel isolation is enabled', () => {
  assert.equal(isBrandMindDataPanelIsolationEvent('wheel'), true);
});

test('pointer and touch isolation are enabled', () => {
  assert.equal(isBrandMindDataPanelIsolationEvent('pointerdown'), true);
  assert.equal(isBrandMindDataPanelIsolationEvent('pointerup'), true);
  assert.equal(isBrandMindDataPanelIsolationEvent('touchmove'), true);
});

test('5A opportunity concepts do not appear in Brand Mind ViewModel', () => {
  const serialized = JSON.stringify(build());
  assert.equal(serialized.includes('opportunityPool'), false);
  assert.equal(serialized.includes('A6'), false);
});

test('internal visual-state and shader fields are not exposed', () => {
  const serialized = JSON.stringify(build());
  for (const key of ['shaderEnergy', 'nodeScale', 'particleDensity', 'bloomIntensity', 'pathOpacity']) {
    assert.equal(serialized.includes(key), false);
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

function build() {
  return buildBrandMindDataPanelViewModel(MOCK_BRAND_MIND_PANEL);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function statusFixture({ concentration, stability, change }) {
  const snapshot = clone(MOCK_BRAND_MIND_PANEL);
  snapshot.brandMind.core.concentration.value = concentration;
  snapshot.brandMind.core.stability.value = stability;
  snapshot.brandMind.core.changeVsLast.value = change;
  snapshot.brandMind.associations.forEach((association) => {
    association.changeVsLast.value = 0.01;
  });
  return snapshot;
}

function findNumbers(value, output = []) {
  if (typeof value === 'number') output.push(value);
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((child) => findNumbers(child, output));
  }
  return output;
}
