import '../style.css';
import {
  initializeAtmosphereSystem,
  updateAtmosphere
} from './atmosphere.js';
import {
  startCameraEmotion,
  updateCameraEmotion
} from './cameraEmotion.js';
import { getCamera, initializeCamera } from './camera.js';
import {
  initializeCohesionSystem,
  updateCohesion
} from './cohesion.js';
import { initializeDepthSystem, updateDepth } from './depth.js';
import { initializeIdentitySystem } from './identity.js';
import { createLights } from './light.js';
import { startLoop } from './loop.js';
import { createBrandMaterial } from './material.js';
import {
  initializeNarrativeSystem,
  updateNarrative
} from './narrative.js';
import {
  applyRenderState,
  initializeRenderState,
  renderState
} from './renderState.js';
import { createRenderer } from './renderer.js';
import { createScene } from './scene.js';
import {
  getActiveScene,
  registerScene,
  setActiveScene
} from './scenes.js';
import { applySpatialDesign } from './spatial.js';

export function initializeEngine() {
  const app = document.querySelector('#app');
  initializeIdentitySystem();

  const renderer = createRenderer();
  initializeCamera(renderer);
  const camera = getCamera();
  const brandMaterial = createBrandMaterial();
  const { scene, cube } = createScene(brandMaterial);

  registerScene('mainScene', scene);
  setActiveScene('mainScene');

  const activeScene = getActiveScene();
  const lights = createLights();
  applySpatialDesign(renderState);
  initializeRenderState({ scene: activeScene, camera, renderer, cube, lights });
  startCameraEmotion();
  initializeNarrativeSystem();
  initializeDepthSystem();
  initializeAtmosphereSystem();
  initializeCohesionSystem();

  app.appendChild(renderer.domElement);

  startLoop({
    scene: activeScene,
    camera,
    renderer,
    renderState,
    applyRenderState,
    updates: [
      updateNarrative,
      updateDepth,
      updateCameraEmotion,
      updateAtmosphere,
      updateCohesion
    ]
  });
}
