import * as THREE from 'three';
import { createBrandMindScene } from '../scenes/brandMindScene.js';
import { createFiveAScene } from '../scenes/fiveAScene.js';
import { createGeoScene } from '../scenes/geoScene.js';
import {
  GALAXY_TOUR_ANCHORS,
  getTourAnchor,
  getTourRouteDefinition,
  getTourSegment
} from './galaxyTourRoute.js';

const WHEEL_SENSITIVITY = 0.00145;
const MAX_NORMALIZED_WHEEL = 120;
const WHEEL_SOFT_THRESHOLD = 72;
const WHEEL_SOFTNESS = 90;
const WHEEL_DEAD_ZONE = 1.5;
const PROGRESS_DAMPING = 3.1;
const ANCHOR_ARRIVAL_PROGRESS = 0.92;
const ANCHOR_RELEASE_MS = 160;
const WHEEL_IDLE_RELEASE_MS = 120;
const CAMERA_PATH_START_PROGRESS = 0.04;
const GEO_JOURNEY_WHEEL_STEPS = 7;
const GEO_JOURNEY_PROGRESS_EPSILON = 0.000001;
const reusablePlanetTarget = new THREE.Vector3();
const reusableDesiredCamera = new THREE.Vector3();
const reusableCurrentCamera = new THREE.Vector3();
const reusableCurrentTarget = new THREE.Vector3();
const reusableDesiredTarget = new THREE.Vector3();
const heroBackgroundColor = new THREE.Color('#020716');
const transitionBackgroundColor = new THREE.Color('#05132a');
const targetBackgroundColor = new THREE.Color('#071b2d');
const transitionFogColor = new THREE.Color('#05192b');
const targetFogColor = new THREE.Color('#072234');
const blendedBackgroundColor = new THREE.Color();
const blendedFogColor = new THREE.Color();

const TARGETS = Object.freeze({
  geo: createTargetConfig({
    key: 'geo',
    sceneName: 'GeoScene',
    nebulaName: 'GEO Nebula',
    localCore: [0.06, 0.04, -0.62],
    lockOffset: [0.9, 0.52, 4.15],
    approachOffset: [0.96, 0.62, 3.92],
    outerOffset: [0.72, 0.68, 3.3],
    openingOffset: [0.92, 0.88, 3.72],
    cameraOffset: [0.7, 0.82, 3.42]
  }),
  fiveA: createTargetConfig({
    key: 'fiveA',
    sceneName: 'FiveAScene',
    nebulaName: '5A Nebula',
    localCore: [-2.35, -0.22, -2.08],
    lockOffset: [0.72, 0.48, 4.35],
    approachOffset: [0.82, 0.56, 4.06],
    outerOffset: [0.64, 0.62, 3.46],
    openingOffset: [1.05, 0.72, 4.22],
    cameraOffset: [0.82, 0.64, 4.38]
  }),
  brandMind: createTargetConfig({
    key: 'brandMind',
    sceneName: 'BrandMindScene',
    nebulaName: 'Brand Mind Nebula',
    localCore: [0, 0, -0.72],
    lockOffset: [0.76, 0.5, 4.08],
    approachOffset: [0.84, 0.58, 3.82],
    outerOffset: [0.66, 0.66, 3.34],
    openingOffset: [0.9, 0.72, 3.86],
    cameraOffset: [0.68, 0.62, 3.66]
  })
});

