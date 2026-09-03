import { buildVisualState } from '../mapping/buildVisualState.js';
import {
  CANONICAL_BRAND_MIND_MOCK,
  CANONICAL_FIVE_A_MOCK,
  CANONICAL_GEO_MOCK
} from '../mock/canonicalFixtures.js';
import { buildVisualBindingPlan } from './bindingPlanner.js';

const fiveA = buildVisualBindingPlan(buildVisualState(CANONICAL_FIVE_A_MOCK));
const brandMind = buildVisualBindingPlan(buildVisualState(CANONICAL_BRAND_MIND_MOCK));
const geo = buildVisualBindingPlan(buildVisualState(CANONICAL_GEO_MOCK));

const find = (entries, channel, targetId) => entries.find((entry) => (
  entry.channel === channel && entry.targetId === targetId
));

const preview = {
  fiveA: {
    A3: Object.fromEntries(['SCALE', 'DENSITY', 'ENERGY', 'ACTIVITY'].map((metric) => {
      const entry = find(fiveA.fiveA.stages, `FIVEA_STAGE_${metric}`, 'A3');
      return [metric.toLowerCase(), entry?.value];
    })),
    A2_TO_A3: {
      flowStrength: find(
        fiveA.fiveA.transitions,
        'FIVEA_TRANSITION_FLOW_STRENGTH',
        'A2_TO_A3'
      )?.value
    }
  },
  brandMind: {
    association: brandMind.brandMind.nodes[0]
      ? {
          id: brandMind.brandMind.nodes[0].associationId,
          brightness: find(
            brandMind.brandMind.nodes,
            'BRAND_MIND_NODE_BRIGHTNESS',
            brandMind.brandMind.nodes[0].associationId
          )?.value
        }
      : null
  },
  geo: {
    citation: {
      energy: find(geo.geo.entries, 'GEO_CITATION_ENERGY', 'citationStream')?.value
    }
  }
};

console.log(JSON.stringify(preview, null, 2));
