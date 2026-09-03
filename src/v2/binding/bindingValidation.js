import { FIVE_A_TRANSITIONS } from '../contracts/brandUniverseContract.js';
import { BINDING_CHANNELS, VISUAL_BINDING_VERSION } from './bindingChannels.js';
import { ART_DIRECTION_OWNERSHIP } from './bindingContracts.js';
import { BINDING_GUARDRAILS } from './bindingGuardrails.js';
import { getBindingPlanEntries } from './bindingPlanner.js';

export function validateVisualBindingPlan(plan) {
  const errors = [];
  const warnings = [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return result(false, ['VisualBindingPlan must be an object.'], warnings);
  }

  for (const section of ['metadata', 'home', 'geo', 'fiveA', 'brandMind', 'diagnostics']) {
    if (!Object.hasOwn(plan, section)) errors.push(`Missing binding plan section: ${section}.`);
  }
  if (plan.metadata?.bindingVersion !== VISUAL_BINDING_VERSION) {
    errors.push(`bindingVersion must be ${VISUAL_BINDING_VERSION}.`);
  }

  const entries = getBindingPlanEntries(plan);
  entries.forEach((entry, index) => validateEntry(entry, index, errors));
  validateFiveA(plan, errors);
  validateArtDirectionOwnership(plan, errors);
  validateFiniteNumbers(plan, '', errors);
  validateSerializable(plan, errors);

  return result(errors.length === 0, errors, warnings);
}

export function validateBindingCapabilities(plan, capabilities) {
  const supported = new Set(capabilities?.supportedChannels ?? []);
  const requested = [...new Set(getBindingPlanEntries(plan).map((entry) => entry.channel))];
  const unsupportedChannels = requested.filter((channel) => !supported.has(channel)).sort();
  return result(
    unsupportedChannels.length === 0,
    unsupportedChannels.map((channel) => `Unsupported binding channel: ${channel}.`),
    [],
    { requestedChannels: requested.sort(), unsupportedChannels }
  );
}

function validateEntry(entry, index, errors) {
  const path = `entries[${index}]`;
  for (const key of ['channel', 'targetId', 'value', 'sourcePath', 'missing', 'confidence']) {
    if (!Object.hasOwn(entry, key)) errors.push(`${path}.${key} is required.`);
  }
  if (!BINDING_CHANNELS.includes(entry.channel)) {
    errors.push(`${path}.channel is unknown: ${entry.channel}.`);
    return;
  }
  const bounds = BINDING_GUARDRAILS[entry.channel];
  if (!Number.isFinite(entry.value) || entry.value < bounds.min || entry.value > bounds.max) {
    errors.push(`${path}.value must remain within ${bounds.min}..${bounds.max}.`);
  }
  if (!Number.isFinite(entry.confidence) || entry.confidence < 0 || entry.confidence > 1) {
    errors.push(`${path}.confidence must be within 0..1.`);
  }
  if (typeof entry.missing !== 'boolean') errors.push(`${path}.missing must be boolean.`);
}

function validateFiveA(plan, errors) {
  const stageIds = [...new Set((plan.fiveA?.stages ?? []).map((entry) => entry.stageId))].sort();
  if (JSON.stringify(stageIds) !== JSON.stringify(['A1', 'A2', 'A3', 'A4', 'A5'])) {
    errors.push('FiveA binding stages must be exactly A1-A5.');
  }
  if (stageIds.includes('A6')) errors.push('Opportunity Pool must not be represented as A6.');
  const transitionIds = [...new Set(
    (plan.fiveA?.transitions ?? []).map((entry) => entry.transitionId)
  )];
  if (JSON.stringify(transitionIds) !== JSON.stringify(FIVE_A_TRANSITIONS)) {
    errors.push('FiveA binding transitions must preserve the four canonical transitions.');
  }
}

function validateArtDirectionOwnership(plan, errors) {
  const forbidden = new Set(ART_DIRECTION_OWNERSHIP.prohibited.map(normalizeKey));
  walk(plan, '', (key, path) => {
    if (forbidden.has(normalizeKey(key))) {
      errors.push(`${path} is owned by Art Direction and forbidden in Binding Plan.`);
    }
  });
}

function validateFiniteNumbers(value, path, errors) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    errors.push(`${path || 'VisualBindingPlan'} contains NaN or Infinity.`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    validateFiniteNumbers(child, path ? `${path}.${key}` : key, errors);
  });
}

function validateSerializable(plan, errors) {
  try {
    const json = JSON.stringify(plan);
    if (typeof json !== 'string' || JSON.parse(json) === undefined) {
      errors.push('VisualBindingPlan must be JSON serializable.');
    }
  } catch (error) {
    errors.push(`VisualBindingPlan is not serializable: ${error.message}`);
  }
}

function walk(value, path, visit) {
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    const nextPath = path ? `${path}.${key}` : key;
    visit(key, nextPath);
    walk(child, nextPath, visit);
  });
}

function normalizeKey(value) {
  return String(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function result(ok, errors, warnings, extra = {}) {
  return Object.freeze({
    ok,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    ...extra
  });
}
