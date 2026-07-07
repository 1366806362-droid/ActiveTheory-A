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

  state.cubePosition.x = -0.38;
  state.cubePosition.y = 0.08;
  state.cubePosition.z = 0;
  state.cameraPosition.x = 1.2;
  state.cameraPosition.y = 1.35;
  state.cameraPosition.z = 3.85;
  state.cameraOffset.targetX = 0.16;
  state.cameraOffset.targetY = 0.2;
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
