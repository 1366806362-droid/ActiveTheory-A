import {
  BRAND_UNIVERSE_SCHEMA_VERSION,
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS,
  GEO_SIGNAL_IDS,
  SNAPSHOT_COMPLETENESS,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  isDataPoint
} from '../contracts/brandUniverseContract.js';

const GEO_METRICS = Object.freeze(['volume', 'strength', 'quality', 'opportunity']);
const STAGE_METRICS = Object.freeze(['population', 'strength', 'confidence', 'changeVsLast']);
const TRANSITION_METRICS = Object.freeze([
  'in', 'out', 'volume', 'rate', 'strength', 'confidence', 'changeVsLast'
]);
const OPPORTUNITY_METRICS = Object.freeze(['population', 'volume', 'strength', 'confidence']);

export function validateSnapshot(snapshot) {
  const errors = [];
  const warnings = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return result(false, ['Snapshot must be an object.'], warnings);
  }

  for (const key of ['metadata', 'geo', 'fiveA', 'brandMind']) {
    if (!Object.hasOwn(snapshot, key)) errors.push(`Missing required root field: ${key}.`);
  }

  const metadata = snapshot.metadata;
  if (!metadata || typeof metadata !== 'object') {
    errors.push('metadata must be an object.');
    return result(false, errors, warnings);
  }
  requireString(metadata.brandId, 'metadata.brandId', errors);
  requireString(metadata.snapshotId, 'metadata.snapshotId', errors);
  requireString(metadata.capturedAt, 'metadata.capturedAt', errors);
  if (typeof metadata.capturedAt === 'string' && Number.isNaN(Date.parse(metadata.capturedAt))) {
    errors.push('metadata.capturedAt must be an ISO-compatible date/time string.');
  }
  if (metadata.schemaVersion !== BRAND_UNIVERSE_SCHEMA_VERSION) {
    errors.push(
      `metadata.schemaVersion must be ${BRAND_UNIVERSE_SCHEMA_VERSION}; `
      + `received ${String(metadata.schemaVersion)}.`
    );
  }
  if (!Object.values(SOURCE_TYPES).includes(metadata.sourceType)) {
    errors.push('metadata.sourceType must be REAL, MOCK, or PARTIAL.');
  }

  if (!Object.values(SNAPSHOT_COMPLETENESS).includes(metadata.completeness)) {
    errors.push('metadata.completeness must be FULL or PARTIAL.');
  }
  validateLineage(metadata.lineage, metadata, errors);

  validateModulePresence(snapshot, metadata, errors, warnings);
  if (snapshot.geo) validateGeo(snapshot.geo, errors, warnings);
  if (snapshot.fiveA) validateFiveA(snapshot.fiveA, errors, warnings);
  if (snapshot.brandMind) validateBrandMind(snapshot.brandMind, errors, warnings);

  return result(errors.length === 0, errors, warnings);
}

function validateModulePresence(snapshot, metadata, errors, warnings) {
  for (const moduleId of ['geo', 'fiveA', 'brandMind']) {
    if (snapshot[moduleId] !== null && snapshot[moduleId] !== undefined) continue;
    const message = `${moduleId} module is missing.`;
    if (
      metadata.sourceType === SOURCE_TYPES.PARTIAL
      || metadata.completeness === SNAPSHOT_COMPLETENESS.PARTIAL
    ) warnings.push(message);
    else errors.push(`${message} ${metadata.sourceType} snapshots must provide all canonical modules.`);
  }
}

function validateLineage(lineage, metadata, errors) {
  if (!lineage || typeof lineage !== 'object' || Array.isArray(lineage)) {
    errors.push('metadata.lineage must be an object.');
    return;
  }
  requireString(lineage.adapterId, 'metadata.lineage.adapterId', errors);
  requireString(lineage.sourceType, 'metadata.lineage.sourceType', errors);
  requireString(lineage.sourceId, 'metadata.lineage.sourceId', errors);
  requireString(lineage.capturedAt, 'metadata.lineage.capturedAt', errors);
  if (lineage.sourceFile !== null && typeof lineage.sourceFile !== 'string') {
    errors.push('metadata.lineage.sourceFile must be a string or null.');
  }
  if (!Object.values(VERIFICATION_STATUSES).includes(lineage.verificationStatus)) {
    errors.push('metadata.lineage.verificationStatus is not supported.');
  }
  if (lineage.sourceType !== metadata.sourceType) {
    errors.push('metadata.lineage.sourceType must preserve metadata.sourceType.');
  }
  if (lineage.completeness !== metadata.completeness) {
    errors.push('metadata.lineage.completeness must preserve metadata.completeness.');
  }
}

