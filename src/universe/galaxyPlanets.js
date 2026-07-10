import * as THREE from 'three';
import { createGalaxyCoreCluster } from './galaxyCoreCluster.js';

const TAU = Math.PI * 2;
const NEBULAE = [
  {
    name: 'GEO Nebula',
    label: 'GEO',
    color: 0x00b8ff,
    accent: 0xb8f6ff,
    orbitRadius: 0.79,
    orbitScaleY: 0.72,
    size: 0.34,
    period: 210,
    spin: 0.052,
    phase: 1.12,
    depthScale: 0.22,
    tilt: [0.384, 0.04, -0.14],
    labelOffset: [0.03, 0.03, 0.08],
    hoverX: 0.28,
    hoverY: 0.12,
    brightness: 1.05,
    armCount: 2,
    coreCount: 4
  },
  {
    name: '5A Nebula',
    label: '5A',
    color: 0x728bff,
    accent: 0xd8e2ff,
    orbitRadius: 0.68,
    orbitScaleY: 0.42,
    size: 0.32,
    period: -260,
    spin: -0.042,
    phase: 5.25,
    depthScale: 0.26,
    tilt: [-0.524, -0.16, 0.28],
    labelOffset: [-0.13, -0.15, 0.08],
    hoverX: 0.24,
    hoverY: -0.45,
    brightness: 1.12,
    armCount: 2,
    coreCount: 4
  },
  {
    name: 'Brand Mind Nebula',
    label: '\u54c1\u724c\u5fc3\u667a',
    color: 0xaa7cff,
    accent: 0xf2e8ff,
    orbitRadius: 0.66,
    orbitScaleY: 0.54,
    size: 0.31,
    period: 300,
    spin: 0.036,
    phase: 2.86,
    depthScale: 0.2,
    tilt: [0.663, 0.08, 0.2],
    labelOffset: [-0.12, 0.22, 0.08],
    hoverX: -0.18,
    hoverY: 0.24,
    brightness: 0.82,
    armCount: 2,
    coreCount: 4
  }
];

export function createGalaxyPlanets() {
  const group = new THREE.Group();
  const particleTexture = createNebulaParticleTexture();
  const nebulae = NEBULAE.map((config, index) => (
    createBusinessNebula(config, particleTexture, 9107 + index * 193)
  ));
  const targetPosition = new THREE.Vector3();
  const entryState = {
    name: null,
    progress: 0
  };

  group.name = 'ActiveTheoryBusinessNebulae';
  group.position.set(0.46, 0.04, 0);
  group.rotation.set(-0.03, 0.02, 0);

  nebulae.forEach((nebula) => {
    group.add(nebula.group);
  });

  function update(delta, time, interaction) {
    group.rotation.y = Math.sin(time * 0.012) * 0.025;
    group.rotation.x = -0.03 + Math.sin(time * 0.01) * 0.014;

    nebulae.forEach((nebula, index) => {
      const isEntryTarget = nebula.name === entryState.name;

      nebula.update(
        delta,
        time,
        index,
        isEntryTarget ? entryState.progress : 0,
        entryState.progress,
        isEntryTarget,
        interaction
      );
    });
  }

  function dispose() {
    nebulae.forEach((nebula) => {
      nebula.dispose();
    });
    particleTexture.dispose();
    group.clear();
  }

  return {
    group,
    getPlanetWorldPosition(name, target = targetPosition) {
      const nebula = nebulae.find((candidate) => candidate.name === name);

      if (!nebula) {
        return null;
      }

      return nebula.nebulaGroup.getWorldPosition(target);
    },
    setPlanetEntryProgress(name, progress) {
      entryState.name = name;
      entryState.progress = Math.min(Math.max(progress, 0), 1);
    },
    setLabelsVisible(visible) {
      nebulae.forEach((nebula) => nebula.setLabelVisible(visible));
    },
    update,
    dispose
  };
}

