import { deepFreeze, FIVE_A_TRANSITIONS } from '../contracts/brandUniverseContract.js';
import { BINDING_CHANNEL } from '../binding/bindingChannels.js';

export const RENDERER_TARGET_INVENTORY_VERSION = 'ACTIVE_THEORY_V2_RENDERER_TARGET_INVENTORY_1.0';

export const RENDERER_TARGET_STATUS = deepFreeze({
  AVAILABLE: 'AVAILABLE',
  NEEDS_ADAPTER_HOOK: 'NEEDS_ADAPTER_HOOK',
  DYNAMIC_TARGET: 'DYNAMIC_TARGET',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  NOT_FOUND: 'NOT_FOUND'
});

export const RENDERER_TARGET_LIFECYCLE = deepFreeze({
  STATIC: 'STATIC',
  DYNAMIC: 'DYNAMIC',
  REBUILT: 'REBUILT',
  UNKNOWN: 'UNKNOWN'
});

export const IMPLEMENTATION_PRIORITY = deepFreeze({
  P0: 'P0',
  P1: 'P1',
  P2: 'P2'
});

const NEEDS_HOOK = RENDERER_TARGET_STATUS.NEEDS_ADAPTER_HOOK;
const DYNAMIC = RENDERER_TARGET_STATUS.DYNAMIC_TARGET;
const REBUILT = RENDERER_TARGET_LIFECYCLE.REBUILT;

const HOME_TARGETS = [
  target('HOME_GEO_NEBULA', 'home:geo-nebula', 'GEO Nebula', 'BusinessNebula', 'src/universe/galaxyPlanets.js', 'createGalaxyPlanets > createBusinessNebula', 1),
  target('HOME_FIVE_A_NEBULA', 'home:fivea-nebula', '5A Nebula', 'BusinessNebula', 'src/universe/galaxyPlanets.js', 'createGalaxyPlanets > createBusinessNebula', 1),
  target('HOME_BRAND_MIND_NEBULA', 'home:brand-mind-nebula', 'Brand Mind Nebula', 'BusinessNebula', 'src/universe/galaxyPlanets.js', 'createGalaxyPlanets > createBusinessNebula', 1)
];

const HOME_CHANNELS = [
  [BINDING_CHANNEL.HOME_GEO_DENSITY, 'HOME_GEO_NEBULA'],
  [BINDING_CHANNEL.HOME_GEO_ENERGY, 'HOME_GEO_NEBULA'],
  [BINDING_CHANNEL.HOME_GEO_ACTIVITY, 'HOME_GEO_NEBULA'],
  [BINDING_CHANNEL.HOME_GEO_EMPHASIS, 'HOME_GEO_NEBULA'],
  [BINDING_CHANNEL.HOME_FIVE_A_DENSITY, 'HOME_FIVE_A_NEBULA'],
  [BINDING_CHANNEL.HOME_FIVE_A_ENERGY, 'HOME_FIVE_A_NEBULA'],
  [BINDING_CHANNEL.HOME_FIVE_A_ACTIVITY, 'HOME_FIVE_A_NEBULA'],
  [BINDING_CHANNEL.HOME_FIVE_A_EMPHASIS, 'HOME_FIVE_A_NEBULA'],
  [BINDING_CHANNEL.HOME_BRAND_MIND_DENSITY, 'HOME_BRAND_MIND_NEBULA'],
  [BINDING_CHANNEL.HOME_BRAND_MIND_ENERGY, 'HOME_BRAND_MIND_NEBULA'],
  [BINDING_CHANNEL.HOME_BRAND_MIND_ACTIVITY, 'HOME_BRAND_MIND_NEBULA'],
  [BINDING_CHANNEL.HOME_BRAND_MIND_EMPHASIS, 'HOME_BRAND_MIND_NEBULA']
];

const GEO_TARGETS = [
  target('ANSWER', 'geo:answer', 'AI ANSWER', 'BusinessCluster', 'src/scenes/geo/geoBusinessClusters.js', 'GEO_CLUSTER_CONFIGS_V2 > createBusinessCluster', 1),
  target('CITATION', 'geo:citation', 'AI CITATION', 'BusinessCluster', 'src/scenes/geo/geoBusinessClusters.js', 'GEO_CLUSTER_CONFIGS_V2 > createBusinessCluster', 1),
  target('KEYWORD', 'geo:keyword', 'GEO KEYWORD', 'BusinessCluster', 'src/scenes/geo/geoBusinessClusters.js', 'GEO_CLUSTER_CONFIGS_V2 > createBusinessCluster', 1),
  target('SIGNAL_CORE', 'geo:signal-core', 'GEO Signal Core', 'SignalCore', 'src/scenes/geo/geoCinematicCoreShell.js', 'createGeoCinematicCoreShell', 1)
];

