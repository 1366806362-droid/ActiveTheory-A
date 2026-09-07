import { BINDING_CHANNEL } from '../binding/bindingChannels.js';
import { BINDING_GUARDRAILS } from '../binding/bindingGuardrails.js';
import { validateVisualBindingPlan } from '../binding/bindingValidation.js';

export const FIVE_A_A3_CHANNELS = Object.freeze({
  scale: BINDING_CHANNEL.FIVEA_STAGE_SCALE,
  energy: BINDING_CHANNEL.FIVEA_STAGE_ENERGY
});

// The target owns renderer references; the adapter only commits bounded values.
export function assertFiveAA3Values(values) {
  if (Object.keys(values).sort().join(',') !== 'energy,scale') throw new Error('Unsupported A3 channel');
  for (const [property, channel] of Object.entries(FIVE_A_A3_CHANNELS)) {
    const { min, max } = BINDING_GUARDRAILS[channel];
    if (!Number.isFinite(values[property]) || values[property] < min || values[property] > max) {
      throw new Error(`A3 ${property} outside guardrail`);
    }
  }
}

export function createFiveAA3RendererAdapter(resolveTarget) {
  let target = resolveTarget('A3');
  if (target?.stageId !== 'A3' || typeof target.write !== 'function') throw new Error('A3 stable target missing');
  const original = target.read().binding;
  let metadata = null;
  let disposed = false;
  return Object.freeze({
    apply(plan) {
      if (disposed) throw new Error('A3 adapter disposed');
      const validation = validateVisualBindingPlan(plan);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      const values = {};
      const entries = [];
      for (const [property, channel] of Object.entries(FIVE_A_A3_CHANNELS)) {
        const matching = plan.fiveA.stages.filter((entry) => entry.channel === channel && entry.stageId === 'A3');
        if (matching.length !== 1 || matching[0].targetId !== 'A3'
          || matching[0].sourcePath !== `fiveA.stages.A3.${property}`) throw new Error('Invalid A3 binding target');
        values[property] = matching[0].value;
        entries.push(structuredClone(matching[0]));
      }
      assertFiveAA3Values(values);
      const nextMetadata = structuredClone({ ...plan.metadata, entries, sourceMissingPaths: plan.diagnostics.sourceMissingPaths });
      const previous = target.read().binding;
      try {
        target.write(values);
      } catch (error) {
        target.write(previous);
        throw error;
      }
      metadata = nextMetadata;
      return this.getReport();
    },
    getReport() {
      return { disposed, targetId: 'A3', metadata: structuredClone(metadata), renderer: target?.read() ?? null };
    },
    dispose() {
      if (disposed) return;
      target.write(original);
      disposed = true;
      target = null;
      metadata = null;
    }
  });
}
