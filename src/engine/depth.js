import { getNarrativeState } from './narrative.js';

const DEPTH_ZONES = Object.freeze({
  near: 'cube-pressure-zone',
  mid: 'camera-movement-zone',
  far: 'fog-background-zone'
});

const DEPTH_RULES = Object.freeze({
  calm: Object.freeze({
    camera: Object.freeze({
      motionScale: 0.55,
      depthDriftScale: 0.35,
      compression: 0
    }),
    fog: Object.freeze({
      nearOffset: 0.08,
      farOffset: 0.35,
      pressureMotion: 0.04
    }),
    cube: Object.freeze({
      scale: 1,
      pressure: 0.005,
      speed: 0.35
    })
  }),
  focus: Object.freeze({
    camera: Object.freeze({
      motionScale: 0.75,
      depthDriftScale: 0.28,
      compression: 0.22
    }),
    fog: Object.freeze({
      nearOffset: -0.12,
      farOffset: -0.45,
      pressureMotion: 0.08
    }),
    cube: Object.freeze({
      scale: 1.02,
      pressure: 0.006,
      speed: 0.5
    })
  }),
  drift: Object.freeze({
    camera: Object.freeze({
      motionScale: 1.25,
      depthDriftScale: 1.6,
      compression: -0.05
    }),
    fog: Object.freeze({
      nearOffset: -0.05,
      farOffset: 0.7,
      pressureMotion: 0.2
    }),
    cube: Object.freeze({
      scale: 1,
      pressure: 0.02,
      speed: 0.8
    })
  })
});

const depthState = {
  zones: DEPTH_ZONES
};

export function initializeDepthSystem() {
  return depthState;
}

export function updateDepth(renderState, delta, time) {
  const state = getNarrativeState();
  const rules = DEPTH_RULES[state] ?? DEPTH_RULES.calm;

  updateFogPressure(renderState, rules, time);
  updateCubePressure(renderState, rules, time);
}

export function getDepthZones() {
  return depthState.zones;
}

function updateFogPressure(renderState, rules, time) {
  const pressure = Math.sin(time * 0.22) * rules.fog.pressureMotion;
  renderState.fogNear += rules.fog.nearOffset + pressure;
  renderState.fogFar += rules.fog.farOffset - pressure * 1.8;
}

function updateCubePressure(renderState, rules, time) {
  const pressure = Math.sin(time * rules.cube.speed) * rules.cube.pressure;
  renderState.cubeScale = rules.cube.scale + pressure;
}

export const depthManager = {
  initializeDepthSystem,
  updateDepth,
  getDepthZones
};
