// Opt-in development harness. Both UI and renderer consume the same validated
// fixture Snapshot. No direct mesh writes, live sources or new business mapping.
import { createV2ConsumerProvider } from './consumerProvider.js';
import { createFiveAStagesDemoSnapshot } from './fiveAStagesDemo.js';
import { createFiveAA3DemoSnapshot } from './fiveAA3Demo.js';
import { createFiveATransitionsDemoSnapshot } from './fiveAFlowDemo.js';
import { buildVisualBindingPlan } from '../binding/bindingPlanner.js';
import { createFiveAStageRendererAdapter } from '../renderer-adapters/fiveAStageRendererAdapter.js';
import { createFiveATransitionFlowRendererAdapter } from '../renderer-adapters/fiveAFlowRendererAdapter.js';

export function createFiveACinematicReview({ scene, replacePanel }) {
  const stages = createFiveAStageRendererAdapter(scene.resolveStageRendererTarget);
  const flows = createFiveATransitionFlowRendererAdapter(scene.resolveTransitionRendererTarget);
  let current = null;
  let disposed = false;
  function applyFixture(kind, state, targetId = 'A2_TO_A3') {
    if (disposed) throw new Error('Review disposed');
    const snapshot = kind === 'stage' ? createFiveAA3DemoSnapshot(state)
      : kind === 'flow' ? createFiveATransitionsDemoSnapshot(targetId, state)
        : kind === 'stages' ? createFiveAStagesDemoSnapshot(state) : null;
    if (!snapshot) throw new Error('Unknown review fixture');
    const consumer = createV2ConsumerProvider({ fiveASnapshot: snapshot }).getFiveA();
    const visual = consumer.buildVisualState();
    const plan = buildVisualBindingPlan(visual);
    try {
      stages.apply(plan);
      flows.apply(plan);
      replacePanel(consumer);
    } catch (error) {
      if (current) { stages.apply(current.plan); flows.apply(current.plan); }
      else { flows.dispose(); stages.dispose(); disposed = true; }
      throw error;
    }
    current = { snapshotId: snapshot.metadata.snapshotId, snapshot, visual, plan, kind, state, targetId: kind === 'stage' ? 'A3' : targetId };
    return read();
  }
  function read() { return { ...current, stages: stages.getReport(), flows: flows.getReport() }; }
  return Object.freeze({ applyFixture, read, dispose() {
    if (disposed) return;
    flows.dispose(); stages.dispose(); disposed = true; current = null;
  } });
}
