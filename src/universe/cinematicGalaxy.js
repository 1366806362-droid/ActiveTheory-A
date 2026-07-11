import * as THREE from 'three';
import { createGalaxyCoreCluster } from './galaxyCoreCluster.js';
import { createCinematicGalaxyShell } from './cinematicGalaxyShell.js';

const TAU = Math.PI * 2;
const INNER_RADIUS = 0.07;
const OUTER_RADIUS = 0.78;
const TURNS = 0.88;
const RADIUS_EXPONENT = 1.12;
const DEFAULT_LAYER_VISIBILITY = Object.freeze({
  core: true,
  mainArms: true,
  nebula: true,
  dust: true,
  highlights: true
});

export function createCinematicGalaxy({
  debugVisibility = DEFAULT_LAYER_VISIBILITY,
  shellDebugMode = null
} = {}) {
  const group = new THREE.Group();
  const visual = new THREE.Group();
  const shellLayer = new THREE.Group();
  const armsLayer = new THREE.Group();
  const nebulaLayer = new THREE.Group();
  const dustLayer = new THREE.Group();
  const nodesLayer = new THREE.Group();
  const coreLayer = new THREE.Group();
  const texture = createParticleTexture();
  const shell = createCinematicGalaxyShell({
    innerRadius: INNER_RADIUS,
    outerRadius: OUTER_RADIUS,
    turns: TURNS,
    radiusExponent: RADIUS_EXPONENT
  });
  const arms = createSpiralArms(texture);
  const armNebula = createArmNebula(texture);
  const dustLanes = createDustLanes(texture);
  const outskirts = createOutskirts(texture);
  const armHighlights = createArmHighlights(texture);
  const core = createGalaxyCoreCluster({
    name: 'CinematicGalaxyCoreCluster',
    starCount: 644,
    highlightCount: 5,
    radius: 0.228,
    depthRange: 0.205,
    coreColor: 0xf3fbff,
    secondaryColors: [0xc8ecff, 0x79cfff, 0xa68cf4, 0xffdfb0],
    bloomIntensity: 1.05,
    pulseSpeed: 0.24,
    starOpacity: 0.94,
    highlightOpacity: 1,
    hazeOpacity: 0.105,
    seed: 88217
  });
  const coreMicroStars = core.group.getObjectByName('GalaxyCoreMicroStars');
  const coreHighlightStars = core.group.getObjectByName('GalaxyCoreHighlightStars');

  if (coreMicroStars?.material) {
    coreMicroStars.material.size *= 1.45;
    coreMicroStars.material.blending = THREE.AdditiveBlending;
    coreMicroStars.material.needsUpdate = true;
  }
  if (coreHighlightStars?.geometry?.attributes?.position) {
    const positions = coreHighlightStars.geometry.attributes.position;
    const layout = [
      [0, 0, 0],
      [-0.074, 0.014, 0.008],
      [0.071, -0.012, -0.007],
      [-0.036, -0.034, 0.01],
      [0.042, 0.031, -0.009]
    ];

    layout.forEach((position, index) => {
      positions.setXYZ(index, position[0], position[1], position[2]);
    });
    positions.needsUpdate = true;
    coreHighlightStars.geometry.computeBoundingSphere();
  }
  const baseQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(24),
    THREE.MathUtils.degToRad(-6),
    THREE.MathUtils.degToRad(-10),
    'XYZ'
  ));
  const spinQuaternion = new THREE.Quaternion();
  const localNormal = new THREE.Vector3(0, 0, 1);
  let spinAngle = -0.2;

  group.name = 'ActiveTheoryCinematicGalaxy';
  visual.name = 'CinematicGalaxyVisual';
  shellLayer.name = 'CinematicGalaxyShellLayer';
  armsLayer.name = 'CinematicGalaxyArmsLayer';
  nebulaLayer.name = 'CinematicGalaxyNebulaLayer';
  dustLayer.name = 'CinematicGalaxyDustLayer';
  nodesLayer.name = 'CinematicGalaxyNodesLayer';
  coreLayer.name = 'CinematicGalaxyCoreLayer';
  group.position.set(0.46, -0.04, 0);
  visual.position.set(0, 0.34, 0);
  visual.scale.set(0.9, 0.84, 0.9);
  shellLayer.add(shell.group);
  armsLayer.add(arms.points);
  nebulaLayer.add(armNebula.points);
  dustLayer.add(outskirts.points, dustLanes.points);
  nodesLayer.add(armHighlights.points);
  coreLayer.add(core.group);
  coreLayer.scale.set(1.12, 0.78, 0.28);
  visual.add(shellLayer, dustLayer, nebulaLayer, armsLayer, nodesLayer, coreLayer);
  group.add(visual);
  applyDebugVisibility();
  applyShellDebugMode(shellDebugMode);
  applyOrientation();

  function update(delta, time, interaction, journeyProgress = 0) {
    const proximity = interaction?.proximity ?? 0;
    const pulse = 0.5 + Math.sin(time * 0.34) * 0.5;
    const breathing = Math.sin(time * 0.16 + 0.6);

    group.position.set(0.46, -0.04, 0);
    group.scale.setScalar(1.37 + breathing * 0.006);
    group.rotation.set(0, 0, 0);
    spinAngle -= delta * 0.012;
    applyOrientation();
    shell.update(delta, time, journeyProgress);
    arms.update(time, pulse, proximity);
    armNebula.update(time, pulse);
    dustLanes.update(time, pulse);
    outskirts.update(time, pulse);
    armHighlights.update(time, pulse);
    core.update(delta, time, pulse, 1, proximity, 1);
  }

  function applyOrientation() {
    spinQuaternion.setFromAxisAngle(localNormal, spinAngle);
    visual.quaternion.copy(baseQuaternion).multiply(spinQuaternion);
  }

  function applyDebugVisibility(visibility = DEFAULT_LAYER_VISIBILITY) {
    armsLayer.visible = visibility.mainArms;
    nebulaLayer.visible = visibility.nebula;
    dustLayer.visible = visibility.dust;
    nodesLayer.visible = visibility.highlights;
    coreLayer.visible = visibility.core;
  }

  function applyShellDebugMode(mode = null) {
    shellLayer.visible = mode !== 'particles';

    if (!mode || mode === 'combined') {
      return;
    }

    const showParticles = mode === 'particles';

    armsLayer.visible = showParticles;
    nebulaLayer.visible = showParticles;
    dustLayer.visible = showParticles;
    nodesLayer.visible = showParticles;
    coreLayer.visible = showParticles;
  }

  function dispose() {
    arms.dispose();
    armNebula.dispose();
    dustLanes.dispose();
    outskirts.dispose();
    armHighlights.dispose();
    shell.dispose();
    core.dispose();
    texture.dispose();
    group.clear();
  }

  return {
    group,
    layers: {
      arms: armsLayer,
      shell: shellLayer,
      nebula: nebulaLayer,
      dust: dustLayer,
      nodes: nodesLayer,
      core: coreLayer
    },
    update,
    applyDebugVisibility,
    applyShellDebugMode,
    dispose,
    parameters: {
      turns: TURNS,
      radiusExponent: RADIUS_EXPONENT,
      innerRadius: INNER_RADIUS,
      outerRadius: OUTER_RADIUS
    }
  };
}

