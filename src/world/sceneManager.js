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
const HERO_HOLD_END = 0;
const HERO_TRANSITION_END = 1.18;
const GEO_HOLD_END = 1.34;
const GEO_TRANSITION_END = 2;
const MAX_SCROLL_PROGRESS = 2;
const SCROLL_RESPONSE = 5200;
const MAX_WHEEL_STEP = 0.075;
const PROGRESS_DAMPING = 1.85;
const WHEEL_TRIGGER_THRESHOLD = 18;
const GEO_PLANET_NAME = 'GEO Universe';
const reusablePlanetTarget = new THREE.Vector3();
const reusableDesiredCamera = new THREE.Vector3();
const reusableCurrentCamera = new THREE.Vector3();
const reusableCurrentTarget = new THREE.Vector3();
const reusableDesiredTarget = new THREE.Vector3();

export function createSceneManager({ heroScene }) {
  const root = new THREE.Group();
  const geoScene = createGeoScene();
  const fiveAScene = createFiveAScene();
  const debugScene = new URLSearchParams(window.location.search).get('scene');
  const startInGeoScene = debugScene === 'geo';
  const startInFiveAScene = debugScene === 'fivea';
  const initialProgress = startInFiveAScene ? MAX_SCROLL_PROGRESS : startInGeoScene ? HERO_TRANSITION_END : 0;
  const scenes = [
    heroScene,
    geoScene,
    fiveAScene,
    ...createPlaceholderScenes()
  ];
  const state = {
    progress: initialProgress,
    targetProgress: initialProgress,
    scrollVelocity: 0,
    scrollProgress: initialProgress,
    transitionProgress: startInGeoScene || startInFiveAScene ? 1 : 0,
    geoToFiveAProgress: startInFiveAScene ? 1 : 0,
    activeScene: startInFiveAScene ? 'FiveAScene' : startInGeoScene ? 'GeoScene' : 'HeroScene',
    nextScene: startInFiveAScene ? 'MindScene' : 'GeoScene'
  };

  root.name = 'ActiveTheorySceneManager';

  scenes.forEach((scene, index) => {
    scene.group.position.z = index === 0 ? 0 : -4.8;
    scene.group.visible = getInitialSceneVisibility(scene, index, debugScene);
    root.add(scene.group);
  });

  function handleWheel(event) {
    if (Math.abs(event.deltaY) < WHEEL_TRIGGER_THRESHOLD) {
      return;
    }

    const scrollStep = Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY) / SCROLL_RESPONSE, MAX_WHEEL_STEP);

    state.targetProgress = clamp(state.targetProgress + scrollStep, 0, HERO_TRANSITION_END);

    state.scrollVelocity = 0;
  }

  window.addEventListener('wheel', handleWheel, { passive: true });

  function update(renderState, delta, time) {
    const follow = 1 - Math.exp(-PROGRESS_DAMPING * delta);

    state.progress += (state.targetProgress - state.progress) * follow;
    state.scrollProgress = state.progress;
    state.transitionProgress = smoothstep(HERO_HOLD_END, HERO_TRANSITION_END, state.progress);
    state.geoToFiveAProgress = smoothstep(GEO_HOLD_END, GEO_TRANSITION_END, state.progress);
    const geoEntranceProgress = 0;
    state.activeScene = getActiveSceneName(state.transitionProgress, state.geoToFiveAProgress);
    state.nextScene = state.activeScene === 'HeroScene' ? 'GeoScene' : 'FiveAScene';
    const shouldUpdateHero = true;
    const shouldUpdateGeo = false;
    const shouldUpdateFiveA = state.geoToFiveAProgress > 0.001;

    if (shouldUpdateHero) {
      heroScene.update(renderState, delta, time, state.transitionProgress);
    } else {
      heroScene.overlay.style.opacity = '0';
    }

    applyHeroToGeoTransition(renderState, state.transitionProgress, heroScene);

    if (shouldUpdateGeo) {
      geoScene.update(renderState, delta, time, geoEntranceProgress);
      applyGeoSceneExit(geoScene, state.geoToFiveAProgress);
    }

    if (shouldUpdateFiveA) {
      fiveAScene.update(renderState, delta, time, state.geoToFiveAProgress);
    }

    applyGeoToFiveATransition(renderState, state.geoToFiveAProgress);

    heroScene.group.visible = shouldUpdateHero;
    geoScene.group.visible = false;
    fiveAScene.group.visible = shouldUpdateFiveA;
  }

  function dispose() {
    window.removeEventListener('wheel', handleWheel);
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

  return heroToGeoProgress < 0.5 ? 'HeroScene' : 'GeoScene';
}

