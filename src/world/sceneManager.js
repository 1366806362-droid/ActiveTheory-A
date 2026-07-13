import * as THREE from 'three';
import { createFiveAScene } from '../scenes/fiveAScene.js';
import { createGeoScene } from '../scenes/geoScene.js';

const SCENE_NAMES = [
  'HeroScene',
  'GeoScene',
  'FiveAScene',
  'MindScene',
  'DecisionScene'
];
const HERO_TRANSITION_END = 1;
const GEO_HOLD_END = 1.34;
const GEO_TRANSITION_END = 2;
const MAX_SCROLL_PROGRESS = 2;
const WHEEL_SENSITIVITY = 0.00115;
const MAX_NORMALIZED_WHEEL = 80;
const PROGRESS_DAMPING = 2.1;
const GEO_NEBULA_NAME = 'GEO Nebula';
const GEO_LOCAL_CORE = new THREE.Vector3(0.06, 0.04, -0.62);
const GEO_CAMERA_OFFSET = new THREE.Vector3(0.7, 0.82, 3.42);
const reusablePlanetTarget = new THREE.Vector3();
const reusableDesiredCamera = new THREE.Vector3();
const reusableCurrentCamera = new THREE.Vector3();
const reusableCurrentTarget = new THREE.Vector3();
const reusableDesiredTarget = new THREE.Vector3();
const reusableApproachDirection = new THREE.Vector3();
const reusableOrbitDirection = new THREE.Vector3();
const reusableWorldUp = new THREE.Vector3(0, 1, 0);
const heroBackgroundColor = new THREE.Color('#020716');
const transitionBackgroundColor = new THREE.Color('#05132a');
const geoBackgroundColor = new THREE.Color('#071b2d');
const transitionFogColor = new THREE.Color('#05192b');
const geoFogColor = new THREE.Color('#072234');
const blendedBackgroundColor = new THREE.Color();
const blendedFogColor = new THREE.Color();

export function createSceneManager({ heroScene }) {
  const root = new THREE.Group();
  const geoScene = createGeoScene();
  const fiveAScene = createFiveAScene();
  const debugScene = new URLSearchParams(window.location.search).get('scene');
  const debugJourneyProgress = parseDebugJourneyProgress();
  const showTransitionDebug = readDebugFlag('showTransitionDebug', false);
  const startInGeoScene = debugScene === 'geo';
  const startInFiveAScene = debugScene === 'fivea';
  const initialProgress = debugJourneyProgress ?? (
    startInFiveAScene ? MAX_SCROLL_PROGRESS : startInGeoScene ? HERO_TRANSITION_END : 0
  );
  const scenes = [
    heroScene,
    geoScene,
    fiveAScene,
    ...createPlaceholderScenes()
  ];
  const state = {
    progress: initialProgress,
    targetProgress: initialProgress,
    scrollProgress: initialProgress,
    transitionProgress: clamp(initialProgress, 0, 1),
    galaxyOpenProgress: startInGeoScene || startInFiveAScene ? 1 : mapGalaxyOpenProgress(initialProgress),
    geoToFiveAProgress: startInFiveAScene ? 1 : 0,
    activeScene: startInFiveAScene ? 'FiveAScene' : startInGeoScene ? 'GeoScene' : 'HeroScene',
    nextScene: startInFiveAScene ? 'MindScene' : 'GeoScene'
  };
  const journey = createHeroGeoJourney();
  const sceneContainers = new Map();

  if (showTransitionDebug || debugJourneyProgress !== null) {
    window.__ACTIVE_THEORY_TRANSITION_DEBUG__ = {
      state,
      setJourneyProgress(value) {
        const progress = clamp(Number(value) || 0, 0, 1);

        state.progress = progress;
        state.targetProgress = progress;
      }
    };
  }

  root.name = 'ActiveTheorySceneManager';

  scenes.forEach((scene, index) => {
    const container = new THREE.Group();

    container.name = `${scene.name}Container`;
    container.visible = getInitialSceneVisibility(scene, index, debugScene);
    container.add(scene.group);
    root.add(container);
    sceneContainers.set(scene.name, container);
  });
  const heroContainer = sceneContainers.get('HeroScene');
  const geoContainer = sceneContainers.get('GeoScene');
  const fiveAContainer = sceneContainers.get('FiveAScene');

  function handleWheel(event) {
    const normalizedDelta = normalizeWheelDelta(event);

    if (event.cancelable) {
      event.preventDefault();
    }

    state.targetProgress = clamp(
      state.targetProgress + normalizedDelta * WHEEL_SENSITIVITY,
      0,
      MAX_SCROLL_PROGRESS
    );
  }

  window.addEventListener('wheel', handleWheel, { passive: false });

  function update(renderState, delta, time) {
    const progressFactor = 1 - Math.exp(-PROGRESS_DAMPING * delta);

    state.progress += (state.targetProgress - state.progress) * progressFactor;
    state.scrollProgress = state.progress;
    state.transitionProgress = clamp(state.progress, 0, 1);
    state.galaxyOpenProgress = startInGeoScene || startInFiveAScene
      ? 1
      : mapGalaxyOpenProgress(state.transitionProgress);
    state.geoToFiveAProgress = smoothstep(GEO_HOLD_END, GEO_TRANSITION_END, state.progress);
    const geoEntranceProgress = state.galaxyOpenProgress;
    state.activeScene = getActiveSceneName(state.transitionProgress, state.geoToFiveAProgress);
    state.nextScene = state.activeScene === 'HeroScene' ? 'GeoScene' : 'FiveAScene';
    const shouldUpdateHero = state.transitionProgress < 0.998;
    const shouldUpdateGeo = geoEntranceProgress > 0.001 || startInGeoScene;
    const shouldUpdateFiveA = state.geoToFiveAProgress > 0.001;

    heroScene.setPlanetEntryProgress(GEO_NEBULA_NAME, state.transitionProgress);

    if (shouldUpdateHero) {
      heroScene.update(renderState, delta, time, state.transitionProgress);
    } else {
      heroScene.overlay.style.opacity = '0';
      heroScene.scrollHint.style.opacity = '0';
    }

    if (shouldUpdateGeo) {
      geoScene.update(
        renderState,
        delta,
        time,
        geoEntranceProgress,
        state.transitionProgress
      );
      applyGeoSceneExit(geoScene, state.geoToFiveAProgress);
    }

    if (shouldUpdateFiveA) {
      fiveAScene.update(renderState, delta, time, state.geoToFiveAProgress);
    }

    applyHeroToGeoTransition(
      renderState,
      state.transitionProgress,
      heroScene,
      journey,
      geoContainer
    );
    applyTransitionFov(renderState, state.transitionProgress);
    applyTransitionEnvironment(renderState, state.transitionProgress);
    applyGeoToFiveATransition(renderState, state.geoToFiveAProgress);

    heroContainer.visible = shouldUpdateHero;
    geoContainer.visible = shouldUpdateGeo;
    fiveAContainer.visible = shouldUpdateFiveA;
  }

  function dispose() {
    window.removeEventListener('wheel', handleWheel);
    delete window.__ACTIVE_THEORY_TRANSITION_DEBUG__;
    scenes.forEach((scene) => {
      scene.dispose?.();
    });
    root.clear();
  }

  return {
    root,
    scenes,
    state,
    update,
    dispose,
    getScrollProgress() {
      return state.scrollProgress;
    }
  };
}

