import * as THREE from 'three';
import { GALAXY_V3_CONFIG, GALAXY_V3_LAYER_ORDER } from './galaxyV3Config.js';
import { createGalaxyV3HeroAsset } from './galaxyV3HeroAsset.js';

export function createGalaxyV3Root({
  state,
  config = GALAXY_V3_CONFIG,
  gpuGalaxy = null,
  businessNebula = null,
  fallbackGroup = null
}) {
  const group = new THREE.Group();
  const layers = createLayers();
  let heroAsset = null;
  let fallbackUsed = false;
  let fallbackReason = null;

  group.name = 'GalaxyV3Root';
  group.add(...GALAXY_V3_LAYER_ORDER.map(({ id }) => layers[id]));

  try {
    heroAsset = createGalaxyV3HeroAsset(config.galaxyHeroAsset);
    layers.heroAsset.add(heroAsset.group);
  } catch (error) {
    fallbackUsed = true;
    fallbackReason = Object.freeze({
      code: error.code ?? 'GALAXY_V3_ASSET_LOAD_FAILED',
      message: error.message
    });
  }

  if (gpuGalaxy?.group) layers.gpuStars.add(gpuGalaxy.group);
  if (businessNebula?.group) layers.businessNebula.add(businessNebula.group);
  if (fallbackGroup) {
    fallbackGroup.name = 'GalaxyV3FallbackGalaxyLayer';
    layers.heroAsset.add(fallbackGroup);
  }

  const fallbackMode = fallbackUsed
    ? (gpuGalaxy ? 'gpu-v2-plus-legacy' : 'legacy-procedural')
    : 'none';

  applyVisibility();
  publishStatus();

  function applyVisibility() {
    layers.heroAsset.visible = state.debug.hero;
    heroAsset?.setEnabled(state.debug.hero);
    layers.gpuStars.visible = state.useGpuStars && state.debug.gpuStars;
    layers.foregroundDust.visible = state.debug.foreground;
    layers.businessNebula.visible = state.debug.businessNebula;
    if (fallbackGroup) {
      fallbackGroup.visible = fallbackUsed && state.debug.hero;
    }
  }

  function update({ camera } = {}) {
    if (layers.heroAsset.visible && !fallbackUsed) {
      heroAsset?.update(camera);
    }
  }

  function getStatus() {
    return Object.freeze({
      enabled: true,
      mode: config.mode,
      assetType: config.galaxyHeroAsset.type,
      placeholder: heroAsset?.placeholder === true,
      fallbackUsed,
      fallbackMode,
      fallbackReason,
      useGpuStars: state.useGpuStars,
      layers: Object.freeze(Object.fromEntries(
        GALAXY_V3_LAYER_ORDER.map(({ id, name, depth, renderOrder }) => [id, Object.freeze({
          name,
          depth,
          renderOrder,
          visible: layers[id].visible,
          childCount: layers[id].children.length
        })])
      )),
      sharedBusinessNebula: businessNebula?.group === layers.businessNebula.children[0],
      sharedGpuGalaxy: gpuGalaxy?.group === layers.gpuStars.children[0]
    });
  }

  function publishStatus() {
    if (typeof window === 'undefined') return;
    const status = getStatus();
    window.__ACTIVE_THEORY_GALAXY_V3__ = status;
    document.documentElement.dataset.galaxyV3 = JSON.stringify(status);
  }

  function dispose() {
    heroAsset?.dispose();
    for (const layer of Object.values(layers)) layer.clear();
    group.clear();
    if (typeof window !== 'undefined') {
      delete window.__ACTIVE_THEORY_GALAXY_V3__;
      delete document.documentElement.dataset.galaxyV3;
    }
  }

  return {
    group,
    layers,
    heroAsset,
    fallbackUsed,
    fallbackMode,
    fallbackReason,
    update,
    getStatus,
    applyVisibility,
    dispose
  };
}

function createLayers() {
  return Object.fromEntries(GALAXY_V3_LAYER_ORDER.map(({ id, name, renderOrder }) => {
    const layer = new THREE.Group();
    layer.name = name;
    layer.renderOrder = renderOrder;
    return [id, layer];
  }));
}
