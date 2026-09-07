import { BINDING_CHANNEL } from '../binding/bindingChannels.js';
import { BINDING_GUARDRAILS } from '../binding/bindingGuardrails.js';
import { validateVisualBindingPlan } from '../binding/bindingValidation.js';

export const FIVE_A_FLOW_TARGET = 'A2_TO_A3';
export const FIVE_A_FLOW_TRANSITION_IDS = Object.freeze([
  'A1_TO_A2', 'A2_TO_A3', 'A3_TO_A4', 'A4_TO_A5'
]);
const channel = BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH;
export function assertFiveAFlowValues(values) {
  const { min, max } = BINDING_GUARDRAILS[channel];
  if (Object.keys(values ?? {}).join(',') !== 'flowStrength'
    || !Number.isFinite(values.flowStrength) || values.flowStrength < min || values.flowStrength > max) {
    throw new Error('Invalid flow strength');
  }
}

// Same validated-plan / stable-target / atomic-write lifecycle as the stage adapter.
export function createFiveATransitionFlowRendererAdapter(resolveTarget, { transitionIds = FIVE_A_FLOW_TRANSITION_IDS } = {}) {
  const ids = [...transitionIds];
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !FIVE_A_FLOW_TRANSITION_IDS.includes(id))) {
    throw new Error('Invalid transition capability scope');
  }
  const targets = new Map(ids.map(id => {
    const target = resolveTarget(id);
    if (target?.transitionId !== id || typeof target.read !== 'function' || typeof target.write !== 'function') {
      throw new Error(`Stable transition target missing: ${id}`);
    }
    return [id, target];
  }));
  const original = new Map(ids.map(id => [id, structuredClone(targets.get(id).read().binding)]));
  let disposed = false;
  let metadata = null;
  function getReport() { return { disposed, transitionIds: [...ids], metadata: structuredClone(metadata), renderer: disposed ? null : Object.fromEntries(ids.map(id => [id, targets.get(id).read()])) }; }
  function writeAtomic(values) {
    const previous = new Map(ids.map(id => [id, structuredClone(targets.get(id).read().binding)]));
    const touched = [];
    try { for (const id of ids) { touched.push(id); targets.get(id).write(values.get(id)); } } catch (error) {
      const failures = [];
      for (const id of touched.reverse()) { try { targets.get(id).write(previous.get(id)); } catch (rollback) { failures.push(rollback); } }
      if (failures.length) throw new AggregateError([error, ...failures], 'Flow rollback failed');
      throw error;
    }
  }
  return Object.freeze({
    apply(plan) {
      if (disposed) throw new Error('Flow adapter disposed');
      const validation = validateVisualBindingPlan(plan);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      const values = new Map(); const entries = [];
      for (const id of ids) {
        const matching = plan.fiveA.transitions.filter(entry => entry.channel === channel && entry.transitionId === id);
        if (matching.length !== 1 || matching[0].targetId !== id || matching[0].sourcePath !== `fiveA.transitions.${id}.flowStrength`) throw new Error(`Invalid flow target: ${id}`);
        const value = { flowStrength: matching[0].value };
        assertFiveAFlowValues(value); values.set(id, value); entries.push(structuredClone(matching[0]));
      }
      const nextMetadata = structuredClone({ ...plan.metadata, entries, sourceMissingPaths: plan.diagnostics.sourceMissingPaths });
      writeAtomic(values);
      metadata = nextMetadata;
      return getReport();
    },
    getReport,
    dispose() { if (disposed) return; writeAtomic(original); metadata = null; disposed = true; targets.clear(); original.clear(); }
  });
}

// Kept so the previous A2→A3 vertical-slice public API remains valid.
export function createFiveAFlowRendererAdapter(resolveTarget) {
  const adapter = createFiveATransitionFlowRendererAdapter(resolveTarget, { transitionIds: [FIVE_A_FLOW_TARGET] });
  const legacy = (report) => ({ disposed: report.disposed,
    metadata: report.metadata ? { ...report.metadata, entry: report.metadata.entries[0] } : null,
    renderer: report.renderer?.[FIVE_A_FLOW_TARGET] ?? null });
  return Object.freeze({
    apply: (plan) => legacy(adapter.apply(plan)),
    getReport: () => legacy(adapter.getReport()),
    dispose: () => adapter.dispose()
  });
}
