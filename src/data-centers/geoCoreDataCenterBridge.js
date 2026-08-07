const GEO_DATA_CENTER_ID = 'geo';

export function createGeoCoreDataCenterBridge({
  router,
  windowObject = window,
  documentObject = windowObject.document
} = {}) {
  if (!router) throw new Error('GEO core bridge requires a Data Center router.');

  const abortController = new AbortController();
  const { signal } = abortController;
  let disposed = false;

  documentObject.addEventListener('pointerdown', handlePointerDown, { signal });

  return Object.freeze({
    requestEnter,
    dispose
  });

  function handlePointerDown(event) {
    if (event.target?.tagName !== 'CANVAS' || !isGeoReady(windowObject)) return;

    const x = event.clientX / windowObject.innerWidth;
    const y = event.clientY / windowObject.innerHeight;
    const withinCore = ((x - 0.51) / 0.18) ** 2 + ((y - 0.56) / 0.24) ** 2 <= 1;

    if (withinCore) requestEnter();
  }

  function requestEnter() {
    if (disposed) return null;
    if (router.getCurrentRoute()?.id === GEO_DATA_CENTER_ID) {
      return router.getCurrentRoute();
    }
    return router.navigate(GEO_DATA_CENTER_ID);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    abortController.abort();
  }
}

function isGeoReady(windowObject) {
  const geo = windowObject.__GEO_SCENE_STATUS__;
  const tour = windowObject.__GALAXY_TOUR_STATUS__;
  return geo?.activeScene === 'GeoScene'
    && Number(geo?.journeyProgress ?? 1) >= 0.999
    && tour?.activeScene === 'GeoScene';
}
