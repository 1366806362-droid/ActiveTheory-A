import * as THREE from 'three';
import { createGalaxyCoreCluster } from './galaxyCoreCluster.js';

const TAU = Math.PI * 2;
const GEO_PREVIEW_TEXTURE_URL = '/textures/hero/subgalaxy/geo/geo-mini-galaxy-v1.webp';
const GEO_PREVIEW_TEXTURE_OPACITY = 0.56;
const GEO_PREVIEW_TEXTURE_SCALE = 0.82;
const GEO_PREVIEW_ARM_OPACITY_SCALE = 0.72;
const NEBULAE = [
  {
    name: 'GEO Nebula',
    label: 'GEO',
    color: 0x00b8ff,
    accent: 0xb8f6ff,
    orbitRadius: 1.12,
    orbitScaleY: 0.62,
    size: 0.38,
    driftPeriod: 240,
    driftDirection: 1,
    driftPhase: Math.PI,
    driftAmplitude: [0.025, 0.02, 0.014],
    driftDepthPhase: 0.65,
    spin: 0.052,
    phase: 5.3,
    depthScale: 0.22,
    tilt: [0.384, 0.04, -0.14],
    labelOffset: [0.12, -0.06, 0.08],
    hoverX: 0.28,
    hoverY: 0.12,
    brightness: 1.55,
    armCount: 2,
    coreStars: 112,
    visibleCoreCount: 62,
    coreCount: 5,
    mainArmCount: 270,
    auxiliaryArmCount: 96,
    auxiliaryBranchCount: 3,
    dustCount: 58,
    nebulaCount: 48,
    nodeCount: 5
  },
  {
    name: '5A Nebula',
    label: '5A',
    color: 0x728bff,
    accent: 0xd8e2ff,
    orbitRadius: 0.96,
    orbitScaleY: 0.3,
    size: 0.345,
    driftPeriod: 285,
    driftDirection: -1,
    driftPhase: -Math.PI * 0.5,
    driftAmplitude: [0.0175, 0.0125, 0.01],
    driftDepthPhase: 1.4,
    spin: -0.042,
    phase: 4.3,
    depthScale: 0.26,
    tilt: [-0.524, -0.16, 0.28],
    labelOffset: [-0.06, -0.16, 0.08],
    hoverX: 0.24,
    hoverY: -0.45,
    brightness: 1.46,
    armCount: 2,
    coreStars: 96,
    visibleCoreCount: 54,
    coreCount: 4,
    mainArmCount: 102,
    auxiliaryArmCount: 38,
    dustCount: 54,
    nebulaCount: 44,
    nodeCount: 4
  },
  {
    name: 'Brand Mind Nebula',
    label: '\u54c1\u724c\u5fc3\u667a',
    color: 0x9b83d5,
    accent: 0xdcecff,
    orbitRadius: 0.98,
    orbitScaleY: 0.48,
    size: 0.345,
    driftPeriod: 330,
    driftDirection: 1,
    driftPhase: Math.PI * 0.5,
    driftAmplitude: [0.025, 0.0175, 0.012],
    driftDepthPhase: 2.2,
    spin: 0.036,
    phase: 3.55,
    depthScale: 0.2,
    tilt: [0.663, 0.08, 0.2],
    labelOffset: [-0.08, 0.18, 0.08],
    hoverX: -0.18,
    hoverY: 0.24,
    brightness: 1.34,
    armCount: 2,
    coreStars: 96,
    visibleCoreCount: 54,
    coreCount: 4,
    mainArmCount: 102,
    auxiliaryArmCount: 38,
    dustCount: 54,
    nebulaCount: 44,
    nodeCount: 4
  }
];

