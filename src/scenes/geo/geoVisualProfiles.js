export const GEO_VISUAL_V1 = Object.freeze({
  id: 'v1.2',
  cinematic: false,
  scene: Object.freeze({
    corePosition: [0.14, 0.04, 0],
    desktopScale: 1.12,
    mediumScale: 1.04,
    compactScale: 0.72,
    desktopPosition: [0.07, 0, -0.62],
    mediumPosition: [0.02, 0, -0.62],
    compactPosition: [-0.42, 0, -1.15],
    foregroundParticles: 180,
    backgroundStars: 420
  }),
  core: Object.freeze({
    scale: 1,
    semanticFieldParticles: 0,
    pulseArcCount: 3,
    labelScale: 1,
    labelOpacity: 0.72
  }),
  streams: Object.freeze({
    segments: 34,
    flowParticles: 336,
    mainLanes: 1,
    secondaryLanes: 1,
    crossLanes: 1,
    mainLineGain: 1,
    crossGain: 1,
    flowScale: 0.92,
    flowOpacity: 0.72
  })
});

export const GEO_VISUAL_V2 = Object.freeze({
  id: 'v2-cinematic',
  cinematic: true,
  scene: Object.freeze({
    corePosition: [0, 0.015, 0],
    desktopScale: 1.34,
    mediumScale: 1.17,
    compactScale: 0.82,
    desktopPosition: [-0.015, 0.015, -0.66],
    mediumPosition: [-0.01, 0.025, -0.7],
    compactPosition: [-0.2, 0.03, -1.2],
    foregroundParticles: 260,
    backgroundStars: 520
  }),
  core: Object.freeze({
    scale: 1.48,
    semanticFieldParticles: 320,
    pulseArcCount: 5,
    labelScale: 0.655,
    labelOpacity: 0.365
  }),
  streams: Object.freeze({
    segments: 42,
    flowParticles: 540,
    mainLanes: 3,
    secondaryLanes: 2,
    crossLanes: 1,
    mainLineGain: 1.34,
    crossGain: 0.34,
    flowScale: 1.06,
    flowOpacity: 0.82
  })
});

export function resolveGeoVisualProfile(search = window.location.search) {
  const params = new URLSearchParams(search);
  return params.get('geoVisual') === 'v2' ? GEO_VISUAL_V2 : GEO_VISUAL_V1;
}
