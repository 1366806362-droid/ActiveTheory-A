import { toFiniteOrNull } from '../contracts/brandUniverseContract.js';

export const NORMALIZATION_STRATEGIES = Object.freeze({
  LINEAR: 'linear',
  LOG: 'log',
  BOUNDED: 'bounded',
  CLAMP: 'clamp'
});

export function clamp(value, min = 0, max = 1) {
  const finite = toFiniteOrNull(value);
  if (finite === null) return min;
  if (max < min) return clamp(finite, max, min);
  return Math.min(Math.max(finite, min), max);
}

export function normalizeLinear(value, { min = 0, max = 1, fallback = 0 } = {}) {
  const finite = toFiniteOrNull(value);
  if (finite === null || max <= min) return safeFallback(fallback);
  return clamp((finite - min) / (max - min), 0, 1);
}

export function normalizeLog(value, { min = 0, max = 1, fallback = 0 } = {}) {
  const finite = toFiniteOrNull(value);
  if (finite === null || max <= min) return safeFallback(fallback);
  const bounded = clamp(finite, min, max) - min;
  const span = max - min;
  return clamp(Math.log1p(bounded) / Math.log1p(span), 0, 1);
}

export function normalizeBounded(value, { min = 0, max = 1, fallback = 0 } = {}) {
  const linear = normalizeLinear(value, { min, max, fallback });
  return clamp(linear * linear * (3 - 2 * linear), 0, 1);
}

export function normalizeClamped(value, { min = 0, max = 1, fallback = 0 } = {}) {
  const finite = toFiniteOrNull(value);
  if (finite === null) return safeFallback(fallback);
  return normalizeLinear(clamp(finite, min, max), { min, max, fallback });
}

export function normalizeDataPoint(dataPoint, profile = {}) {
  const value = dataPoint?.value;
  switch (profile.strategy ?? NORMALIZATION_STRATEGIES.LINEAR) {
    case NORMALIZATION_STRATEGIES.LOG:
      return normalizeLog(value, profile);
    case NORMALIZATION_STRATEGIES.BOUNDED:
      return normalizeBounded(value, profile);
    case NORMALIZATION_STRATEGIES.CLAMP:
      return normalizeClamped(value, profile);
    case NORMALIZATION_STRATEGIES.LINEAR:
    default:
      return normalizeLinear(value, profile);
  }
}

export function normalizeConfidence(dataPoint) {
  return normalizeClamped(dataPoint?.confidence, { min: 0, max: 1, fallback: 0 });
}

export function meanNormalized(values, fallback = 0) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return safeFallback(fallback);
  return clamp(finite.reduce((sum, value) => sum + value, 0) / finite.length, 0, 1);
}

function safeFallback(value) {
  const finite = toFiniteOrNull(value);
  return clamp(finite ?? 0, 0, 1);
}