const GEO_CHANNELS = [
  [BINDING_CHANNEL.GEO_ANSWER_DENSITY, 'ANSWER'],
  [BINDING_CHANNEL.GEO_ANSWER_ENERGY, 'ANSWER'],
  [BINDING_CHANNEL.GEO_ANSWER_FLOW_SPEED, 'ANSWER'],
  [BINDING_CHANNEL.GEO_ANSWER_HIGHLIGHT_RATE, 'ANSWER'],
  [BINDING_CHANNEL.GEO_CITATION_DENSITY, 'CITATION'],
  [BINDING_CHANNEL.GEO_CITATION_ENERGY, 'CITATION'],
  [BINDING_CHANNEL.GEO_CITATION_FLOW_SPEED, 'CITATION'],
  [BINDING_CHANNEL.GEO_CITATION_HIGHLIGHT_RATE, 'CITATION'],
  [BINDING_CHANNEL.GEO_KEYWORD_DENSITY, 'KEYWORD'],
  [BINDING_CHANNEL.GEO_KEYWORD_ENERGY, 'KEYWORD'],
  [BINDING_CHANNEL.GEO_KEYWORD_FLOW_SPEED, 'KEYWORD'],
  [BINDING_CHANNEL.GEO_KEYWORD_HIGHLIGHT_RATE, 'KEYWORD'],
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_DENSITY, 'SIGNAL_CORE'],
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_ENERGY, 'SIGNAL_CORE'],
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_HIGHLIGHT_RATE, 'SIGNAL_CORE'],
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_CONFIDENCE, 'SIGNAL_CORE']
];

const FIVE_A_STAGE_IDS = Object.freeze(['A1', 'A2', 'A3', 'A4', 'A5']);
const FIVE_A_STAGE_CHANNELS = Object.freeze([
  BINDING_CHANNEL.FIVEA_STAGE_SCALE,
  BINDING_CHANNEL.FIVEA_STAGE_DENSITY,
  BINDING_CHANNEL.FIVEA_STAGE_ENERGY,
  BINDING_CHANNEL.FIVEA_STAGE_ACTIVITY
]);
const FIVE_A_TRANSITION_CHANNELS = Object.freeze([
  BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH,
  BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_SPEED
]);
const FIVE_A_OPPORTUNITY_CHANNELS = Object.freeze([
  BINDING_CHANNEL.FIVEA_OPPORTUNITY_DENSITY,
  BINDING_CHANNEL.FIVEA_OPPORTUNITY_ENERGY,
  BINDING_CHANNEL.FIVEA_OPPORTUNITY_ACTIVITY
]);

const FIVE_A_STAGE_TARGETS = FIVE_A_STAGE_IDS.map((stageId) => target(
  stageId,
  `fivea:stage:${stageId}`,
  `FiveAStageNode${stageId}`,
  'FiveAStageRoot',
  'src/scenes/fiveAScene.js',
  'createFiveAOrbit > createStageNode',
  1
));

const FIVE_A_TRANSITION_TARGETS = FIVE_A_TRANSITIONS.map((transitionId) => target(
  transitionId,
  `fivea:transition:${transitionId}`,
  'FiveACoreReleaseParticleFlow',
  'FiveATransitionFlow',
  'src/scenes/fiveAScene.js',
  'createFiveATransferFlow',
  1
));

const FIVE_A_OPPORTUNITY_TARGET = target(
  'OPPORTUNITY_POOL',
  'fivea:opportunity-pool',
  'FiveAStageNodeO',
  'FiveAOpportunityVisual',
  'src/scenes/fiveAScene.js',
  'FIVE_A_STAGES[id=O] > createStageNode',
  1
);

const BRAND_MIND_CORE_TARGET = target(
  'BRAND_MIND_CORE',
  'brandmind:core',
  'BrandMindCoreVolume',
  'BrandMindCore',
  'src/scenes/brandMindScene.js',
  'createMindCore',
  1
);

const BRAND_MIND_ASSOCIATION_TARGET = target(
  'association:<associationId>',
  'brandmind:association:<associationId>',
  'BrandMindAssociationNode1..6',
  'BrandMindAssociationNode',
  'src/scenes/brandMindScene.js',
  'ASSOCIATION_NODE_LAYOUT > createAssociationNodes',
  6
);

const BRAND_MIND_RELATIONSHIP_TARGET = target(
  'relationship:<sourceId>:<targetId>',
  'brandmind:relationship:<sourceId>:<targetId>',
  'BrandMindAssociationPath1..3',
  'BrandMindRelationshipPath',
  'src/scenes/brandMindScene.js',
  'ASSOCIATION_PATH_NODE_INDICES > createAssociationPaths',
  3
);

