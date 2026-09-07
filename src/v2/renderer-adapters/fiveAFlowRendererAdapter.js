import { BINDING_CHANNEL } from '../binding/bindingChannels.js';
import { BINDING_GUARDRAILS } from '../binding/bindingGuardrails.js';
import { validateVisualBindingPlan } from '../binding/bindingValidation.js';

export const FIVE_A_FLOW_TARGET = 'A2_TO_A3';
const channel = BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH;
export function assertFiveAFlowValues(values) {
  const { min, max } = BINDING_GUARDRAILS[channel];
  if (Object.keys(values ?? {}).join(',') !== 'flowStrength'
    || !Number.isFinite(values.flowStrength) || values.flowStrength < min || values.flowStrength > max) {
    throw new Error('Invalid flow strength');
  }
}

// Same validated-plan / stable-target / atomic-write lifecycle as the stage adapter.
export function createFiveAFlowRendererAdapter(resolveTarget) {
  let target = resolveTarget(FIVE_A_FLOW_TARGET);
  if (target?.transitionId !== FIVE_A_FLOW_TARGET || typeof target.read !== 'function'
    || typeof target.write !== 'function') throw new Error('A2_TO_A3 stable target missing');
  const original = structuredClone(target.read().binding);
  let disposed = false;
  let metadata = null;
  function getReport() { return { disposed, metadata: structuredClone(metadata), renderer: disposed ? null : target.read() }; }
  function writeAtomic(values) {
    const previous = structuredClone(target.read().binding);
    try { target.write(values); } catch (error) {
      try { target.write(previous); } catch (rollback) { throw new AggregateError([error, rollback], 'Flow rollback failed'); }
      throw error;
    }
  }
  return Object.freeze({
    apply(plan) {
      if (disposed) throw new Error('Flow adapter disposed');
      const validation = validateVisualBindingPlan(plan);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      const entries = plan.fiveA.transitions.filter(entry => entry.channel === channel && entry.transitionId === FIVE_A_FLOW_TARGET);
      if (entries.length !== 1 || entries[0].targetId !== FIVE_A_FLOW_TARGET
        || entries[0].sourcePath !== `fiveA.transitions.${FIVE_A_FLOW_TARGET}.flowStrength`) throw new Error('Invalid flow target');
      const values = { flowStrength: entries[0].value };
      assertFiveAFlowValues(values);
      const nextMetadata = structuredClone({ ...plan.metadata, entry: entries[0], sourceMissingPaths: plan.diagnostics.sourceMissingPaths });
      writeAtomic(values);
      metadata = nextMetadata;
      return getReport();
    },
    getReport,
    dispose() { if (disposed) return; writeAtomic(original); metadata = null; disposed = true; target = null; }
  });
}
