import * as THREE from 'three';
import {
  createUniverseRoot,
  updateUniverseRoot
} from '../universe/universeRoot.js';

export function createHeroScene() {
  const group = new THREE.Group();
  const universeRoot = createUniverseRoot();
  const overlay = createHeroOverlay();

  group.name = 'HeroScene';
  group.add(universeRoot.root);

  function update(renderState, delta, time, sceneProgress) {
    const exitProgress = smoothstep(0.08, 0.34, sceneProgress);

    updateUniverseRoot(renderState, delta, time);
    group.position.z = -exitProgress * 2.8;
    group.position.y = exitProgress * 0.35;
    group.rotation.y = -exitProgress * 0.16;
    group.scale.setScalar(1 - exitProgress * 0.08);
    renderState.cameraOffset.z -= exitProgress * 0.86;
    renderState.cameraOffset.targetY += exitProgress * 0.1;
    overlay.style.opacity = String(1 - smoothstep(0.03, 0.22, sceneProgress));
    overlay.style.transform = `translate3d(0, ${-exitProgress * 18}px, 0)`;
  }

  function dispose() {
    universeRoot.dispose();
    overlay.remove();
    group.clear();
  }

  return {
    name: 'HeroScene',
    group,
    overlay,
    universeRoot,
    update,
    dispose
  };
}

function createHeroOverlay() {
  const overlay = document.createElement('section');
  const eyebrow = document.createElement('p');
  const title = document.createElement('h1');
  const subtitle = document.createElement('p');
  const meta = document.createElement('p');
  const statusList = document.createElement('div');
  const statuses = [
    ['AI DATA ENGINE', 'ONLINE'],
    ['5A NETWORK', 'READY'],
    ['GEO SIGNAL', 'ACTIVE']
  ];

  overlay.className = 'hero-copy';
  eyebrow.className = 'hero-copy__eyebrow';
  title.className = 'hero-copy__title';
  subtitle.className = 'hero-copy__subtitle';
  meta.className = 'hero-copy__meta';
  statusList.className = 'hero-copy__status-list';
  eyebrow.textContent = 'ActiveTheory';
  title.textContent = '\u54c1\u724c\u8ba4\u77e5\u5b87\u5b99';
  subtitle.textContent = 'Brand Intelligence Universe';
  meta.textContent = 'AI \u00d7 Data \u00d7 Growth';

  statuses.forEach(([label, value]) => {
    const status = document.createElement('p');
    const statusLabel = document.createElement('span');
    const statusValue = document.createElement('strong');

    status.className = 'hero-copy__status';
    statusLabel.textContent = label;
    statusValue.textContent = value;
    status.append(statusLabel, statusValue);
    statusList.append(status);
  });

  overlay.append(eyebrow, title, subtitle, meta, statusList);

  return overlay;
}

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * (3 - 2 * x);
}

export const heroSceneManager = {
  createHeroScene
};
