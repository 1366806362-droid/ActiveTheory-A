import { adaptSource } from '../adapters/sourceAdapterRegistry.js';
import { SOURCE_ADAPTER_TYPES } from '../adapters/sourceAdapterContract.js';
import { SOURCE_TYPES, VERIFICATION_STATUSES, deepFreeze } from '../contracts/brandUniverseContract.js';
import { BINDING_CHANNEL } from '../binding/bindingChannels.js';
import {
  BRAND_MIND_SOURCE_MOCK,
  FIVE_A_SOURCE_MOCK,
  GEO_SOURCE_MOCK
} from '../mock/sourceAdapterFixtures.js';
import { REPLAY_ASSERTION_TYPE, createReplayScenario } from './replayScenario.js';

const frameMetadata = (source, frameId, sourceType = SOURCE_TYPES.MOCK) => {
  source.metadata.snapshotId = `replay-${frameId.toLowerCase()}`;
  source.metadata.sourceId = `replay-source-${frameId.toLowerCase()}`;
  source.metadata.sourceFile = `replay-${frameId.toLowerCase()}.json`;
  source.metadata.capturedAt = `2026-09-0${Number(frameId.slice(1))}T10:30:00+08:00`;
  source.metadata.sourceType = sourceType;
  source.metadata.verificationStatus = sourceType === SOURCE_TYPES.MOCK
    ? VERIFICATION_STATUSES.SYNTHETIC
    : VERIFICATION_STATUSES.UNVERIFIED;
  return source;
};

const fiveAFrame = (frameId, mutate, sourceType = SOURCE_TYPES.MOCK) => {
  const source = frameMetadata(clone(FIVE_A_SOURCE_MOCK), frameId, sourceType);
  mutate(source);
  return { frameId, snapshot: adaptSource({ type: SOURCE_ADAPTER_TYPES.FIVE_A, payload: source }) };
};

const brandMindFrame = (frameId, mutate) => {
  const source = frameMetadata(clone(BRAND_MIND_SOURCE_MOCK), frameId);
  mutate(source);
  return { frameId, snapshot: adaptSource({ type: SOURCE_ADAPTER_TYPES.BRAND_MIND, payload: source }) };
};

const geoFrame = (frameId, mutate) => {
  const source = frameMetadata(clone(GEO_SOURCE_MOCK), frameId);
  mutate(source);
  return { frameId, snapshot: adaptSource({ type: SOURCE_ADAPTER_TYPES.GEO, payload: source }) };
};