const P0_ASSOCIATION_REGISTRY = 'brand-mind-association-stable-registry';
const P0_RELATIONSHIP_REGISTRY = 'brand-mind-relationship-stable-registry';

export const RENDERER_TARGET_MANIFEST = deepFreeze({
  inventoryVersion: RENDERER_TARGET_INVENTORY_VERSION,
  purpose: 'Read-only V2-3B preflight map. It describes current renderer targets and never writes to a scene.',
  artDirectionProtected: Object.freeze([
    'camera', 'globalComposition', 'sceneLayout', 'earthPosition', 'galaxyPosition',
    'stagePermanentPosition', 'route', 'scroll', 'handoff', 'typography', 'panelLayout'
  ]),
  entries: Object.freeze([
    ...HOME_CHANNELS.map(([channel, targetId]) => entry({
      channel,
      domain: 'HOME',
      target: findTarget(HOME_TARGETS, targetId),
      status: NEEDS_HOOK,
      priority: IMPLEMENTATION_PRIORITY.P1,
      requiredHook: 'Expose a bounded semantic nebula setter for density, energy, activity, and emphasis; never change anchor position, rotation, camera, or composition.',
      notes: 'Current semantic identity is the stable nebula config name and its named visual envelope.'
    })),
    ...GEO_CHANNELS.map(([channel, targetId]) => entry({
      channel,
      domain: 'GEO',
      target: findTarget(GEO_TARGETS, targetId),
      status: NEEDS_HOOK,
      priority: IMPLEMENTATION_PRIORITY.P1,
      requiredHook: 'Expose a renderer-safe stream or core setter that composes with the existing journey update; do not change profile, camera, route, or grade.',
      notes: targetId === 'SIGNAL_CORE'
        ? 'The active core implementation varies by current GEO profile; semantic core identity remains stable.'
        : 'Stable cluster config key and group name exist, but no V2 setter is exported.'
    })),
    ...FIVE_A_STAGE_TARGETS.flatMap((stageTarget) => FIVE_A_STAGE_CHANNELS.map((channel) => entry({
      channel,
      domain: 'FIVE_A',
      target: stageTarget,
      status: NEEDS_HOOK,
      priority: IMPLEMENTATION_PRIORITY.P1,
      requiredHook: `Expose setStageVisualState('${stageTarget.targetId}', values) against the existing ${stageTarget.symbol} root; preserve permanent layout and journey motion.`,
      notes: 'A1-A5 use stable stage IDs and named stage roots. The live objects are recreated only when the containing scene is disposed and rebuilt.'
    }))),
    ...FIVE_A_TRANSITION_TARGETS.flatMap((transitionTarget) => FIVE_A_TRANSITION_CHANNELS.map((channel) => entry({
      channel,
      domain: 'FIVE_A',
      target: transitionTarget,
      status: NEEDS_HOOK,
      priority: IMPLEMENTATION_PRIORITY.P1,
      requiredHook: `Expose setTransitionFlow('${transitionTarget.targetId}', values) on the existing transfer-flow material without altering the scroll journey.`,
      notes: 'Transition IDs are canonical and exactly four; the current renderer batches particles into one transfer-flow object.'
    }))),
    ...FIVE_A_OPPORTUNITY_CHANNELS.map((channel) => entry({
      channel,
      domain: 'FIVE_A',
      target: FIVE_A_OPPORTUNITY_TARGET,
      status: NEEDS_HOOK,
      priority: IMPLEMENTATION_PRIORITY.P1,
      requiredHook: 'Expose a semantic Opportunity Pool visual hook mapped from the current secondary O-stage object; never introduce A6.',
      notes: 'The current scene calls this visual stage O. V2 must preserve Opportunity Pool as a separate canonical concept, not an A6 stage.'
    })),
    ...[
      BINDING_CHANNEL.BRAND_MIND_CORE_DENSITY,
      BINDING_CHANNEL.BRAND_MIND_CORE_ENERGY,
      BINDING_CHANNEL.BRAND_MIND_CORE_CONCENTRATION
    ].map((channel) => entry({
      channel,
      domain: 'BRAND_MIND',
      target: BRAND_MIND_CORE_TARGET,
      status: NEEDS_HOOK,
      priority: IMPLEMENTATION_PRIORITY.P1,
      requiredHook: 'Expose a bounded core material/particle state hook that composes with the existing reveal animation and preserves core position.',
      notes: 'The core hit target has a stable object name, but no renderer-facing V2 setter.'
    })),
    ...[
      BINDING_CHANNEL.BRAND_MIND_NODE_SCALE,
      BINDING_CHANNEL.BRAND_MIND_NODE_BRIGHTNESS,
      BINDING_CHANNEL.BRAND_MIND_NODE_ACTIVITY,
      BINDING_CHANNEL.BRAND_MIND_NODE_RELATIONSHIP_STRENGTH
    ].map((channel) => entry({
      channel,
      domain: 'BRAND_MIND',
      target: BRAND_MIND_ASSOCIATION_TARGET,
      status: DYNAMIC,
      priority: IMPLEMENTATION_PRIORITY.P0,
      implementationId: P0_ASSOCIATION_REGISTRY,
      requiredHook: 'NEEDS_STABLE_REGISTRY_HOOK: register associationId -> current node object on create, update the registry on lifecycle changes, and retire missing associations safely.',
      notes: 'Observed nodes are currently created from ASSOCIATION_NODE_LAYOUT by array order as BrandMindAssociationNode1..6. No canonical associationId mapping exists.'
    })),
    ...[
      BINDING_CHANNEL.BRAND_MIND_PATH_VISIBILITY,
      BINDING_CHANNEL.BRAND_MIND_PATH_FLOW_STRENGTH
    ].map((channel) => entry({
      channel,
      domain: 'BRAND_MIND',
      target: BRAND_MIND_RELATIONSHIP_TARGET,
      status: DYNAMIC,
      priority: IMPLEMENTATION_PRIORITY.P0,
      implementationId: P0_RELATIONSHIP_REGISTRY,
      requiredHook: 'NEEDS_STABLE_REGISTRY_HOOK: register sourceId+targetId -> current path object on create and remove it safely when the relationship disappears.',
      notes: 'Observed paths are currently created from ASSOCIATION_PATH_NODE_INDICES by array order as BrandMindAssociationPath1..3. No canonical relationship key mapping exists.'
    }))
  ])
});

