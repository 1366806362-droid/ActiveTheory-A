import { CANONICAL_FIVE_A_MOCK } from '../mock/canonicalFixtures.js';
import { deepFreeze } from '../contracts/brandUniverseContract.js';

const CONTRAST = Object.freeze({
  A1: { population: 10, strength: 20 },
  A2: { population: 100000, strength: 90 },
  A3: { population: 3900, strength: 59 },
  A4: { population: 100, strength: 30 },
  A5: { population: 40000, strength: 80 }
});

export function createFiveAStagesDemoSnapshot(state = 'balanced') {
  if (!['balanced', 'contrast', 'partial'].includes(state)) throw new Error(`Unknown FiveA demo state: ${state}`);
  const snapshot = structuredClone(CANONICAL_FIVE_A_MOCK);
  snapshot.metadata.snapshotId += `:stages-${state}`;
  for (const [id, stage] of Object.entries(snapshot.fiveA.stages)) {
    const facts = state === 'contrast' ? CONTRAST[id] : { population: 4000, strength: 65 };
    stage.population.value = facts.population;
    stage.strength.value = facts.strength;
  }
  if (state === 'partial') {
    snapshot.metadata.sourceType = 'PARTIAL';
    snapshot.metadata.lineage.sourceType = 'PARTIAL';
    const missing = () => ({ value: null, source: null, confidence: null, verificationStatus: 'MISSING' });
    snapshot.fiveA.stages.A2.strength = missing();
    snapshot.fiveA.stages.A4.confidence = missing();
  }
  // Only synthetic source facts change. Transitions / Opportunity are untouched.
  return deepFreeze(snapshot);
}

export function resolveFiveAStagesDemo(search, development) {
  const params = new URLSearchParams(search);
  const state = development ? params.get('v2FiveAState') : null;
  return state ? { state, snapshot: createFiveAStagesDemoSnapshot(state), capture: params.get('v2FiveACapture') === '1' } : null;
}
