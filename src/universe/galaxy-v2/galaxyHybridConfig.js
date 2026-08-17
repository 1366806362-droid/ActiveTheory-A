export const GPU_GALAXY_HYBRID_CONFIG = Object.freeze({
  primaryArmIndices: Object.freeze([0, 1]),
  armSegments: 176,
  armWidthSegments: 6,
  armOpacity: 0.1,
  coreDetail: 4,
  coreScale: Object.freeze([0.34, 0.27, 0.19]),
  coreOpacity: 0.3,
  addedDrawCalls: 2
});

export function readGpuGalaxyHybridState(search = readLocationSearch()) {
  const params = new URLSearchParams(search);

  return Object.freeze({
    enabled: params.get('galaxyHybrid') === '1'
  });
}

function readLocationSearch() {
  return typeof window === 'undefined' ? '' : window.location.search;
}
