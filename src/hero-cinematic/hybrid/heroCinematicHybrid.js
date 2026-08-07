import '../heroCinematicV2.css';
import './heroCinematicHybrid.css';
import { GALAXY_ASSET_PROFILES } from '../../universe/galaxyAssetProfiles.js';
import { createHeroScrollController } from './heroScrollController.js';
import { createHeroCinematicScrubber } from './heroCinematicScrubber.js';
import { createHeroCinematicHandoff } from './heroCinematicHandoff.js';
import {
  HANDOFF_PREPARE_PROGRESS,
  HERO_HANDOFF_CONTRACT
} from './heroHandoffContract.js';
import {
  HERO_WHEEL_OWNERSHIP,
  resolveHeroWheelOwnership
} from './heroCinematicIntegration.js';

const INSTANCE_KEY = '__ACTIVE_THEORY_HERO_CINEMATIC_HYBRID__';
const STATUS_KEY = '__ACTIVE_THEORY_HERO_CINEMATIC_HYBRID_STATUS__';
const P1_INSTANCE_KEY = '__ACTIVE_THEORY_HERO_CINEMATIC_V2__';

export function initializeHeroCinematicHybrid({
  prepareUniverse = () => null,
  getUniverseState = readUniverseState
} = {}) {
  window[INSTANCE_KEY]?.dispose?.();
  window[P1_INSTANCE_KEY]?.dispose?.();

  const params = new URLSearchParams(window.location.search);
  const debugEnabled = import.meta.env.DEV && params.get('heroDebug') === '1';
  const quality = params.get('heroQuality') === 'default' ? 'default' : 'company';
  const app = document.querySelector('#app');
  const root = document.createElement('main');
  const debug = createDebugOverlay(debugEnabled);
  const previousAppStyle = {
    opacity: app.style.opacity,
    visibility: app.style.visibility,
    pointerEvents: app.style.pointerEvents
  };
  let disposed = false;
  let universePrepareRequested = false;
  let universePrepared = false;
  let universePrepareCount = 0;
  let routeObserver = null;
  let lastPublishedAt = 0;
  let status = null;
  let handoffStatus = null;
  let scrollStatus = null;
  let wheelOwnership = HERO_WHEEL_OWNERSHIP.CINEMATIC;

  root.className = 'hero-cinematic-hybrid';
  root.dataset.placeholder = 'true';

  const scrubber = createHeroCinematicScrubber({
    source: GALAXY_ASSET_PROFILES.H1_HD.url,
    duration: HERO_HANDOFF_CONTRACT.duration,
    placeholder: true,
    onDecodedFrame: () => publishStatus(performance.now(), true)
  });

  root.append(scrubber.video);
  if (debug.element) root.append(debug.element);
  document.body.append(root);

  const handoff = createHeroCinematicHandoff({
    videoLayer: scrubber.video,
    threeLayer: app,
    onPrepareThree: requestLatestUniverse,
    onStateChange: () => publishStatus(performance.now(), true)
  });

  let controller = null;
  controller = createHeroScrollController({
    target: window,
    damping: 0.24,
    sensitivity: 0.15,
    onProgress: handleProgress,
    onWheel: () => publishStatus(performance.now(), true),
    shouldHandleWheel: resolveWheelOwnership
  });
  routeObserver = new MutationObserver(syncDataCenterWheelListener);
  routeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-data-center-route']
  });
  syncDataCenterWheelListener();

  document.body.dataset.heroCinematic = 'v2';
  document.body.dataset.heroHybrid = '1';

  const instance = Object.freeze({
    dispose,
    setProgress: (progress, options) => controller.setTargetProgress(progress, options),
    applyWheelDelta: (deltaY, deltaMode) => controller.applyWheelDelta(deltaY, deltaMode),
    getStatus: () => status
  });
  window[INSTANCE_KEY] = instance;
  handleProgress({
    targetProgress: 0,
    currentProgress: 0,
    normalizedWheelDelta: 0,
    settled: true,
    now: performance.now()
  });

  if (import.meta.hot) import.meta.hot.dispose(dispose);
  return instance;

  function requestLatestUniverse() {
    universePrepareRequested = true;
  }

  function prepareLatestUniverse() {
    if (disposed || universePrepared) return;
    prepareUniverse();
    universePrepared = true;
    universePrepareCount += 1;
  }

  function handleProgress(nextScrollStatus) {
    if (disposed) return;
    scrollStatus = nextScrollStatus;
    scrubber.setProgress(nextScrollStatus.currentProgress, nextScrollStatus.now);
    handoffStatus = handoff.update(nextScrollStatus.currentProgress);
    if (
      universePrepareRequested
      && !universePrepared
      && (nextScrollStatus.settled || nextScrollStatus.currentProgress >= 0.96)
    ) {
      prepareLatestUniverse();
    }
    resolveWheelOwnership({ deltaY: 0 });
    publishStatus(nextScrollStatus.now, nextScrollStatus.settled);
  }

  function resolveWheelOwnership({ deltaY = 0 } = {}) {
    wheelOwnership = resolveHeroWheelOwnership({
      currentProgress: scrollStatus?.currentProgress ?? 0,
      deltaY,
      dataCenterRoute: document.documentElement.dataset.dataCenterRoute ?? 'universe',
      tourStatus: window.__GALAXY_TOUR_STATUS__ ?? null
    });
    return wheelOwnership === HERO_WHEEL_OWNERSHIP.CINEMATIC;
  }

  function publishStatus(now, force = false) {
    if (disposed || (!force && now - lastPublishedAt < 80)) return;
    lastPublishedAt = now;
    const controllerDiagnostics = controller?.getDiagnostics?.() ?? null;
    const scrubberDiagnostics = scrubber.getDiagnostics();
    status = {
      active: true,
      mode: 'hybrid-scroll-v1-latest-site',
      placeholder: true,
      quality,
      state: handoffStatus?.state ?? 'CINEMATIC',
      phase: handoffStatus?.phase ?? 'CINEMATIC_ONLY',
      wheelOwnership,
      targetProgress: scrollStatus?.targetProgress ?? 0,
      currentProgress: scrollStatus?.currentProgress ?? 0,
      scrollDeltaNormalized: scrollStatus?.normalizedWheelDelta ?? 0,
      handoffWeight: handoffStatus?.handoffWeight ?? 0,
      videoCurrentTime: scrubberDiagnostics.currentTime,
      videoDuration: scrubberDiagnostics.duration,
      seekCount: scrubberDiagnostics.seekCount,
      frameCallbackCount: scrubberDiagnostics.frameCallbackCount,
      droppedFrames: scrubberDiagnostics.droppedFrames,
      videoPaused: scrubberDiagnostics.paused,
      universePrepared,
      universePrepareCount,
      universeState: getUniverseState(),
      canvasCount: document.querySelectorAll('canvas').length,
      videoElementCount: document.querySelectorAll('video').length,
      domCount: document.querySelectorAll('*').length,
      activeRafCount: controllerDiagnostics?.activeRafCount ?? 0,
      wheelListenerCount: controllerDiagnostics?.wheelListenerCount ?? 0,
      resizeListenerCount: 0,
      performance: controllerDiagnostics?.performance ?? null,
      contract: HERO_HANDOFF_CONTRACT
    };
    debug.update(status);
    window[STATUS_KEY] = status;
    document.documentElement.dataset.heroHybridStatus = JSON.stringify(status);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    routeObserver?.disconnect();
    controller.dispose();
    scrubber.dispose();
    debug.dispose();
    root.remove();
    app.style.opacity = previousAppStyle.opacity;
    app.style.visibility = previousAppStyle.visibility;
    app.style.pointerEvents = previousAppStyle.pointerEvents;
    delete document.body.dataset.heroCinematic;
    delete document.body.dataset.heroHybrid;
    delete document.documentElement.dataset.heroHybridStatus;
    if (window[STATUS_KEY] === status) delete window[STATUS_KEY];
    if (window[INSTANCE_KEY] === instance) delete window[INSTANCE_KEY];
  }

  function syncDataCenterWheelListener() {
    const route = document.documentElement.dataset.dataCenterRoute ?? 'universe';
    controller.setEnabled(route === 'universe');
    publishStatus(performance.now(), true);
  }
}

