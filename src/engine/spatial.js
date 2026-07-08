import { renderState } from './renderState.js';

const SPATIAL_LAYERS = Object.freeze({
  foreground: 'cube',
  midground: 'implicit-reference-space',
  background: 'fog-environment'
});

const spatialState = {
  layers: SPATIAL_LAYERS,
  subject: null,
  camera: null
};

export function applySpatialDesign(state = renderState) {
  spatialState.subject = 'cube';
  spatialState.camera = 'mainCamera';

  state.cubePosition.x = -0.32;
  state.cubePosition.y = 0.12;
  state.cubePosition.z = 0;
  state.cameraPosition.x = 1.05;
  state.cameraPosition.y = 1.52;
  state.cameraPosition.z = 3.35;
  state.cameraOffset.targetX = 0.08;
  state.cameraOffset.targetY = 0.28;
  state.cameraOffset.targetZ = 0;

  return spatialState;
}

export function getSpatialState() {
  return spatialState;
}

export const spatialManager = {
  applySpatialDesign,
  getSpatialState
};