export function createSceneManager({ heroScene }) {
  const geoJourneyWheelMode = isGeoV3JourneyWheelMode();
  const root = new THREE.Group();
  const geoScene = createGeoScene();
  const fiveAScene = createFiveAScene();
  const brandMindScene = createBrandMindScene();
  const debugScene = new URLSearchParams(window.location.search).get('scene');
  const initialRouteIndex = getDebugRouteIndex(debugScene);
  const scenes = [heroScene, geoScene, fiveAScene, brandMindScene];
  const sceneContainers = new Map();
  const journeys = new Map(Object.keys(TARGETS).map((key) => [
    key,
    createTargetJourney(TARGETS[key])
  ]));
  const state = {
    routeIndex: initialRouteIndex,
    transition: null,
    localProgress: 1,
    targetLocalProgress: 1,
    direction: 0,
    anchorLocked: false,
    lockedUntil: 0,
    lastWheelAt: -Infinity,
    transitionStartedAt: 0,
    lastTransitionDurationMs: 0,
    lastAnchorReachedAt: performance.now(),
    scrollProgress: initialRouteIndex,
    activeScene: getTourAnchor(initialRouteIndex).scene,
    nextScene: null,
    transitionUnits: 0
  };
  const diagnostics = createTourDiagnostics(state, geoJourneyWheelMode);
  let lastTargetKey = getTourAnchor(initialRouteIndex).target;

  root.name = 'ActiveTheorySceneManager';
  scenes.forEach((scene) => {
    const container = new THREE.Group();

    container.name = `${scene.name}Container`;
    container.visible = scene.name === state.activeScene;
    container.add(scene.group);
    root.add(container);
    sceneContainers.set(scene.name, container);
  });

  const heroContainer = sceneContainers.get('HeroScene');

  function handleWheel(event) {
    const normalizedDelta = normalizeWheelDelta(event);
    const normalizedWheelUnit = geoJourneyWheelMode
      ? normalizeJourneyWheelUnit(event)
      : 0;
    const now = performance.now();
    const direction = Math.sign(
      geoJourneyWheelMode && normalizedWheelUnit !== 0
        ? normalizedWheelUnit
        : normalizedDelta
    );
    let consumedDelta = 0;

    if (event.cancelable) {
      event.preventDefault();
    }

    if (direction === 0) {
      diagnostics.recordWheel(
        event.deltaY,
        normalizedDelta,
        event.deltaMode,
        consumedDelta,
        normalizedWheelUnit
      );
      return;
    }

    if (!state.transition) {
      const idleFor = now - state.lastWheelAt;
      const canReleaseAnchor = !state.anchorLocked || (
        now >= state.lockedUntil && idleFor >= WHEEL_IDLE_RELEASE_MS
      );

      state.lastWheelAt = now;

      if (!canReleaseAnchor) {
        diagnostics.recordWheel(
          event.deltaY,
          normalizedDelta,
          event.deltaMode,
          consumedDelta,
          normalizedWheelUnit
        );
        return;
      }

      state.anchorLocked = false;
      if (!startTransition(direction)) {
        diagnostics.recordWheel(
          event.deltaY,
          normalizedDelta,
          event.deltaMode,
          consumedDelta,
          normalizedWheelUnit
        );
        return;
      }
    } else {
      state.lastWheelAt = now;
    }

    const transitionDirection = state.transition.direction;
    const progressDirection = direction === transitionDirection ? 1 : -1;

    if (isDirectGeoJourneyTransition()) {
      const unitDelta = normalizedWheelUnit * transitionDirection;

      state.transitionUnits = snapGeoJourneyUnits(
        state.transitionUnits + unitDelta
      );
      state.targetLocalProgress = snapGeoJourneyProgress(
        state.transitionUnits / GEO_JOURNEY_WHEEL_STEPS
      );
      state.localProgress = state.targetLocalProgress;
      state.direction = unitDelta > 0 ? transitionDirection : -transitionDirection;
      consumedDelta = unitDelta * MAX_NORMALIZED_WHEEL;
      diagnostics.recordWheel(
        event.deltaY,
        normalizedDelta,
        event.deltaMode,
        consumedDelta,
        normalizedWheelUnit
      );
      return;
    }

    consumedDelta = Math.abs(normalizedDelta) * progressDirection;
    state.targetLocalProgress = clamp(
      state.targetLocalProgress + consumedDelta * WHEEL_SENSITIVITY,
      0,
      1
    );
    state.direction = progressDirection > 0 ? transitionDirection : -transitionDirection;
    diagnostics.recordWheel(
      event.deltaY,
      normalizedDelta,
      event.deltaMode,
      consumedDelta,
      normalizedWheelUnit
    );
  }

  function startTransition(direction) {
    const toIndex = state.routeIndex + direction;
    const fromAnchor = getTourAnchor(state.routeIndex);
    const toAnchor = getTourAnchor(toIndex);

    if (!fromAnchor || !toAnchor) {
      return false;
    }

    const segment = getTourSegment(state.routeIndex, toIndex);

    if (!segment) {
      return false;
    }

    state.transition = {
      segment,
      direction,
      fromIndex: state.routeIndex,
      toIndex,
      fromAnchor,
      toAnchor,
      needsCapture: fromAnchor.scene === 'HeroScene'
    };
    state.transitionStartedAt = performance.now();
    state.localProgress = 0;
    state.targetLocalProgress = 0;
    state.transitionUnits = 0;
    state.direction = direction;
    state.nextScene = toAnchor.scene;
    return true;
  }

  function update(renderState, delta, time) {
    updateTransitionProgress(delta);
    const view = getTourView(state);
    const targetConfig = view.targetKey ? TARGETS[view.targetKey] : null;
    const targetScene = targetConfig ? getSceneByName(scenes, targetConfig.sceneName) : null;
    const targetContainer = targetConfig ? sceneContainers.get(targetConfig.sceneName) : null;
    const shouldUpdateHero = view.targetPresence < 0.998;
    const shouldUpdateTarget = Boolean(
      targetScene
      && (
        view.targetPresence > 0.001
        || isDirectGeoJourneyTransition()
      )
    );

    sceneContainers.forEach((container, name) => {
      container.visible = name === 'HeroScene' ? shouldUpdateHero : (
        shouldUpdateTarget && name === targetConfig.sceneName
      );
    });

    updateHeroTargetState(heroScene, targetConfig, view.targetPresence, lastTargetKey);
    lastTargetKey = targetConfig?.key ?? lastTargetKey;

    if (shouldUpdateHero) {
      heroScene.update(renderState, delta, time, view.targetPresence);
    } else {
      heroScene.overlay.style.opacity = '0';
    }

    if (shouldUpdateTarget) {
      updateTargetScene(targetScene, targetConfig, renderState, delta, time, view.targetPresence);
    }

    if (targetConfig && view.targetPresence > 0.001) {
      applyTargetTransition(
        renderState,
        view.targetPresence,
        heroScene,
        journeys.get(targetConfig.key),
        targetConfig,
        targetContainer,
        state.transition?.needsCapture ?? false
      );
      if (state.transition) state.transition.needsCapture = false;
    }

    applyTransitionFov(renderState, view.targetPresence);
    applyTransitionEnvironment(renderState, view.targetPresence);
    updateScrollHint(heroScene.scrollHint, state);

    if (isDirectGeoJourneyTransition()) {
      synchronizeDirectJourneyEndpoint();
    }

    const synchronizedView = getTourView(state);
    state.activeScene = synchronizedView.activeScene;
    state.nextScene = state.transition?.toAnchor.scene ?? null;
    state.scrollProgress = state.transition
      ? state.routeIndex + state.transition.direction * state.localProgress
      : state.routeIndex;
    diagnostics.update(synchronizedView, readVideoCurrentTime());
  }

  function updateTransitionProgress(delta) {
    if (!state.transition) {
      return;
    }

    if (isDirectGeoJourneyTransition()) {
      state.localProgress = state.targetLocalProgress;
      return;
    }

    const progressFactor = 1 - Math.exp(-PROGRESS_DAMPING * delta);

    state.localProgress += (
      state.targetLocalProgress - state.localProgress
    ) * progressFactor;

    if (
      state.targetLocalProgress >= ANCHOR_ARRIVAL_PROGRESS
      && state.localProgress >= ANCHOR_ARRIVAL_PROGRESS
    ) {
      completeTransition();
      return;
    }

    if (state.targetLocalProgress <= 0 && state.localProgress <= 0.001) {
      cancelTransition();
    }
  }

  function completeTransition() {
    const now = performance.now();

    state.routeIndex = state.transition.toIndex;
    state.transition = null;
    state.localProgress = 1;
    state.targetLocalProgress = 1;
    state.direction = 0;
    state.anchorLocked = true;
    state.lockedUntil = now + ANCHOR_RELEASE_MS;
    state.lastTransitionDurationMs = now - state.transitionStartedAt;
    state.lastAnchorReachedAt = now;
    state.nextScene = null;
    state.transitionUnits = getTourAnchor(state.routeIndex).scene === 'GeoScene'
      ? GEO_JOURNEY_WHEEL_STEPS
      : 0;
    synchronizeGeoJourneyUxEndpoint(state, geoJourneyWheelMode);
  }

  function cancelTransition() {
    const now = performance.now();

    state.transition = null;
    state.localProgress = 1;
    state.targetLocalProgress = 1;
    state.direction = 0;
    state.anchorLocked = true;
    state.lockedUntil = now + ANCHOR_RELEASE_MS;
    state.lastTransitionDurationMs = now - state.transitionStartedAt;
    state.lastAnchorReachedAt = now;
    state.nextScene = null;
    state.transitionUnits = getTourAnchor(state.routeIndex).scene === 'GeoScene'
      ? GEO_JOURNEY_WHEEL_STEPS
      : 0;
    synchronizeGeoJourneyUxEndpoint(state, geoJourneyWheelMode);
  }

  function isDirectGeoJourneyTransition() {
    return Boolean(
      geoJourneyWheelMode
      && state.transition?.segment?.target === 'geo'
    );
  }

  function synchronizeDirectJourneyEndpoint() {
    if (!state.transition) return;
    if (state.targetLocalProgress >= 1 - GEO_JOURNEY_PROGRESS_EPSILON) {
      completeTransition();
      return;
    }
    if (state.targetLocalProgress <= GEO_JOURNEY_PROGRESS_EPSILON) {
      cancelTransition();
    }
  }

  function dispose() {
    window.removeEventListener('wheel', handleWheel);
    diagnostics.dispose();
    scenes.forEach((scene) => scene.dispose?.());
    journeys.forEach((journey) => journey.reset());
    root.clear();
  }

  window.addEventListener('wheel', handleWheel, { passive: false });

  return {
    root,
    scenes,
    state,
    update,
    dispose,
    getScrollProgress() {
      return state.scrollProgress;
    },
    getRouteDefinition: getTourRouteDefinition
  };
}

