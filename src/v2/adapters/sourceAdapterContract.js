export const SOURCE_ADAPTER_TYPES = Object.freeze({
  GEO: 'GEO_SOURCE',
  FIVE_A: 'FIVE_A_SOURCE',
  BRAND_MIND: 'BRAND_MIND_SOURCE'
});

export const SOURCE_ADAPTER_IDS = Object.freeze({
  [SOURCE_ADAPTER_TYPES.GEO]: 'active-theory-v2-geo-source-adapter',
  [SOURCE_ADAPTER_TYPES.FIVE_A]: 'active-theory-v2-fivea-source-adapter',
  [SOURCE_ADAPTER_TYPES.BRAND_MIND]: 'active-theory-v2-brand-mind-source-adapter'
});

export const SOURCE_ADAPTER_CONTRACT = Object.freeze({
  id: 'ActiveTheoryV2SourceAdapterContract',
  adapterTypes: Object.freeze(Object.values(SOURCE_ADAPTER_TYPES)),
  requiredEnvelopeFields: Object.freeze(['type', 'payload']),
  requiredMetadataFields: Object.freeze([
    'brandId',
    'sourceType',
    'sourceId',
    'capturedAt',
    'verificationStatus'
  ]),
  optionalMetadataFields: Object.freeze(['sourceFile']),
  output: 'BrandUniverseSnapshot'
});
