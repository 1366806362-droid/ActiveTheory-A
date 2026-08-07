import {
  HANDOFF_PREPARE_PROGRESS,
  HANDOFF_START_PROGRESS,
  HANDOFF_END_PROGRESS,
  THREE_READY_PROGRESS
} from './heroHandoffContract.js';

export function createHeroCinematicHandoff({
  videoLayer,
  threeLayer,
  onPrepareThree = () => {},
  onStateChange = () => {}
} = {}) {
  let prepared = false;
  let previousState = null;
  let status = null;

  function update(progress) {
    const normalized = clamp01(progress);
    if (!prepared && normalized >= HANDOFF_PREPARE_PROGRESS) {
      prepared = true;
      onPrepareThree();
    }

    const handoffWeight = smootherstep(
      HANDOFF_START_PROGRESS,
      HANDOFF_END_PROGRESS,
      normalized
    );
    const state = normalized >= THREE_READY_PROGRESS - 0.0001
      ? 'THREE_READY'
      : normalized >= HANDOFF_START_PROGRESS
        ? 'BLENDING'
        : 'CINEMATIC';
    const phase = normalized >= HANDOFF_START_PROGRESS
      ? 'BLEND_TO_THREE'
      : normalized >= HANDOFF_PREPARE_PROGRESS
        ? 'PREPARE_THREE'
        : 'CINEMATIC_ONLY';

    videoLayer.style.opacity = String(1 - handoffWeight);
    videoLayer.style.visibility = handoffWeight >= 0.9999 ? 'hidden' : 'visible';
    threeLayer.style.opacity = String(handoffWeight);
    threeLayer.style.visibility = handoffWeight <= 0.0001 ? 'hidden' : 'visible';
    status = {
      state,
      phase,
      progress: normalized,
      handoffWeight,
      videoOpacity: 1 - handoffWeight,
      threeOpacity: handoffWeight,
      threePrepared: prepared
    };

    if (state !== previousState) {
      previousState = state;
      onStateChange(status);
    }
    return status;
  }

  return Object.freeze({
    update,
    getStatus: () => status
  });
}

function smootherstep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function clamp01(value) {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
}
