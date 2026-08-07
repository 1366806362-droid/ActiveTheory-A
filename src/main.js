import { initializeEngine } from './engine/index.js';
import { initializeGeoDashboardExperience } from './dashboard/geoDashboard.js';
import { createDataCenterRegistry } from './data-centers/dataCenterRegistry.js';
import { createDataCenterLifecycle } from './data-centers/dataCenterLifecycle.js';
import { createDataCenterRouter } from './data-centers/dataCenterRouter.js';
import { createA5AssetCenter } from './data-centers/a5/a5AssetCenter.js';
import { createBrandMindCenter } from './data-centers/brand-mind/brandMindCenter.js';

const initialUrl = new URL(window.location.href);
const dashboardRequested = initialUrl.searchParams.get('geoDashboard') === 'v1';
const shouldPrimeGeoCompletion = dashboardRequested && !initialUrl.searchParams.has('scene');

if (shouldPrimeGeoCompletion) {
  const engineUrl = new URL(initialUrl);
  engineUrl.searchParams.set('scene', 'geo');
  window.history.replaceState({}, '', `${engineUrl.pathname}${engineUrl.search}${engineUrl.hash}`);
}

initializeEngine();

if (shouldPrimeGeoCompletion) {
  window.history.replaceState(
    {},
    '',
    `${initialUrl.pathname}${initialUrl.search}${initialUrl.hash}`
  );
}

window.__ACTIVE_THEORY_DATA_CENTER_ROUTER__?.dispose?.();

const dataCenterRegistry = createDataCenterRegistry({
  geo: {
    dataAdapter: 'geoDashboardDataAdapter',
    dataValidator: 'geoDashboardDataValidator',
    dataSource: 'geoDashboardDataSource',
    create({ route, onRequestClose }) {
      return initializeGeoDashboardExperience({
        requested: true,
        visual: route.visual,
        openedFrom: route.mode === 'legacy' && initialUrl.searchParams.get('entry') === 'geo'
          ? 'geo'
          : 'direct',
        returnLabel: route.mode === 'unified' ? '返回品牌认知宇宙' : '返回 GEO',
        onRequestClose
      });
    },
    destroy(instance) {
      instance?.dispose?.();
    }
  },
  a5: {
    create: createA5AssetCenter,
    destroy(instance) {
      instance?.destroy?.();
    }
  },
  brandMind: {
    create: createBrandMindCenter,
    destroy(instance) {
      instance?.destroy?.();
    }
  }
});
const dataCenterLifecycle = createDataCenterLifecycle({ registry: dataCenterRegistry });
const dataCenterRouter = createDataCenterRouter({
  registry: dataCenterRegistry,
  lifecycle: dataCenterLifecycle
});

dataCenterRouter.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => dataCenterRouter.dispose());
}
