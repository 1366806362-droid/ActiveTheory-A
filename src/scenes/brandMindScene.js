import * as THREE from 'three';

const STAR_COUNT = 220;
const RING_COUNT = 180;

export function createBrandMindScene() {
  const group = new THREE.Group();
  const stars = createStars();
  const core = createCore();
  const label = createLabel();

  group.name = 'BrandMindScene';
  group.position.set(0, 0, -0.72);
  group.add(stars.points, core.group, label.sprite);

  function update(renderState, delta, time, transitionProgress = 1) {
    const reveal = smootherstep(0.08, 0.94, transitionProgress);

    group.visible = transitionProgress > 0.001;
    group.scale.setScalar(0.72 + reveal * 0.28);
    group.rotation.y = Math.sin(time * 0.022) * 0.025;
    stars.update(delta, time, reveal);
    core.update(delta, time, reveal);
    label.material.opacity = smootherstep(0.72, 0.96, reveal) * 0.86;
    renderState.exposure += reveal * 0.012;
  }

  function dispose() {
    stars.dispose();
    core.dispose();
    label.dispose();
    group.clear();
  }

  return {
    name: 'BrandMindScene',
    group,
    update,
    dispose,
    isShell: true
  };
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const purple = new THREE.Color('#7456b8');
  const ice = new THREE.Color('#dcecff');

  for (let index = 0; index < STAR_COUNT; index += 1) {
    const stride = index * 3;
    const angle = index * 2.399963 + pseudoRandom(index * 1.73) * 0.8;
    const radius = 1.05 + Math.pow(pseudoRandom(index * 3.17), 0.72) * 4.6;
    const depth = pseudoRandom(index * 7.91);
    const color = purple.clone().lerp(ice, pseudoRandom(index * 4.33) * 0.72);

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = (pseudoRandom(index * 5.29) - 0.5) * (2.8 + depth * 2.2);
    positions[stride + 2] = -2.1 - depth * 6.4;
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.036,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'BrandMindSceneShellStars';

  return {
    points,
    update(delta, time, reveal) {
      points.rotation.y = time * 0.006;
      points.rotation.z += delta * 0.002;
      material.opacity = reveal * 0.34;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createCore() {
  const group = new THREE.Group();
  const geometry = new THREE.IcosahedronGeometry(0.58, 3);
  const material = new THREE.MeshBasicMaterial({
    color: '#a991e8',
    wireframe: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  const ringGeometry = new THREE.BufferGeometry();
  const ringPositions = new Float32Array(RING_COUNT * 3);

  for (let index = 0; index < RING_COUNT; index += 1) {
    const angle = index / RING_COUNT * Math.PI * 2;
    const radius = 0.86 + (pseudoRandom(index * 2.41) - 0.5) * 0.16;
    const stride = index * 3;

    ringPositions[stride] = Math.cos(angle) * radius;
    ringPositions[stride + 1] = (pseudoRandom(index * 4.19) - 0.5) * 0.16;
    ringPositions[stride + 2] = Math.sin(angle) * radius * 0.72;
  }

  ringGeometry.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
  const ringMaterial = new THREE.PointsMaterial({
    color: '#dcecff',
    size: 0.032,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const ring = new THREE.Points(ringGeometry, ringMaterial);

  group.name = 'BrandMindSceneShellCore';
  group.add(mesh, ring);

  return {
    group,
    update(delta, time, reveal) {
      group.rotation.y += delta * 0.055;
      group.rotation.z = Math.sin(time * 0.035) * 0.06;
      mesh.scale.setScalar(0.82 + reveal * 0.18);
      material.opacity = reveal * 0.5;
      ringMaterial.opacity = reveal * 0.46;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      group.clear();
    }
  };
}

function createLabel() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 1024;
  canvas.height = 256;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = '#9b83d5';
  context.shadowBlur = 16;
  context.fillStyle = '#eef5ff';
  context.font = '700 54px Inter, Arial, sans-serif';
  context.fillText('BRAND MIND', 512, 92);
  context.fillStyle = '#bda9ef';
  context.font = '400 34px Inter, Arial, sans-serif';
  context.fillText('\u54c1\u724c\u5fc3\u667a', 512, 162);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);

  sprite.name = 'BrandMindSceneShellLabel';
  sprite.position.set(0, -1.05, 0.12);
  sprite.scale.set(2.35, 0.59, 1);
  sprite.renderOrder = 20;

  return {
    sprite,
    material,
    dispose() {
      texture.dispose();
      material.dispose();
    }
  };
}

function pseudoRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898 + 78.233) * 43758.5453) % 1;
}

function smootherstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * x * (x * (x * 6 - 15) + 10);
}

export const brandMindSceneManager = {
  createBrandMindScene
};
