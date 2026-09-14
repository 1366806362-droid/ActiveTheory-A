// Candidate-only art. These values are not business data or binding ranges.
const OFFSETS = Object.freeze({
  A1: Object.freeze([-0.10, -0.52, 0]),
  A2: Object.freeze([0.05, -0.12, 0]),
  A3: Object.freeze([0.12, 0.30, 0]),
  A4: Object.freeze([0.40, 0.78, 0]),
  A5: Object.freeze([0.45, 1.05, 0])
});
export function resolveFiveACinematicArt(search = '') {
  const value = new URLSearchParams(search).get('fiveACinematic');
  if (!['A', 'B', '1'].includes(value)) return null;
  return Object.freeze({ name: value === '1' ? 'B' : value, offsets: value === 'A' ? null : OFFSETS,
    pointSize: 0.70, shellFraction: 0.36, middleFraction: 0.49, dustFraction: 0.15 });
}

// Four adjacent migration paths keep the original release/capture curve. In the
// settled scene, phase circulates through that curve instead of parking at t=1.
// Fixed art speed is deliberately independent of flowStrength / conversion.
export function cinematicFlowTravel(time, phase, ordinal) {
  return ((time * 0.055 + phase + ordinal * 0.003) % 1 + 1) % 1;
}
