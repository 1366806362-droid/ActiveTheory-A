import * as THREE from 'three';

export const HERO_GALAXY_VERSION_V1 = 'v1';
export const HERO_GALAXY_VERSION_V2 = 'v2';

export const HERO_GALAXY_V2_CONFIG = Object.freeze({
  version: HERO_GALAXY_VERSION_V2,
  urls: Object.freeze({
    color: '/textures/hero/galaxy/main-galaxy-v2.webp'
  }),
  textureLayer: Object.freeze({
    outerRadius: 0.78,
    extentScale: 2.7,
    localScale: 0.84,
    localPositionZ: 0,
    uvScale: 1,
    uvOffsetX: -0.001,
    uvOffsetY: 0.001,
    uvRotation: 0,
    coreUvX: 0.499,
    coreUvY: 0.501,
    localRotationX: 0,
    localRotationY: 0,
    localRotationZ: 0,
    colorAlphaAsset: true,
    colorAssetSaturation: 0.93,
    colorAssetContrast: 0.955,
    alphaFeatherPixels: 1.1,
    textureSize: 2048
  }),
  composition: Object.freeze({
    galaxyGroupPosition: Object.freeze([0.12, 0.4, 0]),
    galaxyGroupScale: 1.42,
    mainFramePosition: Object.freeze([0.45, -0.05, 0]),
    mainFrameScale: 0.82,
    mainFrameRotationDegrees: Object.freeze([2, 0, 0]),
    galaxyRootPosition: Object.freeze([0.46, -0.04, 0]),
    galaxyRootScale: 1.5,
    visualPosition: Object.freeze([0.12, 0.39, 0]),
    visualScale: 0.94
  }),
  layerWeights: Object.freeze({
    texture: 0.89,
    shell: 0.035,
    arms: 0.12,
    nebula: 0.03,
    dust: 0.03,
    highlights: 0.18,
    innerStarDisk: 0.12,
    coreParticles: 0.08,
    warmCoreGlow: 0
  })
});

const HERO_GALAXY_V2_MAIN_FRAME_QUATERNION = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(
    ...HERO_GALAXY_V2_CONFIG.composition.mainFrameRotationDegrees.map(
      (degrees) => THREE.MathUtils.degToRad(degrees)
    ),
    'XYZ'
  )
);

export function readHeroGalaxyVersionState() {
  if (typeof window === 'undefined') {
    return Object.freeze({
      version: HERO_GALAXY_VERSION_V2,
      isV1: false,
      isV2: true,
      diagnostics: false
    });
  }

  const params = new URLSearchParams(window.location.search);
  const version = params.get('galaxyVersion') === HERO_GALAXY_VERSION_V1
    ? HERO_GALAXY_VERSION_V1
    : HERO_GALAXY_VERSION_V2;

  return Object.freeze({
    version,
    isV1: version === HERO_GALAXY_VERSION_V1,
    isV2: version === HERO_GALAXY_VERSION_V2,
    diagnostics: import.meta.env.DEV && params.get('galaxyDiagnostics') === '1'
  });
}

export function getHeroGalaxyVersionConfig(version) {
  return version === HERO_GALAXY_VERSION_V2 ? HERO_GALAXY_V2_CONFIG : null;
}

export function getHeroGalaxyMainFrameQuaternion(version) {
  return version === HERO_GALAXY_VERSION_V2
    ? HERO_GALAXY_V2_MAIN_FRAME_QUATERNION.clone()
    : new THREE.Quaternion();
}
