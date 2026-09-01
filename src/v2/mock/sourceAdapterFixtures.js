import {
  SOURCE_TYPES,
  VERIFICATION_STATUSES
} from '../contracts/brandUniverseContract.js';

const CAPTURED_AT = '2026-09-01T10:30:00+08:00';

export const GEO_SOURCE_MOCK = Object.freeze({
  metadata: Object.freeze({
    brandId: 'mock-adapter-brand',
    sourceType: SOURCE_TYPES.MOCK,
    sourceId: 'geo-source-mock',
    sourceFile: 'geo-source-mock.json',
    capturedAt: CAPTURED_AT,
    verificationStatus: VERIFICATION_STATUSES.SYNTHETIC
  }),
  geo: Object.freeze({
    answer: Object.freeze({ volume: 48, strength: 64, quality: 71, opportunity: 58 }),
    citation: Object.freeze({ volume: 126, strength: 57, quality: 69, opportunity: 62 }),
    keyword: Object.freeze({ volume: 36, strength: 61, quality: 66, opportunity: 74 }),
    signalCore: Object.freeze({ volume: 210, strength: 63, quality: 70, opportunity: 68 })
  })
});

export const FIVE_A_SOURCE_MOCK = Object.freeze({
  metadata: Object.freeze({
    brandId: 'mock-adapter-brand',
    sourceType: SOURCE_TYPES.MOCK,
    sourceId: 'fivea-source-mock',
    sourceFile: 'fivea-source-mock.json',
    capturedAt: CAPTURED_AT,
    verificationStatus: VERIFICATION_STATUSES.SYNTHETIC
  }),
  fiveA: Object.freeze({
    stages: Object.freeze({
      A1: Object.freeze({ population: 7200, strength: 71, confidence: 0.92, changeVsLast: null }),
      A2: Object.freeze({ population: 6100, strength: 66, confidence: 0.9, changeVsLast: null }),
      A3: Object.freeze({ population: 3900, strength: 59, confidence: 0.86, changeVsLast: null }),
      A4: Object.freeze({ population: 2400, strength: 54, confidence: 0.82, changeVsLast: null }),
      A5: Object.freeze({ population: 1300, strength: 51, confidence: 0.78, changeVsLast: null })
    }),
    transitions: Object.freeze({
      A1_TO_A2: Object.freeze({ in: 7200, out: 6100, volume: 5300, rate: 0.74, strength: 0.74, confidence: 0.9, changeVsLast: null }),
      A2_TO_A3: Object.freeze({ in: 6100, out: 3900, volume: 3100, rate: 0.51, strength: 0.51, confidence: 0.86, changeVsLast: null }),
      A3_TO_A4: Object.freeze({ in: 3900, out: 2400, volume: 1900, rate: 0.49, strength: 0.49, confidence: 0.82, changeVsLast: null }),
      A4_TO_A5: Object.freeze({ in: 2400, out: 1300, volume: 900, rate: 0.38, strength: 0.38, confidence: 0.78, changeVsLast: null })
    }),
    opportunityPool: Object.freeze({ population: 3400, volume: 3400, strength: 67, confidence: 0.81, status: 'AVAILABLE' })
  })
});

export const BRAND_MIND_SOURCE_MOCK = Object.freeze({
  metadata: Object.freeze({
    brandId: 'mock-adapter-brand',
    sourceType: SOURCE_TYPES.MOCK,
    sourceId: 'brandmind-source-mock',
    sourceFile: 'brandmind-source-mock.json',
    capturedAt: CAPTURED_AT,
    verificationStatus: VERIFICATION_STATUSES.SYNTHETIC
  }),
  brandMind: Object.freeze({
    core: Object.freeze({ strength: 72, concentration: 63, coverage: 0.68, stability: 0.81, confidence: 0.88, changeVsLast: 0.01 }),
    associations: Object.freeze([
      Object.freeze({
        id: 'mock-association-a',
        label: 'Mock Association A',
        category: 'synthetic-functional',
        weight: 74,
        strength: 0.74,
        share: 0.55,
        volume: null,
        mentions: null,
        confidence: 0.87,
        changeVsLast: 0.05,
        status: 'CORE',
        source: 'brandmind-source-mock'
      }),
      Object.freeze({
        id: 'mock-association-b',
        label: 'Mock Association B',
        category: 'synthetic-emotional',
        weight: 61,
        strength: 0.61,
        share: 0.45,
        volume: null,
        mentions: null,
        confidence: 0.82,
        changeVsLast: -0.02,
        status: 'WEAKENING',
        source: 'brandmind-source-mock'
      })
    ]),
    relationships: Object.freeze([
      Object.freeze({
        id: 'brand-core--mock-association-a',
        sourceId: 'brand-core',
        targetId: 'mock-association-a',
        strength: 0.74,
        confidence: 0.87,
        changeVsLast: 0.05,
        corePath: true
      })
    ]),
    history: Object.freeze({
      available: true,
      source: 'brandmind-source-mock',
      verificationStatus: VERIFICATION_STATUSES.SYNTHETIC
    })
  })
});

export const SOURCE_ADAPTER_FIXTURES = Object.freeze({
  'geo-source-mock': GEO_SOURCE_MOCK,
  'fivea-source-mock': FIVE_A_SOURCE_MOCK,
  'brandmind-source-mock': BRAND_MIND_SOURCE_MOCK
});
