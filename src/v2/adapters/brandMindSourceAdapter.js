import { adaptBrandUniverseSource } from './brandUniverseAdapter.js';
import { SOURCE_ADAPTER_IDS, SOURCE_ADAPTER_TYPES } from './sourceAdapterContract.js';
import { buildAdapterMetadata, sourceModule } from './sourceAdapterUtils.js';

export function adaptBrandMindSource(payload) {
  const adapterId = SOURCE_ADAPTER_IDS[SOURCE_ADAPTER_TYPES.BRAND_MIND];
  return adaptBrandUniverseSource({
    metadata: buildAdapterMetadata(payload, adapterId),
    geo: null,
    fiveA: null,
    brandMind: sourceModule(payload, 'brandMind')
  });
}
