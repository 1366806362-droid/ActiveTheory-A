export const UNIVERSE_RENDER_DEBUG_PARAMS = Object.freeze({
  galaxyTexture: 'debugGalaxyTexture',
  proceduralGalaxy: 'debugProceduralGalaxy',
  galaxyDust: 'debugGalaxyDust',
  geoNebula: 'debugGeoNebula',
  fiveANebula: 'debug5ANebula',
  brandMindNebula: 'debugBrandMindNebula',
  foregroundDust: 'debugForegroundDust',
  deepStars: 'debugDeepStars'
});

export function readUniverseRenderDebug(search = readLocationSearch()) {
  const params = new URLSearchParams(search);
  const layers = Object.fromEntries(
    Object.entries(UNIVERSE_RENDER_DEBUG_PARAMS).map(([layer, parameter]) => (
      [layer, params.get(parameter) !== '0']
    ))
  );

  return Object.freeze(layers);
}

export const UNIVERSE_RENDER_DEBUG = readUniverseRenderDebug();

if (typeof window !== 'undefined') {
  const diagnostics = Object.freeze({
    params: UNIVERSE_RENDER_DEBUG_PARAMS,
    layers: UNIVERSE_RENDER_DEBUG
  });

  window.__ACTIVE_THEORY_UNIVERSE_RENDER_DEBUG__ = diagnostics;
  document.documentElement.dataset.universeRenderDebug = JSON.stringify(diagnostics);
}

function readLocationSearch() {
  return typeof window === 'undefined' ? '' : window.location.search;
}
