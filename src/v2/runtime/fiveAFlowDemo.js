import { CANONICAL_FIVE_A_MOCK } from '../mock/canonicalFixtures.js';
import { deepFreeze } from '../contracts/brandUniverseContract.js';

export function createFiveAFlowDemoSnapshot(state = 'baseline') {
  const rates = { low: 0.1, baseline: 0.5, high: 0.9, partial: null };
  if (!Object.hasOwn(rates, state)) throw new Error(`Unknown FiveA flow state: ${state}`);
  const snapshot = structuredClone(CANONICAL_FIVE_A_MOCK);
  snapshot.metadata.snapshotId += `:a2-a3-cohort-${state}`;
  // Explicit synthetic tracked cohort: 1000 entrants, observed exits / entrants.
  // These are NOT ratios of A2 and A3 point-in-time stage populations.
  const point = (value, field) => ({ value, source: value === null ? null : `MOCK:a2-a3-cohort:${field}`,
    confidence: value === null ? null : 1, verificationStatus: value === null ? 'MISSING' : 'SYNTHETIC' });
  const transition = snapshot.fiveA.transitions.A2_TO_A3;
  transition.in = point(1000, 'entrants');
  transition.out = point(rates[state] === null ? null : 1000 * rates[state], 'observedExits');
  transition.volume = point(transition.out.value, 'observedExits');
  transition.rate = point(rates[state], 'observedExits/entrants');
  transition.strength = point(null, 'independentStrengthNotProvided');
  return deepFreeze(snapshot);
}

export function resolveFiveAFlowDemo(search, development) {
  const params = new URLSearchParams(search);
  const state = development ? params.get('v2FiveAFlowState') : null;
  if (!state) return null;
  const frame = params.get('v2FiveAFlowFrame');
  if (frame !== null && !['0', '1', '2'].includes(frame)) throw new Error('Invalid flow capture frame');
  return { state, snapshot: createFiveAFlowDemoSnapshot(state), capture: frame !== null,
    sampleTime: frame === null ? null : 12 + Number(frame) * 0.25 };
}
