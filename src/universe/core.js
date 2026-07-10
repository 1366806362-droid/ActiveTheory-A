import * as THREE from 'three';
import { createGalaxyCoreCluster } from './galaxyCoreCluster.js';

const TAU = Math.PI * 2;
const DEBUG_MAIN_GALAXY_ONLY = readDebugFlag('debugMainGalaxyOnly', false);

export function createEnergyCore() {
  const group = new THREE.Group();
  const galaxyPlane = new THREE.Group();
  const particleTexture = createParticleTexture();
  const arms = createSpiralArms(particleTexture);
  const dust = createGalaxyDust(particleTexture);
  const nodes = createStellarNodes(particleTexture);
  const core = createLuminousCore(particleTexture);

  group.name = 'ActiveTheoryBrandGalaxy';
  group.position.set(0.46, 0.04, 0);
  galaxyPlane.name = 'BrandGalaxySpiralPlane';
  galaxyPlane.rotation.set(-0.48, 0.1, -0.12);
  galaxyPlane.add(dust.points, arms.points, nodes.points, core.group);
  group.add(galaxyPlane);

  function update(delta, time, interaction) {
    const interactionProximity = interaction?.proximity ?? 0;
    const pulse = 0.5 + Math.sin(time * 0.42) * 0.5;
    const breathing = Math.sin(time * 0.18 + 0.7);

    group.position.set(0.46, 0.04, 0);
    group.scale.setScalar(1.14 + breathing * 0.01);
    group.rotation.y = 0;
    galaxyPlane.rotation.x = -0.48;
    galaxyPlane.rotation.y = 0.1;
    galaxyPlane.rotation.z -= delta * 0.026;
    arms.update(delta, time, pulse, interactionProximity);
    dust.update(delta, time, breathing);
    nodes.update(delta, time, pulse);
    core.update(delta, time, pulse, interactionProximity);
  }

  function dispose() {
    arms.dispose();
    dust.dispose();
    nodes.dispose();
    core.dispose();
    particleTexture.dispose();
    group.clear();
  }

  return {
    group,
    layers: {
      arms: arms.points,
      dust: dust.points,
      nodes: nodes.points,
      core: core.group
    },
    update,
    dispose
  };
}

