import { BINDING_CHANNELS } from '../binding/bindingChannels.js';
import {
  IMPLEMENTATION_PRIORITY,
  RENDERER_TARGET_MANIFEST,
  RENDERER_TARGET_STATUS,
  V2_3B_IMPLEMENTATION_MANIFEST
} from './rendererTargetManifest.js';
import { validateRendererTargetManifest } from './rendererTargetValidation.js';

const STATUS_VALUES = Object.values(RENDERER_TARGET_STATUS);
const PRIORITY_VALUES = Object.values(IMPLEMENTATION_PRIORITY);

export function buildRendererTargetInventory(manifest = RENDERER_TARGET_MANIFEST) {
  const validation = validateRendererTargetManifest(manifest);
  if (!validation.ok) {
    throw new Error(`Invalid renderer target manifest:\n- ${validation.errors.join('\n- ')}`);
  }

  const entries = manifest.entries.map((entry) => ({ ...entry }));
  const channelCoverage = summarizeChannels(entries);
  const targetCoverage = summarizeTargets(entries);
  const implementation = summarizeImplementation(V2_3B_IMPLEMENTATION_MANIFEST.actions);
  const blockers = implementation.byPriority[IMPLEMENTATION_PRIORITY.P0];

  return Object.freeze({
    inventoryVersion: manifest.inventoryVersion,
    entries: Object.freeze(entries),
    channelCoverage: Object.freeze(channelCoverage),
    targetCoverage: Object.freeze(targetCoverage),
    implementation: Object.freeze(implementation),
    blockers: Object.freeze(blockers),
    preflightStatus: blockers.length ? 'BLOCKED' : 'READY'
  });
}

function summarizeChannels(entries) {
  const byChannel = new Map();
  entries.forEach((entry) => {
    const current = byChannel.get(entry.channel);
    if (!current || statusRank(entry.status) > statusRank(current.status)) {
      byChannel.set(entry.channel, entry);
    }
  });

  return Object.freeze({
    totalChannelTypes: BINDING_CHANNELS.length,
    classifiedChannelTypes: byChannel.size,
    byStatus: countByStatus([...byChannel.values()]),
    uncoveredChannels: Object.freeze(BINDING_CHANNELS.filter((channel) => !byChannel.has(channel)))
  });
}

function summarizeTargets(entries) {
  const byTarget = new Map();
  entries.forEach((entry) => {
    const key = `${entry.domain}:${entry.targetKey}`;
    const current = byTarget.get(key);
    if (!current || statusRank(entry.status) > statusRank(current.status)) {
      byTarget.set(key, entry);
    }
  });

  const targets = [...byTarget.values()];
  return Object.freeze({
    totalRuntimeTargets: targets.reduce((total, target) => total + target.runtimeTargetCount, 0),
    classifiedRuntimeTargets: targets.reduce((total, target) => total + target.runtimeTargetCount, 0),
    byStatus: countByStatus(targets, (target) => target.runtimeTargetCount),
    targetKinds: Object.freeze([...new Set(targets.map((target) => target.targetKind))].sort())
  });
}

function summarizeImplementation(actions) {
  const byPriority = Object.fromEntries(PRIORITY_VALUES.map((priority) => [priority, []]));
  actions.forEach((item) => byPriority[item.priority].push({ ...item }));
  Object.values(byPriority).forEach((items) => items.sort((left, right) => left.id.localeCompare(right.id)));
  return {
    totalActions: actions.length,
    byPriority: Object.freeze(Object.fromEntries(
      Object.entries(byPriority).map(([priority, items]) => [priority, Object.freeze(items)])
    ))
  };
}

function countByStatus(items, count = () => 1) {
  const result = Object.fromEntries(STATUS_VALUES.map((status) => [status, 0]));
  items.forEach((item) => { result[item.status] += count(item); });
  return Object.freeze(result);
}

function statusRank(status) {
  return STATUS_VALUES.indexOf(status);
}