function validateGeo(geo, errors, warnings) {
  for (const signalId of GEO_SIGNAL_IDS) {
    const signal = geo[signalId];
    if (!signal || typeof signal !== 'object') {
      errors.push(`geo.${signalId} must be an object.`);
      continue;
    }
    for (const metricId of GEO_METRICS) {
      validateDataPoint(signal[metricId], `geo.${signalId}.${metricId}`, errors, warnings);
    }
  }
  rejectUnknownKeys(geo, GEO_SIGNAL_IDS, 'geo', errors);
}

function validateFiveA(fiveA, errors, warnings) {
  if (!fiveA.stages || typeof fiveA.stages !== 'object') {
    errors.push('fiveA.stages must be an object.');
  } else {
    for (const [stageId, semantic] of Object.entries(FIVE_A_STAGES)) {
      const stage = fiveA.stages[stageId];
      if (!stage || typeof stage !== 'object') {
        errors.push(`fiveA.stages.${stageId} is required.`);
        continue;
      }
      if (stage.id !== stageId) errors.push(`fiveA.stages.${stageId}.id must equal ${stageId}.`);
      if (stage.semantic !== semantic) {
        errors.push(`fiveA.stages.${stageId}.semantic must equal ${semantic}.`);
      }
      for (const metricId of STAGE_METRICS) {
        validateDataPoint(
          stage[metricId],
          `fiveA.stages.${stageId}.${metricId}`,
          errors,
          warnings
        );
      }
    }
    rejectUnknownKeys(fiveA.stages, Object.keys(FIVE_A_STAGES), 'fiveA.stages', errors);
  }

  if (!fiveA.transitions || typeof fiveA.transitions !== 'object') {
    errors.push('fiveA.transitions must be an object.');
  } else {
    for (const transitionId of FIVE_A_TRANSITIONS) {
      const transition = fiveA.transitions[transitionId];
      if (!transition || typeof transition !== 'object') {
        errors.push(`fiveA.transitions.${transitionId} is required.`);
        continue;
      }
      if (transition.id !== transitionId) {
        errors.push(`fiveA.transitions.${transitionId}.id must equal ${transitionId}.`);
      }
      for (const metricId of TRANSITION_METRICS) {
        validateDataPoint(
          transition[metricId],
          `fiveA.transitions.${transitionId}.${metricId}`,
          errors,
          warnings
        );
      }
    }
    rejectUnknownKeys(fiveA.transitions, FIVE_A_TRANSITIONS, 'fiveA.transitions', errors);
  }

  if (!fiveA.opportunityPool || typeof fiveA.opportunityPool !== 'object') {
    errors.push('fiveA.opportunityPool must be an object and is not a sixth stage.');
  } else {
    for (const metricId of OPPORTUNITY_METRICS) {
      validateDataPoint(
        fiveA.opportunityPool[metricId],
        `fiveA.opportunityPool.${metricId}`,
        errors,
        warnings
      );
    }
    validateCategoricalDataPoint(
      fiveA.opportunityPool.status,
      'fiveA.opportunityPool.status',
      errors,
      warnings
    );
    if (fiveA.opportunityPool.isStage !== false) {
      errors.push('fiveA.opportunityPool.isStage must be false.');
    }
  }
}

