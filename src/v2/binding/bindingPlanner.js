import {
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS,
  deepFreeze
} from '../contracts/brandUniverseContract.js';
import { validateVisualState } from '../runtime/validateVisualState.js';
import { BINDING_CHANNEL, VISUAL_BINDING_VERSION } from './bindingChannels.js';
import { applyBindingGuardrail } from './bindingGuardrails.js';

const HOME_SPECS = Object.freeze({
  geoNebula: [
    ['density', BINDING_CHANNEL.HOME_GEO_DENSITY],
    ['energy', BINDING_CHANNEL.HOME_GEO_ENERGY],
    ['activity', BINDING_CHANNEL.HOME_GEO_ACTIVITY],
    ['emphasis', BINDING_CHANNEL.HOME_GEO_EMPHASIS]
  ],
  fiveANebula: [
    ['density', BINDING_CHANNEL.HOME_FIVE_A_DENSITY],
    ['energy', BINDING_CHANNEL.HOME_FIVE_A_ENERGY],
    ['activity', BINDING_CHANNEL.HOME_FIVE_A_ACTIVITY],
    ['emphasis', BINDING_CHANNEL.HOME_FIVE_A_EMPHASIS]
  ],
  brandMindNebula: [
    ['density', BINDING_CHANNEL.HOME_BRAND_MIND_DENSITY],
    ['energy', BINDING_CHANNEL.HOME_BRAND_MIND_ENERGY],
    ['activity', BINDING_CHANNEL.HOME_BRAND_MIND_ACTIVITY],
    ['emphasis', BINDING_CHANNEL.HOME_BRAND_MIND_EMPHASIS]
  ]
});

const GEO_SPECS = Object.freeze({
  answerStream: [
    ['density', BINDING_CHANNEL.GEO_ANSWER_DENSITY],
    ['energy', BINDING_CHANNEL.GEO_ANSWER_ENERGY],
    ['flowSpeed', BINDING_CHANNEL.GEO_ANSWER_FLOW_SPEED],
    ['highlightRate', BINDING_CHANNEL.GEO_ANSWER_HIGHLIGHT_RATE]
  ],
  citationStream: [
    ['density', BINDING_CHANNEL.GEO_CITATION_DENSITY],
    ['energy', BINDING_CHANNEL.GEO_CITATION_ENERGY],
    ['flowSpeed', BINDING_CHANNEL.GEO_CITATION_FLOW_SPEED],
    ['highlightRate', BINDING_CHANNEL.GEO_CITATION_HIGHLIGHT_RATE]
  ],
  keywordStream: [
    ['density', BINDING_CHANNEL.GEO_KEYWORD_DENSITY],
    ['energy', BINDING_CHANNEL.GEO_KEYWORD_ENERGY],
    ['flowSpeed', BINDING_CHANNEL.GEO_KEYWORD_FLOW_SPEED],
    ['highlightRate', BINDING_CHANNEL.GEO_KEYWORD_HIGHLIGHT_RATE]
  ],
  signalCore: [
    ['density', BINDING_CHANNEL.GEO_SIGNAL_CORE_DENSITY],
    ['energy', BINDING_CHANNEL.GEO_SIGNAL_CORE_ENERGY],
    ['highlightRate', BINDING_CHANNEL.GEO_SIGNAL_CORE_HIGHLIGHT_RATE],
    ['confidence', BINDING_CHANNEL.GEO_SIGNAL_CORE_CONFIDENCE]
  ]
});

const FIVE_A_STAGE_SPECS = Object.freeze([
  ['scale', BINDING_CHANNEL.FIVEA_STAGE_SCALE],
  ['density', BINDING_CHANNEL.FIVEA_STAGE_DENSITY],
  ['energy', BINDING_CHANNEL.FIVEA_STAGE_ENERGY],
  ['activity', BINDING_CHANNEL.FIVEA_STAGE_ACTIVITY]
]);

const FIVE_A_TRANSITION_SPECS = Object.freeze([
  ['flowStrength', BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH],
  ['flowSpeed', BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_SPEED]
]);

const OPPORTUNITY_SPECS = Object.freeze([
  ['density', BINDING_CHANNEL.FIVEA_OPPORTUNITY_DENSITY],
  ['energy', BINDING_CHANNEL.FIVEA_OPPORTUNITY_ENERGY],
  ['activity', BINDING_CHANNEL.FIVEA_OPPORTUNITY_ACTIVITY]
]);

const BRAND_MIND_CORE_SPECS = Object.freeze([
  ['density', BINDING_CHANNEL.BRAND_MIND_CORE_DENSITY],
  ['energy', BINDING_CHANNEL.BRAND_MIND_CORE_ENERGY],
  ['concentration', BINDING_CHANNEL.BRAND_MIND_CORE_CONCENTRATION]
]);

const BRAND_MIND_NODE_SPECS = Object.freeze([
  ['scale', BINDING_CHANNEL.BRAND_MIND_NODE_SCALE],
  ['brightness', BINDING_CHANNEL.BRAND_MIND_NODE_BRIGHTNESS],
  ['activity', BINDING_CHANNEL.BRAND_MIND_NODE_ACTIVITY],
  ['relationshipStrength', BINDING_CHANNEL.BRAND_MIND_NODE_RELATIONSHIP_STRENGTH]
]);

const BRAND_MIND_PATH_SPECS = Object.freeze([
  ['visibility', BINDING_CHANNEL.BRAND_MIND_PATH_VISIBILITY],
  ['flowStrength', BINDING_CHANNEL.BRAND_MIND_PATH_FLOW_STRENGTH]
]);

