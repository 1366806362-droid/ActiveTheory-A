import { createFiveAStageRendererAdapter } from './fiveAStageRendererAdapter.js';
export { FIVE_A_STAGE_RENDERER_CHANNELS as FIVE_A_A3_CHANNELS,
  assertFiveAStageValues as assertFiveAA3Values } from './fiveAStageRendererAdapter.js';

export function createFiveAA3RendererAdapter(resolveTarget) {
  // Compatibility scope and report shape for the frozen A3 milestone.
  const adapter = createFiveAStageRendererAdapter(resolveTarget, { stageIds: ['A3'] });
  function getReport() {
    const report = adapter.getReport();
    return { disposed: report.disposed, targetId: 'A3', metadata: report.metadata, renderer: report.renderer?.A3 ?? null };
  }
  return Object.freeze({
    apply(plan) {
      adapter.apply(plan);
      return getReport();
    },
    getReport,
    dispose: adapter.dispose
  });
}
