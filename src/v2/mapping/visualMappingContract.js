import { deepFreeze } from '../contracts/brandUniverseContract.js';

export const VISUAL_MAPPING_CONTRACT = deepFreeze({
  id: 'ActiveTheoryV2DataToVisualMapping',
  version: 'V2_0_DATA_VISUAL_MAPPING_1',
  rendererIntegration: 'NOT_CONNECTED',
  composition: {
    owner: 'ART_DIRECTION',
    dataControlled: false,
    prohibitedTargets: ['camera', 'position', 'route', 'handoff', 'composition']
  },
  home: {
    geoNebula: {
      density: ['geo.answer.volume', 'geo.citation.volume', 'geo.keyword.volume'],
      energy: ['geo.signalCore.strength'],
      flow: ['geo.answer.opportunity', 'geo.citation.opportunity', 'geo.keyword.opportunity']
    },
    fiveANebula: {
      density: ['fiveA.stages.*.population'],
      energy: ['fiveA.stages.*.strength'],
      flow: ['fiveA.transitions.*.rate']
    },
    brandMindNebula: {
      density: ['brandMind.core.concentration'],
      energy: ['brandMind.core.strength'],
      flow: ['brandMind.associations.*.confidence']
    }
  },
  geo: {
    streamTemplate: {
      density: { source: 'volume', normalizer: 'log', guardrail: 'density' },
      energy: { source: 'strength', normalizer: 'bounded', guardrail: 'energy' },
      flowSpeed: { source: 'opportunity', normalizer: 'bounded', guardrail: 'flowSpeed' },
      highlightRate: { source: 'quality', normalizer: 'bounded', guardrail: 'highlightRate' }
    },
    outputs: ['answerStream', 'citationStream', 'keywordStream', 'signalCore']
  },
  fiveA: {
    stageTemplate: {
      scale: { source: 'population', normalizer: 'log', guardrail: 'stageScale' },
      density: { source: 'population', normalizer: 'log', guardrail: 'density' },
      energy: { source: 'strength', normalizer: 'bounded', guardrail: 'energy' },
      activity: { source: ['strength', 'confidence'], guardrail: 'activity' }
    },
    transitionTemplate: {
      flowStrength: { source: 'rate', normalizer: 'bounded', guardrail: 'flowStrength' },
      flowSpeed: { source: 'volume', normalizer: 'log', guardrail: 'flowSpeed' }
    },
    opportunityPoolIsStage: false
  },
  brandMind: {
    core: {
      density: { source: 'concentration', guardrail: 'density' },
      energy: { source: 'strength', guardrail: 'energy' },
      concentration: { source: 'concentration', guardrail: 'concentration' }
    },
    associationTemplate: {
      nodeScale: { source: 'weight', guardrail: 'nodeScale' },
      brightness: { source: ['weight', 'confidence'], guardrail: 'brightness' },
      activity: { source: 'confidence', guardrail: 'activity' },
      relationshipStrength: { source: 'weight', guardrail: 'relationshipStrength' },
      pathVisibility: { source: 'confidence', guardrail: 'visibility' },
      pathFlowStrength: { source: 'weight', guardrail: 'flowStrength' }
    },
    relationshipTemplate: {
      sourceId: { source: 'sourceId', behavior: 'preserve' },
      targetId: { source: 'targetId', behavior: 'preserve' },
      pathVisibility: { source: 'confidence', guardrail: 'visibility' },
      pathFlowStrength: { source: 'strength', guardrail: 'flowStrength' }
    }
  }
});
