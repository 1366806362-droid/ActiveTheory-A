const scenes = new Map();
let activeSceneName = null;

export function registerScene(name, scene) {
  scenes.set(name, scene);
}

export function getScene(name) {
  return scenes.get(name) || null;
}

export function setActiveScene(name) {
  const scene = getScene(name);

  if (!scene) {
    return null;
  }

  activeSceneName = name;
  return scene;
}

export function getActiveScene() {
  if (!activeSceneName) {
    return null;
  }

  return getScene(activeSceneName);
}

export const sceneManager = {
  registerScene,
  getScene,
  setActiveScene,
  getActiveScene
};
