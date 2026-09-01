import assert from 'node:assert/strict';
import { CANONICAL_FIVE_A_MOCK } from '../../v2/mock/canonicalFixtures.js';
import {
  createFiveADataPanelController,
  isFiveADataPanelIsolationEvent
} from './fiveADataPanelController.js';
import { buildFiveADataPanelViewModel } from './fiveADataPanelViewModel.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('ViewModel is deterministic', () => {
  assert.deepEqual(build(), build());
});

test('Stage Overview always contains A1 through A5', () => {
  assert.deepEqual(build().stageRows.map((row) => row.stageId), ['A1', 'A2', 'A3', 'A4', 'A5']);
});

test('Transition Flow contains exactly four adjacent paths', () => {
  assert.deepEqual(
    build().transitionRows.map((row) => row.transitionId),
    ['A1_TO_A2', 'A2_TO_A3', 'A3_TO_A4', 'A4_TO_A5']
  );
});

test('Opportunity Pool is explicitly not A6', () => {
  const viewModel = build();
  assert.equal(viewModel.opportunityPool.isStage, false);
  assert.equal(viewModel.stageRows.some((row) => row.stageId === 'A6'), false);
});

test('MOCK and SYNTHETIC identity is preserved', () => {
  const header = build().header;
  assert.equal(header.sourceType, 'MOCK');
  assert.equal(header.verification, 'SYNTHETIC');
  assert.equal(header.sourceIdentity, 'MOCK / SYNTHETIC');
});

test('missing stage stays safe and visible as an unavailable row', () => {
  const snapshot = clone(CANONICAL_FIVE_A_MOCK);
  snapshot.fiveA.stages.A3 = null;
  const row = buildFiveADataPanelViewModel(snapshot).stageRows[2];
  assert.equal(row.stageId, 'A3');
  assert.equal(row.available, false);
  assert.equal(row.population, null);
  assert.equal(row.populationLabel, '未提供');
});

test('missing transition stays safe and visible as an unavailable row', () => {
  const snapshot = clone(CANONICAL_FIVE_A_MOCK);
  snapshot.fiveA.transitions.A2_TO_A3 = null;
  const row = buildFiveADataPanelViewModel(snapshot).transitionRows[1];
  assert.equal(row.transitionId, 'A2_TO_A3');
  assert.equal(row.available, false);
  assert.equal(row.conversionRate, null);
});

test('missing quality metrics are labelled unavailable, not fabricated', () => {
  const quality = build().dataQuality;
  assert.equal(quality.productionScore, false);
  assert.equal(quality.metrics.find((item) => item.id === 'validity').value, null);
  assert.equal(quality.metrics.find((item) => item.id === 'timeliness').valueLabel, '未提供');
});

test('ViewModel contains no NaN', () => {
  assert.equal(findNumbers(build()).some(Number.isNaN), false);
});

test('ViewModel contains no Infinity', () => {
  assert.equal(findNumbers(build()).every(Number.isFinite), true);
});

test('controller opens panel once', () => {
  const changes = [];
  const controller = createFiveADataPanelController({ onStateChange: (state) => changes.push(state) });
  assert.equal(controller.open(), true);
  assert.equal(controller.isOpen(), true);
  assert.equal(changes.length, 1);
});

test('controller closes panel and restores closed interaction state', () => {
  const controller = createFiveADataPanelController();
  controller.open();
  assert.equal(controller.close(), true);
  assert.equal(controller.isOpen(), false);
});

test('ESC closes only an open panel', () => {
  const controller = createFiveADataPanelController();
  assert.equal(controller.handleKeyDown({ key: 'Escape' }), false);
  controller.open();
  assert.equal(controller.handleKeyDown({ key: 'Enter' }), false);
  assert.equal(controller.handleKeyDown({ key: 'Escape' }), true);
  assert.equal(controller.isOpen(), false);
});

test('repeated open does not create a second state transition', () => {
  const changes = [];
  const controller = createFiveADataPanelController({ onStateChange: (state) => changes.push(state) });
  controller.open();
  assert.equal(controller.open(), false);
  assert.equal(changes.length, 1);
});

test('panel wheel and pointer events are isolated from scene input', () => {
  assert.equal(isFiveADataPanelIsolationEvent('wheel'), true);
  assert.equal(isFiveADataPanelIsolationEvent('pointerdown'), true);
  assert.equal(isFiveADataPanelIsolationEvent('pointerup'), true);
  assert.equal(isFiveADataPanelIsolationEvent('keydown'), false);
});

test('bottleneck diagnostics are data-derived and marked experimental', () => {
  const viewModel = build();
  assert.equal(viewModel.rules.status, 'EXPERIMENTAL');
  assert.equal(viewModel.transitionRows.filter((row) => row.isBottleneck).length, 1);
  assert.equal(viewModel.diagnostics.length, 3);
  assert.ok(viewModel.diagnostics.every((item) => item.sourceRule === viewModel.rules.version));
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
  return buildFiveADataPanelViewModel(CANONICAL_FIVE_A_MOCK);
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