export function buildVisualBindingPlan(visualState) {
  const validation = validateVisualState(visualState);
  if (!validation.ok) {
    throw new Error(`Invalid BrandUniverseVisualState:\n- ${validation.errors.join('\n- ')}`);
  }

  const missingPaths = new Set(visualState.diagnostics?.sourceMissingPaths ?? []);
  const context = { missingPaths, stats: { fallbackCount: 0, clampedCount: 0 } };

  const home = Object.entries(HOME_SPECS).flatMap(([targetId, specs]) => {
    const state = visualState.home[targetId];
    const moduleMissing = state.availability === 'MISSING';
    return specs.map(([property, channel]) => entry({
      channel,
      targetId,
      value: state[property],
      sourcePath: `home.${targetId}.${property}`,
      confidence: state.confidence,
      forceMissing: moduleMissing,
      context
    }));
  });

  const geo = Object.entries(GEO_SPECS).flatMap(([targetId, specs]) => {
    const state = visualState.geo[targetId];
    return specs.map(([property, channel]) => entry({
      channel,
      targetId,
      value: state[property],
      sourcePath: `geo.${targetId}.${property}`,
      confidence: state.confidence,
      context
    }));
  });

  const stages = Object.keys(FIVE_A_STAGES).flatMap((stageId) => {
    const state = visualState.fiveA.stages[stageId];
    return FIVE_A_STAGE_SPECS.map(([property, channel]) => entry({
      channel,
      targetId: stageId,
      stageId,
      value: state[property],
      sourcePath: `fiveA.stages.${stageId}.${property}`,
      confidence: state.confidence,
      context
    }));
  });

  const transitions = FIVE_A_TRANSITIONS.flatMap((transitionId) => {
    const state = visualState.fiveA.transitions[transitionId];
    return FIVE_A_TRANSITION_SPECS.map(([property, channel]) => entry({
      channel,
      targetId: transitionId,
      transitionId,
      value: state[property],
      sourcePath: `fiveA.transitions.${transitionId}.${property}`,
      confidence: state.confidence,
      context
    }));
  });

  const opportunityPool = OPPORTUNITY_SPECS.map(([property, channel]) => entry({
    channel,
    targetId: 'OPPORTUNITY_POOL',
    value: visualState.fiveA.opportunityPool[property],
    sourcePath: `fiveA.opportunityPool.${property}`,
    confidence: visualState.fiveA.opportunityPool.confidence,
    context
  }));

  const core = BRAND_MIND_CORE_SPECS.map(([property, channel]) => entry({
    channel,
    targetId: 'BRAND_MIND_CORE',
    value: visualState.brandMind.core[property],
    sourcePath: `brandMind.core.${property}`,
    confidence: visualState.brandMind.core.confidence,
    context
  }));

  const nodes = visualState.brandMind.associations.flatMap((association) => (
    BRAND_MIND_NODE_SPECS.map(([property, channel]) => entry({
      channel,
      targetId: association.id,
      associationId: association.id,
      value: association.node[property],
      sourcePath: `brandMind.associations.${association.id}.node.${property}`,
      confidence: association.confidence,
      context
    }))
  ));

  const paths = visualState.brandMind.relationships.flatMap((relationship) => (
    BRAND_MIND_PATH_SPECS.map(([property, channel]) => entry({
      channel,
      targetId: relationship.targetId,
      relationshipId: relationship.id,
      sourceId: relationship.sourceId,
      value: relationship.path[property],
      sourcePath: `brandMind.relationships.${relationship.id}.path.${property}`,
      confidence: relationship.confidence,
      context
    }))
  ));

  return deepFreeze({
    metadata: {
      brandId: visualState.metadata.brandId,
      snapshotId: visualState.metadata.snapshotId,
      capturedAt: visualState.metadata.capturedAt,
      sourceType: visualState.metadata.sourceType,
      schemaVersion: visualState.metadata.schemaVersion,
      bindingVersion: VISUAL_BINDING_VERSION,
      lineage: { ...visualState.metadata.lineage }
    },
    home: { entries: home },
    geo: { entries: geo },
    fiveA: { stages, transitions, opportunityPool },
    brandMind: { core, nodes, paths },
    diagnostics: {
      sourceMissingPaths: [...missingPaths].sort(),
      missingBindingCount: flattenEntries({ home, geo, stages, transitions, opportunityPool, core, nodes, paths })
        .filter((item) => item.missing).length,
      fallbackCount: context.stats.fallbackCount,
      clampedCount: context.stats.clampedCount,
      recalculatedBusinessMetrics: false,
      rendererIntegration: 'NOT_CONNECTED',
      unsupportedChannels: []
    }
  });
}

export function getBindingPlanEntries(plan) {
  return [
    ...(plan.home?.entries ?? []),
    ...(plan.geo?.entries ?? []),
    ...(plan.fiveA?.stages ?? []),
    ...(plan.fiveA?.transitions ?? []),
    ...(plan.fiveA?.opportunityPool ?? []),
    ...(plan.brandMind?.core ?? []),
    ...(plan.brandMind?.nodes ?? []),
    ...(plan.brandMind?.paths ?? [])
  ];
}

function entry({
  channel,
  targetId,
  value,
  sourcePath,
  confidence,
  context,
  forceMissing = false,
  ...identity
}) {
  const guarded = applyBindingGuardrail(channel, value);
  if (guarded.fallbackUsed) context.stats.fallbackCount += 1;
  if (guarded.clamped) context.stats.clampedCount += 1;
  return {
    channel,
    targetId,
    value: guarded.value,
    sourcePath,
    missing: forceMissing || context.missingPaths.has(sourcePath) || guarded.fallbackUsed,
    confidence: Number.isFinite(confidence)
      ? Math.min(Math.max(confidence, 0), 1)
      : 0,
    ...identity
  };
}

function flattenEntries(groups) {
  return Object.values(groups).flat();
}
