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
import { createEnvironmentMap } from './environmentMap.js';
import {
  initializeNarrativeSystem,
  updateNarrative
} from './narrative.js';
import {
  applyRenderState,
  initializeRenderState,
  renderState
} from './renderState.js';
import { createPostProcessing } from './postprocessing.js';
import { createRenderer } from './renderer.js';
import { createScene } from './scene.js';
import {
  getActiveScene,
  registerScene,
  setActiveScene
} from './scenes.js';
import { updateShaderCore } from './shaderCore.js';
import { applySpatialDesign } from './spatial.js';
import { createHeroScene } from '../scenes/heroScene.js';
import {
  initializeInteraction,
  updateInteraction
} from '../universe/interaction.js';
import { createSceneManager } from '../world/sceneManager.js';

const ENGINE_INSTANCE_KEY = '__ACTIVE_THEORY_ENGINE__';

export function initializeEngine() {
  window[ENGINE_INSTANCE_KEY]?.dispose();

  const app = document.querySelector('#app');
  initializeIdentitySystem();

  const renderer = createRenderer();
  initializeCamera(renderer);
  const camera = getCamera();
  const brandMaterial = createBrandMaterial();
  const { scene, cube, ground, grid, background, environment } = createScene(brandMaterial);
  cube.visible = false;
  ground.visible = false;
  grid.visible = false;
  background.visible = false;
  environment.visible = false;

  registerScene('mainScene', scene);
  setActiveScene('mainScene');

  const activeScene = getActiveScene();
  const lights = createLights();
  const heroScene = createHeroScene();
  const sceneManager = createSceneManager({ heroScene });
  const interaction = initializeInteraction();
  activeScene.add(sceneManager.root);
  applySpatialDesign(renderState);
  initializeRenderState({ scene: activeScene, camera, renderer, cube, lights });
  const environmentMap = createEnvironmentMap({ renderer, scene: activeScene, cube });
  startCameraEmotion();
  initializeNarrativeSystem();
  initializeDepthSystem();
  initializeAtmosphereSystem();
  initializeCohesionSystem();

  app.replaceChildren(renderer.domElement, heroScene.overlay, heroScene.scrollHint);
  const postProcessing = createPostProcessing({
    renderer,
    scene: activeScene,
    camera
  });

  const stopEngineLoop = startLoop({
    scene: activeScene,
    camera,
    renderer,
    renderState,
    applyRenderState,
    renderFrame: postProcessing.render,
    updates: [
      updateNarrative,
      updateDepth,
      updateCameraEmotion,
      updateInteraction,
      updateAtmosphere,
      updateCohesion,
      updateShaderCore,
      sceneManager.update
    ]
  });

  let isDisposed = false;
  const engineInstance = {
    dispose() {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      stopEngineLoop();
      interaction.dispose();
      sceneManager.dispose();
      environmentMap.dispose();
      postProcessing.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };

  window[ENGINE_INSTANCE_KEY] = engineInstance;

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      engineInstance.dispose();

      if (window[ENGINE_INSTANCE_KEY] === engineInstance) {
        window[ENGINE_INSTANCE_KEY] = null;
      }
    });
  }
}
