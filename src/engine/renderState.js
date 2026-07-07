import * as THREE from 'three';

export const renderState = {
  fogColor: '#020308',
  fogNear: 1.2,
  fogFar: 6.5,
  exposure: 0.76,
  cubeScale: 1,
  cubePosition: {
    x: -0.38,
    y: -0.12,
    z: 0
  },
  cubeColor: '#0a4b8a',
  emissive: 0.6,
  light: {
    key: {
      color: '#8bbdff',
      intensity: 3.6,
      position: { x: 6, y: 5.5, z: 1.5 }
    },
    rim: {
      color: '#00e5ff',
      intensity: 3.2,
      position: { x: -4.5, y: 2.4, z: -3.2 }
    },
    fill: {
      color: '#081827',
      intensity: 0.16,
      position: { x: -4, y: 1, z: 3 }
    },
    ambient: {
      color: '#02050a',
      intensity: 0.035
    }
  },
  cameraPosition: {
    x: 1.2,
    y: 1.8,
    z: 3.6
  },
  cameraOffset: {
    x: 0,
    y: 0,
    z: 0,
    targetX: 0.1,
    targetY: 0.22,
    targetZ: 0
  }
};

const renderTargets = {
  scene: null,
  camera: null,
  renderer: null,
  cube: null,
  lights: {
    ambientLight: null,
    keyLight: null,
    rimLight: null,
    fillLight: null
  },
  baseCubeRotation: {
    x: 0,
    y: 0
  }
};

const reusableColors = {
  background: new THREE.Color('#000000'),
  fog: new THREE.Color(renderState.fogColor),
  cube: new THREE.Color(renderState.cubeColor),
  emissive: new THREE.Color('#0a2a4a'),
  ambientLight: new THREE.Color(renderState.light.ambient.color),
  keyLight: new THREE.Color(renderState.light.key.color),
  rimLight: new THREE.Color(renderState.light.rim.color),
  fillLight: new THREE.Color(renderState.light.fill.color)
};

export function initializeRenderState({ scene, camera, renderer, cube, lights }) {
  renderTargets.scene = scene;
  renderTargets.camera = camera;
  renderTargets.renderer = renderer;
  renderTargets.cube = cube;
  renderTargets.lights = lights;
  renderTargets.baseCubeRotation = {
    x: cube.rotation.x,
    y: cube.rotation.y
  };

  if (renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = renderState.exposure;
  }

  if (scene) {
    scene.background = reusableColors.background;
    scene.fog = new THREE.Fog(reusableColors.fog, renderState.fogNear, renderState.fogFar);

    if (lights) {
      scene.add(
        lights.ambientLight,
        lights.keyLight,
        lights.rimLight,
        lights.fillLight
      );
    }
  }

  applyRenderState(renderState);

  return renderState;
}

export function getRenderState() {
  return renderState;
}

export function applyRenderState(state, time = 0) {
  const { scene, camera, renderer, cube, lights } = renderTargets;

  if (renderer) {
    renderer.toneMappingExposure = state.exposure;
  }

  if (scene) {
    scene.background = reusableColors.background;

    if (scene.fog) {
      reusableColors.fog.set(state.fogColor);
      scene.fog.color.copy(reusableColors.fog);
      scene.fog.near = state.fogNear;
      scene.fog.far = state.fogFar;
    }
  }

  if (cube) {
    reusableColors.cube.set(state.cubeColor);
    cube.material.color.copy(reusableColors.cube);
    cube.material.emissive.copy(reusableColors.emissive);
    cube.material.emissiveIntensity = state.emissive;
    cube.position.set(state.cubePosition.x, state.cubePosition.y, state.cubePosition.z);
    cube.scale.setScalar(state.cubeScale);
    cube.rotation.x = renderTargets.baseCubeRotation.x + time * 0.5;
    cube.rotation.y = renderTargets.baseCubeRotation.y + time * 0.8;
  }

  if (lights) {
    applyAmbientLight(lights.ambientLight, state.light.ambient);
    applyPositionedLight(lights.keyLight, state.light.key, reusableColors.keyLight);
    applyPositionedLight(lights.rimLight, state.light.rim, reusableColors.rimLight);
    applyPositionedLight(lights.fillLight, state.light.fill, reusableColors.fillLight);
  }

  if (camera && cube) {
    camera.position.set(
      state.cameraPosition.x + state.cameraOffset.x,
      state.cameraPosition.y + state.cameraOffset.y,
      state.cameraPosition.z + state.cameraOffset.z
    );
    camera.lookAt(
      cube.position.x + state.cameraOffset.targetX,
      cube.position.y + state.cameraOffset.targetY,
      cube.position.z + state.cameraOffset.targetZ
    );
  }
}

function applyAmbientLight(light, state) {
  if (!light) {
    return;
  }

  reusableColors.ambientLight.set(state.color);
  light.color.copy(reusableColors.ambientLight);
  light.intensity = state.intensity;
}

function applyPositionedLight(light, state, reusableColor) {
  if (!light) {
    return;
  }

  reusableColor.set(state.color);
  light.color.copy(reusableColor);
  light.intensity = state.intensity;
  light.position.set(state.position.x, state.position.y, state.position.z);
}