function createSpiralArms(texture) {
  const mainArmCount = 760;
  const auxiliaryArmCount = 220;
  const count = mainArmCount * 2 + auxiliaryArmCount;
  const random = seededRandom(74051);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacity = new Float32Array(count);
  const innerColor = new THREE.Color(0xe8fbff);
  const armColor = new THREE.Color(0x56baff);
  const outerColor = new THREE.Color(0x334fa8);
  const violetColor = new THREE.Color(0x7a62d8);
  const warmColor = new THREE.Color(0xfff1d0);
  const particleColor = new THREE.Color();
  const armLayers = [
    { count: 420, width: 0.022, spread: 0.032, opacity: 0.86, size: 1.06, dropout: 0.025 },
    { count: 240, width: 0.052, spread: 0.072, opacity: 0.48, size: 0.84, dropout: 0.12 },
    { count: 100, width: 0.1, spread: 0.13, opacity: 0.23, size: 0.68, dropout: 0.3 }
  ];
  let particleIndex = 0;

  for (let branchIndex = 0; branchIndex < 2; branchIndex += 1) {
    const radiusLimit = branchIndex === 0 ? 1.1 : 1.14;
    const branchAngle = branchIndex * Math.PI + (branchIndex === 0 ? 0.18 : 0.11);
    const spinFactor = branchIndex === 0 ? 7.6 : 7.3;
    const secondarySpin = branchIndex === 0 ? -0.65 : -0.58;

    for (let layerIndex = 0; layerIndex < armLayers.length; layerIndex += 1) {
      const layer = armLayers[layerIndex];

      for (let localIndex = 0; localIndex < layer.count; localIndex += 1) {
        const branchProgress = (localIndex + random() * 0.82) / layer.count;
        const radius = 0.038 + Math.pow(branchProgress, 0.72) * radiusLimit;
        const radiusRatio = radius / radiusLimit;
        const spinAngle = radius * spinFactor + radius * radius * secondarySpin;
        const clusterWave = Math.sin(branchProgress * 30.5 + branchIndex * 2.3) * 0.5 + 0.5;
        const secondaryCluster = Math.sin(branchProgress * 13.2 + branchIndex * 4.6) * 0.5 + 0.5;
        const armWidth = layer.width + radiusRatio * layer.spread;
        const perpendicularOffset = (random() - 0.5) * 2 * armWidth * (0.78 + clusterWave * 0.42);
        const radialOffset = (random() - 0.5) * armWidth * (layerIndex === 0 ? 0.46 : 0.78);
        const angularNoise = (random() - 0.5) * (0.022 + layerIndex * 0.025 + radiusRatio * 0.018);
        const angle = branchAngle + spinAngle + angularNoise;
        const noisyRadius = Math.max(0.025, radius + radialOffset);
        const diskX = Math.cos(angle) * noisyRadius - Math.sin(angle) * perpendicularOffset;
        const diskY = Math.sin(angle) * noisyRadius + Math.cos(angle) * perpendicularOffset;
        const verticalThickness = (0.032 + (1 - radiusRatio) * 0.1 + layerIndex * 0.022) * (0.72 + secondaryCluster * 0.45);
        const isGap = (
          (clusterWave < 0.14 && random() < 0.48)
          || (branchProgress > 0.82 && random() < layer.dropout + 0.08)
          || random() < layer.dropout
        );

        writeArmParticle({
          index: particleIndex,
          x: diskX,
          y: diskY * (branchIndex === 0 ? 0.64 : 0.61),
          z: (random() - 0.5) * verticalThickness,
          progress: branchProgress,
          layer,
          clusterWave,
          secondaryCluster,
          isGap,
          isAuxiliary: false
        });
        particleIndex += 1;
      }
    }
  }

  for (let localIndex = 0; localIndex < auxiliaryArmCount; localIndex += 1) {
    const branchProgress = 0.08 + ((localIndex + random() * 0.8) / auxiliaryArmCount) * 0.76;
    const radiusLimit = 0.9;
    const radius = 0.08 + Math.pow(branchProgress, 0.82) * radiusLimit;
    const radiusRatio = radius / radiusLimit;
    const angle = 1.34 + radius * 6.4 - radius * radius * 0.45 + (random() - 0.5) * 0.12;
    const clusterWave = Math.sin(branchProgress * 24.5 + 1.8) * 0.5 + 0.5;
    const secondaryCluster = Math.sin(branchProgress * 11.8 + 4.1) * 0.5 + 0.5;
    const armWidth = 0.065 + radiusRatio * 0.115;
    const perpendicularOffset = (random() - 0.5) * 2 * armWidth;
    const noisyRadius = radius + (random() - 0.5) * armWidth * 0.72;
    const isGap = clusterWave < 0.28 || random() < 0.36 || branchProgress > 0.72 && random() < 0.52;

    writeArmParticle({
      index: particleIndex,
      x: Math.cos(angle) * noisyRadius - Math.sin(angle) * perpendicularOffset,
      y: (Math.sin(angle) * noisyRadius + Math.cos(angle) * perpendicularOffset) * 0.59,
      z: (random() - 0.5) * (0.05 + (1 - radiusRatio) * 0.1),
      progress: branchProgress,
      layer: { opacity: 0.24, size: 0.65 },
      clusterWave,
      secondaryCluster,
      isGap,
      isAuxiliary: true
    });
    particleIndex += 1;
  }

  function writeArmParticle({
    index,
    x,
    y,
    z,
    progress,
    layer,
    clusterWave,
    secondaryCluster,
    isGap,
    isAuxiliary
  }) {
    const i3 = index * 3;
    const radialFade = 1 - Math.min(progress, 1);

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    particleColor.copy(innerColor).lerp(armColor, Math.min(progress * 1.2, 1));
    particleColor.lerp(outerColor, Math.max((progress - 0.5) / 0.5, 0));

    if (DEBUG_MAIN_GALAXY_ONLY) {
      particleColor.set(progress < 0.5 ? 0xeafaff : 0xaedfff);
    } else if (isAuxiliary) {
      particleColor.lerp(violetColor, 0.42);
    } else if (random() > 0.974) {
      particleColor.lerp(warmColor, 0.24);
    }

    const brightnessVariation = 0.84 + random() * 0.26;
    const brightness = (isAuxiliary ? 0.5 : DEBUG_MAIN_GALAXY_ONLY ? 1.12 : 0.93)
      * brightnessVariation
      * (0.78 + clusterWave * 0.28 + secondaryCluster * 0.1);

    colors[i3] = particleColor.r * brightness;
    colors[i3 + 1] = particleColor.g * brightness;
    colors[i3 + 2] = particleColor.b * brightness;
    sizes[index] = layer.size * (0.82 + random() * 0.44 + clusterWave * 0.12);
    opacity[index] = isGap
      ? layer.opacity * 0.08
      : layer.opacity * (0.72 + radialFade * 0.28) * (0.82 + clusterWave * 0.24);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacity, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: 0.78 },
      uPointScale: { value: 1 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vOpacity = aOpacity;
        gl_PointSize = aSize * uPointScale * (7.2 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        float alpha = texture2D(uTexture, gl_PointCoord).a;
        gl_FragColor = vec4(vColor, alpha * vOpacity * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'BrandGalaxySpiralArms';

  function update(delta, time, pulse, interactionProximity) {
    points.rotation.z += delta * 0.006;
    material.uniforms.uOpacity.value = DEBUG_MAIN_GALAXY_ONLY
      ? 1.08
      : 0.84 + pulse * 0.1 + interactionProximity * 0.025;
    material.uniforms.uPointScale.value = DEBUG_MAIN_GALAXY_ONLY
      ? 1.22
      : 1.02 + pulse * 0.035;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createGalaxyDust(texture) {
  const count = 220;
  const random = seededRandom(90317);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const blue = new THREE.Color(0x245ca8);
  const violet = new THREE.Color(0x5b3d9a);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const radius = 0.26 + Math.pow(random(), 0.74) * 0.86;
    const angle = random() * TAU;
    const diskFalloff = 1 - Math.min(radius / 1.12, 1);
    const irregularity = 0.62 + random() * 0.64;

    positions[i3] = Math.cos(angle) * radius * irregularity;
    positions[i3 + 1] = Math.sin(angle) * radius * 0.72 * irregularity;
    positions[i3 + 2] = (random() - 0.5) * (0.12 + diskFalloff * 0.26);
    color.copy(blue).lerp(violet, random() * 0.48);
    colors[i3] = color.r * (0.38 + diskFalloff * 0.4);
    colors[i3 + 1] = color.g * (0.42 + diskFalloff * 0.34);
    colors[i3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.011,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.01,
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'BrandGalaxyDust';

  function update(delta, time, breathing) {
    points.rotation.z -= delta * 0.0035;
    points.rotation.y = Math.sin(time * 0.02) * 0.04;
    material.opacity = 0.075 + breathing * 0.048;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createStellarNodes(texture) {
  const count = 30;
  const random = seededRandom(12791);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const arm = i % 3;
    const radius = 0.14 + Math.pow(random(), 0.72) * 0.84;
    const baseAngle = arm === 2 ? 1.34 : arm * Math.PI + (arm === 0 ? 0.18 : 0.11);
    const angle = baseAngle
      + radius * (arm === 2 ? 6.4 : arm === 0 ? 7.6 : 7.3)
      + radius * radius * (arm === 2 ? -0.45 : arm === 0 ? -0.65 : -0.58)
      + (random() - 0.5) * 0.18;
    const warmNode = i % 9 === 0;

    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = Math.sin(angle) * radius * 0.66;
    positions[i3 + 2] = (random() - 0.5) * 0.08;
    colors[i3] = warmNode ? 1 : 0.62;
    colors[i3 + 1] = warmNode ? 0.9 : 0.88;
    colors[i3 + 2] = 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.047,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.015,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'BrandGalaxyStellarNodes';

  function update(delta, time, pulse) {
    points.rotation.z += delta * 0.009;
    material.opacity = 0.68 + pulse * 0.24;
    material.size = 0.046 + pulse * 0.011;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createLuminousCore(particleTexture) {
  const group = new THREE.Group();
  const pointCount = 80;
  const planetCluster = createGalaxyCoreCluster({
    name: 'BrandGalaxyCoreCluster',
    starCount: 260,
    highlightCount: 7,
    radius: 0.34,
    coreColor: 0xf2fcff,
    secondaryColors: [0xbdeaff, 0x67d8ff, 0xa99cff, 0xffefd6],
    depthRange: 0.32,
    bloomIntensity: 0.7,
    pulseSpeed: 0.28,
    starOpacity: 0.66,
    highlightOpacity: 0.82,
    hazeOpacity: 0.13,
    seed: 314159
  });
  const random = seededRandom(48151);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);

  for (let i = 0; i < pointCount; i += 1) {
    const i3 = i * 3;
    const radius = Math.pow(random(), 1.95) * 0.2;
    const angle = random() * TAU;

    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = Math.sin(angle) * radius * 0.72;
    positions[i3 + 2] = (random() - 0.5) * 0.08;
    const warmCore = random() > 0.96;
    const violetCore = random() > 0.9;

    colors[i3] = warmCore ? 1 : violetCore ? 0.78 : 0.72 + random() * 0.28;
    colors[i3 + 1] = warmCore ? 0.92 : violetCore ? 0.82 : 0.9 + random() * 0.1;
    colors[i3 + 2] = 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pointMaterial = new THREE.PointsMaterial({
    size: 0.024,
    sizeAttenuation: true,
    map: particleTexture,
    alphaTest: 0.02,
    vertexColors: true,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, pointMaterial);

  group.name = 'BrandGalaxyLuminousCore';
  group.add(points, planetCluster.group);

  function update(delta, time, pulse, interactionProximity) {
    group.rotation.z -= delta * 0.004;
    pointMaterial.opacity = 0.4 + pulse * 0.06;
    planetCluster.update(delta, time, pulse, 1, interactionProximity, 1);
  }

  function dispose() {
    geometry.dispose();
    pointMaterial.dispose();
    planetCluster.dispose();
  }

  return { group, update, dispose };
}

function createParticleTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 64;
  const center = size * 0.5;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);

  canvas.width = size;
  canvas.height = size;
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.24, 'rgba(190,235,255,0.94)');
  gradient.addColorStop(0.62, 'rgba(80,155,255,0.32)');
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

function readDebugFlag(name, fallback) {
  const params = new URLSearchParams(window.location.search);

  if (!params.has(name)) {
    return fallback;
  }

  return params.get(name) !== '0' && params.get(name) !== 'false';
}
