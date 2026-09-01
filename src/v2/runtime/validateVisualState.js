import {
  BRAND_UNIVERSE_VISUAL_STATE_VERSION,
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS,
  SOURCE_TYPES
} from '../contracts/brandUniverseContract.js';
import { BRAND_UNIVERSE_VISUAL_STATE_SCHEMA } from '../contracts/brandUniverseSchema.js';
import {
  ART_DIRECTION_GUARDRAILS,
  isWithinGuardrail
} from '../mapping/artDirectionGuardrails.js';

export function validateVisualState(visualState) {
  const errors = [];
  const warnings = [];
  if (!visualState || typeof visualState !== 'object' || Array.isArray(visualState)) {
    return result(false, ['VisualState must be an object.'], warnings);
  }

  for (const key of BRAND_UNIVERSE_VISUAL_STATE_SCHEMA.required) {
    if (!Object.hasOwn(visualState, key)) errors.push(`Missing VisualState field: ${key}.`);
  }
  if (visualState.metadata?.schemaVersion !== BRAND_UNIVERSE_VISUAL_STATE_VERSION) {
    errors.push(`VisualState schemaVersion must be ${BRAND_UNIVERSE_VISUAL_STATE_VERSION}.`);
  }
  if (!Object.values(SOURCE_TYPES).includes(visualState.metadata?.sourceType)) {
    errors.push('VisualState metadata.sourceType must preserve REAL, MOCK, or PARTIAL.');
  }

  findProhibitedKeys(visualState, '', errors);
  validateFiniteNumbers(visualState, '', errors);
  validateHome(visualState.home, errors);
  validateGeo(visualState.geo, errors);
  validateFiveA(visualState.fiveA, errors);
  validateBrandMind(visualState.brandMind, errors);

  return result(errors.length === 0, errors, warnings);
}

function validateHome(home, errors) {
  for (const moduleId of ['geoNebula', 'fiveANebula', 'brandMindNebula']) {
    const state = home?.[moduleId];
    if (!state) {
      errors.push(`home.${moduleId} is required.`);
      continue;
    }
    validateGuarded(state.visibility, 'visibility', `home.${moduleId}.visibility`, errors);
    validateGuarded(state.density, 'density', `home.${moduleId}.density`, errors);
    validateGuarded(state.energy, 'energy', `home.${moduleId}.energy`, errors);
    validateGuarded(state.flow, 'flow', `home.${moduleId}.flow`, errors);
    validateGuarded(state.emphasis, 'emphasis', `home.${moduleId}.emphasis`, errors);
    validateGuarded(state.activity, 'activity', `home.${moduleId}.activity`, errors);
    validateUnit(state.confidence, `home.${moduleId}.confidence`, errors);
  }
}

function validateGeo(geo, errors) {
  for (const streamId of ['answerStream', 'citationStream', 'keywordStream', 'signalCore']) {
    const state = geo?.[streamId];
    if (!state) {
      errors.push(`geo.${streamId} is required.`);
      continue;
    }
    validateGuarded(state.density, 'density', `geo.${streamId}.density`, errors);
    validateGuarded(state.energy, 'energy', `geo.${streamId}.energy`, errors);
    validateGuarded(state.flowSpeed, 'flowSpeed', `geo.${streamId}.flowSpeed`, errors);
    validateGuarded(
      state.highlightRate,
      'highlightRate',
      `geo.${streamId}.highlightRate`,
      errors
    );
    validateUnit(state.confidence, `geo.${streamId}.confidence`, errors);
  }
}

