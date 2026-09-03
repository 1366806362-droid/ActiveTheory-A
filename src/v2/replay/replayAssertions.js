import { getBindingPlanEntries } from '../binding/bindingPlanner.js';
import { BINDING_GUARDRAILS } from '../binding/bindingGuardrails.js';
import { REPLAY_ASSERTION_TYPE } from './replayScenario.js';

export function evaluateReplayAssertions(replay) {
  return replay.scenario.assertions.map((assertion) => evaluateAssertion(replay, assertion));
}

export function createFrameAssertions(frame) {
  return [
    baseAssertion('NO_NAN', REPLAY_ASSERTION_TYPE.NO_NAN, !numbers(frame).some(Number.isNaN)),
    baseAssertion('NO_INFINITY', REPLAY_ASSERTION_TYPE.NO_INFINITY, numbers(frame).every(Number.isFinite)),
    baseAssertion('WITHIN_GUARDRAIL', REPLAY_ASSERTION_TYPE.WITHIN_GUARDRAIL, allBindingEntriesWithinGuardrails(frame.bindingPlan)),
    baseAssertion('PRESERVED_METADATA', REPLAY_ASSERTION_TYPE.PRESERVED_METADATA, metadataMatches(frame))
  ];
}

function evaluateAssertion(replay, assertion) {
  const values = replay.frames.map((frame) => resolve(frame, assertion));
  let passed = false;
  switch (assertion.type) {
    case REPLAY_ASSERTION_TYPE.MONOTONIC_INCREASE:
      passed = monotonic(values, 'INCREASE');
      break;
    case REPLAY_ASSERTION_TYPE.MONOTONIC_DECREASE:
      passed = monotonic(values, 'DECREASE');
      break;
    case REPLAY_ASSERTION_TYPE.NON_INVERTING:
      passed = nonInverting(
        replay.frames.map((frame) => readPath(frame, assertion.inputPath)),
        values,
        assertion.direction
      );
      break;
    case REPLAY_ASSERTION_TYPE.PRESERVED_ID:
    case REPLAY_ASSERTION_TYPE.PRESERVED_METADATA:
      passed = values.every((value) => value === values[0]);
      break;
    case REPLAY_ASSERTION_TYPE.NO_NAN:
      passed = replay.frames.every((frame) => !numbers(frame).some(Number.isNaN));
      break;
    case REPLAY_ASSERTION_TYPE.NO_INFINITY:
      passed = replay.frames.every((frame) => numbers(frame).every(Number.isFinite));
      break;
    case REPLAY_ASSERTION_TYPE.WITHIN_GUARDRAIL:
      passed = replay.frames.every((frame) => allBindingEntriesWithinGuardrails(frame.bindingPlan));
      break;
    case REPLAY_ASSERTION_TYPE.EXPECTED_CATEGORY:
      passed = JSON.stringify(values) === JSON.stringify(assertion.expected);
      break;
    case REPLAY_ASSERTION_TYPE.MISSING_PRESERVED:
      passed = values.slice(assertion.startAt ?? 0)
        .every((value) => Array.isArray(value) && value.includes(assertion.includes));
      break;
    default:
      throw new Error(`Unknown replay assertion type: ${assertion.type}.`);
  }
  return Object.freeze({
    id: assertion.id,
    type: assertion.type,
    status: passed ? 'PASS' : 'FAIL',
    values,
    expected: assertion.expected ?? assertion.direction ?? assertion.includes ?? null
  });
}

function resolve(frame, assertion) {
  if (assertion.binding) {
    const entry = getBindingPlanEntries(frame.bindingPlan).find((candidate) => (
      candidate.channel === assertion.binding.channel
      && candidate.targetId === assertion.binding.targetId
    ));
    return entry?.[assertion.binding.property ?? 'value'] ?? null;
  }
  const value = readPath(frame, assertion.path);
  return value === undefined ? null : value;
}

function readPath(value, path) {
  return String(path).split('.').reduce((current, key) => current?.[key], value);
}

function monotonic(values, direction) {
  if (!values.every(Number.isFinite)) return false;
  return values.slice(1).every((value, index) => (
    direction === 'INCREASE' ? value >= values[index] : value <= values[index]
  ));
}

function nonInverting(inputs, outputs, direction) {
  if (!inputs.every(Number.isFinite) || !outputs.every(Number.isFinite)) return false;
  return inputs.slice(1).every((input, index) => {
    const inputDelta = input - inputs[index];
    const outputDelta = outputs[index + 1] - outputs[index];
    return direction === 'INCREASE'
      ? inputDelta >= 0 && outputDelta >= 0
      : inputDelta <= 0 && outputDelta <= 0;
  });
}

function allBindingEntriesWithinGuardrails(plan) {
  return getBindingPlanEntries(plan).every((entry) => {
    const guardrail = BINDING_GUARDRAILS[entry.channel];
    return guardrail && Number.isFinite(entry.value)
      && entry.value >= guardrail.min && entry.value <= guardrail.max;
  });
}

function metadataMatches(frame) {
  const snapshot = frame.snapshot.metadata;
  const plan = frame.bindingPlan.metadata;
  return ['brandId', 'snapshotId', 'capturedAt', 'sourceType'].every((key) => snapshot[key] === plan[key])
    && JSON.stringify(snapshot.lineage) === JSON.stringify(plan.lineage);
}

function baseAssertion(id, type, passed) {
  return Object.freeze({ id, type, status: passed ? 'PASS' : 'FAIL' });
}

function numbers(value, output = []) {
  if (typeof value === 'number') output.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach((child) => numbers(child, output));
  return output;
}
