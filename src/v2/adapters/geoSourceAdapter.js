import { adaptBrandUniverseSource } from './brandUniverseAdapter.js';
import { SOURCE_ADAPTER_IDS, SOURCE_ADAPTER_TYPES } from './sourceAdapterContract.js';
import { buildAdapterMetadata, sourceModule } from './sourceAdapterUtils.js';

export function adaptGeoSource(payload) {
  const adapterId = SOURCE_ADAPTER_IDS[SOURCE_ADAPTER_TYPES.GEO];
  return adaptBrandUniverseSource({
    metadata: buildAdapterMetadata(payload, adapterId),
    geo: sourceModule(payload, 'geo'),
    fiveA: null,
    brandMind: null
  });
}