function getTourView(state) {
  const anchor = getTourAnchor(state.routeIndex);

  if (!state.transition) {
    return {
      targetKey: anchor.target,
      targetPresence: anchor.scene === 'HeroScene' ? 0 : 1,
      activeScene: anchor.scene,
      anchor
    };
  }

  const { fromAnchor, toAnchor, segment } = state.transition;
  const fromIsTarget = fromAnchor.scene !== 'HeroScene';
  const targetPresence = fromIsTarget ? 1 - state.localProgress : state.localProgress;
  const targetSceneName = TARGETS[segment.target].sceneName;

  return {
    targetKey: segment.target,
    targetPresence,
    activeScene: targetPresence >= 0.5 ? targetSceneName : 'HeroScene',
    anchor: fromAnchor
  };
}

function updateHeroTargetState(heroScene, targetConfig, targetPresence, lastTargetKey) {
  if (targetConfig) {
    heroScene.setPlanetEntryProgress(targetConfig.nebulaName, targetPresence);
    return;
  }

  if (lastTargetKey && TARGETS[lastTargetKey]) {
    heroScene.setPlanetEntryProgress(TARGETS[lastTargetKey].nebulaName, 0);
  }
}

function updateTargetScene(scene, targetConfig, renderState, delta, time, progress) {
  if (targetConfig.key === 'geo') {
    scene.update(renderState, delta, time, mapGalaxyOpenProgress(progress), progress);
    return;
  }

  scene.update(renderState, delta, time, progress);
}

