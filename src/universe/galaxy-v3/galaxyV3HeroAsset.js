import * as THREE from 'three';
import { GALAXY_V3_ASSET_TYPES } from './galaxyV3Config.js';

const PLACEHOLDER_COLOR = 0x62d9f4;

export function createGalaxyV3HeroAsset(config, { layerVisibility = {} } = {}) {
  validateHeroAssetConfig(config);

  if (config.type === 'ldi-5-layer') {
    return createLdiHeroAsset(config, layerVisibility);
  }

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

function createLdiHeroAsset(config, layerVisibility) {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(16 / 9, 1);
  const loader = new THREE.TextureLoader();
  const textures = [];
  const materials = [];
  const meshes = [];
  const basePosition = new THREE.Vector3().fromArray(config.position);
  const initialCameraPosition = new THREE.Vector3();
  let hasInitialCamera = false;

  group.name = 'GalaxyV3HeroAssetV4LDI';
  group.position.copy(basePosition);
  group.position.z += config.depthBias;
  group.rotation.fromArray(config.rotation);
  group.scale.fromArray(config.scale);
  group.visible = config.enabled;

  for (const layer of config.layers) {
    const texture = loader.load(layer.source);
    texture.name = `GalaxyV4Texture:${layer.id}`;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.premultiplyAlpha = false;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: config.opacity,
      premultipliedAlpha: false,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `GalaxyV4LDI:${layer.id}`;
    mesh.position.z = layer.z;
    mesh.renderOrder = layer.renderOrder;
    mesh.visible = layerVisibility[layer.id] !== false;
    mesh.userData.parallaxFactor = layer.parallaxFactor;
    group.add(mesh);
    textures.push(texture);
    materials.push(material);
    meshes.push(mesh);
  }

  function update(camera, interaction = null) {
    if (!camera || config.parallaxStrength <= 0) return;
    if (!hasInitialCamera) {
      initialCameraPosition.copy(camera.position);
      hasInitialCamera = true;
    }
    const cameraX = camera.position.x - initialCameraPosition.x;
    const cameraY = camera.position.y - initialCameraPosition.y;
    const pointerX = interaction?.parallaxX ?? 0;
    const pointerY = interaction?.parallaxY ?? 0;

    for (const mesh of meshes) {
      const strength = config.parallaxStrength * mesh.userData.parallaxFactor;
      mesh.position.x = pointerX * strength + cameraX * strength * 0.28;
      mesh.position.y = pointerY * strength * 0.62 + cameraY * strength * 0.18;
    }
  }

  function setEnabled(enabled) {
    group.visible = Boolean(enabled) && config.enabled;
  }

  function dispose() {
    geometry.dispose();
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    group.clear();
  }

  return {
    group,
    type: config.type,
    placeholder: false,
    config,
    update,
    setEnabled,
    dispose,
    getStatus() {
      return Object.freeze({
        layerCount: meshes.length,
        drawCalls: meshes.filter((mesh) => mesh.visible).length,
        layers: Object.freeze(meshes.map((mesh, index) => Object.freeze({
          id: config.layers[index].id,
          source: config.layers[index].source,
          z: config.layers[index].z,
          visible: mesh.visible,
          renderOrder: mesh.renderOrder,
          parallaxFactor: mesh.userData.parallaxFactor
        })))
      });
    }
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
  if (config.type === 'ldi-5-layer'
    && (!Array.isArray(config.layers) || config.layers.length !== 5)) {
    throw createAssetError('GALAXY_V3_LDI_LAYERS_INVALID', 'LDI hero asset requires five layers.');
  }
}

function createAssetError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
