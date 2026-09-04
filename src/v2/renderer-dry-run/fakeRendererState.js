import { FIVE_A_STAGES, FIVE_A_TRANSITIONS } from '../contracts/brandUniverseContract.js';
import { BINDING_CHANNEL, BINDING_CHANNELS } from '../binding/bindingChannels.js';

export const FAKE_RENDERER_STATE_VERSION = 'ACTIVE_THEORY_V2_FAKE_RENDERER_STATE_1.0';

export function createFakeRendererState(plan = null) {
  const state = {
    version: FAKE_RENDERER_STATE_VERSION,
    home: {
      geo: metricTarget(),
      fiveA: metricTarget(),
      brandMind: metricTarget()
    },
    geo: {
      answer: geoTarget(),
      citation: geoTarget(),
      keyword: geoTarget(),
      signalCore: signalCoreTarget()
    },
    fiveA: {
      stages: Object.fromEntries(Object.keys(FIVE_A_STAGES).map((id) => [id, stageTarget()])),
      transitions: Object.fromEntries(FIVE_A_TRANSITIONS.map((id) => [id, transitionTarget()])),
      opportunityPool: metricTarget()
    },
    brandMind: {
      core: coreTarget(),
      nodes: {},
      paths: {}
    },
    bindingMetadata: {},
    diagnostics: {
      dynamicTargetPolicy: 'MARK_INACTIVE_WHEN_ABSENT',
      sourceMissingPaths: []
    }
  };
  if (plan) provisionFakeRendererTargets(state, plan);
  return state;
}

export function cloneFakeRendererState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function provisionFakeRendererTargets(state, plan) {
  const entries = flattenPlanEntries(plan);
  for (const entry of entries) {
    if (isBrandMindNodeChannel(entry.channel) && entry.targetId) {
      state.brandMind.nodes[entry.targetId] ??= nodeTarget(entry.targetId);
    }
    if (isBrandMindPathChannel(entry.channel) && entry.sourceId && entry.targetId) {
      const key = relationshipTargetKey(entry.sourceId, entry.targetId);
      state.brandMind.paths[key] ??= pathTarget(entry.sourceId, entry.targetId, entry.relationshipId);
    }
  }
  return state;
}

export function createFakeRendererTargetRegistry(state) {
  return Object.freeze({
    resolve(entry) {
      return resolveFakeRendererTarget(state, entry);
    },
    hasStableTarget(entry) {
      return Boolean(resolveFakeRendererTarget(state, entry)?.path);
    }
  });
}

export function resolveFakeRendererTarget(state, entry) {
  if (!BINDING_CHANNELS.includes(entry?.channel)) {
    return failure('UNKNOWN_CHANNEL', `Unknown binding channel: ${entry?.channel ?? 'undefined'}.`);
  }
  const home = resolveHomeTarget(state, entry);
  if (home) return home;
  const geo = resolveGeoTarget(state, entry);
  if (geo) return geo;
  const fiveA = resolveFiveATarget(state, entry);
  if (fiveA) return fiveA;
  const brandMind = resolveBrandMindTarget(state, entry);
  if (brandMind) return brandMind;
  return failure('TARGET_NOT_FOUND', `No fake renderer target for ${entry.channel}:${entry.targetId ?? 'undefined'}.`);
}

export function relationshipTargetKey(sourceId, targetId) {
  return `${sourceId}→${targetId}`;
}

export function flattenPlanEntries(plan) {
  return [
    ...(plan?.home?.entries ?? []),
    ...(plan?.geo?.entries ?? []),
    ...(plan?.fiveA?.stages ?? []),
    ...(plan?.fiveA?.transitions ?? []),
    ...(plan?.fiveA?.opportunityPool ?? []),
    ...(plan?.brandMind?.core ?? []),
    ...(plan?.brandMind?.nodes ?? []),
    ...(plan?.brandMind?.paths ?? [])
  ];
}

function resolveHomeTarget(state, entry) {
  const spec = {
    [BINDING_CHANNEL.HOME_GEO_DENSITY]: ['geo', 'density'],
    [BINDING_CHANNEL.HOME_GEO_ENERGY]: ['geo', 'energy'],
    [BINDING_CHANNEL.HOME_GEO_ACTIVITY]: ['geo', 'activity'],
    [BINDING_CHANNEL.HOME_GEO_EMPHASIS]: ['geo', 'emphasis'],
    [BINDING_CHANNEL.HOME_FIVE_A_DENSITY]: ['fiveA', 'density'],
    [BINDING_CHANNEL.HOME_FIVE_A_ENERGY]: ['fiveA', 'energy'],
    [BINDING_CHANNEL.HOME_FIVE_A_ACTIVITY]: ['fiveA', 'activity'],
    [BINDING_CHANNEL.HOME_FIVE_A_EMPHASIS]: ['fiveA', 'emphasis'],
    [BINDING_CHANNEL.HOME_BRAND_MIND_DENSITY]: ['brandMind', 'density'],
    [BINDING_CHANNEL.HOME_BRAND_MIND_ENERGY]: ['brandMind', 'energy'],
    [BINDING_CHANNEL.HOME_BRAND_MIND_ACTIVITY]: ['brandMind', 'activity'],
    [BINDING_CHANNEL.HOME_BRAND_MIND_EMPHASIS]: ['brandMind', 'emphasis']
  }[entry.channel];
  if (!spec) return null;
  const [targetId, property] = spec;
  const expectedTarget = `${targetId}Nebula`;
  if (entry.targetId !== expectedTarget) {
    return failure('TARGET_NOT_FOUND', `Expected HOME target ${expectedTarget}, received ${entry.targetId}.`);
  }
  return success(['home', targetId, property]);
}

