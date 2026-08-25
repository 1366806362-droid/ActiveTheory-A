import * as THREE from 'three';
import { readViewportMetrics, subscribeViewport } from './viewport.js';

let camera = null;
let disposeViewport = null;

export function initializeCamera(renderer) {
  disposeViewport?.();
  const viewport = readViewportMetrics();
  camera = new THREE.PerspectiveCamera(
    60,
    viewport.aspect,
    0.1,
    1000
  );

  camera.position.set(0, 2, 5);
  camera.lookAt(0, 0, 0);

  disposeViewport = subscribeViewport((nextViewport) => {
    camera.aspect = nextViewport.aspect;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(nextViewport.pixelRatio);
    renderer.setSize(nextViewport.width, nextViewport.height);
    if (import.meta.env.DEV) {
      window.__ACTIVE_THEORY_VIEWPORT__ = Object.freeze({
        ...nextViewport,
        cameraAspect: camera.aspect,
        cameraFov: camera.fov
      });
    }
  });

  return camera;
}

export function getCamera() {
  return camera;
}

export function disposeCamera() {
  disposeViewport?.();
  disposeViewport = null;
  camera = null;
  if (typeof window !== 'undefined') delete window.__ACTIVE_THEORY_VIEWPORT__;
}
