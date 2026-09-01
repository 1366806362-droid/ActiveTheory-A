import { FIVE_A_STAGES, FIVE_A_TRANSITIONS, deepFreeze } from '../contracts/brandUniverseContract.js';

export const FIVE_A_DERIVATION_VERSION = 'V2_1_FIVE_A_DERIVED_1';

export function deriveFiveAMetrics(snapshot) {
  const fiveA = snapshot?.fiveA;
  if (!fiveA) return deepFreeze({ available: false, version: FIVE_A_DERIVATION_VERSION });

  const stagePopulation = Object.fromEntries(Object.keys(FIVE_A_STAGES).map((stageId) => [
    stageId,
    read(fiveA.stages?.[stageId]?.population)
  ]));
  const transitions = Object.fromEntries(FIVE_A_TRANSITIONS.map((transitionId) => {
    const [fromStageId, toStageId] = transitionId.split('_TO_');
    const transition = fiveA.transitions?.[transitionId];
    const explicitIn = read(transition?.in);
    const explicitOut = read(transition?.out);
    const rate = read(transition?.rate);
    return [transitionId, {
      in: explicitIn ?? stagePopulation[fromStageId],
      out: explicitOut ?? stagePopulation[toStageId],
      rate,
      dropOffRate: rate === null ? null : clamp01(1 - rate),
      changeVsLast: read(transition?.changeVsLast)
    }];
  }));
  const ranked = Object.entries(transitions)
    .filter(([, transition]) => transition.rate !== null)
    .sort((left, right) => left[1].rate - right[1].rate || left[0].localeCompare(right[0]));
  const totalPopulation = Object.values(stagePopulation)
    .reduce((sum, value) => sum + (value ?? 0), 0);
  const opportunityVolume = read(fiveA.opportunityPool?.volume)
    ?? read(fiveA.opportunityPool?.population);

  return deepFreeze({
    available: true,
    version: FIVE_A_DERIVATION_VERSION,
    transitions,
    bottleneck: ranked.length ? {
      transitionId: ranked[0][0],
      stageId: ranked[0][0].split('_TO_')[1],
      rate: ranked[0][1].rate
    } : null,
    opportunityPool: {
      isStage: false,
      ratio: opportunityVolume !== null && totalPopulation > 0
        ? opportunityVolume / totalPopulation
        : null
    }
  });
}

function read(point) {
  return Number.isFinite(point?.value) ? point.value : null;
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}