function createSpiralArms(texture) {
  const layers = [
    { count: 920, widthScale: 0.246, opacity: 0.94, size: 1.1, brightness: 1.23 },
    { count: 414, widthScale: 0.716, opacity: 0.32, size: 0.7, brightness: 0.62 },
    { count: 92, widthScale: 1.08, opacity: 0.085, size: 0.48, brightness: 0.3 }
  ];
  const countPerArm = layers.reduce((sum, layer) => sum + layer.count, 0);
  const count = countPerArm * 2;
  const random = seededRandom(492013);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const palette = [
    new THREE.Color(0xeaf8ff),
    new THREE.Color(0x83ceff),
    new THREE.Color(0x36aed8),
    new THREE.Color(0x9a82ed),
    new THREE.Color(0xffdfad)
  ];
  const color = new THREE.Color();
  let particleIndex = 0;

  for (let armIndex = 0; armIndex < 2; armIndex += 1) {
    const baseAngle = armIndex * Math.PI;

    for (const layer of layers) {
      for (let index = 0; index < layer.count; index += 1) {
        const progress = Math.min((index + random() * 0.74) / layer.count, 1);
        const radius = INNER_RADIUS
          + (OUTER_RADIUS - INNER_RADIUS) * Math.pow(progress, RADIUS_EXPONENT);
        const angle = baseAngle
          + progress * TAU * TURNS
          + (random() - 0.5) * (0.008 + progress * 0.026);
        const armWidth = (0.018
          + Math.sin(progress * Math.PI) * 0.055
          + progress * 0.035) * 1.12;
        const perpendicular = clampGaussian(gaussianRandom(random)) * armWidth * layer.widthScale;
        const radialOffset = clampGaussian(gaussianRandom(random))
          * armWidth
          * layer.widthScale
          * 0.22;
        const noisyRadius = Math.max(INNER_RADIUS * 0.82, radius + radialOffset);
        const x = Math.cos(angle) * noisyRadius - Math.sin(angle) * perpendicular;
        const y = Math.sin(angle) * noisyRadius + Math.cos(angle) * perpendicular;
        const clusterWave = Math.sin(progress * TAU * 4.15 + 0.42) * 0.5 + 0.5;
        const secondaryCluster = Math.sin(progress * TAU * 1.7 + 1.15) * 0.5 + 0.5;
        const clusterStrength = 0.48 + clusterWave * 0.38 + secondaryCluster * 0.14;
        const dustGap = 1 - smoothstep(0.06, 0.22, 1 - clusterWave) * 0.24;
        const innerArmBreak = 1
          - smoothstep(0.3, 0.34, progress)
          * (1 - smoothstep(0.38, 0.42, progress))
          * 0.62;
        const midArmBreak = 1
          - smoothstep(0.46, 0.51, progress)
          * (1 - smoothstep(0.57, 0.62, progress))
          * 0.88;
        const armBreak = innerArmBreak * midArmBreak;
        const midDensityBoost = 1
          + smoothstep(0.16, 0.28, progress)
          * (1 - smoothstep(0.68, 0.76, progress))
          * 0.13;
        const outerFade = 1 - smoothstep(0.7, 0.86, progress) * 0.995;
        const outerLayerHidden = layer.widthScale > 1
          && progress > 0.7
          && random() < 0.38;
        const outerArmHidden = progress > 0.7
          && random() < smoothstep(0.7, 0.86, progress) * 0.35;
        const dropout = outerLayerHidden
          || outerArmHidden
          || progress > 0.84 && random() < (progress - 0.84) * 3.4;
        const stride = particleIndex * 3;

        positions[stride] = x;
        positions[stride + 1] = y;
        positions[stride + 2] = (random() - 0.5)
          * (0.035 + (1 - progress) * 0.08 + layer.widthScale * 0.018);
        chooseGalaxyColor(color, palette, random());
        color.multiplyScalar(layer.brightness * (0.74 + clusterStrength * 0.34) * dustGap);
        colors[stride] = color.r;
        colors[stride + 1] = color.g;
        colors[stride + 2] = color.b;
        sizes[particleIndex] = layer.size
          * (0.78 + random() * 0.38 + clusterStrength * 0.18);
        opacities[particleIndex] = (dropout ? 0.04 : layer.opacity)
          * outerFade
          * (0.56 + clusterStrength * 0.5)
          * dustGap
          * armBreak
          * midDensityBoost;
        particleIndex += 1;
      }
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geometry.computeBoundingSphere();
  const material = createParticleMaterial(texture, 0.8, 7.6, THREE.AdditiveBlending);
  const points = new THREE.Points(geometry, material);

  points.name = 'CinematicGalaxySpiralArms';
  points.renderOrder = 1;

  return {
    points,
    update(time, pulse, proximity) {
      material.uniforms.uOpacity.value = 0.98 + pulse * 0.07 + proximity * 0.02;
      material.uniforms.uPointScale.value = 1 + pulse * 0.025;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createArmNebula(texture) {
  const countPerArm = 260;
  const count = countPerArm * 2;
  const random = seededRandom(381047);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const rotations = new Float32Array(count);
  const stretches = new Float32Array(count);
  const iceBlue = new THREE.Color(0x65bdf2);
  const cyanBlue = new THREE.Color(0x268daf);
  const paleViolet = new THREE.Color(0x745fae);
  const color = new THREE.Color();

  for (let armIndex = 0; armIndex < 2; armIndex += 1) {
    const baseAngle = armIndex * Math.PI;

    for (let index = 0; index < countPerArm; index += 1) {
      const particleIndex = armIndex * countPerArm + index;
      const stride = particleIndex * 3;
      const progress = 0.05 + ((index + random() * 0.8) / countPerArm) * 0.9;
      const radius = INNER_RADIUS
        + (OUTER_RADIUS - INNER_RADIUS) * Math.pow(progress, RADIUS_EXPONENT);
      const angle = baseAngle
        + progress * TAU * TURNS
        + (random() - 0.5) * (0.02 + progress * 0.055);
      const armWidth = 0.018
        + Math.sin(progress * Math.PI) * 0.055
        + progress * 0.035;
      const spread = armWidth * (1.28 + random() * 0.48);
      const perpendicular = clampGaussian(gaussianRandom(random)) * spread * 0.34;
      const radialOffset = gaussianRandom(random) * spread * 0.11;
      const noisyRadius = Math.max(INNER_RADIUS, radius + radialOffset);
      const clusterWave = Math.sin(progress * TAU * 4.15 + 0.42) * 0.5 + 0.5;
      const clusterOpacity = 0.35 + clusterWave * 0.52;
      const outerFade = 1 - smoothstep(0.7, 0.86, progress) * 0.99;
      const innerArmBreak = 1
        - smoothstep(0.3, 0.34, progress)
        * (1 - smoothstep(0.38, 0.42, progress))
        * 0.52;
      const midArmBreak = 1
        - smoothstep(0.46, 0.51, progress)
        * (1 - smoothstep(0.57, 0.62, progress))
        * 0.8;

      positions[stride] = Math.cos(angle) * noisyRadius - Math.sin(angle) * perpendicular;
      positions[stride + 1] = Math.sin(angle) * noisyRadius + Math.cos(angle) * perpendicular;
      positions[stride + 2] = (random() - 0.5) * (0.08 + spread * 0.5);
      color.copy(iceBlue).lerp(cyanBlue, Math.min(progress * 1.18, 1));
      color.lerp(paleViolet, smoothstep(0.34, 0.88, progress) * 0.62);
      color.multiplyScalar(0.58 + clusterWave * 0.2);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      sizes[particleIndex] = 1.4 + random() * 1.8 + Math.sin(progress * Math.PI) * 0.55;
      opacities[particleIndex] = (0.32 + random() * 0.2)
        * clusterOpacity
        * outerFade
        * innerArmBreak
        * midArmBreak;
      rotations[particleIndex] = angle + Math.PI * 0.5;
      stretches[particleIndex] = 1.55 + random() * 0.65;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('aRotation', new THREE.BufferAttribute(rotations, 1));
  geometry.setAttribute('aStretch', new THREE.BufferAttribute(stretches, 1));
  geometry.computeBoundingSphere();
  const material = createNebulaMaterial(texture);
  const points = new THREE.Points(geometry, material);

  points.name = 'CinematicGalaxyArmNebula';
  points.renderOrder = 0;

  return {
    points,
    update(time, pulse) {
      material.uniforms.uOpacity.value = 0.22 + pulse * 0.032;
      material.uniforms.uPointScale.value = 0.98 + pulse * 0.02;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createDustLanes(texture) {
  const countPerArm = 120;
  const count = countPerArm * 2;
  const random = seededRandom(771239);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const darkBlue = new THREE.Color(0x1d3d5b);
  const blueGray = new THREE.Color(0x385a72);
  const color = new THREE.Color();

  for (let armIndex = 0; armIndex < 2; armIndex += 1) {
    const baseAngle = armIndex * Math.PI;

    for (let index = 0; index < countPerArm; index += 1) {
      const particleIndex = armIndex * countPerArm + index;
      const stride = particleIndex * 3;
      const progress = 0.08 + ((index + random() * 0.7) / countPerArm) * 0.78;
      const radius = INNER_RADIUS
        + (OUTER_RADIUS - INNER_RADIUS) * Math.pow(progress, RADIUS_EXPONENT);
      const angle = baseAngle + progress * TAU * TURNS;
      const width = 0.012 + Math.sin(progress * Math.PI) * 0.035;
      const inwardOffset = -width * (0.48 + random() * 0.24);

      positions[stride] = Math.cos(angle) * radius - Math.sin(angle) * inwardOffset;
      positions[stride + 1] = Math.sin(angle) * radius + Math.cos(angle) * inwardOffset;
      positions[stride + 2] = 0.012 + (random() - 0.5) * 0.025;
      color.copy(darkBlue).lerp(blueGray, random() * 0.52);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: texture,
    size: 0.032,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    alphaTest: 0.008,
    blending: THREE.NormalBlending,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'CinematicGalaxyDustLanes';
  points.renderOrder = 2;

  return {
    points,
    update(time, pulse) {
      material.opacity = 0.25 + pulse * 0.04;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createOutskirts(texture) {
  const count = 145;
  const random = seededRandom(201421);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const deepBlue = new THREE.Color(0x315f9b);
  const violet = new THREE.Color(0x6655a8);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const armIndex = index % 2;
    const progress = 0.7 + random() * 0.3;
    const baseAngle = armIndex * Math.PI;
    const radius = INNER_RADIUS
      + (OUTER_RADIUS - INNER_RADIUS) * Math.pow(progress, RADIUS_EXPONENT)
      + gaussianRandom(random) * 0.055;
    const angle = baseAngle
      + progress * TAU * TURNS
      + gaussianRandom(random) * 0.13;

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = Math.sin(angle) * radius;
    positions[stride + 2] = (random() - 0.5) * 0.13;
    const outerFade = 1 - smoothstep(0.7, 0.86, progress) * 0.985;
    const hidden = random() < 0.35;

    color.copy(deepBlue).lerp(violet, random() * 0.58);
    color.multiplyScalar((hidden ? 0.025 : 0.46 + random() * 0.3) * outerFade);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: texture,
    size: 0.016,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    alphaTest: 0.008,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'CinematicGalaxyOutskirts';

  return {
    points,
    update(time, pulse) {
      material.opacity = 0.2 + pulse * 0.035;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createArmHighlights(texture) {
  const count = 16;
  const random = seededRandom(66191);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const palette = [
    new THREE.Color(0x9bdcff),
    new THREE.Color(0xa48cf4),
    new THREE.Color(0xffdfb2)
  ];
  const progressSequence = [0.15, 0.24, 0.36, 0.43, 0.56, 0.67, 0.75, 0.82];

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const armIndex = index % 2;
    const sequenceIndex = Math.floor(index / 2);
    const progress = progressSequence[sequenceIndex] + (random() - 0.5) * 0.028;
    const radius = INNER_RADIUS
      + (OUTER_RADIUS - INNER_RADIUS) * Math.pow(progress, RADIUS_EXPONENT);
    const angle = armIndex * Math.PI + progress * TAU * TURNS;
    const color = palette[index % palette.length];

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = Math.sin(angle) * radius;
    positions[stride + 2] = (random() - 0.5) * 0.05;
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = 0.78 + random() * 0.72;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(new Float32Array(count).fill(0.82), 1));
  const material = createParticleMaterial(texture, 0.9, 18, THREE.AdditiveBlending);
  const points = new THREE.Points(geometry, material);

  points.name = 'CinematicGalaxyArmHighlights';
  points.renderOrder = 3;

  return {
    points,
    update(time, pulse) {
      material.uniforms.uOpacity.value = 0.82 + pulse * 0.15;
      material.uniforms.uPointScale.value = 0.94 + pulse * 0.08;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createNebulaMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: 0.19 },
      uPointScale: { value: 1 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute float aRotation;
      attribute float aStretch;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vRotation;
      varying float vStretch;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vOpacity = aOpacity;
        vRotation = aRotation;
        vStretch = aStretch;
        gl_PointSize = aSize * uPointScale * (14.5 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vRotation;
      varying float vStretch;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float sine = sin(vRotation);
        float cosine = cos(vRotation);
        vec2 rotated = mat2(cosine, -sine, sine, cosine) * centered;
        vec2 stretchedUv = vec2(rotated.x, rotated.y * vStretch) + 0.5;

        if (stretchedUv.x < 0.0 || stretchedUv.x > 1.0 || stretchedUv.y < 0.0 || stretchedUv.y > 1.0) {
          discard;
        }
        float alpha = texture2D(uTexture, stretchedUv).a;
        gl_FragColor = vec4(vColor, alpha * vOpacity * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: true
  });
}

function createParticleMaterial(texture, opacity, pointScale, blending) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: opacity },
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
        gl_PointSize = aSize * uPointScale * (${pointScale.toFixed(1)} / max(-viewPosition.z, 1.0));
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
    blending,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
}

function chooseGalaxyColor(target, palette, roll) {
  if (roll < 0.22) {
    target.copy(palette[0]);
  } else if (roll < 0.52) {
    target.copy(palette[1]);
  } else if (roll < 0.72) {
    target.copy(palette[2]);
  } else if (roll < 0.92) {
    target.copy(palette[3]);
  } else {
    target.copy(palette[4]);
  }
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
  gradient.addColorStop(0.2, 'rgba(226,247,255,0.94)');
  gradient.addColorStop(0.55, 'rgba(104,175,255,0.3)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function gaussianRandom(random) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function clampGaussian(value) {
  return Math.max(-2.4, Math.min(2.4, value));
}

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export const cinematicGalaxyFactory = {
  createCinematicGalaxy
};
