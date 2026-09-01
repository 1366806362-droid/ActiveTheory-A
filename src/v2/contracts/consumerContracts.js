import {
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS,
  GEO_SIGNAL_IDS,
  isDataPoint
} from './brandUniverseContract.js';

export const CONSUMER_CONTRACT_VERSION = 'V2_1_CANONICAL_ALIGNMENT_1';

export const CANONICAL_FIELD_LAYERS = Object.freeze({
  SOURCE: 'SOURCE_FIELD',
  CANONICAL: 'CANONICAL_BUSINESS_FIELD',
  DERIVED: 'DERIVED_BUSINESS_FIELD',
  PRESENTATION: 'PRESENTATION_FIELD'
});

export const CONSUMER_CONTRACTS = Object.freeze({
  geo: Object.freeze({
    sourceContract: 'GeoDashboardDataset schema 1.0.0 / current V1.6 runtime',
    sourceFields: Object.freeze(['overview', 'answer', 'citation', 'keyword', 'dataHealth']),
    canonicalFields: Object.freeze(GEO_SIGNAL_IDS.map((id) => `geo.${id}`)),
    derivedFields: Object.freeze(['availability', 'missingMetricIds']),
    presentationFields: Object.freeze(['labels', 'formatting', 'charts', 'diagnosticCopy'])
  }),
  fiveA: Object.freeze({
    sourceContract: 'FiveA Data Panel V1.1 frozen ViewModel input',
    sourceFields: Object.freeze(['stages', 'transitions', 'opportunityPool']),
    canonicalFields: Object.freeze([
      'fiveA.stages.A1..A5',
      'fiveA.transitions.A1_TO_A2..A4_TO_A5',
      'fiveA.opportunityPool'
    ]),
    derivedFields: Object.freeze(['bottleneck', 'dropOffRate', 'opportunityRatio']),
    presentationFields: Object.freeze(['labels', 'formattedValues', 'diagnosticCopy'])
  }),
  brandMind: Object.freeze({
    sourceContract: 'Brand Mind Data Panel V1.1 frozen ViewModel input',
    sourceFields: Object.freeze(['core', 'associations', 'relationships', 'history']),
    canonicalFields: Object.freeze([
      'brandMind.core',
      'brandMind.associations',
      'brandMind.relationships',
      'brandMind.history'
    ]),
    derivedFields: Object.freeze(['coreStatus', 'opportunitySignals', 'driftSummary']),
    presentationFields: Object.freeze(['labels', 'formattedValues', 'insightCopy'])
  })
});

export function validateConsumerCompatibility(snapshot, moduleId) {
  const errors = [];
  const module = snapshot?.[moduleId];
  if (!module) return result(false, [`${moduleId} canonical module is unavailable.`]);

  if (moduleId === 'geo') validateGeo(module, errors);
  else if (moduleId === 'fiveA') validateFiveA(module, errors);
  else if (moduleId === 'brandMind') validateBrandMind(module, errors);
  else errors.push(`Unknown consumer contract: ${String(moduleId)}.`);

  return result(errors.length === 0, errors);
}

function validateGeo(geo, errors) {
  for (const signalId of GEO_SIGNAL_IDS) {
    const signal = geo[signalId];
    if (!signal) errors.push(`geo.${signalId} is required.`);
    for (const metricId of ['volume', 'strength', 'quality', 'opportunity']) {
      if (!isDataPoint(signal?.[metricId])) errors.push(`geo.${signalId}.${metricId} is required.`);
    }
  }
}

function validateFiveA(fiveA, errors) {
  const stageIds = Object.keys(fiveA.stages ?? {});
  if (stageIds.join(',') !== Object.keys(FIVE_A_STAGES).join(',')) {
    errors.push('fiveA stages must be exactly A1 through A5.');
  }
  const transitionIds = Object.keys(fiveA.transitions ?? {});
  if (transitionIds.join(',') !== FIVE_A_TRANSITIONS.join(',')) {
    errors.push('fiveA transitions must be exactly the four adjacent paths.');
  }
  for (const stageId of Object.keys(FIVE_A_STAGES)) {
    for (const metricId of ['population', 'strength', 'confidence', 'changeVsLast']) {
      if (!isDataPoint(fiveA.stages?.[stageId]?.[metricId])) {
        errors.push(`fiveA.stages.${stageId}.${metricId} is required.`);
      }
    }
  }
  for (const transitionId of FIVE_A_TRANSITIONS) {
    for (const metricId of ['in', 'out', 'rate', 'strength', 'confidence', 'changeVsLast']) {
      if (!isDataPoint(fiveA.transitions?.[transitionId]?.[metricId])) {
        errors.push(`fiveA.transitions.${transitionId}.${metricId} is required.`);
      }
    }
  }
  if (!fiveA.opportunityPool || fiveA.opportunityPool.isStage === true) {
    errors.push('fiveA.opportunityPool must remain separate from A1-A5.');
  }
}

function validateBrandMind(brandMind, errors) {
  for (const metricId of ['strength', 'concentration', 'coverage', 'stability', 'confidence', 'changeVsLast']) {
    if (!isDataPoint(brandMind.core?.[metricId])) errors.push(`brandMind.core.${metricId} is required.`);
  }
  if (!Array.isArray(brandMind.associations)) errors.push('brandMind.associations must be an array.');
  if (!Array.isArray(brandMind.relationships)) errors.push('brandMind.relationships must be an array.');
  if (!brandMind.history || typeof brandMind.history !== 'object') {
    errors.push('brandMind.history must explicitly describe availability.');
  }
}

function result(ok, errors) {
  return Object.freeze({ ok, errors: Object.freeze(errors) });
}
