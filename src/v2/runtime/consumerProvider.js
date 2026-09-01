import { validateConsumerCompatibility } from '../contracts/consumerContracts.js';
import { deepFreeze } from '../contracts/brandUniverseContract.js';
import { deriveBrandMindMetrics } from '../derived/deriveBrandMindMetrics.js';
import { deriveFiveAMetrics } from '../derived/deriveFiveAMetrics.js';
import { deriveGeoMetrics } from '../derived/deriveGeoMetrics.js';
import { buildVisualState } from '../mapping/buildVisualState.js';
import {
  CANONICAL_BRAND_MIND_MOCK,
  CANONICAL_FIVE_A_MOCK,
  CANONICAL_GEO_MOCK
} from '../mock/canonicalFixtures.js';
import { validateSnapshot } from './validateSnapshot.js';

export function createV2ConsumerProvider({
  geoSnapshot = CANONICAL_GEO_MOCK,
  fiveASnapshot = CANONICAL_FIVE_A_MOCK,
  brandMindSnapshot = CANONICAL_BRAND_MIND_MOCK
} = {}) {
  const consumers = deepFreeze({
    geo: createConsumer('geo', geoSnapshot, deriveGeoMetrics),
    fiveA: createConsumer('fiveA', fiveASnapshot, deriveFiveAMetrics),
    brandMind: createConsumer('brandMind', brandMindSnapshot, deriveBrandMindMetrics)
  });

  return Object.freeze({
    getGeo: () => consumers.geo,
    getFiveA: () => consumers.fiveA,
    getBrandMind: () => consumers.brandMind
  });
}

function createConsumer(moduleId, snapshot, derive) {
  const snapshotValidation = validateSnapshot(snapshot);
  if (!snapshotValidation.ok) {
    throw new Error(
      `Invalid ${moduleId} Canonical Snapshot:\n- ${snapshotValidation.errors.join('\n- ')}`
    );
  }
  const compatibility = validateConsumerCompatibility(snapshot, moduleId);
  if (!compatibility.ok) {
    throw new Error(
      `Canonical Snapshot is incompatible with ${moduleId} consumer:\n- `
      + compatibility.errors.join('\n- ')
    );
  }

  const derivedMetrics = derive(snapshot);
  return {
    moduleId,
    snapshot,
    derivedMetrics,
    buildVisualState: () => buildVisualState(snapshot)
  };
}