export const V2_3B_IMPLEMENTATION_MANIFEST = deepFreeze({
  implementationVersion: RENDERER_TARGET_INVENTORY_VERSION,
  phase: 'V2-3B',
  actions: Object.freeze([
    action(P0_ASSOCIATION_REGISTRY, IMPLEMENTATION_PRIORITY.P0, 'BRAND_MIND', 'Create a stable associationId -> node registry with explicit create, update, and retire lifecycle handling.', 6),
    action(P0_RELATIONSHIP_REGISTRY, IMPLEMENTATION_PRIORITY.P0, 'BRAND_MIND', 'Create a stable sourceId+targetId -> path registry with explicit create, update, and retire lifecycle handling.', 3),
    action('home-business-nebula-adapter', IMPLEMENTATION_PRIORITY.P1, 'HOME', 'Expose bounded semantic setters for the three named business nebulae while preserving composition ownership.', 3),
    action('geo-visual-adapter', IMPLEMENTATION_PRIORITY.P1, 'GEO', 'Expose bounded Answer, Citation, Keyword, and Signal Core hooks that compose with GEO journey/profile updates.', 4),
    action('fivea-visual-adapter', IMPLEMENTATION_PRIORITY.P1, 'FIVE_A', 'Expose stable A1-A5, four transition-flow, and separate Opportunity Pool semantic setters.', 10),
    action('brand-mind-core-adapter', IMPLEMENTATION_PRIORITY.P1, 'BRAND_MIND', 'Expose bounded core density, energy, and concentration setters after P0 target identity is safe.', 1),
    action('bounded-value-smoothing', IMPLEMENTATION_PRIORITY.P2, 'ALL', 'Optionally add renderer-local interpolation for already-safe bounded values. This must not change camera, composition, route, or data truth.', 0)
  ])
});

function target(targetId, targetKey, observedName, targetKind, sourceFile, symbol, runtimeTargetCount) {
  return { targetId, targetKey, observedName, targetKind, sourceFile, symbol, runtimeTargetCount };
}

function findTarget(targets, targetId) {
  const found = targets.find((candidate) => candidate.targetId === targetId);
  if (!found) throw new Error(`Inventory target not found: ${targetId}`);
  return found;
}

function entry({ channel, domain, target: targetDefinition, status, priority, requiredHook, notes, implementationId = null }) {
  return {
    channel,
    domain,
    targetId: targetDefinition.targetId,
    targetKey: targetDefinition.targetKey,
    sourceFile: targetDefinition.sourceFile,
    symbol: targetDefinition.symbol,
    targetKind: targetDefinition.targetKind,
    lifecycle: REBUILT,
    status,
    priority,
    implementationId,
    runtimeTargetCount: targetDefinition.runtimeTargetCount,
    observedName: targetDefinition.observedName,
    requiredHook,
    notes
  };
}

function action(id, priority, domain, description, targetCount) {
  return { id, priority, domain, description, targetCount };
}
