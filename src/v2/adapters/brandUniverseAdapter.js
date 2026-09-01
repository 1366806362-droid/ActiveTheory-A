import {
  BRAND_UNIVERSE_SCHEMA_VERSION,
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS,
  GEO_SIGNAL_IDS,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  createDataPoint,
  deepFreeze,
  isDataPoint
} from '../contracts/brandUniverseContract.js';

const GEO_METRICS = Object.freeze(['volume', 'strength', 'quality', 'opportunity']);
const FIVE_A_STAGE_METRICS = Object.freeze(['population', 'strength', 'confidence']);
const FIVE_A_TRANSITION_METRICS = Object.freeze(['volume', 'rate', 'confidence']);
const BRAND_MIND_CORE_METRICS = Object.freeze(['strength', 'concentration', 'confidence']);

export function adaptBrandUniverseSource(rawSource, { expectedSourceType = null } = {}) {
  if (!rawSource || typeof rawSource !== 'object' || Array.isArray(rawSource)) {
    throw new TypeError('Brand Universe source must be an object.');
  }

  const metadata = rawSource.metadata ?? {};
  const sourceType = metadata.sourceType;
  if (!Object.values(SOURCE_TYPES).includes(sourceType)) {
    throw new Error(`metadata.sourceType must be REAL, MOCK, or PARTIAL; received ${String(sourceType)}.`);
  }
  if (expectedSourceType && expectedSourceType !== sourceType) {
    throw new Error(
      `Source type mismatch: expected ${expectedSourceType}, received ${sourceType}. `
      + 'REAL/MOCK/PARTIAL status cannot be silently converted.'
    );
  }

  const context = Object.freeze({
    sourceType,
    defaultSource: cleanString(metadata.sourceName) ?? `snapshot:${cleanString(metadata.snapshotId) ?? 'unknown'}`,
    defaultConfidence: sourceType === SOURCE_TYPES.MOCK ? 1 : null,
    defaultVerificationStatus: sourceType === SOURCE_TYPES.MOCK
      ? VERIFICATION_STATUSES.SYNTHETIC
      : VERIFICATION_STATUSES.UNVERIFIED
  });

  const snapshot = {
    metadata: {
      brandId: cleanString(metadata.brandId),
      snapshotId: cleanString(metadata.snapshotId),
      capturedAt: cleanString(metadata.capturedAt),
      schemaVersion: cleanString(metadata.schemaVersion) ?? BRAND_UNIVERSE_SCHEMA_VERSION,
      sourceType
    },
    geo: rawSource.geo == null ? null : adaptGeo(rawSource.geo, context),
    fiveA: rawSource.fiveA == null ? null : adaptFiveA(rawSource.fiveA, context),
    brandMind: rawSource.brandMind == null
      ? null
      : adaptBrandMind(rawSource.brandMind, context)
  };

  return deepFreeze(snapshot);
}

function adaptGeo(rawGeo, context) {
  return Object.fromEntries(GEO_SIGNAL_IDS.map((signalId) => [
    signalId,
    adaptMetricGroup(rawGeo?.[signalId], GEO_METRICS, context, `geo.${signalId}`)
  ]));
}

function adaptFiveA(rawFiveA, context) {
  const rawStages = rawFiveA?.stages ?? {};
  const rawTransitions = rawFiveA?.transitions ?? {};
  return {
    stages: Object.fromEntries(Object.entries(FIVE_A_STAGES).map(([stageId, semantic]) => [
      stageId,
      {
        id: stageId,
        semantic,
        ...adaptMetricGroup(
          rawStages[stageId],
          FIVE_A_STAGE_METRICS,
          context,
          `fiveA.stages.${stageId}`
        )
      }
    ])),
    transitions: Object.fromEntries(FIVE_A_TRANSITIONS.map((transitionId) => [
      transitionId,
      {
        id: transitionId,
        ...adaptMetricGroup(
          rawTransitions[transitionId],
          FIVE_A_TRANSITION_METRICS,
          context,
          `fiveA.transitions.${transitionId}`
        )
      }
    ])),
    opportunityPool: adaptMetricGroup(
      rawFiveA?.opportunityPool,
      ['volume', 'strength', 'confidence'],
      context,
      'fiveA.opportunityPool'
    )
  };
}

function adaptBrandMind(rawBrandMind, context) {
  const associations = Array.isArray(rawBrandMind?.associations)
    ? rawBrandMind.associations
    : [];
  return {
    core: adaptMetricGroup(
      rawBrandMind?.core,
      BRAND_MIND_CORE_METRICS,
      context,
      'brandMind.core'
    ),
    associations: associations.map((association, index) => ({
      id: cleanString(association?.id),
      label: cleanString(association?.label),
      category: cleanString(association?.category),
      weight: adaptDataPoint(
        association?.weight,
        context,
        `brandMind.associations.${index}.weight`
      ),
      confidence: adaptDataPoint(
        association?.confidence,
        context,
        `brandMind.associations.${index}.confidence`
      )
    })).sort((left, right) => String(left.id).localeCompare(String(right.id)))
  };
}

function adaptMetricGroup(rawGroup, metricIds, context, path) {
  return Object.fromEntries(metricIds.map((metricId) => [
    metricId,
    adaptDataPoint(rawGroup?.[metricId], context, `${path}.${metricId}`)
  ]));
}

function adaptDataPoint(rawValue, context, path) {
  if (isDataPoint(rawValue) || isDataPointLike(rawValue)) {
    return createDataPoint(rawValue.value, {
      source: rawValue.source ?? context.defaultSource,
      confidence: rawValue.confidence,
      verificationStatus: rawValue.verificationStatus
    });
  }
  return createDataPoint(rawValue, {
    source: rawValue == null ? null : `${context.defaultSource}:${path}`,
    confidence: rawValue == null ? null : context.defaultConfidence,
    verificationStatus: rawValue == null
      ? VERIFICATION_STATUSES.MISSING
      : context.defaultVerificationStatus
  });
}

function isDataPointLike(value) {
  return Boolean(value && typeof value === 'object' && Object.hasOwn(value, 'value'));
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
