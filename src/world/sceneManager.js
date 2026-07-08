import * as THREE from 'three';

const SCENE_NAMES = [
  'HeroScene',
  'GeoScene',
  'FiveAScene',
  'MindScene',
  'DecisionScene'
];

export function createSceneManager({ heroScene }) {
  const root = new THREE.Group();
  const scenes = [heroScene, ...createPlaceholderScenes()];
  const state = {
    progress: 0,
    targetProgress: 0,
    scrollProgress: 0
  };

  root.name = 'ActiveTheorySceneManager';

  scenes.forEach((scene, index) => {
    scene.group.position.z = -index * 3.5;
    scene.group.visible = index === 0;
    root.add(scene.group);
  });

  function handleWheel(event) {
    const scrollDelta = event.deltaY / 1800;

    state.targetProgress = clamp(state.targetProgress + scrollDelta, 0, 1);
  }

  window.addEventListener('wheel', handleWheel, { passive: true });

  function update(renderState, delta, time) {
    const follow = 1 - Math.exp(-3.2 * delta);

    state.progress += (state.targetProgress - state.progress) * follow;
    state.scrollProgress = state.progress;

    scenes.forEach((scene, index) => {
      const sceneProgress = getSceneProgress(state.progress, index);
      const distanceFromActive = Math.abs(sceneProgress);

      scene.group.visible = index === 0 || distanceFromActive < 1.2;
      scene.group.position.z = -index * 3.5 + state.progress * 3.5 * (SCENE_NAMES.length - 1);
      scene.group.position.y = sceneProgress * -0.24;

      if (scene.update) {
        scene.update(renderState, delta, time, state.progress);
      }
    });
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
  return SCENE_NAMES.slice(1).map((name) => ({
    name,
    group: createPlaceholderGroup(name),
    update() {},
    dispose() {
      this.group.clear();
    }
  }));
}

function createPlaceholderGroup(name) {
  const group = new THREE.Group();

  group.name = name;

  return group;
}

function getSceneProgress(progress, sceneIndex) {
  const sceneCount = SCENE_NAMES.length - 1;

  return progress * sceneCount - sceneIndex;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export const worldSceneManager = {
  createSceneManager
};