function createPlaceholderGroup(name) {
  const group = new THREE.Group();

  group.name = name;

  return group;
}

function applyHeroToGeoTransition(renderState, transitionProgress, heroScene) {
  if (transitionProgress <= 0) {
    return;
  }

  const eased = easeInOutCubic(transitionProgress);
  const planetPosition = heroScene.getPlanetWorldPosition(GEO_PLANET_NAME, reusablePlanetTarget);

  if (!planetPosition) {
    renderState.cameraOffset.z -= eased * 1.46;
    renderState.cameraOffset.x += Math.sin(eased * Math.PI) * 0.16 + eased * 0.12;
    renderState.cameraOffset.y += Math.sin(eased * Math.PI) * 0.1;
    renderState.cameraOffset.targetX += eased * 0.16;
    renderState.cameraOffset.targetY += Math.sin(eased * Math.PI) * 0.08;
    renderState.cameraOffset.targetZ -= eased * 0.38;

    return;
  }

  const lockProgress = smoothstep(0.04, 0.38, transitionProgress);
  const approachProgress = smoothstep(0.08, 0.4, transitionProgress);
  const orbitProgress = smoothstep(0.4, 0.7, transitionProgress);
  const entryProgress = smoothstep(0.7, 1, transitionProgress);
  const travelProgress = clamp(approachProgress * 0.42 + orbitProgress * 0.38 + entryProgress * 0.2, 0, 1);
  const sideArc = Math.sin((approachProgress * 0.65 + orbitProgress * 0.35) * Math.PI);

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
  reusableDesiredTarget.copy(planetPosition);
  reusableDesiredTarget.x += 0.03 + orbitProgress * 0.08;
  reusableDesiredTarget.y += 0.02 + orbitProgress * 0.04;
  reusableDesiredCamera.copy(planetPosition);
  reusableDesiredCamera.x += 2.08 - orbitProgress * 0.56 - entryProgress * 0.3 + sideArc * 0.18;
  reusableDesiredCamera.y += 0.5 - orbitProgress * 0.14 - entryProgress * 0.08 + sideArc * 0.06;
  reusableDesiredCamera.z += 3.12 - approachProgress * 0.72 - orbitProgress * 0.62 - entryProgress * 0.36;

  reusableCurrentTarget.lerp(reusableDesiredTarget, lockProgress);
  reusableCurrentCamera.lerp(reusableDesiredCamera, travelProgress);
  renderState.cameraOffset.x = reusableCurrentCamera.x - renderState.cameraPosition.x;
  renderState.cameraOffset.y = reusableCurrentCamera.y - renderState.cameraPosition.y;
  renderState.cameraOffset.z = reusableCurrentCamera.z - renderState.cameraPosition.z;
  renderState.cameraOffset.targetX = reusableCurrentTarget.x - renderState.cubePosition.x;
  renderState.cameraOffset.targetY = reusableCurrentTarget.y - renderState.cubePosition.y;
  renderState.cameraOffset.targetZ = reusableCurrentTarget.z - renderState.cubePosition.z;

  if (heroScene.group.visible) {
    const galaxyFocus = smoothstep(0.18, 0.7, transitionProgress);
    const galaxyRecede = smoothstep(0.62, 1, transitionProgress);
    const galaxyOrbit = smoothstep(0.32, 1, transitionProgress);

    heroScene.group.scale.multiplyScalar(1 - galaxyRecede * 0.06);
    heroScene.group.position.z -= galaxyRecede * 0.24;
    heroScene.group.position.x -= galaxyFocus * 0.24;
    heroScene.group.position.y += galaxyFocus * 0.04;
    heroScene.group.rotation.y -= galaxyFocus * 0.22 + galaxyOrbit * 0.14;
    heroScene.group.rotation.x += galaxyOrbit * 0.08;
    heroScene.group.rotation.z -= Math.sin(galaxyOrbit * Math.PI) * 0.035;
  }
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

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export const worldSceneManager = {
  createSceneManager
};
