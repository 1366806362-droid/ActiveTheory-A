import { CANONICAL_FIVE_A_MOCK } from '../mock/canonicalFixtures.js';
import { deepFreeze } from '../contracts/brandUniverseContract.js';

export function createFiveAA3DemoSnapshot(state = 'baseline') {
  if (!['low', 'baseline', 'high', 'partial'].includes(state)) throw new Error(`Unknown A3 demo state: ${state}`);
  const snapshot = structuredClone(CANONICAL_FIVE_A_MOCK);
  snapshot.metadata.snapshotId += `:a3-${state}`;
  const stage = snapshot.fiveA.stages.A3;
  if (state === 'low' || state === 'high') {
    stage.population.value = state === 'low' ? 10 : 100000;
    stage.strength.value = state === 'low' ? 25 : 85;
  }
  if (state === 'partial') {
    snapshot.metadata.sourceType = 'PARTIAL';
    snapshot.metadata.lineage.sourceType = 'PARTIAL';
    stage.confidence = { value: null, source: null, confidence: null, verificationStatus: 'MISSING' };
  }
  // All values are explicit synthetic experiment facts, never renderer parameters.
  return deepFreeze(snapshot);
}

export function resolveFiveAA3Demo(search, development) {
  const params = new URLSearchParams(search);
  const state = development ? params.get('v2FiveAA3State') : null;
  return state ? { state, snapshot: createFiveAA3DemoSnapshot(state), capture: params.get('v2FiveAA3Capture') === '1' } : null;
}
