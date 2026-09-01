import {
  BRAND_UNIVERSE_SCHEMA_VERSION,
  SNAPSHOT_COMPLETENESS,
  SOURCE_TYPES,
  VERIFICATION_STATUSES
} from '../contracts/brandUniverseContract.js';

export function buildAdapterMetadata(payload, adapterId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError(`${adapterId} payload must be an object.`);
  }
  const metadata = payload.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError(`${adapterId} payload.metadata must be an object.`);
  }

  const brandId = requireString(metadata.brandId, 'payload.metadata.brandId');
  const sourceType = requireEnum(
    metadata.sourceType,
    Object.values(SOURCE_TYPES),
    'payload.metadata.sourceType'
  );
  const sourceId = requireString(metadata.sourceId, 'payload.metadata.sourceId');
  const capturedAt = requireString(metadata.capturedAt, 'payload.metadata.capturedAt');
  if (Number.isNaN(Date.parse(capturedAt))) {
    throw new Error('payload.metadata.capturedAt must be an ISO-compatible date/time string.');
  }
  const verificationStatus = requireEnum(
    metadata.verificationStatus,
    Object.values(VERIFICATION_STATUSES),
    'payload.metadata.verificationStatus'
  );

  return {
    brandId,
    snapshotId: cleanString(metadata.snapshotId) ?? `${adapterId}:${sourceId}`,
    capturedAt,
    schemaVersion: BRAND_UNIVERSE_SCHEMA_VERSION,
    sourceType,
    completeness: SNAPSHOT_COMPLETENESS.PARTIAL,
    sourceName: adapterId,
    lineage: {
      adapterId,
      sourceType,
      sourceId,
      sourceFile: cleanString(metadata.sourceFile),
      capturedAt,
      completeness: SNAPSHOT_COMPLETENESS.PARTIAL,
      verificationStatus
    }
  };
}

export function sourceModule(payload, moduleId) {
  return payload[moduleId] && typeof payload[moduleId] === 'object'
    ? payload[moduleId]
    : payload;
}

export function assertKnownKeys(object, knownKeys, path) {
  if (object == null) return;
  if (typeof object !== 'object' || Array.isArray(object)) {
    throw new TypeError(`${path} must be an object.`);
  }
  const known = new Set(knownKeys);
  const unknown = Object.keys(object).filter((key) => !known.has(key));
  if (unknown.length) {
    throw new Error(`${path} contains unsupported id(s): ${unknown.join(', ')}.`);
  }
}

function requireString(value, path) {
  const cleaned = cleanString(value);
  if (!cleaned) throw new Error(`${path} is required.`);
  return cleaned;
}

function requireEnum(value, allowed, path) {
  if (!allowed.includes(value)) {
    throw new Error(`${path} must be one of ${allowed.join(', ')}; received ${String(value)}.`);
  }
  return value;
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