function createBusinessNebula(config, particleTexture, seed) {
  const orbitalGroup = new THREE.Group();
  const nebulaGroup = new THREE.Group();
  const cluster = createNebulaCluster(config, particleTexture, seed);
  const dust = createNebulaDust(config, particleTexture, seed + 37);
  const nodes = createNebulaNodes(config, particleTexture, seed + 71);
  const coreCluster = createGalaxyCoreCluster({
    name: `${config.name.replace(/\s+/g, '')}CoreCluster`,
    starCount: config.name === 'GEO Nebula' ? 84 : 70,
    highlightCount: config.coreCount,
    radius: config.size * 0.38,
    coreColor: config.accent,
    secondaryColors: [config.color, config.accent],
    depthRange: config.size * 0.46,
    bloomIntensity: config.name === 'GEO Nebula' ? 0.54 : 0.4,
    pulseSpeed: 0.3 + seed % 7 * 0.006,
    seed: seed + 107
  });
  const label = createNebulaLabel(config);
  let orbitAngle = config.phase;

  orbitalGroup.name = `${config.name.replace(/\s+/g, '')}Orbit`;
  orbitalGroup.rotation.set(0, 0, 0);
  nebulaGroup.name = config.name.replace(/\s+/g, '');
  nebulaGroup.add(
    dust.points,
    cluster.points,
    nodes.points,
    coreCluster.group
  );
  orbitalGroup.add(nebulaGroup, label.sprite);

  function update(delta, time, index, entryProgress, focusProgress, isEntryTarget, interaction) {
    const freeze = smoothstep(0.05, 0.24, entryProgress);
    const entryFocus = smoothstep(0.16, 0.66, entryProgress);
    const angleSpeed = (TAU / Math.abs(config.period)) * Math.sign(config.period) * (1 - freeze);
    const pulse = 0.5 + Math.sin(time * (0.46 + index * 0.05) + config.phase) * 0.5;
    const dissolve = isEntryTarget
      ? smoothstep(0.9, 1, entryProgress)
      : 0;
    const targetScale = 1 + entryFocus * 4.8;
    const backgroundScale = 1 - smoothstep(0.35, 0.78, focusProgress) * 0.18;
    const visibility = isEntryTarget
      ? 1 - dissolve
      : 1 - smoothstep(0.28, 0.72, focusProgress) * 0.96;
    const labelVisibility = isEntryTarget
      ? visibility * (1 - smoothstep(0.44, 0.68, entryProgress))
      : visibility;
    const hover = calculateHoverStrength(config, interaction);
    const hoverBoost = 1 + hover * 0.14;
    const entryBoost = isEntryTarget ? 1 + entryFocus * 0.72 : 1;
    const visualBoost = hoverBoost * entryBoost;

    orbitAngle += delta * angleSpeed * 0.18;
    nebulaGroup.position.set(
      Math.cos(orbitAngle) * config.orbitRadius,
      Math.sin(orbitAngle) * config.orbitRadius * config.orbitScaleY,
      Math.sin(orbitAngle) * config.orbitRadius * Math.sin(config.tilt[0])
    );
    nebulaGroup.scale.setScalar(isEntryTarget ? targetScale : backgroundScale);
    nebulaGroup.rotation.z += delta * config.spin * 0.28 * (1 + hover * 0.12);
    nebulaGroup.rotation.x = 0;
    nebulaGroup.rotation.y = 0;
    label.sprite.position.set(
      nebulaGroup.position.x + config.labelOffset[0],
      nebulaGroup.position.y + config.labelOffset[1],
      nebulaGroup.position.z + config.labelOffset[2]
    );
    cluster.update(delta, time, pulse, visibility, entryFocus, visualBoost);
    dust.update(delta, time, pulse, visibility, visualBoost);
    nodes.update(delta, time, pulse, visibility, entryFocus, visualBoost);
    coreCluster.update(delta, time, pulse, visibility, entryFocus, visualBoost);
    label.update(labelVisibility, hover);
  }

  function dispose() {
    cluster.dispose();
    dust.dispose();
    nodes.dispose();
    coreCluster.dispose();
    label.dispose();
    orbitalGroup.clear();
  }

  return {
    name: config.name,
    group: orbitalGroup,
    nebulaGroup,
    setLabelVisible(visible) {
      label.sprite.visible = visible;
    },
    update,
    dispose
  };
}