function validateBrandMind(brandMind, errors, warnings) {
  if (!brandMind.core || typeof brandMind.core !== 'object') {
    errors.push('brandMind.core must be an object.');
  } else {
    for (const metricId of [
      'strength', 'concentration', 'coverage', 'stability', 'confidence', 'changeVsLast'
    ]) {
      validateDataPoint(
        brandMind.core[metricId],
        `brandMind.core.${metricId}`,
        errors,
        warnings
      );
    }
  }
  if (!Array.isArray(brandMind.associations)) {
    errors.push('brandMind.associations must be an array.');
    return;
  }

  const ids = new Set();
  brandMind.associations.forEach((association, index) => {
    const path = `brandMind.associations[${index}]`;
    if (!association || typeof association !== 'object') {
      errors.push(`${path} must be an object.`);
      return;
    }
    requireString(association.id, `${path}.id`, errors);
    requireString(association.label, `${path}.label`, errors);
    requireString(association.category, `${path}.category`, errors);
    if (association.source !== null && typeof association.source !== 'string') {
      errors.push(`${path}.source must be a string or null.`);
    }
    if (association.id && ids.has(association.id)) {
      errors.push(`${path}.id duplicates association id ${association.id}.`);
    }
    ids.add(association.id);
    validateDataPoint(association.weight, `${path}.weight`, errors, warnings);
    validateDataPoint(association.confidence, `${path}.confidence`, errors, warnings);
    for (const metricId of ['strength', 'share', 'volume', 'mentions', 'changeVsLast']) {
      validateDataPoint(association[metricId], `${path}.${metricId}`, errors, warnings);
    }
    if (association.status !== null && typeof association.status !== 'string') {
      errors.push(`${path}.status must be a string or null.`);
    }
    if (!Object.values(VERIFICATION_STATUSES).includes(association.statusVerificationStatus)) {
      errors.push(`${path}.statusVerificationStatus is not supported.`);
    }
  });

  if (!Array.isArray(brandMind.relationships)) {
    errors.push('brandMind.relationships must be an array.');
  } else {
    brandMind.relationships.forEach((relationship, index) => {
      const path = `brandMind.relationships[${index}]`;
      requireString(relationship?.id, `${path}.id`, errors);
      requireString(relationship?.sourceId, `${path}.sourceId`, errors);
      requireString(relationship?.targetId, `${path}.targetId`, errors);
      for (const metricId of ['strength', 'confidence', 'changeVsLast']) {
        validateDataPoint(relationship?.[metricId], `${path}.${metricId}`, errors, warnings);
      }
      if (typeof relationship?.corePath !== 'boolean') {
        errors.push(`${path}.corePath must be boolean.`);
      }
    });
  }
  if (!brandMind.history || typeof brandMind.history !== 'object') {
    errors.push('brandMind.history must be an object.');
  } else {
    if (typeof brandMind.history.available !== 'boolean') {
      errors.push('brandMind.history.available must be boolean.');
    }
    if (brandMind.history.source !== null && typeof brandMind.history.source !== 'string') {
      errors.push('brandMind.history.source must be a string or null.');
    }
    if (!Object.values(VERIFICATION_STATUSES).includes(brandMind.history.verificationStatus)) {
      errors.push('brandMind.history.verificationStatus is not supported.');
    }
  }
}

function validateDataPoint(dataPoint, path, errors, warnings) {
  if (!isDataPoint(dataPoint)) {
    errors.push(`${path} must be a canonical data point.`);
    return;
  }
  if (dataPoint.value !== null && !Number.isFinite(dataPoint.value)) {
    errors.push(`${path}.value must be finite or null.`);
  }
  if (Number.isFinite(dataPoint.value) && dataPoint.value < 0) {
    warnings.push(`${path}.value is negative and will be safely clamped by normalization.`);
  }
  if (dataPoint.confidence !== null && (
    !Number.isFinite(dataPoint.confidence)
    || dataPoint.confidence < 0
    || dataPoint.confidence > 1
  )) {
    errors.push(`${path}.confidence must be within 0..1 or null.`);
  }
  if (!Object.values(VERIFICATION_STATUSES).includes(dataPoint.verificationStatus)) {
    errors.push(`${path}.verificationStatus is not supported.`);
  }
  if (dataPoint.value === null && dataPoint.verificationStatus !== VERIFICATION_STATUSES.MISSING) {
    warnings.push(`${path} has no value but is not marked MISSING.`);
  }
}

function validateCategoricalDataPoint(dataPoint, path, errors, warnings) {
  if (!isDataPoint(dataPoint)) {
    errors.push(`${path} must be a canonical data point.`);
    return;
  }
  if (dataPoint.value !== null && typeof dataPoint.value !== 'string') {
    errors.push(`${path}.value must be a string or null.`);
  }
  if (dataPoint.confidence !== null && (
    !Number.isFinite(dataPoint.confidence)
    || dataPoint.confidence < 0
    || dataPoint.confidence > 1
  )) errors.push(`${path}.confidence must be within 0..1 or null.`);
  if (!Object.values(VERIFICATION_STATUSES).includes(dataPoint.verificationStatus)) {
    errors.push(`${path}.verificationStatus is not supported.`);
  }
  if (dataPoint.value === null && dataPoint.verificationStatus !== VERIFICATION_STATUSES.MISSING) {
    warnings.push(`${path} has no value but is not marked MISSING.`);
  }
}

function rejectUnknownKeys(object, expectedKeys, path, errors) {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(object)) {
    if (!expected.has(key)) errors.push(`${path}.${key} is not a supported canonical id.`);
  }
}

function requireString(value, path, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${path} is required.`);
}

function result(ok, errors, warnings) {
  return Object.freeze({ ok, errors: Object.freeze(errors), warnings: Object.freeze(warnings) });
}
