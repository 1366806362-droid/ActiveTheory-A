import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export function createPostProcessing({ renderer, scene, camera }) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.52,
    0.52,
    0.58
  );
  const outputPass = new OutputPass();

  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  function resizePostProcessing() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(width, height);
    bloomPass.setSize(width, height);
  }

  window.addEventListener('resize', resizePostProcessing);

  return {
    composer,
    render() {
      composer.render();
    },
    dispose() {
      window.removeEventListener('resize', resizePostProcessing);
      composer.dispose();
    }
  };
}

export const postProcessingManager = {
  createPostProcessing
};
