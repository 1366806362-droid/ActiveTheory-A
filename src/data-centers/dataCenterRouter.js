const DATA_CENTER_QUERY_KEY = 'dataCenter';
const LEGACY_GEO_QUERY_KEY = 'geoDashboard';
const ROUTER_STATUS_KEY = '__ACTIVE_THEORY_DATA_CENTER_ROUTER__';

export function createDataCenterRouter({
  registry,
  lifecycle,
  windowObject = window
} = {}) {
  if (!registry || !lifecycle) {
    throw new Error('Data Center router requires a registry and lifecycle.');
  }

  let started = false;
  let disposed = false;
  let currentRoute = null;

  const router = Object.freeze({
    start,
    navigate,
    returnToUniverse,
    syncFromLocation,
    dispose,
    getCurrentRoute: () => currentRoute,
    getStatus
  });

  return router;

  function start() {
    if (started || disposed) return router;
    started = true;
    windowObject.addEventListener('popstate', handlePopState);
    windowObject[ROUTER_STATUS_KEY] = router;
    syncFromLocation({ source: 'initial' });
    return router;
  }

  function navigate(id, { replace = false, params = {} } = {}) {
    if (!registry.has(id)) throw new Error(`Unknown Data Center “${id}”.`);
    const url = new URL(windowObject.location.href);
    url.searchParams.set(DATA_CENTER_QUERY_KEY, id);
    url.searchParams.delete(LEGACY_GEO_QUERY_KEY);
    url.searchParams.delete('entry');
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    });
    updateHistory(url, replace);
    return syncFromLocation({ source: replace ? 'replace' : 'navigate' });
  }

  function returnToUniverse({ replace = false } = {}) {
    const url = new URL(windowObject.location.href);
    url.searchParams.delete(DATA_CENTER_QUERY_KEY);
    url.searchParams.delete('visual');
    url.searchParams.delete('dataVersion');
    url.searchParams.delete(LEGACY_GEO_QUERY_KEY);
    url.searchParams.delete('entry');
    updateHistory(url, replace);
    return syncFromLocation({ source: 'return' });
  }

  function syncFromLocation({ source = 'sync' } = {}) {
    if (disposed) return null;
    const route = resolveDataCenterRoute(windowObject.location.href, registry);
    currentRoute = route;

    if (!route) {
      lifecycle.destroy({ reason: source });
      publish();
      return null;
    }

    const instance = lifecycle.open(route.id, {
      route,
      router,
      onRequestClose: () => returnToUniverse({ replace: route.mode === 'legacy' })
    });
    publish();
    return instance;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (started) windowObject.removeEventListener('popstate', handlePopState);
    lifecycle.dispose();
    started = false;
    currentRoute = null;
    if (windowObject[ROUTER_STATUS_KEY] === router) delete windowObject[ROUTER_STATUS_KEY];
  }

  function getStatus() {
    return {
      started,
      route: currentRoute,
      ...lifecycle.getStatus()
    };
  }

  function handlePopState() {
    syncFromLocation({ source: 'popstate' });
  }

  function updateHistory(url, replace) {
    const value = `${url.pathname}${url.search}${url.hash}`;
    windowObject.history[replace ? 'replaceState' : 'pushState']({}, '', value);
  }

  function publish() {
    const root = windowObject.document?.documentElement;
    if (!root) return;
    root.dataset.dataCenterRoute = currentRoute?.id ?? 'universe';
  }
}

export function resolveDataCenterRoute(href, registry) {
  const url = new URL(href);
  const requested = url.searchParams.get(DATA_CENTER_QUERY_KEY);

  if (requested) {
    if (!registry.has(requested)) return null;
    return Object.freeze({
      id: requested,
      mode: 'unified',
      visual: url.searchParams.get('visual'),
      dataVersion: url.searchParams.get('dataVersion')
    });
  }

  if (url.searchParams.get(LEGACY_GEO_QUERY_KEY) === 'v1' && registry.has('geo')) {
    return Object.freeze({ id: 'geo', mode: 'legacy', visual: null, dataVersion: null });
  }

  return null;
}
