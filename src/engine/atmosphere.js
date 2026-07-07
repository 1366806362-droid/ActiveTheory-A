import { getNarrativeState } from './narrative.js';

const ATMOSPHERE_RULES = Object.freeze({
  calm: Object.freeze({
    exposure: 0.76,
    fogColor: '#020308',
    fogNearOffset: 0,
    fogFarOffset: 0,
    fogPulse: 0.025
  }),
  focus: Object.freeze({
    exposure: 0.8,
    fogColor: '#020308',
    fogNearOffset: -0.08,
    fogFarOffset: -0.18,
    fogPulse: 0.04
  }),
  drift: Object.freeze({
    exposure: 0.72,
    fogColor: '#020308',
    fogNearOffset: 0.05,
    fogFarOffset: 0.2,
    fogPulse: 0.06
  })
});

export function initializeAtmosphereSystem() {
  return ATMOSPHERE_RULES.calm;
}

export function updateAtmosphere(renderState, delta, time) {
  const rules = ATMOSPHERE_RULES[getNarrativeState()] ?? ATMOSPHERE_RULES.calm;
  const densityBreath = Math.sin(time * 0.24) * rules.fogPulse;
  const exposureBreath = Math.sin(time * 0.18) * 0.015;

  renderState.exposure = rules.exposure + exposureBreath;
  renderState.fogColor = rules.fogColor;
  renderState.fogNear = clamp(renderState.fogNear + rules.fogNearOffset + densityBreath, 1.05, 1.5);
  renderState.fogFar = clamp(renderState.fogFar + rules.fogFarOffset - densityBreath * 1.6, 6, 7.1);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export const atmosphereManager = {
  initializeAtmosphereSystem,
  updateAtmosphere
};
