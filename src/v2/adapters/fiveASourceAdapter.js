import {
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS
} from '../contracts/brandUniverseContract.js';
import { adaptBrandUniverseSource } from './brandUniverseAdapter.js';
import { SOURCE_ADAPTER_IDS, SOURCE_ADAPTER_TYPES } from './sourceAdapterContract.js';
import {
  assertKnownKeys,
  buildAdapterMetadata,
  sourceModule
} from './sourceAdapterUtils.js';

export function adaptFiveASource(payload) {
  const adapterId = SOURCE_ADAPTER_IDS[SOURCE_ADAPTER_TYPES.FIVE_A];
  const fiveA = sourceModule(payload, 'fiveA');
  assertKnownKeys(fiveA?.stages, Object.keys(FIVE_A_STAGES), 'payload.fiveA.stages');
  assertKnownKeys(fiveA?.transitions, FIVE_A_TRANSITIONS, 'payload.fiveA.transitions');

  return adaptBrandUniverseSource({
    metadata: buildAdapterMetadata(payload, adapterId),
    geo: null,
    fiveA,
    brandMind: null
  });
}
