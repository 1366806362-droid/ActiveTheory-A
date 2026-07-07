import * as THREE from 'three';
import { getIdentity } from './identity.js';
import { applyShaderCore } from './shaderCore.js';

export function createBrandMaterial() {
  const identity = getIdentity();

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x061f3a),
    metalness: 0.74,
    roughness: 0.32,
    emissive: new THREE.Color(0x061f36),
    emissiveIntensity: 0.5,
    envMapIntensity: 0.42
  });

  return applyShaderCore(material);
}

export const materialManager = {
  createBrandMaterial
};
