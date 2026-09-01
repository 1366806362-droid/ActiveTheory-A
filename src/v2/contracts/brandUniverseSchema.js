import {
  BRAND_UNIVERSE_SCHEMA_VERSION,
  BRAND_UNIVERSE_VISUAL_STATE_VERSION,
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS,
  GEO_SIGNAL_IDS,
  SNAPSHOT_COMPLETENESS,
  SOURCE_TYPES,
  VERIFICATION_STATUSES
} from './brandUniverseContract.js';

export const BRAND_UNIVERSE_SNAPSHOT_SCHEMA = Object.freeze({
  id: 'BrandUniverseSnapshot',
  schemaVersion: BRAND_UNIVERSE_SCHEMA_VERSION,
  required: Object.freeze(['metadata', 'geo', 'fiveA', 'brandMind']),
  metadata: Object.freeze({
    required: Object.freeze([
      'brandId',
      'snapshotId',
      'capturedAt',
      'schemaVersion',
      'sourceType',
      'completeness',
      'lineage'
    ]),
    sourceTypes: Object.freeze(Object.values(SOURCE_TYPES)),
    completeness: Object.freeze(Object.values(SNAPSHOT_COMPLETENESS)),
    lineageRequired: Object.freeze([
      'adapterId',
      'sourceType',
      'sourceId',
      'sourceFile',
      'capturedAt',
      'completeness',
      'verificationStatus'
    ])
  }),
  dataPoint: Object.freeze({
    required: Object.freeze(['value', 'source', 'confidence', 'verificationStatus']),
    verificationStatuses: Object.freeze(Object.values(VERIFICATION_STATUSES))
  }),
  geoSignals: GEO_SIGNAL_IDS,
  fiveAStages: Object.freeze(Object.keys(FIVE_A_STAGES)),
  fiveATransitions: FIVE_A_TRANSITIONS,
  brandMind: Object.freeze({
    required: Object.freeze(['core', 'associations', 'relationships', 'history'])
  })
});

export const BRAND_UNIVERSE_VISUAL_STATE_SCHEMA = Object.freeze({
  id: 'BrandUniverseVisualState',
  schemaVersion: BRAND_UNIVERSE_VISUAL_STATE_VERSION,
  required: Object.freeze([
    'metadata',
    'availability',
    'home',
    'geo',
    'fiveA',
    'brandMind',
    'diagnostics'
  ]),
  forbiddenCompositionKeys: Object.freeze([
    'camera',
    'position',
    'route',
    'handoff',
    'composition'
  ])
});
