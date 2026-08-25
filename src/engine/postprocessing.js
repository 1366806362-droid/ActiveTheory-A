import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  GEO_CINEMATIC_BLOOM_LAYER,
  createGeoCinematicGradeShader,
  prepareGeoCinematicGradeScene,
  resolveGeoCinematicGrade
} from '../scenes/geo/geoCinematicGrade.js';
import { readViewportMetrics, subscribeViewport } from './viewport.js';

export function createPostProcessing({ renderer, scene, camera }) {
  const initialViewport = readViewportMetrics();
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(initialViewport.width, initialViewport.height),
    0.3,
    0.11,
    0.78
  );
  const outputPass = new OutputPass();
  const gradeSelection = resolveGeoCinematicGrade();
  const gradeTarget = gradeSelection.enabled
    ? new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false
    })
    : null;
  const gradeController = prepareGeoCinematicGradeScene(scene, gradeSelection);
  const gradePass = gradeSelection.enabled
    ? new ShaderPass(createGeoCinematicGradeShader(
      null,
      gradeSelection.debugLayer
    ))
    : null;
  const reusableClearColor = new THREE.Color();
  const showBloom = readDebugFlag('debugMainGalaxyOnly', false)
    ? false
    : readDebugFlag('showBloom', true);

  bloomPass.threshold = 0.78;
  bloomPass.strength = 0.3;
  bloomPass.radius = 0.11;

  composer.setPixelRatio(initialViewport.pixelRatio);
  composer.setSize(initialViewport.width, initialViewport.height);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  if (gradePass) composer.addPass(gradePass);
  composer.addPass(outputPass);
  bloomPass.enabled = showBloom;
  if (gradePass) {
    gradePass.uniforms.tBloom.value = gradeTarget.texture;
    gradePass.enabled = false;
  }
  resizeGradeTarget();

  function resizePostProcessing(viewport) {
    const { width, height, pixelRatio } = viewport;
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    bloomPass.setSize(width, height);
    resizeGradeTarget(viewport);
  }

  const disposeViewport = subscribeViewport(resizePostProcessing);

  return {
    composer,
    render() {
      const gradeActive = gradeController.isSceneActive();
      if (gradePass) {
        gradePass.enabled = gradeActive;
        bloomPass.enabled = gradeActive ? false : showBloom;
      }
      if (gradeActive) renderSelectiveBloom();
      composer.render();
    },
    dispose() {
      disposeViewport();
      gradeController.dispose();
      gradePass?.material.dispose();
      gradeTarget?.dispose();
      composer.dispose();
    }
  };

  function resizeGradeTarget(viewport = readViewportMetrics()) {
    if (!gradeTarget || !gradePass) return;
    const pixelRatio = Math.min(renderer.getPixelRatio(), 1.25);
    const width = Math.max(1, Math.floor(viewport.width * 0.5 * pixelRatio));
    const height = Math.max(1, Math.floor(viewport.height * 0.5 * pixelRatio));

    gradeTarget.setSize(width, height);
    gradePass.uniforms.uBloomTexel.value.set(1 / width, 1 / height);
  }

  function renderSelectiveBloom() {
    const previousTarget = renderer.getRenderTarget();
    const previousBackground = scene.background;
    const previousLayerMask = camera.layers.mask;
    const previousAutoClear = renderer.autoClear;
    const previousClearAlpha = renderer.getClearAlpha();

    renderer.getClearColor(reusableClearColor);
    scene.background = null;
    camera.layers.set(GEO_CINEMATIC_BLOOM_LAYER);
    renderer.autoClear = true;
    renderer.setRenderTarget(gradeTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    camera.layers.mask = previousLayerMask;
    scene.background = previousBackground;
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(reusableClearColor, previousClearAlpha);
    renderer.autoClear = previousAutoClear;
  }
}

export const postProcessingManager = {
  createPostProcessing
};

function readDebugFlag(name, fallback) {
  const params = new URLSearchParams(window.location.search);

  if (!params.has(name)) {
    return fallback;
  }

  return params.get(name) !== '0' && params.get(name) !== 'false';
}
