import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const HDR_ENVIRONMENT_PATH = '/hdr/active-theory-dark-studio.hdr';
const ENV_MAP_INTENSITY = 0.42;

export function createEnvironmentMap({ renderer, scene, cube }) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const loader = new HDRLoader();
  const state = {
    disposed: false,
    envMap: null,
    hdrTexture: null
  };

  pmremGenerator.compileEquirectangularShader();

  loader.load(
    HDR_ENVIRONMENT_PATH,
    (hdrTexture) => {
      if (state.disposed) {
        hdrTexture.dispose();
        return;
      }

      state.hdrTexture = hdrTexture;
      hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
      state.envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
      scene.environment = state.envMap;

      if (cube?.material) {
        cube.material.envMapIntensity = ENV_MAP_INTENSITY;
        cube.material.needsUpdate = true;
      }

      hdrTexture.dispose();
      pmremGenerator.dispose();
    },
    undefined,
    (error) => {
      console.warn('HDR environment failed to load.', error);
      pmremGenerator.dispose();
    }
  );

  return {
    intensity: ENV_MAP_INTENSITY,
    dispose() {
      state.disposed = true;

      if (scene.environment === state.envMap) {
        scene.environment = null;
      }

      if (state.envMap) {
        state.envMap.dispose();
        state.envMap = null;
      }

      if (state.hdrTexture) {
        state.hdrTexture.dispose();
        state.hdrTexture = null;
      }

      pmremGenerator.dispose();
    }
  };
}

export const environmentMapManager = {
  createEnvironmentMap
};
