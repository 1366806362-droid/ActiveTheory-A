import { SOURCE_TYPES } from '../contracts/brandUniverseContract.js';
import { adaptBrandUniverseSource } from '../adapters/brandUniverseAdapter.js';

const CAPTURED_AT = '2026-09-01T09:00:00+08:00';

export const MOCK_BALANCED = adaptBrandUniverseSource(createBalancedRaw());
export const MOCK_GEO_OPPORTUNITY = adaptBrandUniverseSource(createGeoOpportunityRaw());
export const MOCK_FIVE_A_BOTTLENECK = adaptBrandUniverseSource(createFiveABottleneckRaw());

export const BRAND_UNIVERSE_MOCKS = Object.freeze({
  'mock-balanced': MOCK_BALANCED,
  'mock-geo-opportunity': MOCK_GEO_OPPORTUNITY,
  'mock-fivea-bottleneck': MOCK_FIVE_A_BOTTLENECK
});

function createBalancedRaw() {
  return {
    metadata: {
      brandId: 'mock-brand',
      snapshotId: 'mock-balanced',
      capturedAt: CAPTURED_AT,
      sourceType: SOURCE_TYPES.MOCK,
      sourceName: 'ActiveTheory V2 synthetic balanced fixture'
    },
    geo: {
      answer: { volume: 5200, strength: 58, quality: 62, opportunity: 55 },
      citation: { volume: 3100, strength: 61, quality: 66, opportunity: 57 },
      keyword: { volume: 1800, strength: 54, quality: 59, opportunity: 60 },
      signalCore: { volume: 10100, strength: 60, quality: 63, opportunity: 58 }
    },
    fiveA: {
      stages: {
        A1: { population: 82000, strength: 68, confidence: 0.9 },
        A2: { population: 65000, strength: 63, confidence: 0.88 },
        A3: { population: 43000, strength: 58, confidence: 0.86 },
        A4: { population: 28000, strength: 54, confidence: 0.84 },
        A5: { population: 16000, strength: 51, confidence: 0.82 }
      },
      transitions: {
        A1_TO_A2: { volume: 53000, rate: 0.79, confidence: 0.88 },
        A2_TO_A3: { volume: 36000, rate: 0.66, confidence: 0.86 },
        A3_TO_A4: { volume: 24000, rate: 0.65, confidence: 0.84 },
        A4_TO_A5: { volume: 14000, rate: 0.57, confidence: 0.82 }
      },
      opportunityPool: { volume: 22000, strength: 58, confidence: 0.8 }
    },
    brandMind: {
      core: { strength: 64, concentration: 59, confidence: 0.87 },
      associations: [
        { id: 'association-clarity', label: 'Clarity', category: 'functional', weight: 68, confidence: 0.86 },
        { id: 'association-trust', label: 'Trust', category: 'emotional', weight: 74, confidence: 0.88 },
        { id: 'association-value', label: 'Value', category: 'market', weight: 57, confidence: 0.82 }
      ]
    }
  };
}

function createGeoOpportunityRaw() {
  const raw = clone(createBalancedRaw());
  raw.metadata.snapshotId = 'mock-geo-opportunity';
  raw.metadata.sourceName = 'ActiveTheory V2 synthetic GEO opportunity fixture';
  raw.geo.answer = { volume: 8400, strength: 76, quality: 72, opportunity: 82 };
  raw.geo.citation = { volume: 7900, strength: 88, quality: 84, opportunity: 91 };
  raw.geo.keyword = { volume: 6400, strength: 83, quality: 79, opportunity: 96 };
  raw.geo.signalCore = { volume: 22700, strength: 86, quality: 82, opportunity: 93 };
  return raw;
}

function createFiveABottleneckRaw() {
  const raw = clone(createBalancedRaw());
  raw.metadata.snapshotId = 'mock-fivea-bottleneck';
  raw.metadata.sourceName = 'ActiveTheory V2 synthetic 5A bottleneck fixture';
  raw.fiveA.stages = {
    A1: { population: 92000, strength: 78, confidence: 0.91 },
    A2: { population: 83000, strength: 74, confidence: 0.9 },
    A3: { population: 21000, strength: 39, confidence: 0.82 },
    A4: { population: 12000, strength: 35, confidence: 0.79 },
    A5: { population: 8000, strength: 32, confidence: 0.76 }
  };
  raw.fiveA.transitions = {
    A1_TO_A2: { volume: 76000, rate: 0.9, confidence: 0.9 },
    A2_TO_A3: { volume: 18000, rate: 0.26, confidence: 0.82 },
    A3_TO_A4: { volume: 10000, rate: 0.48, confidence: 0.79 },
    A4_TO_A5: { volume: 6500, rate: 0.54, confidence: 0.76 }
  };
  raw.fiveA.opportunityPool = { volume: 61000, strength: 84, confidence: 0.86 };
  return raw;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
