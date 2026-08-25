import * as THREE from 'three';
import { readViewportMetrics } from './viewport.js';

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const viewport = readViewportMetrics();

  renderer.setPixelRatio(viewport.pixelRatio);
  renderer.setSize(viewport.width, viewport.height);

  return renderer;
}
