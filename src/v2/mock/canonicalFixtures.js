import { adaptSource } from '../adapters/sourceAdapterRegistry.js';
import { SOURCE_ADAPTER_TYPES } from '../adapters/sourceAdapterContract.js';
import { deepFreeze } from '../contracts/brandUniverseContract.js';
import {
  BRAND_MIND_SOURCE_MOCK,
  FIVE_A_SOURCE_MOCK,
  GEO_SOURCE_MOCK
} from './sourceAdapterFixtures.js';

export const CANONICAL_GEO_MOCK = adaptSource({
  type: SOURCE_ADAPTER_TYPES.GEO,
  payload: GEO_SOURCE_MOCK
});

export const CANONICAL_FIVE_A_MOCK = adaptSource({
  type: SOURCE_ADAPTER_TYPES.FIVE_A,
  payload: FIVE_A_SOURCE_MOCK
});

export const CANONICAL_BRAND_MIND_MOCK = adaptSource({
  type: SOURCE_ADAPTER_TYPES.BRAND_MIND,
  payload: BRAND_MIND_SOURCE_MOCK
});

export const CANONICAL_CONSUMER_FIXTURES = deepFreeze({
  'canonical-geo-mock': CANONICAL_GEO_MOCK,
  'canonical-fivea-mock': CANONICAL_FIVE_A_MOCK,
  'canonical-brandmind-mock': CANONICAL_BRAND_MIND_MOCK
});
