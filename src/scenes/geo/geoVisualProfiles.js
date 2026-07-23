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

export const GEO_VISUAL_V27_BIODIGITAL = Object.freeze({
  ...GEO_VISUAL_V2,
  id: 'v2.7-biodigital-organic',
  backgroundMode: 'biodigital-elevated',
  scene: Object.freeze({
    ...GEO_VISUAL_V2.scene,
    foregroundParticles: 110,
    backgroundStars: 338,
    backgroundStarOpacity: 0.25,
    backgroundStarSizeScale: 0.76,
    foregroundOpacity: 0.105,
    foregroundSizeScale: 0.78,
    deepSpaceOpacity: 0.78
  }),
  streams: Object.freeze({
    ...GEO_VISUAL_V2.streams,
    secondaryLanes: 1,
    crossGain: 0.13
  }),
  nebula: Object.freeze({
    particleCount: 185,
    particleOpacity: 0.135
  })
});

export const GEO_VISUAL_V3_CINEMATIC = Object.freeze({
  ...GEO_VISUAL_V2,
  id: 'v3-cinematic-organic',
  backgroundMode: 'cinematic-organic-v3',
  scene: Object.freeze({
    ...GEO_VISUAL_V2.scene,
    foregroundParticles: 96,
    backgroundStars: 320,
    backgroundStarOpacity: 0.24,
    backgroundStarSizeScale: 0.72,
    foregroundOpacity: 0.1,
    foregroundSizeScale: 0.76,
    deepSpaceOpacity: 0.82
  }),
  core: Object.freeze({
    ...GEO_VISUAL_V2.core,
    scale: 1.66,
    labelScale: 0.61,
    labelOpacity: 0.32
  }),
  streams: Object.freeze({
    ...GEO_VISUAL_V2.streams,
    segments: 44,
    flowParticles: 540,
    secondaryLanes: 1,
    crossGain: 0.11,
    mainLineGain: 1.28,
    flowOpacity: 0.8
  })
});

const GEO_VERSION_CONFIGS = Object.freeze({
  v12: Object.freeze({
    activeVersion: 'v12',
    visualProfile: GEO_VISUAL_V1,
    coreMode: 'v1.2',
    coreType: 'signal-v12'
  }),
  v23: Object.freeze({
    activeVersion: 'v23',
    visualProfile: GEO_VISUAL_V2,
    coreMode: 'v2.3',
    coreType: 'processing-v23'
  }),
  v24: Object.freeze({
    activeVersion: 'v24',
    visualProfile: GEO_VISUAL_V2,
    coreMode: 'gyroscope',
    coreType: 'gyroscope'
  }),
  v3: Object.freeze({
    activeVersion: 'v3',
    visualProfile: GEO_VISUAL_V3_CINEMATIC,
    coreMode: 'cinematic-shell',
    coreType: 'cinematic-organic-shell'
  })
});

export function resolveGeoVersionSelection(search = window.location.search) {
  const params = new URLSearchParams(search);
  const explicitVersion = params.get('geoVersion');

  if (explicitVersion) {
    const config = GEO_VERSION_CONFIGS[explicitVersion] ?? GEO_VERSION_CONFIGS.v24;
    return withBackgroundSelection({
      ...config,
      requestedVersion: explicitVersion,
      isDefaultVersion: false,
      fallbackUsed: !GEO_VERSION_CONFIGS[explicitVersion],
      legacyQueryUsed: false
    }, params);
  }

  if (params.get('geoVisual') === 'v3-cinematic') {
    return Object.freeze({
      ...GEO_VERSION_CONFIGS.v3,
      requestedVersion: 'v3',
      isDefaultVersion: false,
      fallbackUsed: false,
      legacyQueryUsed: true,
      requestedBackground: 'cinematic-organic-v3',
      activeBackground: 'cinematic-organic-v3',
      backgroundIsDefault: false,
      backgroundFallbackUsed: false
    });
  }

  const legacyV2 = params.get('geoVisual') === 'v2';
  const legacyGyroscope = params.get('geoCore') === 'gyroscope';
  const legacyQueryUsed = legacyV2 || legacyGyroscope;
  const config = legacyGyroscope
    ? GEO_VERSION_CONFIGS.v24
    : legacyV2
      ? GEO_VERSION_CONFIGS.v23
      : GEO_VERSION_CONFIGS.v24;

  return withBackgroundSelection({
    ...config,
    requestedVersion: config.activeVersion,
    isDefaultVersion: !legacyQueryUsed,
    fallbackUsed: false,
    legacyQueryUsed
  }, params);
}

export function resolveGeoVisualProfile(search = window.location.search) {
  return resolveGeoVersionSelection(search).visualProfile;
}

function withBackgroundSelection(config, params) {
  const requestedBackground = params.get('geoBackground');
  const formalRequested = requestedBackground === 'formal';
  const organicRequested = requestedBackground === 'biodigital-elevated';
  const organicDefault = requestedBackground === null
    && config.activeVersion === 'v24';
  const organicSupported = config.activeVersion === 'v24'
    || config.activeVersion === 'v23';
  const organicEnabled = !formalRequested
    && (organicDefault || (organicRequested && organicSupported));
  const recognizedBackground = requestedBackground === null
    || formalRequested
    || organicRequested;
  const backgroundFallbackUsed = !recognizedBackground
    || (organicRequested && !organicSupported);

  return Object.freeze({
    ...config,
    visualProfile: organicEnabled ? GEO_VISUAL_V27_BIODIGITAL : config.visualProfile,
    requestedBackground: requestedBackground
      ?? (organicDefault ? 'biodigital-organic-v27' : 'formal'),
    activeBackground: organicEnabled ? 'biodigital-organic-v27' : 'formal',
    backgroundIsDefault: organicDefault,
    backgroundFallbackUsed
  });
}