function createNebulaCluster(config, texture, seed) {
  const mainArmCount = 96;
  const auxiliaryArmCount = 36;
  const count = mainArmCount + auxiliaryArmCount;
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const baseColor = new THREE.Color(config.color);
  const accentColor = new THREE.Color(config.accent);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const auxiliary = i >= mainArmCount;
    const localIndex = auxiliary ? i - mainArmCount : i;
    const branchCount = auxiliary ? auxiliaryArmCount : mainArmCount;
    const progress = (localIndex + random() * 0.8) / branchCount;
    const radius = 0.018 + Math.pow(progress, auxiliary ? 1.18 : 1.04) * config.size;
    const armAngle = auxiliary ? Math.PI + 0.62 : 0.2;
    const spinAngle = Math.pow(progress, 0.86) * (auxiliary ? 2.05 : 2.85);
    const cluster = Math.sin(progress * 22 + seed * 0.003) * 0.5 + 0.5;
    const angularNoise = (random() - 0.5) * (auxiliary ? 0.22 : 0.11);
    const radialNoise = (random() - 0.5) * config.size * (0.035 + progress * 0.08);
    const angle = armAngle + spinAngle + angularNoise;
    const noisyRadius = radius + radialNoise;
    const thickness = config.size * (0.08 + (1 - progress) * 0.24 + cluster * 0.05);
    const dropout = (cluster < 0.22 && random() < 0.6) || (auxiliary && random() < 0.3);

    positions[i3] = Math.cos(angle) * noisyRadius;
    positions[i3 + 1] = Math.sin(angle) * noisyRadius * 0.62;
    positions[i3 + 2] = (random() - 0.5) * thickness;
    color.copy(accentColor).lerp(baseColor, progress * 0.82);
    const brightness = (auxiliary ? 0.3 : 0.94) * (0.72 + cluster * 0.42) * (dropout ? 0.08 : 1) * config.brightness;

    colors[i3] = color.r * brightness;
    colors[i3 + 1] = color.g * brightness;
    colors[i3 + 2] = color.b * brightness;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.02,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.012,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = `${config.name.replace(/\s+/g, '')}SpiralCluster`;

  function update(delta, time, pulse, visibility, entryProgress, hoverBoost) {
    points.rotation.z += delta * config.spin * 0.38;
    points.rotation.y = Math.sin(time * 0.08 + config.phase) * 0.08;
    material.opacity = (0.42 + pulse * 0.1 + entryProgress * 0.08) * visibility * hoverBoost * config.brightness;
    material.size = (0.017 + pulse * 0.002 + entryProgress * 0.005) * (0.98 + (hoverBoost - 1) * 0.25);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createNebulaDust(config, texture, seed) {
  const count = 60;
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color(config.color);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const radius = Math.pow(random(), 0.68) * config.size * 1.75;
    const angle = random() * TAU;

    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = Math.sin(angle) * radius * 0.72;
    positions[i3 + 2] = (random() - 0.5) * config.size * 0.42;
    const brightness = (0.42 + random() * 0.32) * config.brightness;

    colors[i3] = color.r * brightness;
    colors[i3 + 1] = color.g * brightness;
    colors[i3 + 2] = color.b * brightness;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.009,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.008,
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  function update(delta, time, pulse, visibility, hoverBoost) {
    points.rotation.z -= delta * config.spin * 0.12;
    material.opacity = (0.18 + pulse * 0.12) * visibility * (0.96 + (hoverBoost - 1) * 0.5) * config.brightness;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createNebulaNodes(config, texture, seed) {
  const count = 5;
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const accent = new THREE.Color(config.accent);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const arm = i % config.armCount;
    const radius = config.size * (0.22 + random() * 0.7);
    const angle = (arm / config.armCount) * TAU + radius * 15.5 + (random() - 0.5) * 0.24;

    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = Math.sin(angle) * radius * 0.62;
    positions[i3 + 2] = (random() - 0.5) * config.size * 0.2;
    colors[i3] = accent.r;
    colors[i3 + 1] = accent.g;
    colors[i3 + 2] = accent.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.038,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.015,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  function update(delta, time, pulse, visibility, entryProgress, hoverBoost) {
    points.rotation.z += delta * config.spin * 0.54;
    material.opacity = (0.52 + pulse * 0.3 + entryProgress * 0.12) * visibility * hoverBoost * config.brightness;
    material.size = (0.033 + pulse * 0.01 + entryProgress * 0.012) * (0.98 + (hoverBoost - 1) * 0.4);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createNebulaLabel(config) {
  const texture = createLabelTexture(config.label, config.accent);
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    depthTest: false,
    fog: false
  });
  const sprite = new THREE.Sprite(material);

  sprite.name = `${config.name.replace(/\s+/g, '')}Label`;
  sprite.scale.set(0.48, 0.12, 1);

  function update(visibility, hover) {
    material.opacity = (0.68 + hover * 0.16) * visibility;
    sprite.scale.set(0.48 + hover * 0.03, 0.12 + hover * 0.008, 1);
  }

  function dispose() {
    texture.dispose();
    material.dispose();
  }

  return { sprite, update, dispose };
}

function createLabelTexture(text, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 512;
  const height = 128;
  const labelColor = new THREE.Color(color);

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.font = '700 42px Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.letterSpacing = '4px';
  context.shadowColor = `rgba(${Math.round(labelColor.r * 255)}, ${Math.round(labelColor.g * 255)}, ${Math.round(labelColor.b * 255)}, 0.45)`;
  context.shadowBlur = 10;
  context.fillStyle = `rgba(${Math.round(labelColor.r * 235 + 20)}, ${Math.round(labelColor.g * 235 + 20)}, ${Math.round(labelColor.b * 235 + 20)}, 0.9)`;
  context.fillText(text, width * 0.5, height * 0.5);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function calculateHoverStrength(config, interaction) {
  if (!interaction) {
    return 0;
  }

  const dx = interaction.x - config.hoverX;
  const dy = interaction.y - config.hoverY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const hover = 1 - smoothstep(0.14, 0.48, distance);

  return hover * interaction.active;
}

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * (3 - 2 * x);
}

function createNebulaParticleTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 64;
  const center = size * 0.5;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);

  canvas.width = size;
  canvas.height = size;
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(220,245,255,0.94)');
  gradient.addColorStop(0.58, 'rgba(96,175,255,0.38)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export const galaxyPlanetsManager = {
  createGalaxyPlanets
};
