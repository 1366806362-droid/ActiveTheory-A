import { BINDING_CHANNELS } from '../binding/bindingChannels.js';
import { FIVE_A_TRANSITIONS } from '../contracts/brandUniverseContract.js';
import {
  IMPLEMENTATION_PRIORITY,
  RENDERER_TARGET_LIFECYCLE,
  RENDERER_TARGET_STATUS
} from './rendererTargetManifest.js';

const REQUIRED_ENTRY_FIELDS = Object.freeze([
  'channel', 'domain', 'targetId', 'targetKey', 'sourceFile', 'symbol', 'targetKind',
  'lifecycle', 'status', 'priority', 'runtimeTargetCount', 'requiredHook', 'notes'
]);
const FORBIDDEN_ART_DIRECTION_TERMS = new Set([
  'camera', 'globalcomposition', 'scenelayout', 'earthposition', 'galaxyposition',
  'stagepermanentposition', 'route', 'scroll', 'handoff', 'typography', 'panellayout'
]);

export function validateRendererTargetManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return result(false, ['Renderer target manifest must be an object.']);
  }
  if (!Array.isArray(manifest.entries)) errors.push('Manifest entries must be an array.');
  const entries = manifest.entries ?? [];
  const entryKeys = new Set();

  entries.forEach((entry, index) => {
    const path = `entries[${index}]`;
    REQUIRED_ENTRY_FIELDS.forEach((field) => {
      if (!Object.hasOwn(entry, field)) errors.push(`${path}.${field} is required.`);
    });
    if (!BINDING_CHANNELS.includes(entry.channel)) errors.push(`${path}.channel is unknown: ${entry.channel}.`);
    if (!Object.values(RENDERER_TARGET_STATUS).includes(entry.status)) errors.push(`${path}.status is invalid.`);
    if (!Object.values(RENDERER_TARGET_LIFECYCLE).includes(entry.lifecycle)) errors.push(`${path}.lifecycle is invalid.`);
    if (!Object.values(IMPLEMENTATION_PRIORITY).includes(entry.priority)) errors.push(`${path}.priority is invalid.`);
    if (!Number.isInteger(entry.runtimeTargetCount) || entry.runtimeTargetCount < 1) {
      errors.push(`${path}.runtimeTargetCount must be a positive integer.`);
    }
    if (entry.status === RENDERER_TARGET_STATUS.NEEDS_ADAPTER_HOOK && !String(entry.requiredHook).trim()) {
      errors.push(`${path}.requiredHook is required for NEEDS_ADAPTER_HOOK.`);
    }
    const key = `${entry.channel}:${entry.domain}:${entry.targetKey}`;
    if (entryKeys.has(key)) errors.push(`${path} duplicates renderer target manifest entry ${key}.`);
    entryKeys.add(key);
    [entry.targetId, entry.targetKind].forEach((value) => {
      if (FORBIDDEN_ART_DIRECTION_TERMS.has(normalize(value))) {
        errors.push(`${path} attempts to inventory Art Direction-owned target ${value}.`);
      }
    });
  });

  const classified = new Set(entries.map((entry) => entry.channel));
  BINDING_CHANNELS.filter((channel) => !classified.has(channel)).forEach((channel) => {
    errors.push(`Binding channel is not classified: ${channel}.`);
  });
  validateFiveA(entries, errors);
  validateBrandMindIdentityPolicy(entries, errors);
  validateSerialization(manifest, errors);
  return result(errors.length === 0, errors);
}

function validateFiveA(entries, errors) {
  const stages = new Set(entries.filter((entry) => entry.domain === 'FIVE_A' && entry.targetKind === 'FiveAStageRoot').map((entry) => entry.targetId));
  if (JSON.stringify([...stages].sort()) !== JSON.stringify(['A1', 'A2', 'A3', 'A4', 'A5'])) {
    errors.push('FiveA stage targets must be exactly A1-A5.');
  }
  if (stages.has('A6')) errors.push('Opportunity Pool must not be represented as A6.');
  const transitions = new Set(entries.filter((entry) => entry.targetKind === 'FiveATransitionFlow').map((entry) => entry.targetId));
  if (JSON.stringify([...transitions]) !== JSON.stringify(FIVE_A_TRANSITIONS)) {
    errors.push('FiveA transitions must be exactly the four canonical transitions.');
  }
}

function validateBrandMindIdentityPolicy(entries, errors) {
  const dynamic = entries.filter((entry) => entry.domain === 'BRAND_MIND' && entry.status === RENDERER_TARGET_STATUS.DYNAMIC_TARGET);
  dynamic.forEach((entry) => {
    if (!entry.requiredHook.includes('NEEDS_STABLE_REGISTRY_HOOK')) {
      errors.push(`Dynamic Brand Mind entry ${entry.channel} must declare NEEDS_STABLE_REGISTRY_HOOK.`);
    }
    if (entry.priority !== IMPLEMENTATION_PRIORITY.P0) {
      errors.push(`Dynamic Brand Mind entry ${entry.channel} must remain P0 until a stable registry exists.`);
    }
  });
}

function validateSerialization(value, errors) {
  try {
    JSON.parse(JSON.stringify(value));
  } catch (error) {
    errors.push(`Manifest must be serializable: ${error.message}`);
  }
}

function normalize(value) {
  return String(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function result(ok, errors) {
  return Object.freeze({ ok, errors: Object.freeze(errors) });
}
