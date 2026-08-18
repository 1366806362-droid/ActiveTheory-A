export const GALAXY_V3_ASSET_TYPES = Object.freeze([
  'placeholder',
  'transparent-image',
  'texture-sequence',
  'alpha-video',
  'glb',
  'mesh'
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

export function readGalaxyV3State(search = readLocationSearch()) {
  const params = new URLSearchParams(search);
  const enabled = params.get('galaxyV3') === '1';

  return Object.freeze({
    enabled,
    useGpuStars: enabled && readBooleanParam(params, 'v3UseGpuStars', true),
    debug: Object.freeze({
      hero: readBooleanParam(params, 'debugV3Hero', true),
      gpuStars: readBooleanParam(params, 'debugV3GpuStars', true),
      foreground: readBooleanParam(params, 'debugV3Foreground', true),
      businessNebula: readBooleanParam(params, 'debugV3BusinessNebula', true)
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
