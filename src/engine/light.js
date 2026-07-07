import * as THREE from 'three';

const lightManager = {
  ambientLight: null,
  keyLight: null,
  rimLight: null,
  fillLight: null
};

export function createLights() {
  lightManager.ambientLight = new THREE.AmbientLight();

  lightManager.keyLight = new THREE.DirectionalLight();

  lightManager.rimLight = new THREE.PointLight();

  lightManager.fillLight = new THREE.DirectionalLight();

  return lightManager;
}

export { lightManager };
