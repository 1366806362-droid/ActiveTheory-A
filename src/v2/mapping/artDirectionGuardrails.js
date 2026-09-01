import { clamp } from './normalizers.js';

export const ART_DIRECTION_GUARDRAILS = Object.freeze({
  visibility: Object.freeze({ min: 0.15, max: 1 }),
  density: Object.freeze({ min: 0.2, max: 1 }),
  energy: Object.freeze({ min: 0.15, max: 1 }),
  flow: Object.freeze({ min: 0.12, max: 1 }),
  emphasis: Object.freeze({ min: 0.15, max: 1 }),
  activity: Object.freeze({ min: 0.12, max: 1 }),
  stageScale: Object.freeze({ min: 0.75, max: 1.25 }),
  flowStrength: Object.freeze({ min: 0.1, max: 1 }),
  flowSpeed: Object.freeze({ min: 0.1, max: 1 }),
  highlightRate: Object.freeze({ min: 0.05, max: 0.85 }),
  nodeScale: Object.freeze({ min: 0.7, max: 1.3 }),
  brightness: Object.freeze({ min: 0.15, max: 1 }),
  concentration: Object.freeze({ min: 0.1, max: 1 }),
  relationshipStrength: Object.freeze({ min: 0.08, max: 1 })
});

export function applyVisualGuardrail(channel, normalizedValue) {
  const bounds = ART_DIRECTION_GUARDRAILS[channel];
  if (!bounds) throw new Error(`Unknown visual guardrail channel: ${channel}`);
  const normalized = clamp(normalizedValue, 0, 1);
  return bounds.min + normalized * (bounds.max - bounds.min);
}

export function isWithinGuardrail(channel, value, epsilon = 1e-9) {
  const bounds = ART_DIRECTION_GUARDRAILS[channel];
  return Boolean(
    bounds
    && Number.isFinite(value)
    && value >= bounds.min - epsilon
    && value <= bounds.max + epsilon
  );
}