function validateFiveA(fiveA, errors) {
  for (const stageId of Object.keys(FIVE_A_STAGES)) {
    const state = fiveA?.stages?.[stageId];
    if (!state) {
      errors.push(`fiveA.stages.${stageId} is required.`);
      continue;
    }
    validateGuarded(state.scale, 'stageScale', `fiveA.stages.${stageId}.scale`, errors);
    validateGuarded(state.density, 'density', `fiveA.stages.${stageId}.density`, errors);
    validateGuarded(state.energy, 'energy', `fiveA.stages.${stageId}.energy`, errors);
    validateGuarded(state.activity, 'activity', `fiveA.stages.${stageId}.activity`, errors);
    validateUnit(state.confidence, `fiveA.stages.${stageId}.confidence`, errors);
  }
  for (const transitionId of FIVE_A_TRANSITIONS) {
    const state = fiveA?.transitions?.[transitionId];
    if (!state) {
      errors.push(`fiveA.transitions.${transitionId} is required.`);
      continue;
    }
    validateGuarded(
      state.flowStrength,
      'flowStrength',
      `fiveA.transitions.${transitionId}.flowStrength`,
      errors
    );
    validateGuarded(
      state.flowSpeed,
      'flowSpeed',
      `fiveA.transitions.${transitionId}.flowSpeed`,
      errors
    );
    validateUnit(state.confidence, `fiveA.transitions.${transitionId}.confidence`, errors);
  }
  if (fiveA?.opportunityPool?.isStage !== false) {
    errors.push('fiveA.opportunityPool must remain separate from the five canonical stages.');
  }
  validateGuarded(
    fiveA?.opportunityPool?.density,
    'density',
    'fiveA.opportunityPool.density',
    errors
  );
  validateGuarded(
    fiveA?.opportunityPool?.energy,
    'energy',
    'fiveA.opportunityPool.energy',
    errors
  );
  validateGuarded(
    fiveA?.opportunityPool?.activity,
    'activity',
    'fiveA.opportunityPool.activity',
    errors
  );
  validateUnit(fiveA?.opportunityPool?.confidence, 'fiveA.opportunityPool.confidence', errors);
}

function validateBrandMind(brandMind, errors) {
  validateGuarded(brandMind?.core?.density, 'density', 'brandMind.core.density', errors);
  validateGuarded(brandMind?.core?.energy, 'energy', 'brandMind.core.energy', errors);
  validateGuarded(
    brandMind?.core?.concentration,
    'concentration',
    'brandMind.core.concentration',
    errors
  );
  validateUnit(brandMind?.core?.confidence, 'brandMind.core.confidence', errors);
  if (!Array.isArray(brandMind?.associations)) {
    errors.push('brandMind.associations must be an array.');
    return;
  }
  brandMind.associations.forEach((association, index) => {
    const path = `brandMind.associations[${index}]`;
    validateGuarded(association.node?.scale, 'nodeScale', `${path}.node.scale`, errors);
    validateGuarded(
      association.node?.brightness,
      'brightness',
      `${path}.node.brightness`,
      errors
    );
    validateGuarded(association.node?.activity, 'activity', `${path}.node.activity`, errors);
    validateGuarded(
      association.node?.relationshipStrength,
      'relationshipStrength',
      `${path}.node.relationshipStrength`,
      errors
    );
    validateGuarded(
      association.path?.visibility,
      'visibility',
      `${path}.path.visibility`,
      errors
    );
    validateGuarded(
      association.path?.flowStrength,
      'flowStrength',
      `${path}.path.flowStrength`,
      errors
    );
    validateUnit(association.confidence, `${path}.confidence`, errors);
  });
}

function validateGuarded(value, channel, path, errors) {
  if (!isWithinGuardrail(channel, value)) {
    const bounds = ART_DIRECTION_GUARDRAILS[channel];
    errors.push(`${path} must remain within ${bounds.min}..${bounds.max}.`);
  }
}

function validateUnit(value, path, errors) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    errors.push(`${path} must be a finite normalized value within 0..1.`);
  }
}

function validateFiniteNumbers(value, path, errors) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    errors.push(`${path || 'VisualState'} contains NaN or Infinity.`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    validateFiniteNumbers(child, path ? `${path}.${key}` : key, errors);
  });
}

function findProhibitedKeys(value, path, errors) {
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (BRAND_UNIVERSE_VISUAL_STATE_SCHEMA.forbiddenCompositionKeys.includes(key)) {
      errors.push(`${nextPath} is forbidden: V2 data cannot control composition.`);
    }
    findProhibitedKeys(child, nextPath, errors);
  });
}

function result(ok, errors, warnings) {
  return Object.freeze({ ok, errors: Object.freeze(errors), warnings: Object.freeze(warnings) });
}