function normalizeWheelDelta(event) {
  let delta = event.deltaY;

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    delta *= 16;
  } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    delta *= window.innerHeight;
  }

  return clamp(delta, -MAX_NORMALIZED_WHEEL, MAX_NORMALIZED_WHEEL);
}

function createPlaceholderScenes() {
  return SCENE_NAMES.slice(3).map((name) => ({
    name,
    group: createPlaceholderGroup(name),
    update() {},
    dispose() {
      this.group.clear();
    }
  }));
}

function getInitialSceneVisibility(scene, index, debugScene) {
  if (debugScene === 'geo') {
    return scene.name === 'GeoScene';
  }

  if (debugScene === 'fivea') {
    return scene.name === 'FiveAScene';
  }

  return index === 0;
}

function getActiveSceneName(heroToGeoProgress, geoToFiveAProgress) {
  if (geoToFiveAProgress >= 0.5) {
    return 'FiveAScene';
  }

  return heroToGeoProgress < 0.94 ? 'HeroScene' : 'GeoScene';
}

function createPlaceholderGroup(name) {
  const group = new THREE.Group();

  group.name = name;

  return group;
}

function applyHeroToGeoTransition(renderState, transitionProgress, heroScene, journey, geoContainer) {
  if (transitionProgress <= 0.001) {
    journey.reset();
    geoContainer.position.set(0, 0, 0);
    return;
  }

  const planetPosition = heroScene.getPlanetWorldPosition(GEO_NEBULA_NAME, reusablePlanetTarget);

  if (!planetPosition) {
    return;
  }

  if (!journey.active) {
    journey.capture(renderState, planetPosition);
  }

  const handoff = smootherstep(0.55, 1, transitionProgress);

  // GEO's existing content remains untouched. Its container temporarily aligns
  // the existing core with the Hero GEO nebula, then eases back to its normal pose.
  reusableDesiredCamera.copy(journey.planetPosition).sub(GEO_LOCAL_CORE);
  geoContainer.position.copy(reusableDesiredCamera).multiplyScalar(1 - handoff);

  const pathProgress = smootherstep(0, 1, transitionProgress);

  if (pathProgress >= 1) {
    reusableDesiredCamera.copy(journey.cameraPath.points.at(-1));
    reusableDesiredTarget.copy(journey.targetPath.points.at(-1));
  } else {
    journey.cameraPath.getPointAt(pathProgress, reusableDesiredCamera);
    journey.targetPath.getPointAt(pathProgress, reusableDesiredTarget);
  }
  applyCameraPose(renderState, reusableDesiredCamera, reusableDesiredTarget);
  renderState.exposure -= smoothstep(0.58, 0.9, transitionProgress) * 0.035;
}

