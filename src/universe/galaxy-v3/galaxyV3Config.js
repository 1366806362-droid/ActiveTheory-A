export const GALAXY_V3_ASSET_TYPES = Object.freeze([
  'placeholder',
  'transparent-image',
  'texture-sequence',
  'alpha-video',
  'glb',
  'mesh',
  'ldi-5-layer'
]);

export const GALAXY_V3_LAYER_ORDER = Object.freeze([
  Object.freeze({ id: 'rearDust', name: 'RearDustLayer', depth: 'far', renderOrder: 1 }),
  Object.freeze({ id: 'gpuStars', name: 'GPUStarLayer', depth: 'mid-far', renderOrder: 3 }),
  Object.freeze({ id: 'heroAsset', name: 'HeroAssetLayer', depth: 'mid', renderOrder: 5 }),
  Object.freeze({ id: 'businessNebula', name: 'BusinessNebulaLayer', depth: 'mid-near', renderOrder: 7 }),
  Object.freeze({ id: 'foregroundDust', name: 'ForegroundDustLayer', depth: 'near', renderOrder: 9 }),
  Object.freeze({ id: 'optionalGlow', name: 'OptionalGlowLayer', depth: 'near', renderOrder: 10 })
]);

export const GALAXY_V3_CONFIG = Object.freeze({
  schemaVersion: '1.0.0',
  mode: 'blender-hybrid-foundation',
  manifestUrl: '/assets/galaxy-v3/manifest.json',
  v3UseGpuStars: true,
  layerOrder: GALAXY_V3_LAYER_ORDER,
  galaxyHeroAsset: Object.freeze({
    type: 'placeholder',
    source: null,
    alphaSource: null,
    depthSource: null,
    position: Object.freeze([0.95, 0.03, 0.02]),
    rotation: Object.freeze([0.35, -0.04, 0.77]),
    scale: Object.freeze([0.82, 0.82, 0.82]),
    opacity: 0.38,
    depthBias: 0.02,
    colorIntensity: 0.82,
    bloomIntensity: 0.18,
    parallaxStrength: 0.018,
    enabled: true
  })
});

const GALAXY_V4_LDI_LAYERS = Object.freeze([
  Object.freeze({ id: 'background', source: '/assets/galaxy-v3/hero/v4/galaxy-v4-bg.webp', z: -0.04, renderOrder: 5, parallaxFactor: 0 }),
  Object.freeze({ id: 'farArm', source: '/assets/galaxy-v3/hero/v4/galaxy-v4-far-arm.webp', z: -0.02, renderOrder: 6, parallaxFactor: 0.24 }),
  Object.freeze({ id: 'core', source: '/assets/galaxy-v3/hero/v4/galaxy-v4-core.webp', z: 0, renderOrder: 7, parallaxFactor: 0.42 }),
  Object.freeze({ id: 'nearArm', source: '/assets/galaxy-v3/hero/v4/galaxy-v4-near-arm.webp', z: 0.02, renderOrder: 8, parallaxFactor: 0.7 }),
  Object.freeze({ id: 'foreground', source: '/assets/galaxy-v3/hero/v4/galaxy-v4-foreground.webp', z: 0.04, renderOrder: 9, parallaxFactor: 1 })
]);

export const GALAXY_V3_V4_CONFIG = Object.freeze({
  ...GALAXY_V3_CONFIG,
  mode: 'v3-hero-asset-v4-ldi',
  galaxyHeroAsset: Object.freeze({
    ...GALAXY_V3_CONFIG.galaxyHeroAsset,
    type: 'ldi-5-layer',
    source: GALAXY_V4_LDI_LAYERS[2].source,
    layers: GALAXY_V4_LDI_LAYERS,
    position: Object.freeze([0.58, -0.06, 0]),
    rotation: Object.freeze([-0.38, 0, 0]),
    scale: Object.freeze([2.03, 2.03, 1]),
    opacity: 1,
    colorIntensity: 1,
    bloomIntensity: 0.04,
    parallaxStrength: 0.045
  })
});

export function readGalaxyV3State(search = readLocationSearch()) {
  const params = new URLSearchParams(search);
  const enabled = params.get('galaxyV3') === '1';
  const heroVersion = enabled && params.get('galaxyHero') === 'v4' ? 'v4' : 'foundation';

  return Object.freeze({
    enabled,
    heroVersion,
    isolated: heroVersion === 'v4' && readBooleanParam(params, 'debugV4Isolated', false),
    useGpuStars: enabled && readBooleanParam(params, 'v3UseGpuStars', true),
    debug: Object.freeze({
      hero: readBooleanParam(params, 'debugV3Hero', true),
      gpuStars: readBooleanParam(params, 'debugV3GpuStars', true),
      foreground: readBooleanParam(params, 'debugV3Foreground', true),
      businessNebula: readBooleanParam(params, 'debugV3BusinessNebula', true),
      v4: Object.freeze({
        supportStars: readBooleanParam(params, 'debugV4SupportStars', true),
        background: readBooleanParam(params, 'debugV4Background', true),
        farArm: readBooleanParam(params, 'debugV4FarArm', true),
        core: readBooleanParam(params, 'debugV4Core', true),
        nearArm: readBooleanParam(params, 'debugV4NearArm', true),
        foreground: readBooleanParam(params, 'debugV4Foreground', true)
      })
    })
  });
}

function readBooleanParam(params, key, fallback) {
  const value = params.get(key);

  if (value === null) return fallback;
  return value !== '0' && value !== 'false';
}

function readLocationSearch() {
  return typeof window === 'undefined' ? '' : window.location.search;
}
