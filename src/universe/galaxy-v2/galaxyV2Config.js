export const GPU_GALAXY_V2_QUALITY = Object.freeze({
  LOW: 60000,
  MEDIUM: 100000,
  HIGH: 150000
});

export const GPU_GALAXY_V2_ARM_PROFILES = Object.freeze([
  Object.freeze({ weight: 0.35, phase: 0.06, reach: 1.06, strength: 1, widthScale: 1.45, zScale: 1.18, dustStrength: 1, gap: -1, gapWidth: 0, branchRate: 0.055, branchDirection: 1 }),
  Object.freeze({ weight: 0.3, phase: Math.PI + 0.14, reach: 0.97, strength: 0.92, widthScale: 1.3, zScale: 1.08, dustStrength: 0.92, gap: 0.64, gapWidth: 0.045, branchRate: 0.04, branchDirection: -1 }),
  Object.freeze({ weight: 0.2, phase: Math.PI * 0.5 - 0.12, reach: 0.78, strength: 0.68, widthScale: 0.88, zScale: 0.88, dustStrength: 0.38, gap: 0.52, gapWidth: 0.085, branchRate: 0.11, branchDirection: -1 }),
  Object.freeze({ weight: 0.15, phase: Math.PI * 1.5 + 0.26, reach: 0.68, strength: 0.54, widthScale: 0.78, zScale: 0.78, dustStrength: 0.24, gap: 0.41, gapWidth: 0.11, branchRate: 0.17, branchDirection: 1 })
]);

export const GPU_GALAXY_V2_DUST_FIELD = Object.freeze({
  laneCenter: -0.035,
  laneWobble: 0.014,
  innerSharpness: 15,
  outerSharpness: 10
});

export const GPU_GALAXY_V2_CONFIG = Object.freeze({
  particleCount: GPU_GALAXY_V2_QUALITY.MEDIUM,
  starCount: 82000,
  dustCount: 18000,
  coreStarCount: 15000,
  armStarCount: 60000,
  haloStarCount: 7000,
  armCount: 4,
  outerRadius: 1,
  coreRadius: 0.24,
  turns: 1.04,
  composition: Object.freeze({
    position: Object.freeze([0.32, 0.13, 0.015]),
    rotation: Object.freeze([0.74, -0.12, -0.34]),
    scale: 1.82
  })
});

export function readGpuGalaxyV2State(search = readLocationSearch()) {
  const params = new URLSearchParams(search);

  return Object.freeze({
    enabled: params.get('galaxyV2') === '1',
    particleCount: GPU_GALAXY_V2_CONFIG.particleCount
  });
}

function readLocationSearch() {
  return typeof window === 'undefined' ? '' : window.location.search;
}
