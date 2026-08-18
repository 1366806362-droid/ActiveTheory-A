import * as THREE from 'three';
import { GALAXY_V3_ASSET_TYPES } from './galaxyV3Config.js';

const PLACEHOLDER_COLOR = 0x62d9f4;

export function createGalaxyV3HeroAsset(config) {
  validateHeroAssetConfig(config);

  if (config.type !== 'placeholder') {
    if (!config.source) {
      throw createAssetError('GALAXY_V3_ASSET_SOURCE_MISSING', 'Hero asset source is missing.');
    }
    throw createAssetError(
      'GALAXY_V3_ASSET_LOADER_PENDING',
      `Hero asset loader for ${config.type} is not enabled in Foundation V1.`
    );
  }

  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: PLACEHOLDER_COLOR,
    transparent: true,
    opacity: config.opacity * config.colorIntensity,
    depthWrite: false,
    side: THREE.DoubleSide,
    wireframe: true
  });
  const geometry = new THREE.RingGeometry(0.32, 1, 64, 3);
  const proxy = new THREE.Mesh(geometry, material);
  const coreGeometry = new THREE.RingGeometry(0.08, 0.18, 36, 1);
  const coreMaterial = material.clone();
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const basePosition = new THREE.Vector3().fromArray(config.position);
  const baseScale = new THREE.Vector3().fromArray(config.scale);
  const initialCameraPosition = new THREE.Vector3();
  let hasInitialCamera = false;

  group.name = 'GalaxyV3HeroAssetPlaceholder';
  group.position.copy(basePosition);
  group.position.z += config.depthBias;
  group.rotation.fromArray(config.rotation);
  group.scale.copy(baseScale);
  group.visible = config.enabled;
  proxy.name = 'GalaxyV3HeroAssetWireframeProxy';
  proxy.scale.set(1.7, 0.72, 1);
  proxy.renderOrder = 5;
  core.name = 'GalaxyV3HeroAssetCoreProxy';
  core.position.z = 0.012;
  core.scale.set(1.25, 0.68, 1);
  core.renderOrder = 6;
  coreMaterial.opacity = Math.min(1, config.opacity * (0.7 + config.bloomIntensity));
  group.add(proxy, core);

  function update(camera) {
    if (!camera || config.parallaxStrength <= 0) return;
    if (!hasInitialCamera) {
      initialCameraPosition.copy(camera.position);
      hasInitialCamera = true;
    }

    group.position.x = basePosition.x
      + (camera.position.x - initialCameraPosition.x) * config.parallaxStrength;
    group.position.y = basePosition.y
      + (camera.position.y - initialCameraPosition.y) * config.parallaxStrength;
    group.position.z = basePosition.z + config.depthBias;
  }

  function setEnabled(enabled) {
    group.visible = Boolean(enabled) && config.enabled;
  }

  function dispose() {
    geometry.dispose();
    coreGeometry.dispose();
    material.dispose();
    coreMaterial.dispose();
    group.clear();
  }

  return {
    group,
    type: config.type,
    placeholder: true,
    config,
    update,
    setEnabled,
    dispose
  };
}

export function validateHeroAssetConfig(config) {
  if (!config || typeof config !== 'object') {
    throw createAssetError('GALAXY_V3_ASSET_CONFIG_INVALID', 'Hero asset config is required.');
  }
  if (!GALAXY_V3_ASSET_TYPES.includes(config.type)) {
    throw createAssetError('GALAXY_V3_ASSET_TYPE_UNSUPPORTED', `Unsupported asset type: ${config.type}`);
  }
  for (const key of ['position', 'rotation', 'scale']) {
    if (!Array.isArray(config[key]) || config[key].length !== 3
      || config[key].some((value) => !Number.isFinite(value))) {
      throw createAssetError('GALAXY_V3_ASSET_TRANSFORM_INVALID', `${key} must contain three finite numbers.`);
    }
  }
  for (const key of [
    'opacity',
    'depthBias',
    'colorIntensity',
    'bloomIntensity',
    'parallaxStrength'
  ]) {
    if (!Number.isFinite(config[key])) {
      throw createAssetError('GALAXY_V3_ASSET_VALUE_INVALID', `${key} must be finite.`);
    }
  }
}

function createAssetError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
