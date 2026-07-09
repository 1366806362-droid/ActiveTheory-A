import * as THREE from 'three';
import {
  createUniverseRoot,
  updateUniverseRoot
} from '../universe/universeRoot.js';

export function createHeroScene() {
  const group = new THREE.Group();
  const universeRoot = createUniverseRoot();
  const { overlay, scrollHint } = createHeroOverlay();

  group.name = 'HeroScene';
  group.add(universeRoot.root);

  function update(renderState, delta, time, sceneProgress) {
    const exitProgress = smoothstep(0.08, 0.34, sceneProgress);
    const heroPresence = 1 - exitProgress;

    updateUniverseRoot(renderState, delta, time);
    renderState.cameraOffset.x += (0.12 + Math.sin(time * 0.032) * 0.14) * heroPresence;
    renderState.cameraOffset.y += (0.03 + Math.sin(time * 0.024 + 0.7) * 0.055) * heroPresence;
    renderState.cameraOffset.z += (0.34 - Math.sin(time * 0.02) * 0.08) * heroPresence;
    renderState.cameraOffset.targetX += 0.18 * heroPresence;
    renderState.cameraOffset.targetY += (0.02 + Math.sin(time * 0.028) * 0.045) * heroPresence;
    group.position.set(0, exitProgress * 0.35, -exitProgress * 2.8);
    group.rotation.set(0, -exitProgress * 0.16, 0);
    group.scale.setScalar(1 - exitProgress * 0.08);
    renderState.cameraOffset.z -= exitProgress * 0.86;
    renderState.cameraOffset.targetY += exitProgress * 0.1;
    overlay.style.opacity = String(1 - smoothstep(0.03, 0.22, sceneProgress));
    overlay.style.transform = `translate3d(0, ${-exitProgress * 18}px, 0)`;
    scrollHint.style.opacity = String(1 - smoothstep(0.02, 0.16, sceneProgress));
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

export const heroSceneManager = {
  createHeroScene
};
