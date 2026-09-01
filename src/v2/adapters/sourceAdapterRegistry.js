import { validateSnapshot } from '../runtime/validateSnapshot.js';
import { adaptBrandMindSource } from './brandMindSourceAdapter.js';
import { adaptFiveASource } from './fiveASourceAdapter.js';
import { adaptGeoSource } from './geoSourceAdapter.js';
import { SOURCE_ADAPTER_TYPES } from './sourceAdapterContract.js';

const ADAPTERS = Object.freeze({
  [SOURCE_ADAPTER_TYPES.GEO]: adaptGeoSource,
  [SOURCE_ADAPTER_TYPES.FIVE_A]: adaptFiveASource,
  [SOURCE_ADAPTER_TYPES.BRAND_MIND]: adaptBrandMindSource
});

export function adaptSource({ type, payload } = {}) {
  const adapter = ADAPTERS[type];
  if (!adapter) {
    throw new Error(
      `Unknown source adapter type: ${String(type)}. `
      + `Expected one of ${Object.keys(ADAPTERS).join(', ')}.`
    );
  }

  const snapshot = adapter(payload);
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) {
    throw new Error(
      `Source adapter ${type} produced an invalid BrandUniverseSnapshot:\n- `
      + validation.errors.join('\n- ')
    );
  }
  return snapshot;
}

export function listSourceAdapterTypes() {
  return Object.freeze(Object.keys(ADAPTERS));
}
