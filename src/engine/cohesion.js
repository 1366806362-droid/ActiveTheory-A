import { getNarrativeState } from './narrative.js';

const COHESION_PALETTE = Object.freeze({
  primary: '#0a4b8a',
  background: '#000000',
  fog: '#020308'
});

const COHESION_RULES = Object.freeze({
  calm: Object.freeze({
    exposure: 0.76,
    fogNear: 1.2,
    fogFar: 6.5,
    depthPulse: 0.025,
    emissive: 0.6
  }),
  focus: Object.freeze({
    exposure: 0.8,
    fogNear: 1.12,
    fogFar: 6.15,
    depthPulse: 0.035,
    emissive: 0.66
  }),
  drift: Object.freeze({
    exposure: 0.72,
    fogNear: 1.35,
    fogFar: 6.85,
    depthPulse: 0.06,
    emissive: 0.56
  })
});

export function initializeCohesionSystem() {
  return COHESION_RULES.calm;
}

export function updateCohesion(renderState, delta, time) {
  const rules = COHESION_RULES[getNarrativeState()] ?? COHESION_RULES.calm;
  const depthBreath = Math.sin(time * 0.2) * rules.depthPulse;
  const materialPulse = Math.sin(time * 0.7) * 0.025;
  const tonePulse = Math.sin(time * 0.16) * 0.01;

  renderState.exposure = rules.exposure + tonePulse;
  renderState.fogColor = COHESION_PALETTE.fog;
  renderState.fogNear = lerp(renderState.fogNear, rules.fogNear + depthBreath, 0.18);
  renderState.fogFar = lerp(renderState.fogFar, rules.fogFar - depthBreath * 1.8, 0.18);
  renderState.cubeColor = COHESION_PALETTE.primary;
  renderState.emissive = rules.emissive + materialPulse;
}

function lerp(from, to, alpha) {
  return from + (to - from) * alpha;
}

export const cohesionManager = {
  initializeCohesionSystem,
  updateCohesion
};