function readUniverseState() {
  const tour = window.__GALAXY_TOUR_STATUS__ ?? null;
  return {
    ready: Boolean(window.__ACTIVE_THEORY_ENGINE__),
    activeScene: tour?.activeScene ?? null,
    currentAnchor: tour?.currentAnchor ?? null,
    transitionFrom: tour?.transitionFrom ?? null,
    transitionTo: tour?.transitionTo ?? null,
    dataCenterRoute: document.documentElement.dataset.dataCenterRoute ?? 'universe'
  };
}

function createDebugOverlay(enabled) {
  if (!enabled) return Object.freeze({ element: null, update() {}, dispose() {} });
  const element = document.createElement('pre');
  element.className = 'hero-cinematic-hybrid__debug';

  return Object.freeze({
    element,
    update(status) {
      element.textContent = [
        `state              ${status.state}`,
        `phase              ${status.phase}`,
        `wheelOwner         ${status.wheelOwnership}`,
        `targetProgress     ${status.targetProgress.toFixed(4)}`,
        `currentProgress    ${status.currentProgress.toFixed(4)}`,
        `videoCurrentTime   ${status.videoCurrentTime.toFixed(3)}s`,
        `videoDuration      ${status.videoDuration.toFixed(3)}s`,
        `seekCount          ${status.seekCount}`,
        `frameCallbacks     ${status.frameCallbackCount}`,
        `droppedFrames      ${status.droppedFrames ?? 'n/a'}`,
        `FPS                ${status.performance?.averageFps?.toFixed(1) ?? 'measuring'}`,
        `1% low             ${status.performance?.onePercentLow?.toFixed(1) ?? 'measuring'}`,
        `handoffWeight      ${status.handoffWeight.toFixed(4)}`,
        `Universe prepared  ${status.universePrepared}`,
        `Canvas / Video     ${status.canvasCount} / ${status.videoElementCount}`
      ].join('\n');
    },
    dispose() {
      element.remove();
    }
  });
}
