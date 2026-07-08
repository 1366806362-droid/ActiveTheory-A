import * as THREE from 'three';

const LAYERS = [
  {
    name: 'near',
    count: 420,
    width: 18,
    height: 10,
    zMin: 1.6,
    zMax: 8,
    size: 0.05,
    opacity: 0.18,
    speed: 0.006,
    interaction: 0.22
  },
  {
    name: 'mid',
    count: 1800,
    width: 30,
    height: 16,
    zMin: -16,
    zMax: 2,
    size: 0.032,
    opacity: 0.38,
    speed: 0.014,
    interaction: 0.12
  },
  {
    name: 'far',
    count: 1800,
    width: 46,
    height: 24,
    zMin: -44,
    zMax: -14,
    size: 0.018,
    opacity: 0.32,
    speed: 0.022,
    interaction: 0.055
  }
];

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export function createParticleField() {
  const group = new THREE.Group();
  const layers = LAYERS.map((layer, index) => createParticleLayer(layer, 20260707 + index * 101));
  const count = layers.reduce((total, layer) => total + layer.count, 0);

  group.name = 'ActiveTheoryParticleField';

  layers.forEach((layer) => {
    group.add(layer.points);
  });

  function update(delta, time, interaction) {
    layers.forEach((layer, index) => {
      layer.update(delta, time, interaction, index);
    });
  }

  function dispose() {
    layers.forEach((layer) => {
      layer.dispose();
    });
  }

  return {
    group,
    points: group,
    count,
    update,
    dispose
  };
}

function createParticleLayer(layer, seed) {
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(layer.count * 3);
  const colors = new Float32Array(layer.count * 3);
  const color = new THREE.Color();
  const baseColor = new THREE.Color(0x102b4c);
  const accentColor = new THREE.Color(0x00ccff);
  const hazeColor = new THREE.Color(0x4f7fa8);

  for (let i = 0; i < layer.count; i += 1) {
    const i3 = i * 3;
    const depth = random();
    const cluster = Math.pow(random(), 4);
    const spread = 0.55 + random() * 0.75;
    const x = (random() - 0.5) * layer.width * spread;
    const y = (random() - 0.5) * layer.height * spread;

    positions[i3] = x + Math.sin(depth * Math.PI * 7) * cluster * 2.2;
    positions[i3 + 1] = y + Math.cos(depth * Math.PI * 5) * cluster * 1.1;
    positions[i3 + 2] = layer.zMin + random() * (layer.zMax - layer.zMin);

    color.copy(baseColor).lerp(hazeColor, random() * 0.36);

    if (random() > 0.9) {
      color.lerp(accentColor, 0.22 + random() * 0.28);
    }

    const depthFade = 0.22 + depth * 0.42;
    colors[i3] = color.r * depthFade;
    colors[i3 + 1] = color.g * depthFade;
    colors[i3 + 2] = color.b * depthFade;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: layer.size,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: layer.opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.position.set(0, 1.2, -5);
  points.rotation.set(-0.08, 0.08, 0.03);

  function update(delta, time, interaction, index) {
    const influenceX = interaction?.x ?? 0;
    const influenceY = interaction?.y ?? 0;
    const influenceStrength = interaction?.strength ?? 0;

    points.rotation.y += delta * layer.speed;
    points.rotation.x = -0.08 + Math.sin(time * (0.06 + index * 0.02)) * 0.014 + influenceY * layer.interaction * 0.025;
    points.rotation.z = 0.03 + Math.sin(time * (0.045 + index * 0.012)) * 0.012 + influenceX * layer.interaction * 0.035;
    points.position.x = Math.sin(time * (0.035 + index * 0.01)) * 0.24 + influenceX * layer.interaction;
    points.position.y = 1.2 + Math.sin(time * (0.028 + index * 0.008)) * 0.1 + influenceY * layer.interaction * 0.45;
    points.position.z = -5 + Math.sin(time * (0.022 + index * 0.006)) * (0.45 + index * 0.18);
    material.opacity = layer.opacity + influenceStrength * 0.035;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    count: layer.count,
    update,
    dispose
  };
}

export const particleFieldManager = {
  createParticleField
};
