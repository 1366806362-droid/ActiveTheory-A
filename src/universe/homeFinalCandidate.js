// One opt-in HOME milestone. Existing modes and frozen scene internals stay unchanged.
export function readHomeFinalCandidate(search = typeof window === 'undefined' ? '' : window.location.search) {
  const p = new URLSearchParams(search);
  const enabled = p.get('homeFinalV1') === '1' && p.get('galaxyV3') === '1'
    && p.get('galaxyHero') === 'repaired_m3' && p.get('homeArt') === 'final';
  const pick = (key, fallback) => !enabled || p.get(key) === '0' ? null
    : ['A', 'B', 'C'].includes(p.get(key)) ? p.get(key) : fallback;
  return Object.freeze({ enabled, journey: pick('homeJourney', 'B'), earth: pick('earthFinal', 'B') });
}
