import * as THREE from 'three';
import {
  createUniverseRoot,
  updateUniverseRoot
} from '../universe/universeRoot.js';

export function createHeroScene() {
  const group = new THREE.Group();
  const universeRoot = createUniverseRoot();
  const { overlay, scrollHint } = createHeroOverlay();
  const debugMainGalaxyOnly = readDebugFlag('debugMainGalaxyOnly', false);

  group.name = 'HeroScene';
  group.add(universeRoot.root);
  overlay.style.display = debugMainGalaxyOnly ? 'none' : '';
  scrollHint.style.display = debugMainGalaxyOnly ? 'none' : '';

  function update(renderState, delta, time, sceneProgress) {
    const heroPresence = 1 - smoothstep(0.68, 0.97, sceneProgress);
    const brandCoreDeparture = smoothstep(0.34, 0.9, sceneProgress);
    const sceneDeparture = smoothstep(0.9, 0.99, sceneProgress);

    updateUniverseRoot(renderState, delta, time, sceneProgress);
    // The core update restores its idle pose each frame. Apply departure as an
    // absolute transform so scroll progress cannot compound over time.
    universeRoot.energyCore.group.scale.multiplyScalar(1 - brandCoreDeparture * 0.46);
    universeRoot.energyCore.group.position.x = 0.46 - brandCoreDeparture * 0.3;
    universeRoot.energyCore.group.position.z = -brandCoreDeparture * 0.68;
    universeRoot.energyCore.group.visible = brandCoreDeparture < 0.98;
    renderState.cameraOffset.x += (0.12 + Math.sin(time * 0.032) * 0.14) * heroPresence;
    renderState.cameraOffset.y += (0.03 + Math.sin(time * 0.024 + 0.7) * 0.055) * heroPresence;
    renderState.cameraOffset.z += (0.34 - Math.sin(time * 0.02) * 0.08) * heroPresence;
    renderState.cameraOffset.targetX += 0.18 * heroPresence;
    renderState.cameraOffset.targetY += (0.02 + Math.sin(time * 0.028) * 0.045) * heroPresence;
    group.position.set(0, 0, -sceneDeparture * 0.9);
    group.rotation.set(0, 0, 0);
    group.scale.setScalar(1 - sceneDeparture * 0.82);
    overlay.style.opacity = String(1 - smoothstep(0.06, 0.4, sceneProgress));
    overlay.style.transform = `translate3d(0, ${-smoothstep(0.06, 0.4, sceneProgress) * 14}px, 0)`;
    scrollHint.style.opacity = String(1 - smoothstep(0.02, 0.18, sceneProgress));
  }

  function dispose() {
    universeRoot.dispose();
    overlay.remove();
    scrollHint.remove();
    group.clear();
  }

  return {
    name: 'HeroScene',
    group,
    overlay,
    scrollHint,
    universeRoot,
    getPlanetWorldPosition(name, target) {
      return universeRoot.getPlanetWorldPosition(name, target);
    },
    setPlanetEntryProgress(name, progress) {
      universeRoot.setPlanetEntryProgress(name, progress);
    },
    update,
    dispose
  };
}

function createHeroOverlay() {
  const overlay = document.createElement('section');
  const scrollHint = document.createElement('div');
  const eyebrow = document.createElement('p');
  const title = document.createElement('h1');
  const subtitle = document.createElement('p');
  const meta = document.createElement('p');

  overlay.className = 'hero-copy';
  scrollHint.className = 'hero-scroll-hint';
  eyebrow.className = 'hero-copy__eyebrow';
  title.className = 'hero-copy__title';
  subtitle.className = 'hero-copy__subtitle';
  meta.className = 'hero-copy__meta';
  eyebrow.textContent = 'ACTIVE THEORY';
  title.textContent = '\u54c1\u724c\u8ba4\u77e5\u5b87\u5b99';
  subtitle.textContent = 'Brand Intelligence Universe';
  meta.textContent = 'AI \u00d7 Data \u00d7 Growth';

  overlay.append(eyebrow, title, subtitle, meta);
  scrollHint.textContent = 'Scroll to Explore';

  return { overlay, scrollHint };
}

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * (3 - 2 * x);
}

function readDebugFlag(name, fallback) {
  const params = new URLSearchParams(window.location.search);

  if (!params.has(name)) {
    return fallback;
  }

  return params.get(name) !== '0' && params.get(name) !== 'false';
}

export const heroSceneManager = {
  createHeroScene
};
