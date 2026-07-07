const NARRATIVE_STATES = Object.freeze({
  calm: Object.freeze({
    camera: Object.freeze({
      motionScale: 0.65,
      depthDriftScale: 0.45,
      zOffset: 0,
      targetXOffset: 0.2,
      targetYOffset: 0.2,
      compression: 0
    }),
    fog: Object.freeze({
      near: 1.2,
      far: 6.5,
      motion: 0.035
    }),
    backgroundColor: '#05070c',
    emissiveIntensity: 0.85,
    emissivePulse: 0.035,
    cubeOffset: 0
  }),
  focus: Object.freeze({
    camera: Object.freeze({
      motionScale: 0.8,
      depthDriftScale: 0.35,
      zOffset: -0.18,
      targetXOffset: 0.18,
      targetYOffset: 0.22,
      compression: 0.1
    }),
    fog: Object.freeze({
      near: 1.12,
      far: 6.15,
      motion: 0.05
    }),
    backgroundColor: '#08101d',
    emissiveIntensity: 0.9,
    emissivePulse: 0.05,
    cubeOffset: 0
  }),
  drift: Object.freeze({
    camera: Object.freeze({
      motionScale: 1.15,
      depthDriftScale: 1.25,
      zOffset: 0.04,
      targetXOffset: 0.26,
      targetYOffset: 0.18,
      compression: 0
    }),
    fog: Object.freeze({
      near: 1.35,
      far: 6.85,
      motion: 0.07
    }),
    backgroundColor: '#02050a',
    emissiveIntensity: 0.8,
    emissivePulse: 0.06,
    cubeOffset: 0.08
  })
});

const NARRATIVE_SEQUENCE = Object.freeze([
  Object.freeze({ state: 'calm', duration: 8 }),
  Object.freeze({ state: 'focus', duration: 7 }),
  Object.freeze({ state: 'drift', duration: 8 })
]);

const narrativeState = {
  current: 'calm',
  elapsed: 0,
  sequenceElapsed: 0
};

export function initializeNarrativeSystem() {
  setNarrativeState('calm');
}

export function setNarrativeState(state) {
  if (!NARRATIVE_STATES[state]) {
    return narrativeState.current;
  }

  narrativeState.current = state;
  narrativeState.elapsed = 0;

  return narrativeState.current;
}

export function getNarrativeState() {
  return narrativeState.current;
}

export function updateNarrative(renderState, delta) {
  narrativeState.elapsed += delta;
  narrativeState.sequenceElapsed += delta;
  updateNarrativeSequence();
  applyNarrativeRules(renderState, narrativeState.elapsed);
}

function applyNarrativeRules(renderState, time) {
  const rules = NARRATIVE_STATES[narrativeState.current];

  const fogBreath = Math.sin(time * 0.28) * rules.fog.motion;
  const emissiveBreath = Math.sin(time * 0.9) * rules.emissivePulse;
  renderState.fogNear = rules.fog.near + fogBreath;
  renderState.fogFar = rules.fog.far - fogBreath * 1.4;
  renderState.emissive = rules.emissiveIntensity + emissiveBreath;
}

function updateNarrativeSequence() {
  const totalDuration = NARRATIVE_SEQUENCE.reduce((total, item) => {
    return total + item.duration;
  }, 0);
  const sequenceTime = narrativeState.sequenceElapsed % totalDuration;
  let cursor = 0;

  for (const item of NARRATIVE_SEQUENCE) {
    cursor += item.duration;

    if (sequenceTime <= cursor) {
      if (narrativeState.current !== item.state) {
        narrativeState.current = item.state;
        narrativeState.elapsed = 0;
      }

      return;
    }
  }
}

export const narrativeManager = {
  initializeNarrativeSystem,
  setNarrativeState,
  getNarrativeState,
  updateNarrative
};
