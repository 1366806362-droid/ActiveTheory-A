import { IMPLEMENTATION_PRIORITY } from './rendererTargetManifest.js';
import { buildRendererTargetInventory } from './rendererTargetInventory.js';

export function buildRendererTargetReport() {
  const inventory = buildRendererTargetInventory();
  const domains = ['FIVE_A', 'BRAND_MIND', 'GEO', 'HOME'].map((domain) => ({
    domain,
    channels: new Set(inventory.entries.filter((entry) => entry.domain === domain).map((entry) => entry.channel)).size,
    targets: inventory.entries
      .filter((entry) => entry.domain === domain)
      .filter((entry, index, items) => items.findIndex((candidate) => candidate.targetKey === entry.targetKey) === index)
      .reduce((total, entry) => total + entry.runtimeTargetCount, 0),
    available: countDomain(inventory.entries, domain, 'AVAILABLE'),
    needsHook: countDomain(inventory.entries, domain, 'NEEDS_ADAPTER_HOOK'),
    dynamic: countDomain(inventory.entries, domain, 'DYNAMIC_TARGET')
  }));

  return Object.freeze({
    title: 'ACTIVE THEORY V2-3B PREFLIGHT',
    inventoryVersion: inventory.inventoryVersion,
    domains: Object.freeze(domains),
    channelCoverage: inventory.channelCoverage,
    targetCoverage: inventory.targetCoverage,
    priorities: Object.freeze({
      P0: inventory.implementation.byPriority[IMPLEMENTATION_PRIORITY.P0],
      P1: inventory.implementation.byPriority[IMPLEMENTATION_PRIORITY.P1],
      P2: inventory.implementation.byPriority[IMPLEMENTATION_PRIORITY.P2]
    }),
    blockers: inventory.blockers,
    status: inventory.preflightStatus
  });
}

export function formatRendererTargetReport(report = buildRendererTargetReport()) {
  const lines = [report.title, ''];
  report.domains.forEach((domain) => {
    lines.push(`${domain.domain}: channels=${domain.channels}, targets=${domain.targets}, available=${domain.available}, needsHook=${domain.needsHook}, dynamic=${domain.dynamic}`);
  });
  lines.push('');
  lines.push(`CHANNEL COVERAGE: ${report.channelCoverage.classifiedChannelTypes}/${report.channelCoverage.totalChannelTypes}`);
  lines.push(`TARGET COVERAGE: ${report.targetCoverage.classifiedRuntimeTargets}/${report.targetCoverage.totalRuntimeTargets}`);
  lines.push(`AVAILABLE: ${report.targetCoverage.byStatus.AVAILABLE}`);
  lines.push(`NEEDS_ADAPTER_HOOK: ${report.targetCoverage.byStatus.NEEDS_ADAPTER_HOOK}`);
  lines.push(`DYNAMIC_TARGET: ${report.targetCoverage.byStatus.DYNAMIC_TARGET}`);
  lines.push(`NOT_FOUND: ${report.targetCoverage.byStatus.NOT_FOUND}`);
  lines.push(`P0: ${report.priorities.P0.length}`);
  lines.push(`P1: ${report.priorities.P1.length}`);
  lines.push(`P2: ${report.priorities.P2.length}`);
  lines.push(`V2-3B STATUS: ${report.status}`);
  return lines.join('\n');
}

function countDomain(entries, domain, status) {
  const seen = new Set();
  return entries.filter((entry) => entry.domain === domain && entry.status === status).reduce((total, entry) => {
    if (seen.has(entry.targetKey)) return total;
    seen.add(entry.targetKey);
    return total + entry.runtimeTargetCount;
  }, 0);
}