export const REPLAY_SCENARIOS = deepFreeze([
  createReplayScenario({
    id: 'FIVEA_A3_GROWTH',
    moduleId: 'fiveA',
    title: 'FiveA A3 Growth',
    frames: [
      fiveAFrame('T1', (source) => { source.fiveA.stages.A3.population = 1200; }),
      fiveAFrame('T2', (source) => { source.fiveA.stages.A3.population = 3900; }),
      fiveAFrame('T3', (source) => { source.fiveA.stages.A3.population = 8600; })
    ],
    assertions: [
      monotonic('a3PopulationDirection', 'snapshot.fiveA.stages.A3.population.value', 'INCREASE'),
      monotonic('a3ScaleDirection', 'visualState.fiveA.stages.A3.scale', 'INCREASE'),
      monotonic('a3DensityDirection', 'visualState.fiveA.stages.A3.density', 'INCREASE'),
      bindingMonotonic('a3BindingScaleDirection', BINDING_CHANNEL.FIVEA_STAGE_SCALE, 'A3', 'INCREASE'),
      bindingMonotonic('a3BindingDensityDirection', BINDING_CHANNEL.FIVEA_STAGE_DENSITY, 'A3', 'INCREASE')
    ],
    golden: { frameIds: ['T1', 'T2', 'T3'], stableTargetId: 'A3' }
  }),
  createReplayScenario({
    id: 'FIVEA_A2_A3_BOTTLENECK',
    moduleId: 'fiveA',
    title: 'FiveA A2 to A3 Bottleneck',
    frames: [
      fiveAFrame('T1', (source) => setBottleneck(source, 0.85)),
      fiveAFrame('T2', (source) => setBottleneck(source, 0.55)),
      fiveAFrame('T3', (source) => setBottleneck(source, 0.25))
    ],
    assertions: [
      monotonic('conversionDecreases', 'derived.fiveA.transitions.A2_TO_A3.rate', 'DECREASE'),
      monotonic('dropOffIncreases', 'derived.fiveA.transitions.A2_TO_A3.dropOffRate', 'INCREASE'),
      monotonic('bottleneckRateDecreases', 'derived.fiveA.bottleneck.rate', 'DECREASE'),
      monotonic('flowStrengthDecreases', 'visualState.fiveA.transitions.A2_TO_A3.flowStrength', 'DECREASE'),
      bindingMonotonic('bindingFlowStrengthDecreases', BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH, 'A2_TO_A3', 'DECREASE'),
      preserved('bottleneckTransitionId', 'derived.fiveA.bottleneck.transitionId')
    ],
    golden: { frameIds: ['T1', 'T2', 'T3'], bottleneckTransitionId: 'A2_TO_A3' }
  }),
  createReplayScenario({
    id: 'BRAND_MIND_ASSOCIATION_GROWTH',
    moduleId: 'brandMind',
    title: 'Brand Mind Association Growth',
    frames: [
      brandMindFrame('T1', (source) => setAssociation(source, 'mock-association-a', { strength: 0.3 })),
      brandMindFrame('T2', (source) => setAssociation(source, 'mock-association-a', { strength: 0.6 })),
      brandMindFrame('T3', (source) => setAssociation(source, 'mock-association-a', { strength: 0.9 }))
    ],
    assertions: [
      monotonic('associationStrengthIncreases', 'snapshot.brandMind.associations.0.strength.value', 'INCREASE'),
      monotonic('nodeBrightnessIncreases', 'visualState.brandMind.associations.0.node.brightness', 'INCREASE'),
      monotonic('nodeEmphasisNonDecreasing', 'visualState.brandMind.associations.0.node.emphasis', 'INCREASE'),
      bindingMonotonic('bindingBrightnessIncreases', BINDING_CHANNEL.BRAND_MIND_NODE_BRIGHTNESS, 'mock-association-a', 'INCREASE'),
      preserved('associationStableId', 'visualState.brandMind.associations.0.id')
    ],
    golden: { frameIds: ['T1', 'T2', 'T3'], associationId: 'mock-association-a' }
  }),
  createReplayScenario({
    id: 'BRAND_MIND_CONCENTRATION_SHIFT',
    moduleId: 'brandMind',
    title: 'Brand Mind Concentration Shift',
    frames: [
      brandMindFrame('T1', (source) => { source.brandMind.core.concentration = 0.5; source.brandMind.core.changeVsLast = 0; }),
      brandMindFrame('T2', (source) => { source.brandMind.core.concentration = 0.6; source.brandMind.core.changeVsLast = 0; }),
      brandMindFrame('T3', (source) => { source.brandMind.core.concentration = 0.75; source.brandMind.core.changeVsLast = 0; })
    ],
    assertions: [
      expected('coreStatusMatchesRules', 'derived.brandMind.coreStatus', ['DISTRIBUTED', 'STABLE', 'CONCENTRATED']),
      expected('panelCoreStatusMatchesRules', 'panel.coreStatus.code', ['DISTRIBUTED', 'STABLE', 'CONCENTRATED']),
      monotonic('coreConcentrationIncreases', 'visualState.brandMind.core.concentration', 'INCREASE'),
      bindingMonotonic('bindingCoreConcentrationIncreases', BINDING_CHANNEL.BRAND_MIND_CORE_CONCENTRATION, 'BRAND_MIND_CORE', 'INCREASE')
    ],
    golden: { frameIds: ['T1', 'T2', 'T3'], categories: ['DISTRIBUTED', 'STABLE', 'CONCENTRATED'] }
  }),
  createReplayScenario({
    id: 'BRAND_MIND_WEAKENING_ASSOCIATION',
    moduleId: 'brandMind',
    title: 'Brand Mind Weakening Association',
    frames: [
      brandMindFrame('T1', (source) => setWeakeningAssociation(source, 0.05)),
      brandMindFrame('T2', (source) => setWeakeningAssociation(source, 0)),
      brandMindFrame('T3', (source) => setWeakeningAssociation(source, -0.05))
    ],
    assertions: [
      expected('driftFollowsActualRules', 'derived.brandMind.associations.mock-association-b.driftStatus', ['GROWING', 'STABLE', 'WEAKENING']),
      expected('growthThenNeutralThenDefend', 'derived.brandMind.opportunitySignals.1.type', ['GROWTH', null, 'DEFEND'])
    ],
    golden: { frameIds: ['T1', 'T2', 'T3'], associationId: 'mock-association-b' }
  }),
  createReplayScenario({
    id: 'GEO_CITATION_STRENGTH',
    moduleId: 'geo',
    title: 'GEO Citation Strength',
    frames: [
      geoFrame('T1', (source) => { source.geo.citation.strength = 20; }),
      geoFrame('T2', (source) => { source.geo.citation.strength = 55; }),
      geoFrame('T3', (source) => { source.geo.citation.strength = 90; })
    ],
    assertions: [
      monotonic('citationStrengthIncreases', 'snapshot.geo.citation.strength.value', 'INCREASE'),
      monotonic('citationEnergyIncreases', 'visualState.geo.citationStream.energy', 'INCREASE'),
      bindingMonotonic('bindingCitationEnergyIncreases', BINDING_CHANNEL.GEO_CITATION_ENERGY, 'citationStream', 'INCREASE')
    ],
    golden: { frameIds: ['T1', 'T2', 'T3'], stream: 'citationStream' }
  }),
  createReplayScenario({
    id: 'GEO_KEYWORD_OPPORTUNITY',
    moduleId: 'geo',
    title: 'GEO Keyword Opportunity',
    frames: [
      geoFrame('T1', (source) => { source.geo.keyword.opportunity = 20; }),
      geoFrame('T2', (source) => { source.geo.keyword.opportunity = 55; }),
      geoFrame('T3', (source) => { source.geo.keyword.opportunity = 90; })
    ],
    assertions: [
      monotonic('keywordOpportunityIncreases', 'snapshot.geo.keyword.opportunity.value', 'INCREASE'),
      monotonic('keywordFlowIncreases', 'visualState.geo.keywordStream.flowSpeed', 'INCREASE'),
      bindingMonotonic('bindingKeywordFlowIncreases', BINDING_CHANNEL.GEO_KEYWORD_FLOW_SPEED, 'keywordStream', 'INCREASE')
    ],
    golden: { frameIds: ['T1', 'T2', 'T3'], stream: 'keywordStream' }
  }),
  createReplayScenario({
    id: 'PARTIAL_DATA_DEGRADATION',
    moduleId: 'fiveA',
    title: 'Partial Data Degradation',
    frames: [
      fiveAFrame('T1', () => {}, SOURCE_TYPES.PARTIAL),
      fiveAFrame('T2', (source) => { source.fiveA.stages.A3.confidence = null; }, SOURCE_TYPES.PARTIAL),
      fiveAFrame('T3', (source) => { source.fiveA.stages.A3.confidence = null; source.fiveA.transitions.A2_TO_A3.confidence = null; }, SOURCE_TYPES.PARTIAL)
    ],
    assertions: [
      expected('partialSourceTypePreserved', 'bindingPlan.metadata.sourceType', [SOURCE_TYPES.PARTIAL, SOURCE_TYPES.PARTIAL, SOURCE_TYPES.PARTIAL]),
      missing('a3ConfidenceMissingPreserved', 'bindingPlan.diagnostics.sourceMissingPaths', 'fiveA.stages.A3.activity', 1),
      missing('transitionConfidenceDoesNotInventData', 'bindingPlan.diagnostics.sourceMissingPaths', 'fiveA.transitions.A2_TO_A3.confidence', 2)
    ],
    golden: { frameIds: ['T1', 'T2', 'T3'], sourceType: SOURCE_TYPES.PARTIAL }
  })
]);