function applyTargetTransition(
  renderState,
  targetPresence,
  heroScene,
  journey,
  config,
  targetContainer,
  needsCapture
) {
  const planetPosition = heroScene.getPlanetWorldPosition(config.nebulaName, reusablePlanetTarget);

  if (!planetPosition) {
    return;
  }

  if (needsCapture || !journey.active) {
    journey.capture(renderState, planetPosition);
  }

  const handoff = smootherstep(0.38, 1, targetPresence);

  reusableDesiredCamera.copy(planetPosition).sub(config.localCore);
  targetContainer.position.copy(reusableDesiredCamera).multiplyScalar(1 - handoff);

  const pathProgress = mapCameraPathProgress(targetPresence);

  if (pathProgress >= 1) {
    reusableDesiredCamera.copy(journey.cameraPath.points.at(-1));
    reusableDesiredTarget.copy(journey.targetPath.points.at(-1));
  } else {
    journey.cameraPath.getPointAt(pathProgress, reusableDesiredCamera);
    journey.targetPath.getPointAt(pathProgress, reusableDesiredTarget);
  }
  applyCameraPose(renderState, reusableDesiredCamera, reusableDesiredTarget);
  renderState.exposure -= smoothstep(0.42, 0.82, targetPresence) * 0.035;
}

