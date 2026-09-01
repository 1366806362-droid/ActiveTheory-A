export const BRAND_UNIVERSE_SCHEMA_VERSION = '2.0.0-alpha.0';
export const BRAND_UNIVERSE_VISUAL_STATE_VERSION = '2.0.0-alpha.0';
export const VISUAL_MAPPING_VERSION = 'V2_0_DATA_VISUAL_MAPPING_1';

export const SOURCE_TYPES = Object.freeze({
  REAL: 'REAL',
  MOCK: 'MOCK',
  PARTIAL: 'PARTIAL'
});

export const SNAPSHOT_COMPLETENESS = Object.freeze({
  FULL: 'FULL',
  PARTIAL: 'PARTIAL'
});

export const VERIFICATION_STATUSES = Object.freeze({
  VERIFIED: 'VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
  ESTIMATED: 'ESTIMATED',
  SYNTHETIC: 'SYNTHETIC',
  MISSING: 'MISSING'
});

export const FIVE_A_STAGES = Object.freeze({
  A1: 'AWARE',
  A2: 'APPEAL',
  A3: 'ASK',
  A4: 'ACT',
  A5: 'ADVOCATE'
});

export const FIVE_A_TRANSITIONS = Object.freeze([
  'A1_TO_A2',
  'A2_TO_A3',
  'A3_TO_A4',
  'A4_TO_A5'
]);

export const GEO_SIGNAL_IDS = Object.freeze([
  'answer',
  'citation',
  'keyword',
  'signalCore'
]);

export function createDataPoint(
  value = null,
  {
    source = null,
    confidence = null,
    verificationStatus = null
  } = {}
) {
  const finiteValue = toFiniteOrNull(value);
  const finiteConfidence = toFiniteOrNull(confidence);
  const status = verificationStatus
    ?? (finiteValue === null
      ? VERIFICATION_STATUSES.MISSING
      : VERIFICATION_STATUSES.UNVERIFIED);

  return Object.freeze({
    value: finiteValue,
    source: typeof source === 'string' && source.trim() ? source.trim() : null,
    confidence: finiteConfidence,
    verificationStatus: status
  });
}

export function createCategoricalDataPoint(
  value = null,
  {
    source = null,
    confidence = null,
    verificationStatus = null
  } = {}
) {
  const cleanValue = typeof value === 'string' && value.trim() ? value.trim() : null;
  const finiteConfidence = toFiniteOrNull(confidence);
  const status = verificationStatus
    ?? (cleanValue === null
      ? VERIFICATION_STATUSES.MISSING
      : VERIFICATION_STATUSES.UNVERIFIED);

  return Object.freeze({
    value: cleanValue,
    source: typeof source === 'string' && source.trim() ? source.trim() : null,
    confidence: finiteConfidence,
    verificationStatus: status
  });
}

export function isDataPoint(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && Object.hasOwn(value, 'value')
    && Object.hasOwn(value, 'source')
    && Object.hasOwn(value, 'confidence')
    && Object.hasOwn(value, 'verificationStatus')
  );
}

export function toFiniteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
