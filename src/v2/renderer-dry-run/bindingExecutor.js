import { RENDERER_CAPABILITY_CONTRACT } from '../binding/bindingContracts.js';
import { BINDING_CHANNELS } from '../binding/bindingChannels.js';
import { BINDING_GUARDRAILS } from '../binding/bindingGuardrails.js';
import {
  cloneFakeRendererState,
  createFakeRendererTargetRegistry,
  flattenPlanEntries,
  relationshipTargetKey
} from './fakeRendererState.js';

export function applyBindingPlan(plan, rendererState, capabilities = RENDERER_CAPABILITY_CONTRACT) {
  const previousState = cloneFakeRendererState(rendererState);
  const candidateState = cloneFakeRendererState(rendererState);
  const entries = flattenPlanEntries(plan);
  const registry = createFakeRendererTargetRegistry(candidateState);
  const errors = validateEntries(entries, registry, capabilities);
  if (errors.length > 0) {
    return executionResult({ ok: false, applied: [], skipped: [], errors, warnings: [], previousState, nextState: previousState });
  }

  const applied = entries.map((entry) => applyEntry(candidateState, registry, entry));
  reconcileDynamicTargets(candidateState, entries);
  candidateState.diagnostics.sourceMissingPaths = [...new Set(
    entries.filter((entry) => entry.missing).map((entry) => entry.sourcePath)
  )].sort();
  return executionResult({ ok: true, applied, skipped: [], errors: [], warnings: [], previousState, nextState: candidateState });
}

export function diffRendererState(before, after) {
  const changes = [];
  diffValue(before, after, '', changes);
  return Object.freeze(changes);
}

function validateEntries(entries, registry, capabilities) {
  const errors = [];
  const supported = new Set(capabilities?.supportedChannels ?? []);
  for (const entry of entries) {
    if (!BINDING_CHANNELS.includes(entry?.channel)) {
      errors.push(problem('UNKNOWN_CHANNEL', entry, `Unknown binding channel: ${entry?.channel ?? 'undefined'}.`));
      continue;
    }
    if (!supported.has(entry.channel)) {
      errors.push(problem('UNSUPPORTED_CHANNEL', entry, `Renderer capability does not support ${entry.channel}.`));
      continue;
    }
    if (!Number.isFinite(entry.value)) {
      errors.push(problem('INVALID_VALUE', entry, `${entry.channel} value must be finite.`));
      continue;
    }
    const bounds = BINDING_GUARDRAILS[entry.channel];
    if (!bounds || entry.value < bounds.min || entry.value > bounds.max) {
      errors.push(problem('OUT_OF_GUARDRAIL', entry, `${entry.channel} is outside its binding guardrail.`));
      continue;
    }
    const target = registry.resolve(entry);
    if (!target.ok) errors.push(problem(target.code, entry, target.reason));
  }
  return errors;
}

function applyEntry(state, registry, entry) {
  const target = registry.resolve(entry);
  const destination = getPath(state, target.path);
  const previous = destination.value;
  destination.parent[destination.key] = entry.value;
  state.bindingMetadata[entryKey(entry)] = {
    channel: entry.channel,
    targetId: entry.targetId,
    sourceId: entry.sourceId ?? null,
    relationshipId: entry.relationshipId ?? null,
    sourcePath: entry.sourcePath,
    missing: entry.missing,
    confidence: entry.confidence
  };
  return { channel: entry.channel, targetId: entry.targetId, previous, next: entry.value, missing: entry.missing };
}

function reconcileDynamicTargets(state, entries) {
  const activeNodeIds = new Set(entries
    .filter((entry) => entry.channel.startsWith('BRAND_MIND_NODE_'))
    .map((entry) => entry.targetId));
  const activePathIds = new Set(entries
    .filter((entry) => entry.channel.startsWith('BRAND_MIND_PATH_'))
    .map((entry) => relationshipTargetKey(entry.sourceId, entry.targetId)));
  Object.entries(state.brandMind.nodes).forEach(([id, node]) => { node.active = activeNodeIds.has(id); });
  Object.entries(state.brandMind.paths).forEach(([id, path]) => { path.active = activePathIds.has(id); });
}

function executionResult({ ok, applied, skipped, errors, warnings, previousState, nextState }) {
  return Object.freeze({
    ok,
    applied: Object.freeze(applied),
    skipped: Object.freeze(skipped),
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    previousState,
    nextState
  });
}

function problem(code, entry, reason) {
  return { code, channel: entry?.channel ?? null, targetId: entry?.targetId ?? null, reason };
}

function entryKey(entry) {
  return [entry.channel, entry.targetId, entry.sourceId ?? '', entry.relationshipId ?? ''].join('|');
}

function getPath(object, path) {
  let parent = object;
  for (const part of path.slice(0, -1)) parent = parent[part];
  const key = path.at(-1);
  return { parent, key, value: parent[key] };
}

function diffValue(before, after, path, changes) {
  if (typeof before === 'number' || typeof after === 'number') {
    if (before !== after) changes.push({ path, before, after });
    return;
  }
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) {
    diffValue(before[key], after[key], path ? `${path}.${key}` : key, changes);
  }
}
