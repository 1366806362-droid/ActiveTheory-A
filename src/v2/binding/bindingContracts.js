import { deepFreeze } from '../contracts/brandUniverseContract.js';
import {
  BINDING_CHANNEL,
  BINDING_CHANNEL_GROUPS,
  BINDING_CHANNELS,
  VISUAL_BINDING_VERSION
} from './bindingChannels.js';

export const ART_DIRECTION_OWNERSHIP = deepFreeze({
  dataControlled: [
    'scale within channel bounds',
    'density',
    'energy',
    'activity',
    'flow',
    'highlight',
    'visibility within channel bounds'
  ],
  prohibited: [
    'camera',
    'globalComposition',
    'sceneLayout',
    'earthPosition',
    'galaxyPosition',
    'stagePermanentPosition',
    'route',
    'scroll',
    'handoff',
    'typography',
    'panelLayout'
  ]
});

export const VISUAL_BINDING_CONTRACT = deepFreeze({
  id: 'ActiveTheoryV2VisualBindingPlan',
  bindingVersion: VISUAL_BINDING_VERSION,
  input: 'BrandUniverseVisualState',
  output: 'VisualBindingPlan',
  rendererIntegration: 'NOT_CONNECTED',
  behavior: 'IDENTITY_OR_BOUNDED_PASS_THROUGH',
  entryRequired: ['channel', 'targetId', 'value', 'sourcePath', 'missing', 'confidence'],
  sections: ['metadata', 'home', 'geo', 'fiveA', 'brandMind', 'diagnostics'],
  artDirection: ART_DIRECTION_OWNERSHIP
});

export const RENDERER_CAPABILITY_CONTRACT = deepFreeze({
  id: 'ActiveTheoryV2RendererCapabilities',
  bindingVersion: VISUAL_BINDING_VERSION,
  renderers: {
    home: { supportedChannels: BINDING_CHANNEL_GROUPS.home },
    geo: { supportedChannels: BINDING_CHANNEL_GROUPS.geo },
    fiveA: { supportedChannels: BINDING_CHANNEL_GROUPS.fiveA },
    brandMind: { supportedChannels: BINDING_CHANNEL_GROUPS.brandMind }
  },
  supportedChannels: BINDING_CHANNELS
});

function buildManifestEntry(channel) {
  const explicit = MANIFEST_OVERRIDES[channel];
  if (explicit) return { channel, ...explicit };

  const homeMatch = channel.match(/^HOME_(GEO|FIVE_A|BRAND_MIND)_(DENSITY|ENERGY|ACTIVITY|EMPHASIS)$/);
  if (homeMatch) {
    const moduleByToken = {
      GEO: ['geoNebula', 'GEO'],
      FIVE_A: ['fiveANebula', 'FiveA'],
      BRAND_MIND: ['brandMindNebula', 'Brand Mind']
    };
    const [moduleId, label] = moduleByToken[homeMatch[1]];
    const property = lowerCamel(homeMatch[2]);
    return {
      channel,
      sourcePathPattern: `home.${moduleId}.${property}`,
      futureRendererTarget: `${label} home nebula ${humanize(homeMatch[2])}`
    };
  }

  const geoMatch = channel.match(/^GEO_(ANSWER|CITATION|KEYWORD)_(DENSITY|ENERGY|FLOW_SPEED|HIGHLIGHT_RATE)$/);
  if (geoMatch) {
    const stream = geoMatch[1].toLowerCase();
    const property = lowerCamel(geoMatch[2]);
    return {
      channel,
      sourcePathPattern: `geo.${stream}Stream.${property}`,
      futureRendererTarget: `${stream} stream ${humanize(geoMatch[2])}`
    };
  }

  throw new Error(`Missing renderer binding manifest entry for ${channel}.`);
}