function resolveGeoTarget(state, entry) {
  const spec = {
    [BINDING_CHANNEL.GEO_ANSWER_DENSITY]: ['answer', 'answerStream', 'density'],
    [BINDING_CHANNEL.GEO_ANSWER_ENERGY]: ['answer', 'answerStream', 'energy'],
    [BINDING_CHANNEL.GEO_ANSWER_FLOW_SPEED]: ['answer', 'answerStream', 'flowSpeed'],
    [BINDING_CHANNEL.GEO_ANSWER_HIGHLIGHT_RATE]: ['answer', 'answerStream', 'highlightRate'],
    [BINDING_CHANNEL.GEO_CITATION_DENSITY]: ['citation', 'citationStream', 'density'],
    [BINDING_CHANNEL.GEO_CITATION_ENERGY]: ['citation', 'citationStream', 'energy'],
    [BINDING_CHANNEL.GEO_CITATION_FLOW_SPEED]: ['citation', 'citationStream', 'flowSpeed'],
    [BINDING_CHANNEL.GEO_CITATION_HIGHLIGHT_RATE]: ['citation', 'citationStream', 'highlightRate'],
    [BINDING_CHANNEL.GEO_KEYWORD_DENSITY]: ['keyword', 'keywordStream', 'density'],
    [BINDING_CHANNEL.GEO_KEYWORD_ENERGY]: ['keyword', 'keywordStream', 'energy'],
    [BINDING_CHANNEL.GEO_KEYWORD_FLOW_SPEED]: ['keyword', 'keywordStream', 'flowSpeed'],
    [BINDING_CHANNEL.GEO_KEYWORD_HIGHLIGHT_RATE]: ['keyword', 'keywordStream', 'highlightRate'],
    [BINDING_CHANNEL.GEO_SIGNAL_CORE_DENSITY]: ['signalCore', 'signalCore', 'density'],
    [BINDING_CHANNEL.GEO_SIGNAL_CORE_ENERGY]: ['signalCore', 'signalCore', 'energy'],
    [BINDING_CHANNEL.GEO_SIGNAL_CORE_HIGHLIGHT_RATE]: ['signalCore', 'signalCore', 'highlightRate'],
    [BINDING_CHANNEL.GEO_SIGNAL_CORE_CONFIDENCE]: ['signalCore', 'signalCore', 'confidence']
  }[entry.channel];
  if (!spec) return null;
  const [targetId, expectedTarget, property] = spec;
  if (entry.targetId !== expectedTarget || !state.geo[targetId]) {
    return failure('TARGET_NOT_FOUND', `Expected GEO target ${expectedTarget}, received ${entry.targetId}.`);
  }
  return success(['geo', targetId, property]);
}

function resolveFiveATarget(state, entry) {
  if ([
    BINDING_CHANNEL.FIVEA_STAGE_SCALE,
    BINDING_CHANNEL.FIVEA_STAGE_DENSITY,
    BINDING_CHANNEL.FIVEA_STAGE_ENERGY,
    BINDING_CHANNEL.FIVEA_STAGE_ACTIVITY
  ].includes(entry.channel)) {
    if (!state.fiveA.stages[entry.targetId]) {
      return failure('TARGET_NOT_FOUND', `FiveA stage target does not exist: ${entry.targetId}.`);
    }
    const property = {
      [BINDING_CHANNEL.FIVEA_STAGE_SCALE]: 'scale',
      [BINDING_CHANNEL.FIVEA_STAGE_DENSITY]: 'density',
      [BINDING_CHANNEL.FIVEA_STAGE_ENERGY]: 'energy',
      [BINDING_CHANNEL.FIVEA_STAGE_ACTIVITY]: 'activity'
    }[entry.channel];
    return success(['fiveA', 'stages', entry.targetId, property]);
  }
  if ([
    BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH,
    BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_SPEED
  ].includes(entry.channel)) {
    if (!state.fiveA.transitions[entry.targetId]) {
      return failure('TARGET_NOT_FOUND', `FiveA transition target does not exist: ${entry.targetId}.`);
    }
    return success(['fiveA', 'transitions', entry.targetId,
      entry.channel === BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH ? 'flowStrength' : 'flowSpeed']);
  }
  if ([
    BINDING_CHANNEL.FIVEA_OPPORTUNITY_DENSITY,
    BINDING_CHANNEL.FIVEA_OPPORTUNITY_ENERGY,
    BINDING_CHANNEL.FIVEA_OPPORTUNITY_ACTIVITY
  ].includes(entry.channel)) {
    if (entry.targetId !== 'OPPORTUNITY_POOL') {
      return failure('TARGET_NOT_FOUND', `Expected Opportunity Pool target, received ${entry.targetId}.`);
    }
    const property = {
      [BINDING_CHANNEL.FIVEA_OPPORTUNITY_DENSITY]: 'density',
      [BINDING_CHANNEL.FIVEA_OPPORTUNITY_ENERGY]: 'energy',
      [BINDING_CHANNEL.FIVEA_OPPORTUNITY_ACTIVITY]: 'activity'
    }[entry.channel];
    return success(['fiveA', 'opportunityPool', property]);
  }
  return null;
}

