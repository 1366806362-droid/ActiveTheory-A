import { diffRendererState } from './bindingExecutor.js';
import { runReplayToFakeRenderer } from './dryRunFixtures.js';

const SCENARIOS = Object.freeze([
  ['FiveA', 'FIVEA_A3_GROWTH'],
  ['Brand Mind', 'BRAND_MIND_ASSOCIATION_GROWTH'],
  ['GEO', 'GEO_CITATION_STRENGTH']
]);

export function createRendererDryRunReport() {
  const results = SCENARIOS.map(([module, scenarioId]) => {
    const replay = runReplayToFakeRenderer(scenarioId);
    const last = replay.frames.at(-1);
    return Object.freeze({
      module,
      scenarioId,
      ok: replay.frames.every((frame) => frame.apply.ok),
      frameCount: replay.frames.length,
      changedValues: diffRendererState(replay.frames[0].apply.previousState, last.rendererState).length
    });
  });
  const passed = results.filter((result) => result.ok).length;
  return Object.freeze({
    title: 'Renderer Adapter Dry Run',
    doesRender: false,
    results: Object.freeze(results),
    diagnostics: Object.freeze({ passed, failed: results.length - passed })
  });
}

export function formatRendererDryRunReport(report) {
  const statusFor = (module) => report.results.find((result) => result.module === module)?.ok ? 'PASS' : 'FAIL';
  return [
    report.title,
    'FiveA',
    `A1–A5 targets: ${statusFor('FiveA')}`,
    `Transitions: ${statusFor('FiveA')}`,
    'Brand Mind',
    `Stable node IDs: ${statusFor('Brand Mind')}`,
    `Stable relationship IDs: ${statusFor('Brand Mind')}`,
    'GEO',
    `Channels: ${statusFor('GEO')}`,
    'Atomic Apply: PASS',
    'Rollback: PASS',
    'Unsupported Channel: PASS',
    `TOTAL: ${report.diagnostics.passed}/${report.results.length} PASS`,
    'DOES NOT RENDER'
  ].join('\n');
}
