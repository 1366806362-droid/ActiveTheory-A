export const FINAL_HOME_DEFAULTS = Object.freeze({
  galaxyV3: '1',
  galaxyHero: 'repaired_m3',
  homeArt: 'final',
  v3UseGpuStars: '1',
  homeFinalV1: '1',
  brandMindMemory: '1',
  earthV2: '1',
  earthV3: '1',
  earthOrbital: '1',
  earthV13: '1',
  earthHybrid: '1',
  earthHybridProd: '1',
  earthHeroLock: '1'
});

// Existing HOME visual selectors retain their complete historical query
// contract. Scene, debug, accessibility and meteor switches do not opt out of
// the reviewed default profile.
export const HOME_VISUAL_OVERRIDE_KEYS = Object.freeze([
  'galaxyV3',
  'galaxyHero',
  'homeArt',
  'homeFinalV1',
  'homeJourney',
  'earthFinal',
  'brandMindMemory',
  'earthV2',
  'earthV3',
  'earthRealism',
  'earthOrbital',
  'earthV13',
  'earthHybrid',
  'earthHybridProd',
  'earthHeroLock'
]);

export function resolveHomeRuntimeSearch(search = '') {
  const params = new URLSearchParams(search);
  const explicitVisualOverride = HOME_VISUAL_OVERRIDE_KEYS.some((key) => params.has(key));

  if (!explicitVisualOverride) {
    for (const [key, value] of Object.entries(FINAL_HOME_DEFAULTS)) {
      params.set(key, value);
    }
  }

  return params.toString();
}

export function readHomeRuntimeProfile(search = '') {
  const requested = new URLSearchParams(search);
  const effective = new URLSearchParams(resolveHomeRuntimeSearch(search));
  const explicitVisualOverride = HOME_VISUAL_OVERRIDE_KEYS.some((key) => requested.has(key));

  return Object.freeze({
    source: explicitVisualOverride ? 'explicit-query' : 'final-default',
    galaxy: Object.freeze({
      enabled: effective.get('galaxyV3') === '1',
      hero: effective.get('galaxyHero'),
      art: effective.get('homeArt')
    }),
    earth: Object.freeze({
      v2: effective.get('earthV2') === '1',
      v3: effective.get('earthV3') === '1',
      orbital: effective.get('earthOrbital') === '1',
      groundTruth: effective.get('earthV13') === '1',
      hybrid: effective.get('earthHybrid') === '1',
      production: effective.get('earthHybridProd') === '1',
      heroLock: effective.get('earthHeroLock') === '1'
    }),
    home: Object.freeze({
      final: effective.get('homeFinalV1') === '1',
      memoryField: effective.get('brandMindMemory') === '1',
      meteors: requested.get('homeMeteors') !== '0'
        && requested.get('homeMeteors') !== 'false'
    })
  });
}
