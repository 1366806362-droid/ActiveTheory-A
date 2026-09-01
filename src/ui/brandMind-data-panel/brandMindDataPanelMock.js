import {
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  createDataPoint,
  deepFreeze
} from '../../v2/contracts/brandUniverseContract.js';
import { MOCK_BALANCED } from '../../v2/mock/brandUniverseMocks.js';

const SOURCE = 'ActiveTheory V2 synthetic Brand Mind panel fixture';

// Deprecated V1.1 presentation fixture. Runtime and unified-consumer tests use
// CANONICAL_BRAND_MIND_MOCK from src/v2/mock/canonicalFixtures.js.

const associationDefinitions = [
  ['association-scale', '量大', '产品利益', 86, 0.182, 0.92, 0.052, 'CORE'],
  ['association-value', '实惠', '价格心智', 78, 0.154, 0.89, 0.021, 'CORE'],
  ['association-night', '夜宵', '场景心智', 63, 0.108, 0.84, 0.084, 'GROWING'],
  ['association-convenience', '方便', '产品利益', 58, 0.096, 0.83, 0.016, 'STABLE'],
  ['association-reliable', '品质可靠', '品牌认知', 55, 0.087, 0.81, -0.005, 'STABLE'],
  ['association-local', '国货品牌', '品牌认知', 45, 0.063, 0.78, -0.012, 'WEAKENING']
];

const associations = associationDefinitions.map(([
  id,
  label,
  category,
  strength,
  share,
  confidence,
  changeVsLast,
  status
]) => ({
  id,
  label,
  category,
  weight: mockPoint(strength, confidence),
  confidence: mockPoint(confidence, confidence),
  strength: mockPoint(strength / 100, confidence),
  share: mockPoint(share, confidence),
  mentions: mockPoint(null, null),
  changeVsLast: mockPoint(changeVsLast, confidence),
  status
}));

const relationships = [
  relationship('brand-core', 'association-scale', 0.86, 0.92, 0.052, true),
  relationship('brand-core', 'association-value', 0.78, 0.89, 0.021, true),
  relationship('brand-core', 'association-night', 0.63, 0.84, 0.084, false),
  relationship('association-scale', 'association-value', 0.41, 0.76, 0.013, false),
  relationship('association-night', 'association-convenience', 0.38, 0.74, 0.026, false)
];

export const MOCK_BRAND_MIND_PANEL = deepFreeze({
  ...MOCK_BALANCED,
  metadata: {
    ...MOCK_BALANCED.metadata,
    snapshotId: 'mock-brand-mind-panel-v1',
    capturedAt: '2026-09-01T09:00:00+08:00',
    sourceType: SOURCE_TYPES.MOCK
  },
  brandMind: {
    core: {
      strength: mockPoint(72, 0.91),
      concentration: mockPoint(48, 0.88),
      confidence: mockPoint(0.87, 0.87),
      coverage: mockPoint(0.683, 0.86),
      stability: mockPoint(0.81, 0.85),
      changeVsLast: mockPoint(0.047, 0.82)
    },
    associations,
    relationships,
    history: {
      verificationStatus: VERIFICATION_STATUSES.SYNTHETIC,
      source: SOURCE,
      available: true
    }
  }
});

function relationship(sourceId, targetId, strength, confidence, changeVsLast, corePath) {
  return {
    id: `${sourceId}--${targetId}`,
    sourceId,
    targetId,
    strength: mockPoint(strength, confidence),
    confidence: mockPoint(confidence, confidence),
    changeVsLast: mockPoint(changeVsLast, confidence),
    corePath
  };
}

function mockPoint(value, confidence) {
  return createDataPoint(value, {
    source: SOURCE,
    confidence,
    verificationStatus: value === null
      ? VERIFICATION_STATUSES.MISSING
      : VERIFICATION_STATUSES.SYNTHETIC
  });
}