const MANIFEST_OVERRIDES = {
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_DENSITY]: descriptor('geo.signalCore.density', 'signal core density'),
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_ENERGY]: descriptor('geo.signalCore.energy', 'signal core luminous energy'),
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_HIGHLIGHT_RATE]: descriptor('geo.signalCore.highlightRate', 'signal core highlight rate'),
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_CONFIDENCE]: descriptor('geo.signalCore.confidence', 'signal core confidence emphasis'),
  [BINDING_CHANNEL.FIVEA_STAGE_SCALE]: descriptor('fiveA.stages.*.scale', 'stage sphere scale'),
  [BINDING_CHANNEL.FIVEA_STAGE_DENSITY]: descriptor('fiveA.stages.*.density', 'stage sphere density'),
  [BINDING_CHANNEL.FIVEA_STAGE_ENERGY]: descriptor('fiveA.stages.*.energy', 'stage luminous energy'),
  [BINDING_CHANNEL.FIVEA_STAGE_ACTIVITY]: descriptor('fiveA.stages.*.activity', 'stage activity intensity'),
  [BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH]: descriptor('fiveA.transitions.*.flowStrength', 'journey flow intensity'),
  [BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_SPEED]: descriptor('fiveA.transitions.*.flowSpeed', 'journey flow speed'),
  [BINDING_CHANNEL.FIVEA_OPPORTUNITY_DENSITY]: descriptor('fiveA.opportunityPool.density', 'opportunity pool density'),
  [BINDING_CHANNEL.FIVEA_OPPORTUNITY_ENERGY]: descriptor('fiveA.opportunityPool.energy', 'opportunity pool luminous energy'),
  [BINDING_CHANNEL.FIVEA_OPPORTUNITY_ACTIVITY]: descriptor('fiveA.opportunityPool.activity', 'opportunity pool activity'),
  [BINDING_CHANNEL.BRAND_MIND_CORE_DENSITY]: descriptor('brandMind.core.density', 'Brand Mind core density'),
  [BINDING_CHANNEL.BRAND_MIND_CORE_ENERGY]: descriptor('brandMind.core.energy', 'Brand Mind core luminous energy'),
  [BINDING_CHANNEL.BRAND_MIND_CORE_CONCENTRATION]: descriptor('brandMind.core.concentration', 'Brand Mind core concentration'),
  [BINDING_CHANNEL.BRAND_MIND_NODE_SCALE]: descriptor('brandMind.associations.*.node.scale', 'association node scale'),
  [BINDING_CHANNEL.BRAND_MIND_NODE_BRIGHTNESS]: descriptor('brandMind.associations.*.node.brightness', 'association node luminous intensity'),
  [BINDING_CHANNEL.BRAND_MIND_NODE_ACTIVITY]: descriptor('brandMind.associations.*.node.activity', 'association node activity'),
  [BINDING_CHANNEL.BRAND_MIND_NODE_RELATIONSHIP_STRENGTH]: descriptor('brandMind.associations.*.node.relationshipStrength', 'association relationship emphasis'),
  [BINDING_CHANNEL.BRAND_MIND_PATH_VISIBILITY]: descriptor('brandMind.relationships.*.path.visibility', 'relationship path visibility'),
  [BINDING_CHANNEL.BRAND_MIND_PATH_FLOW_STRENGTH]: descriptor('brandMind.relationships.*.path.flowStrength', 'relationship path flow intensity')
};

export const RENDERER_BINDING_MANIFEST = deepFreeze({
  bindingVersion: VISUAL_BINDING_VERSION,
  notes: 'Future renderer targets are semantic descriptions, not implementation instructions.',
  entries: BINDING_CHANNELS.map(buildManifestEntry)
});

function descriptor(sourcePathPattern, futureRendererTarget) {
  return { sourcePathPattern, futureRendererTarget };
}

function lowerCamel(token) {
  const words = token.toLowerCase().split('_');
  return words[0] + words.slice(1).map((word) => word[0].toUpperCase() + word.slice(1)).join('');
}

function humanize(token) {
  return token.toLowerCase().replaceAll('_', ' ');
}
