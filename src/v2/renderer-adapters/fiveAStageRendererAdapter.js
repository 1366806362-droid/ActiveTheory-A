import { FIVE_A_STAGES } from '../contracts/brandUniverseContract.js';
import { BINDING_CHANNEL } from '../binding/bindingChannels.js';
import { BINDING_GUARDRAILS } from '../binding/bindingGuardrails.js';
import { validateVisualBindingPlan } from '../binding/bindingValidation.js';

export const FIVE_A_RENDERER_STAGE_IDS = Object.freeze(Object.keys(FIVE_A_STAGES));
export const FIVE_A_STAGE_RENDERER_CHANNELS = Object.freeze({
  scale: BINDING_CHANNEL.FIVEA_STAGE_SCALE,
  energy: BINDING_CHANNEL.FIVEA_STAGE_ENERGY
});

export function assertFiveAStageValues(values) {
  if (!values || Object.keys(values).sort().join(',') !== 'energy,scale') throw new Error('Unsupported stage channel');
  for (const [property, channel] of Object.entries(FIVE_A_STAGE_RENDERER_CHANNELS)) {
    const { min, max } = BINDING_GUARDRAILS[channel];
    if (!Number.isFinite(values[property]) || values[property] < min || values[property] > max) {
      throw new Error(`Stage ${property} outside guardrail`);
    }
  }
}

// Validate the entire requested scope before any write. No source metrics here.
export function createFiveAStageRendererAdapter(resolveTarget, { stageIds = FIVE_A_RENDERER_STAGE_IDS } = {}) {
  const ids = [...stageIds];
  if (!ids.length || new Set(ids).size !== ids.length || ids.some((id) => !FIVE_A_RENDERER_STAGE_IDS.includes(id))) {
    throw new Error('Invalid stage capability scope');
  }
  const targets = new Map(ids.map((id) => {
    const target = resolveTarget(id);
    if (target?.stageId !== id || typeof target.write !== 'function' || typeof target.read !== 'function') {
      throw new Error(`Stable target missing: ${id}`);
    }
    return [id, target];
  }));
  const original = new Map(ids.map((id) => [id, targets.get(id).read().binding]));
  let metadata = null;
  let disposed = false;
  function getReport() {
    return { disposed, stageIds: [...ids], metadata: structuredClone(metadata),
      renderer: disposed ? null : Object.fromEntries(ids.map((id) => [id, targets.get(id).read()])) };
  }
  function writeAtomic(values) {
    const previous = new Map(ids.map((id) => [id, targets.get(id).read().binding]));
    const touched = [];
    try {
      for (const id of ids) { touched.push(id); targets.get(id).write(values.get(id)); }
    } catch (error) {
      const rollbackErrors = [];
      for (const id of touched.reverse()) {
        try { targets.get(id).write(previous.get(id)); } catch (failure) { rollbackErrors.push(failure); }
      }
      if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], 'Stage apply and rollback failed');
      throw error;
    }
  }
  return Object.freeze({
    apply(plan) {
      if (disposed) throw new Error('Stage adapter disposed');
      const validation = validateVisualBindingPlan(plan);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      const values = new Map();
      const entries = [];
      for (const id of ids) {
        const next = {};
        for (const [property, channel] of Object.entries(FIVE_A_STAGE_RENDERER_CHANNELS)) {
          const matching = plan.fiveA.stages.filter((entry) => entry.channel === channel && entry.stageId === id);
          if (matching.length !== 1 || matching[0].targetId !== id
            || matching[0].sourcePath !== `fiveA.stages.${id}.${property}`) throw new Error(`Invalid stage binding target: ${id}`);
          next[property] = matching[0].value;
          entries.push(structuredClone(matching[0]));
        }
        assertFiveAStageValues(next);
        values.set(id, next);
      }
      const nextMetadata = structuredClone({ ...plan.metadata, entries, sourceMissingPaths: plan.diagnostics.sourceMissingPaths });
      writeAtomic(values);
      metadata = nextMetadata;
      return getReport();
    },
    getReport,
    dispose() {
      if (disposed) return;
      writeAtomic(original);
      disposed = true;
      targets.clear();
      original.clear();
      metadata = null;
    }
  });
}
