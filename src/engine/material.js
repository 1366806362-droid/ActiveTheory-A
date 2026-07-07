import * as THREE from 'three';
import { getIdentity } from './identity.js';

export function createBrandMaterial() {
  const identity = getIdentity();

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x0a4b8a),
    metalness: 0.4,
    roughness: 0.7,
    emissive: new THREE.Color(0x0a2a4a),
    emissiveIntensity: 0.85
  });
}

export const materialManager = {
  createBrandMaterial
};
