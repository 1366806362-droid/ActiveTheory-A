import { GEO_SIGNAL_IDS, deepFreeze } from '../contracts/brandUniverseContract.js';

export const GEO_DERIVATION_VERSION = 'V2_1_GEO_DERIVED_1';

export function deriveGeoMetrics(snapshot) {
  const geo = snapshot?.geo;
  if (!geo) return deepFreeze({ available: false, version: GEO_DERIVATION_VERSION });
  const missingMetricIds = [];
  for (const signalId of GEO_SIGNAL_IDS) {
    for (const metricId of ['volume', 'strength', 'quality', 'opportunity']) {
      if (!Number.isFinite(geo[signalId]?.[metricId]?.value)) {
        missingMetricIds.push(`${signalId}.${metricId}`);
      }
    }
  }
  return deepFreeze({
    available: true,
    version: GEO_DERIVATION_VERSION,
    missingMetricIds,
    complete: missingMetricIds.length === 0
  });
}
