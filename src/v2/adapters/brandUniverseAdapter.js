import {
  BRAND_UNIVERSE_SCHEMA_VERSION,
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS,
  GEO_SIGNAL_IDS,
  SNAPSHOT_COMPLETENESS,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  createCategoricalDataPoint,
  createDataPoint,
  deepFreeze,
  isDataPoint
} from '../contracts/brandUniverseContract.js';

const GEO_METRICS = Object.freeze(['volume', 'strength', 'quality', 'opportunity']);
const FIVE_A_STAGE_METRICS = Object.freeze([
  'population', 'strength', 'confidence', 'changeVsLast'
]);
const FIVE_A_TRANSITION_METRICS = Object.freeze([
  'in', 'out', 'volume', 'rate', 'strength', 'confidence', 'changeVsLast'
]);
const BRAND_MIND_CORE_METRICS = Object.freeze([
  'strength', 'concentration', 'coverage', 'stability', 'confidence', 'changeVsLast'
]);

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
    defaultVerificationStatus: Object.values(VERIFICATION_STATUSES).includes(
      metadata.lineage?.verificationStatus
    )
      ? metadata.lineage.verificationStatus
      : (sourceType === SOURCE_TYPES.MOCK
        ? VERIFICATION_STATUSES.SYNTHETIC
        : VERIFICATION_STATUSES.UNVERIFIED)
  });

  const completeness = metadata.completeness
    ?? (sourceType === SOURCE_TYPES.PARTIAL
      ? SNAPSHOT_COMPLETENESS.PARTIAL
      : SNAPSHOT_COMPLETENESS.FULL);
  if (!Object.values(SNAPSHOT_COMPLETENESS).includes(completeness)) {
    throw new Error(`metadata.completeness must be FULL or PARTIAL; received ${String(completeness)}.`);
  }

  const lineage = metadata.lineage ?? {};
  const capturedAt = cleanString(metadata.capturedAt);

  const snapshot = {
    metadata: {
      brandId: cleanString(metadata.brandId),
      snapshotId: cleanString(metadata.snapshotId),
      capturedAt,
      schemaVersion: cleanString(metadata.schemaVersion) ?? BRAND_UNIVERSE_SCHEMA_VERSION,
      sourceType,
      completeness,
      lineage: {
        adapterId: cleanString(lineage.adapterId) ?? 'brand-universe-source-v2',
        sourceType,
        sourceId: cleanString(lineage.sourceId) ?? cleanString(metadata.snapshotId),
        sourceFile: cleanString(lineage.sourceFile),
        capturedAt: cleanString(lineage.capturedAt) ?? capturedAt,
        completeness,
        verificationStatus: cleanString(lineage.verificationStatus)
          ?? context.defaultVerificationStatus
      }
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
    opportunityPool: {
      isStage: false,
      ...adaptMetricGroup(
        rawFiveA?.opportunityPool,
        ['population', 'volume', 'strength', 'confidence'],
        context,
        'fiveA.opportunityPool'
      ),
      status: adaptCategoricalDataPoint(
        rawFiveA?.opportunityPool?.status,
        context,
        'fiveA.opportunityPool.status'
      )
    }
  };
}

function adaptBrandMind(rawBrandMind, context) {
  const associations = Array.isArray(rawBrandMind?.associations)
    ? rawBrandMind.associations
    : [];
  const relationships = Array.isArray(rawBrandMind?.relationships)
    ? rawBrandMind.relationships
    : [];
  const history = rawBrandMind?.history && typeof rawBrandMind.history === 'object'
    ? rawBrandMind.history
    : null;

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
      source: cleanString(association?.source),
      weight: adaptDataPoint(
        association?.weight,
        context,
        `brandMind.associations.${index}.weight`
      ),
      confidence: adaptDataPoint(
        association?.confidence,
        context,
        `brandMind.associations.${index}.confidence`
      ),
      strength: adaptDataPoint(association?.strength, context, `brandMind.associations.${index}.strength`),
      share: adaptDataPoint(association?.share, context, `brandMind.associations.${index}.share`),
      volume: adaptDataPoint(association?.volume, context, `brandMind.associations.${index}.volume`),
      mentions: adaptDataPoint(association?.mentions, context, `brandMind.associations.${index}.mentions`),
      changeVsLast: adaptDataPoint(
        association?.changeVsLast,
        context,
        `brandMind.associations.${index}.changeVsLast`
      ),
      status: cleanString(
        association?.status && typeof association.status === 'object'
          ? association.status.value
          : association?.status
      ),
      statusVerificationStatus: association?.status == null
        ? VERIFICATION_STATUSES.MISSING
        : context.defaultVerificationStatus
    })).sort((left, right) => String(left.id).localeCompare(String(right.id))),
    relationships: relationships.map((relationship, index) => ({
      id: cleanString(relationship?.id)
        ?? `${cleanString(relationship?.sourceId) ?? 'missing'}--${cleanString(relationship?.targetId) ?? index}`,
      sourceId: cleanString(relationship?.sourceId),
      targetId: cleanString(relationship?.targetId),
      strength: adaptDataPoint(relationship?.strength, context, `brandMind.relationships.${index}.strength`),
      confidence: adaptDataPoint(relationship?.confidence, context, `brandMind.relationships.${index}.confidence`),
      changeVsLast: adaptDataPoint(
        relationship?.changeVsLast,
        context,
        `brandMind.relationships.${index}.changeVsLast`
      ),
      corePath: relationship?.corePath === true
    })).sort((left, right) => String(left.id).localeCompare(String(right.id))),
    history: {
      available: history?.available === true,
      source: cleanString(history?.source),
      verificationStatus: Object.values(VERIFICATION_STATUSES).includes(history?.verificationStatus)
        ? history.verificationStatus
        : VERIFICATION_STATUSES.MISSING
    }
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

function adaptCategoricalDataPoint(rawValue, context, path) {
  if (rawValue && typeof rawValue === 'object' && Object.hasOwn(rawValue, 'value')) {
    return createCategoricalDataPoint(rawValue.value, {
      source: rawValue.source ?? context.defaultSource,
      confidence: rawValue.confidence,
      verificationStatus: rawValue.verificationStatus
    });
  }
  return createCategoricalDataPoint(rawValue, {
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