function monotonic(id, path, direction) {
  return { id, type: direction === 'INCREASE' ? REPLAY_ASSERTION_TYPE.MONOTONIC_INCREASE : REPLAY_ASSERTION_TYPE.MONOTONIC_DECREASE, path };
}

function bindingMonotonic(id, channel, targetId, direction) {
  return { id, type: direction === 'INCREASE' ? REPLAY_ASSERTION_TYPE.MONOTONIC_INCREASE : REPLAY_ASSERTION_TYPE.MONOTONIC_DECREASE, binding: { channel, targetId } };
}

function preserved(id, path) {
  return { id, type: REPLAY_ASSERTION_TYPE.PRESERVED_ID, path };
}

function expected(id, path, values) {
  return { id, type: REPLAY_ASSERTION_TYPE.EXPECTED_CATEGORY, path, expected: values };
}

function missing(id, path, includes, startAt = 0) {
  return { id, type: REPLAY_ASSERTION_TYPE.MISSING_PRESERVED, path, includes, startAt };
}

function setBottleneck(source, rate) {
  for (const transition of Object.values(source.fiveA.transitions)) transition.rate = 0.95;
  source.fiveA.transitions.A2_TO_A3.rate = rate;
  source.fiveA.transitions.A2_TO_A3.strength = rate;
}

function setAssociation(source, id, values) {
  const association = source.brandMind.associations.find((item) => item.id === id);
  Object.assign(association, values);
}

function setWeakeningAssociation(source, changeVsLast) {
  setAssociation(source, 'mock-association-a', { changeVsLast: 0 });
  setAssociation(source, 'mock-association-b', { status: null, changeVsLast });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
