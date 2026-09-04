import { getBindingPlanEntries } from '../binding/bindingPlanner.js';

export function createReplayReport(replays) {
  const scenarios = replays.map((replay) => ({
    id: replay.scenario.id,
    title: replay.scenario.title,
    moduleId: replay.scenario.moduleId,
    passed: replay.diagnostics.passed,
    failed: replay.diagnostics.failed,
    frames: replay.frames.map(summarizeFrame),
    assertions: replay.assertions.map(({ id, type, status }) => ({ id, type, status }))
  }));
  const passed = scenarios.reduce((sum, item) => sum + item.passed, 0);
  const failed = scenarios.reduce((sum, item) => sum + item.failed, 0);
  return Object.freeze({
    id: 'ACTIVE_THEORY_V2_BINDING_REPLAY_REPORT_1',
    rendererIntegration: 'V2_3B_TODO',
    doesRender: false,
    passed,
    failed,
    scenarios
  });
}

export function formatReplayReport(report) {
  const lines = ['V2 Replay Regression', ''];
  for (const scenario of report.scenarios) {
    lines.push(`${scenario.title}: ${scenario.failed ? 'FAIL' : 'PASS'} ${scenario.passed}/${scenario.passed + scenario.failed}`);
  }
  lines.push('', `TOTAL: ${report.passed}/${report.passed + report.failed} PASS`);
  return lines.join('\n');
}

function summarizeFrame(frame) {
  const bindingEntries = getBindingPlanEntries(frame.bindingPlan);
  return {
    frameId: frame.frameId,
    capturedAt: frame.capturedAt,
    snapshotId: frame.snapshotId,
    canonicalSummary: summarizeCanonical(frame),
    derivedSummary: summarizeDerived(frame),
    visualStateSummary: summarizeVisual(frame),
    bindingSummary: {
      entryCount: bindingEntries.length,
      missingBindingCount: frame.bindingPlan.diagnostics.missingBindingCount
    },
    assertions: frame.assertions
  };
}

function summarizeCanonical(frame) {
  const snapshot = frame.snapshot;
  return {
    sourceType: snapshot.metadata.sourceType,
    lineage: { ...snapshot.metadata.lineage },
    a3Population: snapshot.fiveA?.stages?.A3?.population?.value ?? null,
    a2ToA3Rate: snapshot.fiveA?.transitions?.A2_TO_A3?.rate?.value ?? null,
    associationAStrength: snapshot.brandMind?.associations?.find((item) => item.id === 'mock-association-a')?.strength?.value ?? null,
    citationStrength: snapshot.geo?.citation?.strength?.value ?? null,
    keywordOpportunity: snapshot.geo?.keyword?.opportunity?.value ?? null
  };
}

function summarizeDerived(frame) {
  return {
    bottleneck: frame.derived.fiveA?.bottleneck ?? null,
    coreStatus: frame.derived.brandMind?.coreStatus ?? null,
    geoComplete: frame.derived.geo?.complete ?? null
  };
}

function summarizeVisual(frame) {
  return {
    a3Scale: frame.visualState.fiveA.stages.A3.scale,
    a2ToA3FlowStrength: frame.visualState.fiveA.transitions.A2_TO_A3.flowStrength,
    citationEnergy: frame.visualState.geo.citationStream.energy,
    keywordFlowSpeed: frame.visualState.geo.keywordStream.flowSpeed,
    coreConcentration: frame.visualState.brandMind.core.concentration
  };
}
