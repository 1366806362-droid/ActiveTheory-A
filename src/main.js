import { initializeEngine } from './engine/index.js';
import { initializeGeoDashboardExperience } from './dashboard/geoDashboard.js';

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

initializeGeoDashboardExperience();