export function createGalaxyPlanets() {
  const group = new THREE.Group();
  const debugState = readSubGalaxyDebugState();
  const previewState = readSubGalaxyPreviewState();
  const particleTexture = createNebulaParticleTexture();
  const geoPreviewTexture = previewState.enabled
    ? loadGeoPreviewTexture()
    : null;
  const nebulae = NEBULAE.map((config, index) => (
    createBusinessNebula(
      config,
      particleTexture,
      9107 + index * 193,
      {
        geoPreviewTexture,
        previewMode: previewState.mode
      }
    )
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
    if (previewState.enabled && nebula.name === 'GEO Nebula') {
      nebula.setPreviewMode(previewState.mode);
    }
    if (debugState.enabled) {
      nebula.setDebugMode(
        nebula.name === 'GEO Nebula' ? debugState.mode : 'hidden'
      );
    }
  });

  const geoNebula = nebulae.find((nebula) => nebula.name === 'GEO Nebula');

  if (import.meta.env.DEV && geoNebula) {
    window.__ACTIVE_THEORY_GEO_ARMS__ = geoNebula.getDebugSnapshot;
  }

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
    geoPreviewTexture?.dispose();
    group.clear();
    if (
      import.meta.env.DEV
      && window.__ACTIVE_THEORY_GEO_ARMS__ === geoNebula?.getDebugSnapshot
    ) {
      delete window.__ACTIVE_THEORY_GEO_ARMS__;
    }
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

function createBusinessNebula(config, particleTexture, seed, previewOptions) {
  const orbitalGroup = new THREE.Group();
  const nebulaGroup = new THREE.Group();
  const cluster = createNebulaCluster(config, particleTexture, seed);
  const galaxyTexture = config.name === 'GEO Nebula' && previewOptions.geoPreviewTexture
    ? createGeoGalaxyTexture(config, previewOptions.geoPreviewTexture)
    : null;
  const innerNebula = config.name === 'GEO Nebula'
    ? createGeoInnerNebula(config, particleTexture, seed + 23)
    : null;
  const dust = createNebulaDust(config, particleTexture, seed + 37);
  const nodes = createNebulaNodes(config, particleTexture, seed + 71);
  const nebula = createLocalNebula(config, particleTexture, seed + 89);
  const visibleCore = createVisibleCore(config, particleTexture, seed + 101);
  const coreCluster = createGalaxyCoreCluster({
    name: `${config.name.replace(/\s+/g, '')}CoreCluster`,
    starCount: config.coreStars,
    highlightCount: config.coreCount,
    radius: config.size * 0.47,
    coreColor: config.accent,
    secondaryColors: [config.color, config.accent],
    depthRange: config.size * 0.46,
    bloomIntensity: config.name === 'GEO Nebula' ? 0.72 : 0.52,
    pulseSpeed: 0.3 + seed % 7 * 0.006,
    starOpacity: config.name === 'GEO Nebula' ? 1 : 0.89,
    highlightOpacity: config.name === 'GEO Nebula' ? 0.98 : 0.88,
    hazeOpacity: 0.035,
    seed: seed + 107
  });
  const label = createNebulaLabel(config);
  const anchorPosition = new THREE.Vector3(
    Math.cos(config.phase) * config.orbitRadius,
    Math.sin(config.phase) * config.orbitRadius * config.orbitScaleY,
    Math.sin(config.phase) * config.orbitRadius * Math.sin(config.tilt[0])
  );
  let driftAngle = config.driftPhase;
  let debugMode = 'combined';
  let previewMode = galaxyTexture ? previewOptions.previewMode : 'disabled';
  let labelVisible = true;

  orbitalGroup.name = `${config.name.replace(/\s+/g, '')}Orbit`;
  orbitalGroup.rotation.set(0, 0, 0);
  nebulaGroup.name = config.name.replace(/\s+/g, '');
  nebulaGroup.add(
    nebula.points,
    dust.points
  );
  if (galaxyTexture) {
    nebulaGroup.add(galaxyTexture.mesh);
  }
  if (innerNebula) {
    nebulaGroup.add(innerNebula.points);
  }
  nebulaGroup.add(
    cluster.points,
    nodes.points,
    visibleCore.group,
    coreCluster.group
  );
  orbitalGroup.add(nebulaGroup, label.sprite);

  function update(delta, time, index, entryProgress, focusProgress, isEntryTarget, interaction) {
    const freeze = smoothstep(0.05, 0.24, entryProgress);
    const entryFocus = smoothstep(0.16, 0.66, entryProgress);
    const driftSpeed = TAU / config.driftPeriod * config.driftDirection * (1 - freeze);
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

    driftAngle += delta * driftSpeed;
    const driftX = (
      Math.cos(driftAngle) - Math.cos(config.driftPhase)
    ) * config.driftAmplitude[0];
    const driftY = (
      Math.sin(driftAngle) - Math.sin(config.driftPhase)
    ) * config.driftAmplitude[1];
    const driftZ = (
      Math.sin(driftAngle + config.driftDepthPhase)
      - Math.sin(config.driftPhase + config.driftDepthPhase)
    ) * config.driftAmplitude[2];
    nebulaGroup.position.set(
      anchorPosition.x + driftX,
      anchorPosition.y + driftY,
      anchorPosition.z + driftZ
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
    const armOpacityScale = galaxyTexture && previewMode === 'combined'
      ? GEO_PREVIEW_ARM_OPACITY_SCALE
      : 1;

    cluster.update(
      delta,
      time,
      pulse,
      visibility,
      entryFocus,
      visualBoost,
      armOpacityScale
    );
    galaxyTexture?.update(delta, visibility, visualBoost);
    innerNebula?.update(delta, time, visibility, visualBoost);
    nebula.update(delta, time, pulse, visibility, visualBoost);
    dust.update(delta, time, pulse, visibility, visualBoost);
    nodes.update(delta, time, pulse, visibility, entryFocus, visualBoost);
    visibleCore.update(time, pulse, visibility, visualBoost);
    coreCluster.update(delta, time, pulse, visibility, entryFocus, visualBoost);
    label.update(labelVisibility, hover);
  }

  function dispose() {
    cluster.dispose();
    galaxyTexture?.dispose();
    innerNebula?.dispose();
    nebula.dispose();
    dust.dispose();
    nodes.dispose();
    visibleCore.dispose();
    coreCluster.dispose();
    label.dispose();
    orbitalGroup.clear();
  }

  function setDebugMode(mode) {
    debugMode = mode;
    orbitalGroup.visible = mode !== 'hidden';
    const armsOnly = mode === 'armsOnly';
    const innerNebulaOnly = mode === 'innerNebulaOnly';
    const isolatedLayer = armsOnly || innerNebulaOnly;

    cluster.points.visible = !innerNebulaOnly;
    if (innerNebula) {
      innerNebula.points.visible = !armsOnly;
    }
    nebula.points.visible = !isolatedLayer;
    dust.points.visible = !isolatedLayer;
    nodes.points.visible = !isolatedLayer;
    visibleCore.group.visible = !isolatedLayer;
    coreCluster.group.visible = !isolatedLayer;
    label.sprite.visible = labelVisible && !isolatedLayer;
  }

  function setPreviewMode(mode) {
    if (!galaxyTexture) {
      return;
    }

    previewMode = mode;
    const textureOnly = mode === 'textureOnly';

    galaxyTexture.mesh.visible = true;
    cluster.points.visible = !textureOnly;
    if (innerNebula) {
      innerNebula.points.visible = !textureOnly;
    }
    nebula.points.visible = !textureOnly;
    dust.points.visible = !textureOnly;
    nodes.points.visible = !textureOnly;
    visibleCore.group.visible = !textureOnly;
    coreCluster.group.visible = !textureOnly;
    label.sprite.visible = labelVisible && !textureOnly && debugMode === 'combined';
  }

  function getDebugSnapshot() {
    return {
      name: config.name,
      mode: debugMode,
      rootUuid: orbitalGroup.uuid,
      nebulaUuid: nebulaGroup.uuid,
      armUuid: cluster.points.uuid,
      rotationZ: nebulaGroup.rotation.z,
      armRotationZ: cluster.points.rotation.z,
      mainArmCount: config.mainArmCount,
      auxiliaryBranchCount: config.auxiliaryBranchCount ?? 1,
      auxiliaryArmCount: config.auxiliaryArmCount,
      sizeRatios: cluster.sizeRatios,
      innerNebulaSegments: innerNebula?.segmentCount ?? 0,
      innerNebulaAlpha: innerNebula?.alphaRange ?? null,
      previewMode,
      textureUuid: galaxyTexture?.mesh.uuid ?? null,
      textureRotationZ: galaxyTexture?.mesh.rotation.z ?? null,
      textureOpacity: galaxyTexture?.opacity ?? null,
      textureScale: galaxyTexture?.scale ?? null,
      armOpacityScale: galaxyTexture && previewMode === 'combined'
        ? GEO_PREVIEW_ARM_OPACITY_SCALE
        : 1
    };
  }

  return {
    name: config.name,
    group: orbitalGroup,
    nebulaGroup,
    setLabelVisible(visible) {
      labelVisible = visible;
      label.sprite.visible = visible
        && debugMode === 'combined'
        && previewMode !== 'textureOnly';
    },
    setDebugMode,
    setPreviewMode,
    getDebugSnapshot,
    update,
    dispose
  };
}

function createNebulaCluster(config, texture, seed) {
  if (config.name === 'GEO Nebula') {
    return createGeoNebulaCluster(config, texture, seed);
  }

  return createLegacyNebulaCluster(config, texture, seed);
}

function createLegacyNebulaCluster(config, texture, seed) {
  const mainArmCount = config.mainArmCount;
  const auxiliaryArmCount = config.auxiliaryArmCount;
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
    const armLength = auxiliary ? 0.64 : 0.77;
    const radius = 0.018 + Math.pow(progress, auxiliary ? 1.18 : 1.04) * config.size * armLength;
    const armAngle = auxiliary ? Math.PI + 0.7 : 0.16;
    const spinAngle = Math.pow(progress, 0.86) * (auxiliary ? 1.48 : 2.12);
    const cluster = Math.sin(progress * 22 + seed * 0.003) * 0.5 + 0.5;
    const angularNoise = (random() - 0.5) * (auxiliary ? 0.22 : 0.11);
    const radialNoise = (random() - 0.5) * config.size * (0.035 + progress * 0.08);
    const angle = armAngle + spinAngle + angularNoise;
    const noisyRadius = radius + radialNoise;
    const thickness = config.size * (0.055 + (1 - progress) * 0.18 + cluster * 0.045);
    const dropout = (cluster < 0.22 && random() < 0.6) || (auxiliary && random() < 0.3);

    positions[i3] = Math.cos(angle) * noisyRadius;
    positions[i3 + 1] = Math.sin(angle) * noisyRadius * 0.62;
    positions[i3 + 2] = (random() - 0.5) * thickness;
    color.copy(accentColor).lerp(baseColor, progress * 0.82);
    const brightness = (auxiliary ? 0.2 : 0.94) * (0.72 + cluster * 0.42) * (dropout ? 0.08 : 1) * config.brightness;

    colors[i3] = color.r * brightness;
    colors[i3 + 1] = color.g * brightness;
    colors[i3 + 2] = color.b * brightness;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.024,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.012,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = `${config.name.replace(/\s+/g, '')}SpiralCluster`;

  function update(delta, time, pulse, visibility, entryProgress, hoverBoost) {
    points.rotation.z += delta * config.spin * 0.38;
    points.rotation.y = Math.sin(time * 0.08 + config.phase) * 0.08;
    material.opacity = (0.64 + pulse * 0.1 + entryProgress * 0.08) * visibility * hoverBoost * config.brightness;
    material.size = (0.026 + pulse * 0.002 + entryProgress * 0.005) * (0.98 + (hoverBoost - 1) * 0.25);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose, sizeRatios: null };
}

function createGeoNebulaCluster(config, texture, seed) {
  const mainArmCounts = [144, 126];
  const branchCounts = [38, 32, 26];
  const count = config.mainArmCount + config.auxiliaryArmCount;
  const microCount = Math.round(count * 0.74);
  const mediumCount = Math.round(count * 0.22);
  const highlightCount = count - microCount - mediumCount;
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const sizeTiers = [
    ...new Array(microCount).fill(0),
    ...new Array(mediumCount).fill(1),
    ...new Array(highlightCount).fill(2)
  ];
  const baseColor = new THREE.Color(config.color);
  const accentColor = new THREE.Color(config.accent);
  const coldWhite = new THREE.Color(0xeaffff);
  const deepBlue = new THREE.Color(0x0757a8);
  const color = new THREE.Color();
  let cursor = 0;

  for (let index = sizeTiers.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = sizeTiers[index];

    sizeTiers[index] = sizeTiers[swapIndex];
    sizeTiers[swapIndex] = value;
  }

  function writeParticle({
    x,
    y,
    z,
    progress,
    cluster,
    alpha,
    brightnessScale = 1,
    iceCluster = false,
    forceHighlight = false
  }) {
    const stride = cursor * 3;
    const tier = forceHighlight ? Math.max(1, sizeTiers[cursor]) : sizeTiers[cursor];
    const tierSize = tier === 0
      ? 0.0125 + random() * 0.0045
      : tier === 1
        ? 0.021 + random() * 0.007
        : 0.034 + random() * 0.011;

    positions[stride] = x;
    positions[stride + 1] = y;
    positions[stride + 2] = z;
    color.copy(accentColor).lerp(baseColor, 0.28 + progress * 0.55);
    if (tier === 2 || forceHighlight) {
      color.lerp(coldWhite, 0.55 + random() * 0.2);
    } else if (iceCluster) {
      color.lerp(coldWhite, 0.42 + random() * 0.16);
    } else if (tier === 0 && progress > 0.7) {
      color.lerp(deepBlue, 0.2 + random() * 0.22);
    }
    const brightness = (
      0.58 + cluster * 0.28 + tier * 0.08 + (iceCluster ? 0.06 : 0)
    ) * brightnessScale;

    colors[stride] = color.r * brightness;
    colors[stride + 1] = color.g * brightness;
    colors[stride + 2] = color.b * brightness;
    sizes[cursor] = tierSize;
    alphas[cursor] = alpha;
    cursor += 1;
  }

  const armSettings = [
    {
      count: mainArmCounts[0],
      phase: -0.04,
      sweep: 2.34,
      maxRadius: 0.75,
      gaps: [[0.5, 0.58], [0.79, 0.85]],
      brightness: 1,
      outerFadeStart: 0.8,
      outerFadeAmount: 0.58
    },
    {
      count: mainArmCounts[1],
      phase: Math.PI + 0.24,
      sweep: 2.06,
      maxRadius: 0.68,
      gaps: [[0.57, 0.65], [0.74, 0.84]],
      brightness: 0.82,
      outerFadeStart: 0.68,
      outerFadeAmount: 0.82
    }
  ];

  armSettings.forEach((arm, armIndex) => {
    for (let localIndex = 0; localIndex < arm.count; localIndex += 1) {
      const progress = (localIndex + random() * 0.72) / arm.count;
      const radius = config.size * (
        0.045 + Math.pow(progress, 0.88) * (arm.maxRadius - 0.045)
      );
      const cluster = Math.sin(progress * (18.5 + armIndex * 2.4) + armIndex * 1.7) * 0.5 + 0.5;
      const width = config.size * (
        0.048
        + (1 - progress) * 0.072
        + Math.sin(progress * Math.PI) * 0.052
      );
      const band = localIndex % 3 - 1;
      const lateral = (
        band * width * 0.52
        + clampGaussian(gaussianRandom(random)) * width * 0.32
      );
      const angle = arm.phase
        + Math.pow(progress, 0.84) * arm.sweep
        + (random() - 0.5) * (0.055 + progress * 0.05);
      const gapDistance = Math.min(...arm.gaps.map((gap) => (
        Math.abs(progress - (gap[0] + gap[1]) * 0.5)
      )));
      const inGap = arm.gaps.some((gap) => progress > gap[0] && progress < gap[1]);
      const reconnect = gapDistance < 0.13 && !inGap ? 1.1 : 1;
      const outerFade = 1
        - smoothstep(arm.outerFadeStart, 1, progress) * arm.outerFadeAmount;
      const coreConnection = 1 + (1 - smoothstep(0.08, 0.24, progress)) * 0.16;
      const alpha = (
        (0.62 + cluster * 0.34)
        * outerFade
        * coreConnection
        * (inGap ? 0.08 + random() * 0.12 : reconnect)
      );
      const x = Math.cos(angle) * radius - Math.sin(angle) * lateral;
      const y = (Math.sin(angle) * radius + Math.cos(angle) * lateral) * 0.62;
      const z = (random() - 0.5) * width * (0.65 + progress * 0.45);

      writeParticle({
        x,
        y,
        z,
        progress,
        cluster,
        alpha,
        brightnessScale: arm.brightness,
        iceCluster: progress > 0.08 && progress < 0.18 && localIndex % 3 !== 2
      });
    }
  });

  const branchSettings = [
    { count: branchCounts[0], arm: 0, start: 0.38, length: 0.3, divergence: -0.52, alpha: 0.72 },
    { count: branchCounts[1], arm: 1, start: 0.5, length: 0.25, divergence: 0.46, alpha: 0.6 },
    { count: branchCounts[2], arm: 0, start: 0.66, length: 0.18, divergence: 0.62, alpha: 0.48 }
  ];

  branchSettings.forEach((branch, branchIndex) => {
    const sourceArm = armSettings[branch.arm];

    for (let localIndex = 0; localIndex < branch.count; localIndex += 1) {
      const branchProgress = (localIndex + random() * 0.74) / branch.count;
      const sourceProgress = branch.start + branchProgress * branch.length;
      const radius = config.size * (
        0.045 + Math.pow(sourceProgress, 0.88) * (sourceArm.maxRadius - 0.045)
      );
      const angle = sourceArm.phase
        + Math.pow(sourceProgress, 0.84) * sourceArm.sweep
        + branch.divergence * Math.pow(branchProgress, 1.16)
        + (random() - 0.5) * 0.09;
      const width = config.size * (0.052 - branchProgress * 0.02);
      const lateral = clampGaussian(gaussianRandom(random)) * width * 0.48;
      const cluster = Math.sin(branchProgress * 13 + branchIndex * 2.6) * 0.5 + 0.5;
      const breakMask = (
        branchProgress > 0.43
        && branchProgress < 0.53
        && branchIndex !== 1
      ) ? 0.2 : 1;
      const endCluster = branchIndex === 0 && branchProgress > 0.82;
      const alpha = branch.alpha
        * (0.62 + cluster * 0.34)
        * (1 - smoothstep(0.82, 1, branchProgress) * 0.5)
        * breakMask
        * (endCluster ? 1.2 : 1);
      const x = Math.cos(angle) * radius - Math.sin(angle) * lateral;
      const y = (Math.sin(angle) * radius + Math.cos(angle) * lateral) * 0.62;
      const z = (random() - 0.5) * width * 0.65;

      writeParticle({
        x,
        y,
        z,
        progress: sourceProgress,
        cluster,
        alpha,
        brightnessScale: sourceArm.brightness * 0.92,
        forceHighlight: endCluster && localIndex % 3 === 0
      });
    }
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: 0.7 },
      uSizeScale: { value: 1 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uSizeScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = max(1.0, aSize * uSizeScale * (720.0 / max(1.0, -viewPosition.z)));
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 particle = texture2D(uTexture, gl_PointCoord);
        if (particle.a < 0.012) discard;
        gl_FragColor = vec4(vColor * particle.rgb, particle.a * vAlpha * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GEONebulaSpiralCluster';

  function update(
    delta,
    time,
    pulse,
    visibility,
    entryProgress,
    hoverBoost,
    opacityScale = 1
  ) {
    points.rotation.z += delta * config.spin * 0.38;
    points.rotation.y = Math.sin(time * 0.08 + config.phase) * 0.08;
    material.uniforms.uOpacity.value = (
      0.68 + pulse * 0.08 + entryProgress * 0.07
    ) * visibility * hoverBoost * config.brightness * opacityScale;
    material.uniforms.uSizeScale.value = (
      0.98 + pulse * 0.04 + entryProgress * 0.09
    ) * (0.98 + (hoverBoost - 1) * 0.25);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose,
    sizeRatios: {
      micro: microCount / count,
      medium: mediumCount / count,
      highlight: highlightCount / count
    }
  };
}

function createGeoGalaxyTexture(config, texture) {
  const planeSize = config.size * 2.55;
  const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: GEO_PREVIEW_TEXTURE_OPACITY,
    alphaTest: 0.002,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'GEOGalaxyTexture';
  mesh.position.set(0, 0, -0.052);
  mesh.scale.setScalar(GEO_PREVIEW_TEXTURE_SCALE);
  mesh.renderOrder = -0.75;

  function update(delta, visibility, hoverBoost) {
    mesh.rotation.z += delta * config.spin * 0.38;
    material.opacity = GEO_PREVIEW_TEXTURE_OPACITY
      * visibility
      * (1 + (hoverBoost - 1) * 0.08);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    mesh,
    update,
    dispose,
    opacity: GEO_PREVIEW_TEXTURE_OPACITY,
    scale: GEO_PREVIEW_TEXTURE_SCALE
  };
}

function createGeoInnerNebula(config, texture, seed) {
  const segments = [
    { count: 20, arm: 0, start: 0.07, end: 0.46, phaseOffset: -0.03, alphaScale: 1 },
    { count: 18, arm: 1, start: 0.09, end: 0.41, phaseOffset: 0.04, alphaScale: 0.82 },
    { count: 16, arm: 0, start: 0.24, end: 0.52, phaseOffset: -0.18, alphaScale: 0.68 }
  ];
  const armSettings = [
    { phase: -0.04, sweep: 2.34, maxRadius: 0.75 },
    { phase: Math.PI + 0.24, sweep: 2.06, maxRadius: 0.68 }
  ];
  const count = segments.reduce((total, segment) => total + segment.count, 0);
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const deepCyan = new THREE.Color(0x005b7f);
  const iceBlue = new THREE.Color(0x63dfff);
  const coldWhite = new THREE.Color(0xdffbff);
  const color = new THREE.Color();
  let cursor = 0;

  segments.forEach((segment, segmentIndex) => {
    const arm = armSettings[segment.arm];

    for (let localIndex = 0; localIndex < segment.count; localIndex += 1) {
      const localProgress = (localIndex + random() * 0.72) / segment.count;
      const armProgress = segment.start
        + localProgress * (segment.end - segment.start);
      const radius = config.size * (
        0.045 + Math.pow(armProgress, 0.88) * (arm.maxRadius - 0.045)
      );
      const angle = arm.phase
        + Math.pow(armProgress, 0.84) * arm.sweep
        + segment.phaseOffset
        + (random() - 0.5) * 0.11;
      const width = config.size * (
        0.06 + Math.sin(localProgress * Math.PI) * 0.055
      );
      const lateral = clampGaussian(gaussianRandom(random)) * width * 0.72;
      const lowFrequencyNoise = (
        Math.sin(localProgress * TAU * (1.18 + segmentIndex * 0.17) + segmentIndex * 1.4)
        * 0.5
        + 0.5
      );
      const feather = smoothstep(0, 0.18, localProgress)
        * (1 - smoothstep(0.78, 1, localProgress));
      const hole = lowFrequencyNoise < 0.26 || (
        segmentIndex === 2
        && localProgress > 0.42
        && localProgress < 0.62
      );
      const alpha = Math.min(
        0.065,
        (0.025 + lowFrequencyNoise * 0.04)
          * segment.alphaScale
          * feather
          * (hole ? 0.12 : 1)
      );
      const stride = cursor * 3;

      positions[stride] = Math.cos(angle) * radius - Math.sin(angle) * lateral;
      positions[stride + 1] = (
        Math.sin(angle) * radius + Math.cos(angle) * lateral
      ) * 0.62;
      positions[stride + 2] = -0.018 + (random() - 0.5) * width * 0.7;
      color.copy(deepCyan).lerp(iceBlue, 0.28 + lowFrequencyNoise * 0.38);
      if (random() > 0.94) {
        color.lerp(coldWhite, 0.18);
      }
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      sizes[cursor] = 0.06 + random() * 0.045;
      alphas[cursor] = alpha;
      cursor += 1;
    }
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: 1 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = max(1.0, aSize * (720.0 / max(1.0, -viewPosition.z)));
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 mist = texture2D(uTexture, gl_PointCoord);
        if (mist.a < 0.006) discard;
        gl_FragColor = vec4(vColor * mist.rgb, mist.a * vAlpha * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GEOInnerNebula';
  points.renderOrder = -0.5;

  function update(delta, time, visibility, hoverBoost) {
    points.rotation.z += delta * config.spin * 0.38;
    points.rotation.y = Math.sin(time * 0.08 + config.phase) * 0.08;
    material.uniforms.uOpacity.value = visibility * (
      0.94 + (hoverBoost - 1) * 0.25
    );
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose,
    segmentCount: segments.length,
    alphaRange: [0.025, 0.065]
  };
}

function createNebulaDust(config, texture, seed) {
  const count = config.dustCount;
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color(config.color);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const radius = Math.pow(random(), 0.72) * config.size * 1.38;
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
    size: 0.011,
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
    material.opacity = (0.3 + pulse * 0.12) * visibility * (0.96 + (hoverBoost - 1) * 0.5) * config.brightness;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createLocalNebula(config, texture, seed) {
  const count = config.nebulaCount;
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const baseColor = new THREE.Color(config.color);
  const accentColor = new THREE.Color(config.accent);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const progress = 0.1 + ((index + random() * 0.75) / count) * 0.65;
    const radius = 0.02 + Math.pow(progress, 1.04) * config.size * 0.72;
    const angle = 0.16 + Math.pow(progress, 0.86) * 2.12;
    const cluster = Math.sin(progress * TAU * 3.2 + seed * 0.002) * 0.5 + 0.5;
    const width = config.size * (0.035 + Math.sin(progress * Math.PI) * 0.07);
    const perpendicular = clampGaussian(gaussianRandom(random)) * width;

    positions[stride] = Math.cos(angle) * radius - Math.sin(angle) * perpendicular;
    positions[stride + 1] = (Math.sin(angle) * radius + Math.cos(angle) * perpendicular) * 0.62;
    positions[stride + 2] = -0.025 + (random() - 0.5) * config.size * 0.12;
    color.copy(baseColor).lerp(accentColor, 0.38 + cluster * 0.34);
    color.multiplyScalar(0.36 + cluster * 0.24);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.075,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.006,
    vertexColors: true,
    transparent: true,
    opacity: 0.18,
    blending: THREE.NormalBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = `${config.name.replace(/\s+/g, '')}LocalNebula`;
  points.renderOrder = -1;
  function update(delta, time, pulse, visibility, hoverBoost) {
    points.rotation.z += delta * config.spin * 0.18;
    material.opacity = (0.16 + pulse * 0.045) * visibility * hoverBoost;
    material.size = 0.072 + Math.sin(time * 0.18 + config.phase) * 0.003;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createNebulaNodes(config, texture, seed) {
  const count = config.nodeCount;
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
    material.size = (0.04 + pulse * 0.01 + entryProgress * 0.012) * (0.98 + (hoverBoost - 1) * 0.4);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createVisibleCore(config, texture, seed) {
  const random = seededRandom(seed);
  const group = new THREE.Group();
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(config.visibleCoreCount * 3);
  const starColors = new Float32Array(config.visibleCoreCount * 3);
  const accent = new THREE.Color(config.accent);
  const base = new THREE.Color(config.color);
  const warm = new THREE.Color(0xffe1b8);
  const color = new THREE.Color();

  for (let index = 0; index < config.visibleCoreCount; index += 1) {
    const radius = Math.pow(random(), 1.75) * config.size * 0.25;
    const angle = random() * TAU;
    const stride = index * 3;

    starPositions[stride] = Math.cos(angle) * radius;
    starPositions[stride + 1] = Math.sin(angle) * radius * 0.58;
    starPositions[stride + 2] = (random() - 0.5) * config.size * 0.06;
    color.copy(accent).lerp(base, random() * 0.45);
    if (random() > 0.94) color.lerp(warm, 0.42);
    starColors[stride] = color.r * config.brightness;
    starColors[stride + 1] = color.g * config.brightness;
    starColors[stride + 2] = color.b * config.brightness;
  }

  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMaterial = new THREE.PointsMaterial({
    size: 0.034,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.012,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  const highlightGeometry = new THREE.BufferGeometry();
  const highlightPositions = new Float32Array(3 * 3);
  const highlightColors = new Float32Array(3 * 3);

  for (let index = 0; index < 3; index += 1) {
    const radius = config.size * (0.025 + index * 0.045);
    const angle = 0.55 + index * 2.15;
    const stride = index * 3;

    highlightPositions[stride] = Math.cos(angle) * radius;
    highlightPositions[stride + 1] = Math.sin(angle) * radius * 0.58;
    highlightPositions[stride + 2] = 0.012;
    highlightColors[stride] = accent.r;
    highlightColors[stride + 1] = accent.g;
    highlightColors[stride + 2] = accent.b;
  }

  highlightGeometry.setAttribute('position', new THREE.BufferAttribute(highlightPositions, 3));
  highlightGeometry.setAttribute('color', new THREE.BufferAttribute(highlightColors, 3));
  const highlightMaterial = new THREE.PointsMaterial({
    size: 0.064,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.012,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const highlights = new THREE.Points(highlightGeometry, highlightMaterial);

  group.name = `${config.name.replace(/\s+/g, '')}VisibleCore`;
  group.add(stars, highlights);
  function update(time, pulse, visibility, hoverBoost) {
    const scale = 0.985 + Math.sin(time * 0.22 + config.phase) * 0.015;

    group.scale.setScalar(scale);
    starMaterial.opacity = (0.78 + pulse * 0.12) * visibility * hoverBoost;
    highlightMaterial.opacity = (0.7 + pulse * 0.16) * visibility * hoverBoost;
  }

  function dispose() {
    starGeometry.dispose();
    highlightGeometry.dispose();
    starMaterial.dispose();
    highlightMaterial.dispose();
    group.clear();
  }

  return { group, update, dispose };
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

function readSubGalaxyDebugState() {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('debugSubGalaxy') === 'geo';
  const requestedMode = params.get('mode');

  return {
    enabled,
    mode: requestedMode === 'armsOnly'
      ? 'armsOnly'
      : requestedMode === 'innerNebulaOnly'
        ? 'innerNebulaOnly'
        : 'combined'
  };
}

function readSubGalaxyPreviewState() {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('subGalaxyPreview') === 'geo-v13';

  return {
    enabled,
    mode: enabled && params.get('mode') === 'textureOnly'
      ? 'textureOnly'
      : enabled
        ? 'combined'
        : 'disabled'
  };
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

function loadGeoPreviewTexture() {
  const texture = new THREE.TextureLoader().load(GEO_PREVIEW_TEXTURE_URL);

  texture.name = 'GEOMiniGalaxyV1Texture';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  return texture;
}

function gaussianRandom(random) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function clampGaussian(value) {
  return Math.max(-2.25, Math.min(2.25, value));
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
