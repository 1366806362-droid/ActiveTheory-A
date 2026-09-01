import { deepFreeze } from '../contracts/brandUniverseContract.js';
import { deriveBrandMindMetrics } from './deriveBrandMindMetrics.js';
import { deriveFiveAMetrics } from './deriveFiveAMetrics.js';
import { deriveGeoMetrics } from './deriveGeoMetrics.js';

export function deriveBusinessMetrics(snapshot) {
  return deepFreeze({
    geo: deriveGeoMetrics(snapshot),
    fiveA: deriveFiveAMetrics(snapshot),
    brandMind: deriveBrandMindMetrics(snapshot)
  });
}
