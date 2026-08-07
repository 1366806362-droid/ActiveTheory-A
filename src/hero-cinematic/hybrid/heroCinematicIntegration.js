export const HERO_WHEEL_OWNERSHIP = Object.freeze({
  CINEMATIC: 'HERO_CINEMATIC',
  UNIVERSE: 'UNIVERSE_READY',
  GEO: 'GEO_JOURNEY',
  DATA_CENTER: 'DATA_CENTER'
});

export function resolveHeroCinematicEntry(href) {
  const url = new URL(href, 'http://127.0.0.1/');
  const params = url.searchParams;
  const hasBusinessRoute = params.has('dataCenter')
    || params.get('geoDashboard') === 'v1'
    || params.has('scene');

  if (hasBusinessRoute || params.get('heroCinematic') !== 'v2') return null;
  return params.get('heroHybrid') === '1' ? 'hybrid' : 'p1';
}

export function resolveHeroWheelOwnership({
  currentProgress = 0,
  deltaY = 0,
  dataCenterRoute = 'universe',
  tourStatus = null
} = {}) {
  if (dataCenterRoute && dataCenterRoute !== 'universe') {
    return HERO_WHEEL_OWNERSHIP.DATA_CENTER;
  }

  if (currentProgress < 0.9995) {
    return HERO_WHEEL_OWNERSHIP.CINEMATIC;
  }

  const atUniverseStart = !tourStatus || (
    tourStatus.activeScene === 'HeroScene'
    && tourStatus.currentAnchor === 'HERO_START'
    && !tourStatus.transitionFrom
    && !tourStatus.transitionTo
  );

  if (!atUniverseStart) return HERO_WHEEL_OWNERSHIP.GEO;
  if (deltaY < 0) return HERO_WHEEL_OWNERSHIP.CINEMATIC;
  return HERO_WHEEL_OWNERSHIP.UNIVERSE;
}