function createTargetJourney(config) {
  return {
    active: false,
    planetPosition: new THREE.Vector3(),
    cameraPath: null,
    targetPath: null,
    capture(renderState, planetPosition) {
      reusableCurrentCamera.set(
        renderState.cameraPosition.x + renderState.cameraOffset.x,
        renderState.cameraPosition.y + renderState.cameraOffset.y,
        renderState.cameraPosition.z + renderState.cameraOffset.z
      );
      reusableCurrentTarget.set(
        renderState.cubePosition.x + renderState.cameraOffset.targetX,
        renderState.cubePosition.y + renderState.cameraOffset.targetY,
        renderState.cubePosition.z + renderState.cameraOffset.targetZ
      );
      this.planetPosition.copy(planetPosition);

      const lockCamera = reusableCurrentCamera.clone().lerp(
        planetPosition.clone().add(config.lockOffset),
        0.2
      );
      const approachCamera = planetPosition.clone().add(config.approachOffset);
      const outerCamera = planetPosition.clone().add(config.outerOffset);
      const openingCamera = config.localCore.clone().add(config.openingOffset);
      const internalCamera = config.localCore.clone().add(config.cameraOffset);
      const lockTarget = reusableCurrentTarget.clone().lerp(planetPosition, 0.46);

      this.cameraPath = new THREE.CatmullRomCurve3(
        [
          reusableCurrentCamera.clone(),
          lockCamera,
          approachCamera,
          outerCamera,
          openingCamera,
          internalCamera
        ],
        false,
        'centripetal'
      );
      this.targetPath = new THREE.CatmullRomCurve3(
        [
          reusableCurrentTarget.clone(),
          lockTarget,
          planetPosition.clone(),
          planetPosition.clone(),
          config.localCore.clone().lerp(planetPosition, 0.35),
          config.localCore.clone()
        ],
        false,
        'centripetal'
      );
      this.active = true;
    },
    reset() {
      this.active = false;
      this.cameraPath = null;
      this.targetPath = null;
    }
  };
}

function normalizeWheelDelta(event) {
  const delta = getPixelWheelDelta(event);

  const direction = Math.sign(delta);
  const magnitude = Math.abs(delta);

  if (magnitude < WHEEL_DEAD_ZONE) {
    return 0;
  }

  if (magnitude <= WHEEL_SOFT_THRESHOLD) {
    return delta;
  }

  const softRange = MAX_NORMALIZED_WHEEL - WHEEL_SOFT_THRESHOLD;
  const compressedMagnitude = WHEEL_SOFT_THRESHOLD
    + softRange * (1 - Math.exp(-(magnitude - WHEEL_SOFT_THRESHOLD) / WHEEL_SOFTNESS));

  return direction * Math.min(compressedMagnitude, MAX_NORMALIZED_WHEEL);
}

function normalizeJourneyWheelUnit(event) {
  const delta = getPixelWheelDelta(event);

  if (Math.abs(delta) < WHEEL_DEAD_ZONE) {
    return 0;
  }

  return clamp(delta / 120, -1.25, 1.25);
}

