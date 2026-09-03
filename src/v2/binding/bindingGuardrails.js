import { deepFreeze } from '../contracts/brandUniverseContract.js';
import { ART_DIRECTION_GUARDRAILS } from '../mapping/artDirectionGuardrails.js';
import { BINDING_CHANNEL } from './bindingChannels.js';

export const BINDING_MISSING_POLICY = deepFreeze({
  USE_VISUAL_STATE_FALLBACK_AND_FLAG: 'USE_VISUAL_STATE_FALLBACK_AND_FLAG'
});

const guardrailByChannel = {
  [BINDING_CHANNEL.HOME_GEO_DENSITY]: 'density',
  [BINDING_CHANNEL.HOME_GEO_ENERGY]: 'energy',
  [BINDING_CHANNEL.HOME_GEO_ACTIVITY]: 'activity',
  [BINDING_CHANNEL.HOME_GEO_EMPHASIS]: 'emphasis',
  [BINDING_CHANNEL.HOME_FIVE_A_DENSITY]: 'density',
  [BINDING_CHANNEL.HOME_FIVE_A_ENERGY]: 'energy',
  [BINDING_CHANNEL.HOME_FIVE_A_ACTIVITY]: 'activity',
  [BINDING_CHANNEL.HOME_FIVE_A_EMPHASIS]: 'emphasis',
  [BINDING_CHANNEL.HOME_BRAND_MIND_DENSITY]: 'density',
  [BINDING_CHANNEL.HOME_BRAND_MIND_ENERGY]: 'energy',
  [BINDING_CHANNEL.HOME_BRAND_MIND_ACTIVITY]: 'activity',
  [BINDING_CHANNEL.HOME_BRAND_MIND_EMPHASIS]: 'emphasis',
  [BINDING_CHANNEL.GEO_ANSWER_DENSITY]: 'density',
  [BINDING_CHANNEL.GEO_ANSWER_ENERGY]: 'energy',
  [BINDING_CHANNEL.GEO_ANSWER_FLOW_SPEED]: 'flowSpeed',
  [BINDING_CHANNEL.GEO_ANSWER_HIGHLIGHT_RATE]: 'highlightRate',
  [BINDING_CHANNEL.GEO_CITATION_DENSITY]: 'density',
  [BINDING_CHANNEL.GEO_CITATION_ENERGY]: 'energy',
  [BINDING_CHANNEL.GEO_CITATION_FLOW_SPEED]: 'flowSpeed',
  [BINDING_CHANNEL.GEO_CITATION_HIGHLIGHT_RATE]: 'highlightRate',
  [BINDING_CHANNEL.GEO_KEYWORD_DENSITY]: 'density',
  [BINDING_CHANNEL.GEO_KEYWORD_ENERGY]: 'energy',
  [BINDING_CHANNEL.GEO_KEYWORD_FLOW_SPEED]: 'flowSpeed',
  [BINDING_CHANNEL.GEO_KEYWORD_HIGHLIGHT_RATE]: 'highlightRate',
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_DENSITY]: 'density',
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_ENERGY]: 'energy',
  [BINDING_CHANNEL.GEO_SIGNAL_CORE_HIGHLIGHT_RATE]: 'highlightRate',
  [BINDING_CHANNEL.FIVEA_STAGE_SCALE]: 'stageScale',
  [BINDING_CHANNEL.FIVEA_STAGE_DENSITY]: 'density',
  [BINDING_CHANNEL.FIVEA_STAGE_ENERGY]: 'energy',
  [BINDING_CHANNEL.FIVEA_STAGE_ACTIVITY]: 'activity',
  [BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_STRENGTH]: 'flowStrength',
  [BINDING_CHANNEL.FIVEA_TRANSITION_FLOW_SPEED]: 'flowSpeed',
  [BINDING_CHANNEL.FIVEA_OPPORTUNITY_DENSITY]: 'density',
  [BINDING_CHANNEL.FIVEA_OPPORTUNITY_ENERGY]: 'energy',
  [BINDING_CHANNEL.FIVEA_OPPORTUNITY_ACTIVITY]: 'activity',
  [BINDING_CHANNEL.BRAND_MIND_CORE_DENSITY]: 'density',
  [BINDING_CHANNEL.BRAND_MIND_CORE_ENERGY]: 'energy',
  [BINDING_CHANNEL.BRAND_MIND_CORE_CONCENTRATION]: 'concentration',
  [BINDING_CHANNEL.BRAND_MIND_NODE_SCALE]: 'nodeScale',
  [BINDING_CHANNEL.BRAND_MIND_NODE_BRIGHTNESS]: 'brightness',
  [BINDING_CHANNEL.BRAND_MIND_NODE_ACTIVITY]: 'activity',
  [BINDING_CHANNEL.BRAND_MIND_NODE_RELATIONSHIP_STRENGTH]: 'relationshipStrength',
  [BINDING_CHANNEL.BRAND_MIND_PATH_VISIBILITY]: 'visibility',
  [BINDING_CHANNEL.BRAND_MIND_PATH_FLOW_STRENGTH]: 'flowStrength'
};

const unitRangeChannels = new Set([
  BINDING_CHANNEL.GEO_SIGNAL_CORE_CONFIDENCE
]);

export const BINDING_GUARDRAILS = deepFreeze(Object.fromEntries([
  ...Object.entries(guardrailByChannel).map(([channel, guardrailId]) => {
    const bounds = ART_DIRECTION_GUARDRAILS[guardrailId];
    return [channel, {
      valueType: 'number',
      min: bounds.min,
      max: bounds.max,
      fallback: bounds.min,
      missingPolicy: BINDING_MISSING_POLICY.USE_VISUAL_STATE_FALLBACK_AND_FLAG,
      sourceGuardrail: guardrailId,
      transform: 'BOUNDED_PASS_THROUGH'
    }];
  }),
  ...[...unitRangeChannels].map((channel) => [channel, {
    valueType: 'number',
    min: 0,
    max: 1,
    fallback: 0,
    missingPolicy: BINDING_MISSING_POLICY.USE_VISUAL_STATE_FALLBACK_AND_FLAG,
    sourceGuardrail: 'normalizedConfidence',
    transform: 'BOUNDED_PASS_THROUGH'
  }])
]));

export function applyBindingGuardrail(channel, value) {
  const contract = BINDING_GUARDRAILS[channel];
  if (!contract) throw new Error(`Unknown binding channel: ${channel}`);
  if (!Number.isFinite(value)) {
    return { value: contract.fallback, fallbackUsed: true, clamped: false };
  }
  const bounded = Math.min(Math.max(value, contract.min), contract.max);
  return { value: bounded, fallbackUsed: false, clamped: bounded !== value };
}
