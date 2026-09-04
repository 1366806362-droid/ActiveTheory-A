import { RENDERER_CAPABILITY_CONTRACT } from '../binding/bindingContracts.js';
import { REPLAY_SCENARIOS } from '../replay/replayFixtures.js';
import { runBindingReplay } from '../replay/replayRunner.js';
import { applyBindingPlan } from './bindingExecutor.js';
import { cloneFakeRendererState, createFakeRendererState } from './fakeRendererState.js';

export function getReplayScenario(id) {
  const scenario = REPLAY_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Unknown replay scenario: ${id}.`);
  return scenario;
}

export function getReplayFrame(scenarioId, index = 0) {
  const replay = runBindingReplay({ scenario: getReplayScenario(scenarioId) });
  const frame = replay.frames[index];
  if (!frame) throw new RangeError(`Replay scenario ${scenarioId} has no frame at index ${index}.`);
  return frame;
}

export function getReplayPlan(scenarioId, index = 0) {
  return getReplayFrame(scenarioId, index).bindingPlan;
}

export function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

export function createDefaultFakeRendererState(plan) {
  return createFakeRendererState(plan);
}

export function createShuffledFakeRendererState(plan) {
  const state = createFakeRendererState(plan);
  state.brandMind.nodes = Object.fromEntries(Object.entries(state.brandMind.nodes).reverse());
  state.brandMind.paths = Object.fromEntries(Object.entries(state.brandMind.paths).reverse());
  return state;
}

export function withoutCapability(channel) {
  return {
    ...RENDERER_CAPABILITY_CONTRACT,
    supportedChannels: RENDERER_CAPABILITY_CONTRACT.supportedChannels.filter((item) => item !== channel)
  };
}

export function runReplayToFakeRenderer(scenarioId) {
  const replay = runBindingReplay({ scenario: getReplayScenario(scenarioId) });
  let state = createFakeRendererState(replay.frames[0].bindingPlan);
  const frames = replay.frames.map((frame) => {
    const apply = applyBindingPlan(frame.bindingPlan, state);
    if (!apply.ok) throw new Error(`Dry-run failed at ${scenarioId}:${frame.frameId}.`);
    state = apply.nextState;
    return Object.freeze({ frameId: frame.frameId, bindingPlan: frame.bindingPlan, rendererState: state, apply });
  });
  return Object.freeze({ scenarioId, frames: Object.freeze(frames), finalState: cloneFakeRendererState(state) });
}