function getPixelWheelDelta(event) {
  let delta = event.deltaY;

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    delta *= 16;
  } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    delta *= window.innerHeight;
  }

  return delta;
}

function snapGeoJourneyProgress(progress) {
  if (progress <= GEO_JOURNEY_PROGRESS_EPSILON) return 0;
  if (progress >= 1 - GEO_JOURNEY_PROGRESS_EPSILON) return 1;
  return progress;
}

function snapGeoJourneyUnits(units) {
  const clampedUnits = clamp(units, 0, GEO_JOURNEY_WHEEL_STEPS);
  if (clampedUnits <= GEO_JOURNEY_PROGRESS_EPSILON) return 0;
  if (clampedUnits >= GEO_JOURNEY_WHEEL_STEPS - GEO_JOURNEY_PROGRESS_EPSILON) {
    return GEO_JOURNEY_WHEEL_STEPS;
  }
  return Math.round(clampedUnits * 1_000_000) / 1_000_000;
}

function synchronizeGeoJourneyUxEndpoint(state, enabled) {
  if (!import.meta.env.DEV || !enabled || !window.__GEO_V3_UX_STATUS__) {
    return;
  }

  const anchor = getTourAnchor(state.routeIndex);
  const geoActive = anchor.scene === 'GeoScene';
  const status = window.__GEO_V3_UX_STATUS__;
  Object.assign(status, {
    journeyProgress: geoActive ? 1 : 0,
    previousJourneyProgress: geoActive ? 1 : 0,
    progressChangedAfterWheel: 0,
    scrollUnits: geoActive ? GEO_JOURNEY_WHEEL_STEPS : 0,
    routeTarget: anchor.id,
    routeCurrent: anchor.id,
    routeState: anchor.id,
    activeScene: anchor.scene,
    membraneProgress: geoActive ? 1 : 0,
    answerProgress: geoActive ? 1 : 0,
    citationProgress: geoActive ? 1 : 0,
    keywordProgress: geoActive ? 1 : 0,
    answerStreamProgress: geoActive ? 1 : 0,
    citationStreamProgress: geoActive ? 1 : 0,
    keywordStreamProgress: geoActive ? 1 : 0,
    seedProgress: geoActive ? 1 : 0,
    diskProgress: geoActive ? 1 : 0,
    bandsProgress: geoActive ? 1 : 0,
    chamberProgress: geoActive ? 1 : 0,
    responseProgress: geoActive ? 1 : 0,
    gradeProgress: geoActive ? 1 : 0
  });
  document.documentElement.dataset.geoV3UxStatus = JSON.stringify(status);
}

function isGeoV3JourneyWheelMode(search = window.location.search) {
  const params = new URLSearchParams(search);
  return params.get('geoVisual') === 'v3-cinematic'
    && params.get('geoGrade') === 'cinematic'
    && params.get('geoJourney') === 'v1';
}

function applyCameraPose(renderState, position, target) {
  renderState.cameraOffset.x = position.x - renderState.cameraPosition.x;
  renderState.cameraOffset.y = position.y - renderState.cameraPosition.y;
  renderState.cameraOffset.z = position.z - renderState.cameraPosition.z;
  renderState.cameraOffset.targetX = target.x - renderState.cubePosition.x;
  renderState.cameraOffset.targetY = target.y - renderState.cubePosition.y;
  renderState.cameraOffset.targetZ = target.z - renderState.cubePosition.z;
}

function applyTransitionFov(renderState, progress) {
  const focus = smoothstep(0.12, 0.72, progress);
  const settle = smoothstep(0.74, 1, progress);

  renderState.cameraFov = lerp(60, 47.5, focus);
  renderState.cameraFov = lerp(renderState.cameraFov, 46, settle);
}