function resolveBrandMindTarget(state, entry) {
  if ([
    BINDING_CHANNEL.BRAND_MIND_CORE_DENSITY,
    BINDING_CHANNEL.BRAND_MIND_CORE_ENERGY,
    BINDING_CHANNEL.BRAND_MIND_CORE_CONCENTRATION
  ].includes(entry.channel)) {
    if (entry.targetId !== 'BRAND_MIND_CORE') {
      return failure('TARGET_NOT_FOUND', `Expected BRAND_MIND_CORE, received ${entry.targetId}.`);
    }
    const property = {
      [BINDING_CHANNEL.BRAND_MIND_CORE_DENSITY]: 'density',
      [BINDING_CHANNEL.BRAND_MIND_CORE_ENERGY]: 'energy',
      [BINDING_CHANNEL.BRAND_MIND_CORE_CONCENTRATION]: 'concentration'
    }[entry.channel];
    return success(['brandMind', 'core', property]);
  }
  if (isBrandMindNodeChannel(entry.channel)) {
    if (!state.brandMind.nodes[entry.targetId]) {
      return failure('TARGET_NOT_FOUND', `Brand Mind association target does not exist: ${entry.targetId}.`);
    }
    const property = {
      [BINDING_CHANNEL.BRAND_MIND_NODE_SCALE]: 'scale',
      [BINDING_CHANNEL.BRAND_MIND_NODE_BRIGHTNESS]: 'brightness',
      [BINDING_CHANNEL.BRAND_MIND_NODE_ACTIVITY]: 'activity',
      [BINDING_CHANNEL.BRAND_MIND_NODE_RELATIONSHIP_STRENGTH]: 'relationshipStrength'
    }[entry.channel];
    return success(['brandMind', 'nodes', entry.targetId, property]);
  }
  if (isBrandMindPathChannel(entry.channel)) {
    const key = relationshipTargetKey(entry.sourceId, entry.targetId);
    if (!state.brandMind.paths[key]) {
      return failure('TARGET_NOT_FOUND', `Brand Mind relationship target does not exist: ${key}.`);
    }
    const property = entry.channel === BINDING_CHANNEL.BRAND_MIND_PATH_VISIBILITY
      ? 'visibility'
      : 'flowStrength';
    return success(['brandMind', 'paths', key, property]);
  }
  return null;
}

function metricTarget() {
  return { density: 0, energy: 0, activity: 0, emphasis: 0, active: true };
}

function geoTarget() {
  return { density: 0, energy: 0, flowSpeed: 0, highlightRate: 0, active: true };
}

function signalCoreTarget() {
  return { density: 0, energy: 0, highlightRate: 0, confidence: 0, active: true };
}

function stageTarget() {
  return { scale: 0, density: 0, energy: 0, activity: 0, active: true };
}

function transitionTarget() {
  return { flowStrength: 0, flowSpeed: 0, active: true };
}

function coreTarget() {
  return { density: 0, energy: 0, concentration: 0, active: true };
}

function nodeTarget(id) {
  return { id, scale: 0, brightness: 0, activity: 0, relationshipStrength: 0, active: true };
}

function pathTarget(sourceId, targetId, relationshipId = null) {
  return { sourceId, targetId, relationshipId, visibility: 0, flowStrength: 0, active: true };
}

function isBrandMindNodeChannel(channel) {
  return [
    BINDING_CHANNEL.BRAND_MIND_NODE_SCALE,
    BINDING_CHANNEL.BRAND_MIND_NODE_BRIGHTNESS,
    BINDING_CHANNEL.BRAND_MIND_NODE_ACTIVITY,
    BINDING_CHANNEL.BRAND_MIND_NODE_RELATIONSHIP_STRENGTH
  ].includes(channel);
}

function isBrandMindPathChannel(channel) {
  return [
    BINDING_CHANNEL.BRAND_MIND_PATH_VISIBILITY,
    BINDING_CHANNEL.BRAND_MIND_PATH_FLOW_STRENGTH
  ].includes(channel);
}

function success(path) {
  return { ok: true, path };
}

function failure(code, reason) {
  return { ok: false, code, reason };
}
