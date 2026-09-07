import '../style.css';
import {
  initializeAtmosphereSystem,
  updateAtmosphere
} from './atmosphere.js';
import {
  startCameraEmotion,
  updateCameraEmotion
} from './cameraEmotion.js';
import { disposeCamera, getCamera, initializeCamera } from './camera.js';
import {
  initializeCohesionSystem,
  updateCohesion
} from './cohesion.js';
import { initializeDepthSystem, updateDepth } from './depth.js';
import { initializeIdentitySystem } from './identity.js';
import { createLights } from './light.js';
import { getLoopStatus, startLoop } from './loop.js';
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
import { createFiveADataPanel } from '../ui/fiveA-data-panel/fiveADataPanel.js';
import { createBrandMindDataPanel } from '../ui/brandMind-data-panel/brandMindDataPanel.js';
import { createV2ConsumerProvider } from '../v2/runtime/consumerProvider.js';
import { resolveFiveAA3Demo } from '../v2/runtime/fiveAA3Demo.js';
import { buildVisualBindingPlan } from '../v2/binding/bindingPlanner.js';
import { createFiveAA3RendererAdapter } from '../v2/renderer-adapters/fiveAA3RendererAdapter.js';

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
  const a3Demo = resolveFiveAA3Demo(window.location.search, import.meta.env.DEV);
  const consumerProvider = createV2ConsumerProvider(a3Demo ? { fiveASnapshot: a3Demo.snapshot } : undefined);
  const fiveAConsumer = consumerProvider.getFiveA();
  const brandMindConsumer = consumerProvider.getBrandMind();
  const fiveADataPanel = createFiveADataPanel(fiveAConsumer);
  const brandMindDataPanel = createBrandMindDataPanel(brandMindConsumer);
  const sceneManager = createSceneManager({
    heroScene,
    camera,
    onFiveAPrimaryActivate() {
      fiveADataPanel.toggle('primary-sphere');
    },
    isFiveADataPanelOpen: fiveADataPanel.isOpen,
    onBrandMindPrimaryActivate() {
      brandMindDataPanel.toggle('primary-core');
    },
    isBrandMindDataPanelOpen: brandMindDataPanel.isOpen
  });
  const a3VisualState = a3Demo ? fiveAConsumer.buildVisualState() : null;
  const a3Plan = a3Demo ? buildVisualBindingPlan(a3VisualState) : null;
  const a3Adapter = a3Demo ? createFiveAA3RendererAdapter(
    sceneManager.scenes.find((candidate) => candidate.name === 'FiveAScene').resolveStageBindingTarget
  ) : null;
  a3Adapter?.apply(a3Plan);
  let proofFramesRemaining = a3Demo ? 120 : 0;
  function publishA3Proof() {
    if (proofFramesRemaining === 0 || --proofFramesRemaining !== 0) return;
    document.documentElement.dataset.v2FiveAA3Proof = JSON.stringify({
      state: a3Demo.state,
      canonical: fiveAConsumer.snapshot.fiveA.stages.A3,
      visualState: a3VisualState.fiveA.stages.A3,
      binding: a3Plan.fiveA.stages.filter((entry) => entry.stageId === 'A3'),
      execution: a3Adapter.getReport(),
      camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov },
      sampleTime: a3Demo.capture ? 12 : null,
      loop: getLoopStatus()
    });
  }
  const fiveADataPanelDebugRequested = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('fiveADataPanel') === '1';

  if (fiveADataPanelDebugRequested) {
    fiveADataPanel.open('debug-query');
  }
  const brandMindDataPanelDebugRequested = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('brandMindDataPanel') === '1';

  if (brandMindDataPanelDebugRequested) {
    brandMindDataPanel.open('debug-query');
  }
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

  app.replaceChildren(
    renderer.domElement,
    heroScene.overlay,
    heroScene.scrollHint,
    fiveADataPanel.element,
    brandMindDataPanel.element
  );
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
    sampleTime: a3Demo?.capture ? 12 : null,
    updates: [
      updateNarrative,
      updateDepth,
      updateCameraEmotion,
      updateInteraction,
      updateAtmosphere,
      updateCohesion,
      updateShaderCore,
      sceneManager.update,
      publishA3Proof
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
      fiveADataPanel.destroy();
      brandMindDataPanel.destroy();
      interaction.dispose();
      a3Adapter?.dispose();
      delete document.documentElement.dataset.v2FiveAA3Proof;
      sceneManager.dispose();
      environmentMap.dispose();
      postProcessing.dispose();
      disposeCamera();
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