function applyTransitionEnvironment(renderState, progress) {
  const colorShift = smoothstep(0.1, 0.7, progress);
  const targetSettle = smoothstep(0.62, 1, progress);

  blendedBackgroundColor.copy(heroBackgroundColor).lerp(transitionBackgroundColor, colorShift);
  blendedBackgroundColor.lerp(targetBackgroundColor, targetSettle);
  blendedFogColor.copy(transitionFogColor).lerp(targetFogColor, targetSettle);
  renderState.backgroundColor = blendedBackgroundColor;
  renderState.fogColor = blendedFogColor;
  renderState.fogNear = lerp(1.2, 1.65, colorShift);
  renderState.fogFar = lerp(6.5, 9.2, colorShift);
}

function updateScrollHint(scrollHint, state) {
  if (state.transition) {
    scrollHint.style.opacity = '0';
    return;
  }

  const anchor = getTourAnchor(state.routeIndex);

  scrollHint.textContent = anchor.scrollHint;
  scrollHint.style.opacity = '1';
}

function mapGalaxyOpenProgress(progress) {
  if (progress <= 0.3) return 0;
  if (progress <= 0.48) return smootherstep(0.3, 0.48, progress) * 0.25;
  if (progress <= 0.72) {
    return lerp(0.25, 0.75, smootherstep(0.48, 0.72, progress));
  }
  return lerp(0.75, 1, smootherstep(0.72, 1, progress));
}

function mapCameraPathProgress(progress) {
  return smootherstep(CAMERA_PATH_START_PROGRESS, 1, progress);
}

function createTourDiagnostics(state, geoJourneyWheelMode = false) {
  if (!import.meta.env.DEV) {
    return {
      recordWheel() {},
      update() {},
      dispose() {}
    };
  }

  const status = {
    routeIndex: state.routeIndex,
    currentChapter: getTourAnchor(state.routeIndex).id,
    currentAnchor: getTourAnchor(state.routeIndex).id,
    transitionFrom: null,
    transitionTo: null,
    localProgress: state.localProgress,
    targetLocalProgress: state.targetLocalProgress,
    direction: 'idle',
    rawDelta: 0,
    normalizedDelta: 0,
    normalizedWheelUnit: 0,
    scrollUnits: getGeoJourneyScrollUnits(state),
    routeTarget: getTourAnchor(state.routeIndex).id,
    routeCurrent: getTourAnchor(state.routeIndex).id,
    routeState: getTourAnchor(state.routeIndex).id,
    deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    wheelEventCount: 0,
    cumulativeRawDelta: 0,
    cumulativeEffectiveDelta: 0,
    activeScene: state.activeScene,
    nextScene: null,
    anchorLocked: state.anchorLocked,
    videoCurrentTime: 0,
    lastTransitionDurationMs: state.lastTransitionDurationMs,
    lastAnchorReachedAt: state.lastAnchorReachedAt,
    damping: geoJourneyWheelMode ? 0 : PROGRESS_DAMPING
  };
  let publishFrame = 0;

  window.__GALAXY_TOUR_STATUS__ = status;
  window.__HERO_GEO_SCROLL_STATUS__ = status;
  window.HERO_GEO_SCROLL_STATUS = status;
  publish();

  return {
    recordWheel(
      rawDelta,
      normalizedDelta,
      deltaMode,
      consumedDelta,
      normalizedWheelUnit = 0
    ) {
      status.rawDelta = rawDelta;
      status.normalizedDelta = normalizedDelta;
      status.normalizedWheelUnit = normalizedWheelUnit;
      status.deltaMode = deltaMode;
      status.wheelEventCount += 1;
      status.cumulativeRawDelta += rawDelta;
      status.cumulativeEffectiveDelta += consumedDelta;
      syncState();
      publish();
    },
    update(view, videoCurrentTime) {
      syncState();
      status.activeScene = view.activeScene;
      status.videoCurrentTime = videoCurrentTime;
      publishFrame += 1;
      if (publishFrame % 4 === 0) publish();
    },
    dispose() {
      delete window.__GALAXY_TOUR_STATUS__;
      delete window.__HERO_GEO_SCROLL_STATUS__;
      delete window.HERO_GEO_SCROLL_STATUS;
      delete document.documentElement.dataset.galaxyTourStatus;
      delete document.documentElement.dataset.heroGeoScrollStatus;
    }
  };

  function syncState() {
    const anchor = getTourAnchor(state.routeIndex);

    status.routeIndex = state.routeIndex;
    status.currentChapter = state.transition?.segment.id ?? anchor.id;
    status.currentAnchor = anchor.id;
    status.transitionFrom = state.transition?.fromAnchor.id ?? null;
    status.transitionTo = state.transition?.toAnchor.id ?? null;
    status.localProgress = state.localProgress;
    status.targetLocalProgress = state.targetLocalProgress;
    status.scrollUnits = getGeoJourneyScrollUnits(state);
    status.routeTarget = state.transition?.toAnchor.id ?? anchor.id;
    status.routeCurrent = anchor.id;
    status.routeState = state.transition?.segment.id ?? anchor.id;
    status.direction = state.direction > 0 ? 'down' : state.direction < 0 ? 'up' : 'idle';
    status.activeScene = state.activeScene;
    status.nextScene = state.nextScene;
    status.anchorLocked = state.anchorLocked;
    status.lastTransitionDurationMs = state.lastTransitionDurationMs;
    status.lastAnchorReachedAt = state.lastAnchorReachedAt;
  }

  function publish() {
    const serialized = JSON.stringify(status);

    // Re-publish the live object as well as the serialized DOM snapshot. During
    // Vite HMR an older manager may dispose after the replacement manager was
    // created; assigning here keeps the development-only diagnostic handle
    // attached to the currently active scene manager.
    window.__GALAXY_TOUR_STATUS__ = status;
    window.__HERO_GEO_SCROLL_STATUS__ = status;
    window.HERO_GEO_SCROLL_STATUS = status;
    document.documentElement.dataset.galaxyTourStatus = serialized;
    document.documentElement.dataset.heroGeoScrollStatus = serialized;
  }
}

