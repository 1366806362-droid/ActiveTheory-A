import { buildVisualBindingPlan } from '../binding/bindingPlanner.js';
import { deriveBusinessMetrics } from '../derived/deriveBusinessMetrics.js';
import { buildVisualState } from '../mapping/buildVisualState.js';
import { buildBrandMindDataPanelViewModel } from '../../ui/brandMind-data-panel/brandMindDataPanelViewModel.js';
import { buildFiveADataPanelViewModel } from '../../ui/fiveA-data-panel/fiveADataPanelViewModel.js';
import { createFrameAssertions, evaluateReplayAssertions } from './replayAssertions.js';
import { REPLAY_SCENARIOS } from './replayFixtures.js';

export function runBindingReplay({ scenario, frames = scenario?.frames } = {}) {
  if (!scenario || !Array.isArray(frames)) throw new TypeError('runBindingReplay requires scenario frames.');
  const replay = {
    scenario: { id: scenario.id, moduleId: scenario.moduleId, title: scenario.title, golden: scenario.golden },
    frames: frames.map((sourceFrame) => buildReplayFrame(sourceFrame, scenario.moduleId))
  };
  const assertions = evaluateReplayAssertions({ ...replay, scenario });
  return Object.freeze({
    ...replay,
    assertions,
    diagnostics: {
      passed: assertions.filter((item) => item.status === 'PASS').length,
      failed: assertions.filter((item) => item.status === 'FAIL').length,
      rendererIntegration: 'V2_3B_TODO',
      doesRender: false
    }
  });
}

export function runAllBindingReplays(scenarios = REPLAY_SCENARIOS) {
  return Object.freeze(scenarios.map((scenario) => runBindingReplay({ scenario })));
}

export function validateReplayGolden(replay) {
  const golden = replay?.scenario?.golden ?? {};
  const frameIds = replay.frames.map((frame) => frame.frameId);
  const errors = [];
  if (golden.frameIds && JSON.stringify(frameIds) !== JSON.stringify(golden.frameIds)) {
    errors.push('Golden frame IDs differ.');
  }
  if (golden.stableTargetId && !replay.frames.every((frame) => (
    frame.bindingPlan && JSON.stringify(frame.bindingPlan).includes(golden.stableTargetId)
  ))) errors.push('Golden stable target ID is absent.');
  if (golden.categories) {
    const categories = replay.frames.map((frame) => frame.derived.brandMind?.coreStatus ?? null);
    if (JSON.stringify(categories) !== JSON.stringify(golden.categories)) {
      errors.push('Golden categories differ.');
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function buildReplayFrame(sourceFrame, moduleId) {
  const snapshot = sourceFrame.snapshot;
  const derived = deriveBusinessMetrics(snapshot);
  const visualState = buildVisualState(snapshot);
  const bindingPlan = buildVisualBindingPlan(visualState);
  const panel = buildPanel(moduleId, snapshot, derived);
  const frame = {
    frameId: sourceFrame.frameId,
    capturedAt: snapshot.metadata.capturedAt,
    snapshotId: snapshot.metadata.snapshotId,
    snapshot,
    derived,
    visualState,
    bindingPlan,
    panel
  };
  return Object.freeze({ ...frame, assertions: createFrameAssertions(frame) });
}

function buildPanel(moduleId, snapshot, derived) {
  if (moduleId === 'fiveA') return buildFiveADataPanelViewModel(snapshot, derived.fiveA);
  if (moduleId === 'brandMind') return buildBrandMindDataPanelViewModel(snapshot, derived.brandMind);
  return null;
}