function createHeroGeoJourney() {
  const journey = {
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
        planetPosition.clone().add(new THREE.Vector3(0.9, 0.52, 4.15)),
        0.2
      );
      const approachCamera = planetPosition.clone().add(new THREE.Vector3(0.96, 0.62, 3.92));
      const outerCamera = planetPosition.clone().add(new THREE.Vector3(0.72, 0.68, 3.3));
      const openingCamera = GEO_LOCAL_CORE.clone().add(new THREE.Vector3(0.92, 0.88, 3.72));
      const internalCamera = GEO_LOCAL_CORE.clone().add(GEO_CAMERA_OFFSET);
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
          GEO_LOCAL_CORE.clone().lerp(planetPosition, 0.35),
          GEO_LOCAL_CORE.clone()
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

  return journey;
}

function applyCameraPose(renderState, position, target) {
  renderState.cameraOffset.x = position.x - renderState.cameraPosition.x;
  renderState.cameraOffset.y = position.y - renderState.cameraPosition.y;
  renderState.cameraOffset.z = position.z - renderState.cameraPosition.z;
  renderState.cameraOffset.targetX = target.x - renderState.cubePosition.x;
  renderState.cameraOffset.targetY = target.y - renderState.cubePosition.y;
  renderState.cameraOffset.targetZ = target.z - renderState.cubePosition.z;
}

function applyTransitionFov(renderState, transitionProgress) {
  const focus = smoothstep(0.22, 0.78, transitionProgress);
  const settle = smoothstep(0.82, 1, transitionProgress);

  renderState.cameraFov = lerp(60, 47.5, focus);
  renderState.cameraFov = lerp(renderState.cameraFov, 46, settle);
}

function applyTransitionEnvironment(renderState, transitionProgress) {
  const colorShift = smoothstep(0.16, 0.78, transitionProgress);
  const geoSettle = smoothstep(0.72, 1, transitionProgress);

  blendedBackgroundColor.copy(heroBackgroundColor).lerp(transitionBackgroundColor, colorShift);
  blendedBackgroundColor.lerp(geoBackgroundColor, geoSettle);
  blendedFogColor.copy(transitionFogColor).lerp(geoFogColor, geoSettle);
  renderState.backgroundColor = blendedBackgroundColor;
  renderState.fogColor = blendedFogColor;
  renderState.fogNear = lerp(1.2, 1.65, colorShift);
  renderState.fogFar = lerp(6.5, 9.2, colorShift);
}

function applyGeoToFiveATransition(renderState, transitionProgress) {
  if (transitionProgress <= 0) {
    return;
  }

  const eased = easeInOutCubic(transitionProgress);

  renderState.cameraOffset.z -= eased * 0.96;
  renderState.cameraOffset.x -= Math.sin(eased * Math.PI) * 0.12 + eased * 0.16;
  renderState.cameraOffset.y += Math.sin(eased * Math.PI) * 0.1;
  renderState.cameraOffset.targetX -= eased * 0.1;
  renderState.cameraOffset.targetY += Math.sin(eased * Math.PI) * 0.12;
}

function applyGeoSceneExit(geoScene, transitionProgress) {
  if (transitionProgress <= 0) {
    return;
  }

  const eased = easeInOutCubic(transitionProgress);

  geoScene.group.position.z -= eased * 2.4;
  geoScene.group.position.y += eased * 0.4;
  geoScene.group.rotation.y += eased * 0.16;
  geoScene.group.scale.setScalar(1 - eased * 0.12);
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return x * x * x * (x * (x * 6 - 15) + 10);
}

function smootherstep(edge0, edge1, value) {
  return smoothstep(edge0, edge1, value);
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start, end, value) {
  return start + (end - start) * value;
}

function mapGalaxyOpenProgress(journeyProgress) {
  if (journeyProgress <= 0.55) {
    return 0;
  }

  if (journeyProgress <= 0.72) {
    return smootherstep(0.55, 0.72, journeyProgress) * 0.25;
  }

  if (journeyProgress <= 0.88) {
    return lerp(0.25, 0.7, smootherstep(0.72, 0.88, journeyProgress));
  }

  return lerp(0.7, 1, smootherstep(0.88, 1, journeyProgress));
}

function parseDebugJourneyProgress() {
  const params = new URLSearchParams(window.location.search);

  if (!params.has('debugJourneyProgress')) {
    return null;
  }

  const value = Number(params.get('debugJourneyProgress'));

  return Number.isFinite(value) ? clamp(value, 0, 1) : null;
}

function readDebugFlag(name, fallback) {
  const params = new URLSearchParams(window.location.search);

  if (!params.has(name)) {
    return fallback;
  }

  return params.get(name) !== '0' && params.get(name) !== 'false';
}

export const worldSceneManager = {
  createSceneManager
};