function getGeoJourneyScrollUnits(state) {
  const anchor = getTourAnchor(state.routeIndex);

  if (!state.transition) {
    return anchor.scene === 'GeoScene' ? GEO_JOURNEY_WHEEL_STEPS : 0;
  }

  if (state.transition.segment.target !== 'geo') {
    return anchor.scene === 'GeoScene' ? GEO_JOURNEY_WHEEL_STEPS : 0;
  }

  const fromIsGeo = state.transition.fromAnchor.scene === 'GeoScene';
  const presence = fromIsGeo
    ? 1 - state.localProgress
    : state.localProgress;
  return snapGeoJourneyUnits(
    snapGeoJourneyProgress(presence) * GEO_JOURNEY_WHEEL_STEPS
  );
}

function readVideoCurrentTime() {
  const serialized = document.documentElement.dataset.galaxyVideoDiagnostics;

  if (!serialized) return 0;
  try {
    return Number(JSON.parse(serialized).currentTime) || 0;
  } catch {
    return 0;
  }
}

function getDebugRouteIndex(debugScene) {
  if (debugScene === 'geo') return 1;
  if (debugScene === 'fivea') return 3;
  if (debugScene === 'brandmind') return 5;
  return 0;
}

function getSceneByName(scenes, name) {
  return scenes.find((scene) => scene.name === name) ?? null;
}

function createTargetConfig(config) {
  return Object.freeze({
    ...config,
    localCore: new THREE.Vector3(...config.localCore),
    lockOffset: new THREE.Vector3(...config.lockOffset),
    approachOffset: new THREE.Vector3(...config.approachOffset),
    outerOffset: new THREE.Vector3(...config.outerOffset),
    openingOffset: new THREE.Vector3(...config.openingOffset),
    cameraOffset: new THREE.Vector3(...config.cameraOffset)
  });
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return x * x * x * (x * (x * 6 - 15) + 10);
}

function smootherstep(edge0, edge1, value) {
  return smoothstep(edge0, edge1, value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start, end, value) {
  return start + (end - start) * value;
}

export const worldSceneManager = {
  createSceneManager
};
