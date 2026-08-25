import * as THREE from 'three';
import { createGalaxyCoreCluster } from './galaxyCoreCluster.js';
import { UNIVERSE_RENDER_DEBUG } from './universeRenderDebug.js';

const TAU = Math.PI * 2;
export const BUSINESS_INTERACTION_DEBUG_PARAMS = Object.freeze({
  labels: 'debugBusinessLabels',
  hover: 'debugBusinessHover'
});

export function readBusinessInteractionDebug(search = readLocationSearch()) {
  const params = new URLSearchParams(search);

  return Object.freeze(Object.fromEntries(
    Object.entries(BUSINESS_INTERACTION_DEBUG_PARAMS).map(([key, parameter]) => (
      [key, params.get(parameter) !== '0']
    ))
  ));
}

export function readBusinessHoverTarget(search = readLocationSearch()) {
  const value = new URLSearchParams(search).get(BUSINESS_INTERACTION_DEBUG_PARAMS.hover);
  const targets = {
    geo: 'GEO Nebula',
    '5a': '5A Nebula',
    brandMind: 'Brand Mind Nebula'
  };

  return targets[value] ?? null;
}

export const BUSINESS_INTERACTION_DEBUG = readBusinessInteractionDebug();

export const BRAND_GROWTH_NEBULAE = Object.freeze([
  {
    name: 'GEO Nebula',
    label: 'GEO',
    color: 0x00b8ff,
    accent: 0xb8f6ff,
    anchor: [0.77, -0.08, 0.34],
    depthRole: 'foreground',
    visualScale: [1.34, 0.74, 1.08],
    visualRotation: -0.22,
    size: 0.43,
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
    hoverX: 0.34,
    hoverY: -0.06,
    brightness: 1.55,
    armCount: 2,
    coreStars: 168,
    visibleCoreCount: 84,
    coreCount: 7,
    mainArmCount: 188,
    auxiliaryArmCount: 72,
    dustCount: 86,
    nebulaCount: 72,
    nodeCount: 9
  },
  {
    name: '5A Nebula',
    label: '5A',
    color: 0x728bff,
    accent: 0xd8e2ff,
    anchor: [-0.5, 0.53, -0.28],
    depthRole: 'rear',
    visualScale: [1.48, 0.68, 1.18],
    visualRotation: 0.34,
    size: 0.4,
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
    hoverX: -0.15,
    hoverY: 0.32,
    brightness: 1.46,
    armCount: 2,
    coreStars: 128,
    visibleCoreCount: 68,
    coreCount: 5,
    mainArmCount: 142,
    auxiliaryArmCount: 58,
    dustCount: 76,
    nebulaCount: 64,
    nodeCount: 7
  },
  {
    name: 'Brand Mind Nebula',
    label: 'BRAND MIND',
    color: 0x9b83d5,
    accent: 0xdcecff,
    anchor: [-0.72, -0.36, -0.58],
    depthRole: 'deep',
    visualScale: [1.42, 0.82, 1.26],
    visualRotation: -0.16,
    size: 0.42,
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
    hoverX: -0.3,
    hoverY: -0.22,
    brightness: 1.34,
    armCount: 2,
    coreStars: 92,
    visibleCoreCount: 48,
    coreCount: 4,
    mainArmCount: 96,
    auxiliaryArmCount: 36,
    dustCount: 48,
    nebulaCount: 52,
    nodeCount: 4
  }
].map(Object.freeze));

export const BRAND_GROWTH_V4_HOME_COMPOSITION = Object.freeze([
  Object.freeze({
    name: 'GEO Nebula',
    position: Object.freeze([0.72, 0.16, 0.46]),
    hover: Object.freeze([0.82, 0.2]),
    labelScale: 0.42,
    scale: 1.22,
    opacity: 0.78,
    layers: Object.freeze({ cluster: 1.4, flow: 0.9, dust: 0.65, nodes: 1.45, visibleCore: 1.3, core: 1.25 }),
    identity: Object.freeze({
      mode: 'signal',
      coreConcentration: 0.62,
      railCount: 4,
      pointSizes: Object.freeze({ cluster: 0.018, dust: 0.007, flow: 0.048, nodes: 0.028, core: 0.026, highlights: 0.05 })
    })
  }),
  Object.freeze({
    name: '5A Nebula',
    position: Object.freeze([-0.28, 0.58, -0.36]),
    hover: Object.freeze([0.22, 0.51]),
    labelScale: 0.56,
    scale: 1.12,
    opacity: 0.64,
    layers: Object.freeze({ cluster: 0.58, flow: 1.65, dust: 1.25, nodes: 0.48, visibleCore: 0.12, core: 0.04 }),
    identity: Object.freeze({
      mode: 'flow',
      flowClusters: 4,
      pointSizes: Object.freeze({ cluster: 0.028, dust: 0.012, flow: 0.09, nodes: 0.04, core: 0.034, highlights: 0.062 })
    })
  }),
  Object.freeze({
    name: 'Brand Mind Nebula',
    position: Object.freeze([-1.03, -1.42, -0.72]),
    hover: Object.freeze([-0.04, -0.36]),
    labelScale: 0.66,
    scale: 1.48,
    opacity: 0.59,
    layers: Object.freeze({ cluster: 0.9, flow: 1.55, dust: 2.6, nodes: 0.22, visibleCore: 0.08, core: 0.025 }),
    identity: Object.freeze({
      mode: 'memory',
      haloSpread: 1.65,
      pointSizes: Object.freeze({ cluster: 0.023, dust: 0.022, flow: 0.18, nodes: 0.045, core: 0.04, highlights: 0.075 })
    })
  })
]);

export const BRAND_GROWTH_V4_MOBILE_COMPOSITION = Object.freeze({
  mobilePortrait: Object.freeze({
    groupPosition: Object.freeze([0.04, 0.08, 0.02]),
    groupScale: 1,
    nebulae: Object.freeze({
      'GEO Nebula': Object.freeze({ position: [0.08, 0.28, 0.46], scale: 0.72, labelScale: 0.46 }),
      '5A Nebula': Object.freeze({ position: [-0.64, 0.34, -0.36], scale: 0.7, labelScale: 0.55 }),
      'Brand Mind Nebula': Object.freeze({ position: [-0.48, -0.72, -0.72], scale: 0.72, labelScale: 0.5 })
    })
  }),
  mobileLandscape: Object.freeze({
    groupPosition: Object.freeze([-0.04, 0.24, 0.02]),
    groupScale: 1,
    nebulae: Object.freeze({
      'GEO Nebula': Object.freeze({ position: [0.85, -0.05, 0.46], scale: 0.84, labelScale: 0.52 }),
      '5A Nebula': Object.freeze({ position: [-0.26, 0.58, -0.36], scale: 0.82, labelScale: 0.56 }),
      'Brand Mind Nebula': Object.freeze({ position: [-0.46, -0.58, -0.72], scale: 0.82, labelScale: 0.6 })
    })
  })
});

const BUSINESS_NEBULA_POINT_COUNT = BRAND_GROWTH_NEBULAE.reduce((total, config) => (
  total
  + config.coreStars
  + config.visibleCoreCount
  + config.coreCount
  + config.mainArmCount
  + config.auxiliaryArmCount
  + config.dustCount
  + config.nebulaCount
  + config.nodeCount
), 0);

export function createGalaxyPlanets({ homeComposition = 'default' } = {}) {
  const group = new THREE.Group();
  const particleTexture = createNebulaParticleTexture();
  const businessInteraction = {
    labels: homeComposition === 'v4' && BUSINESS_INTERACTION_DEBUG.labels,
    hover: homeComposition === 'v4' && BUSINESS_INTERACTION_DEBUG.hover,
    forcedHoverTarget: homeComposition === 'v4' ? readBusinessHoverTarget() : null
  };
  const configs = homeComposition === 'v4'
    ? createV4HomeConfigs()
    : BRAND_GROWTH_NEBULAE;
  const nebulae = configs.map((config, index) => (
    createBusinessNebula(config, particleTexture, 9107 + index * 193, businessInteraction)
  ));
  const targetPosition = new THREE.Vector3();
  const entryState = {
    name: null,
    progress: 0
  };
  const intentState = {
    name: null,
    progress: 0
  };

  group.name = 'ActiveTheoryBusinessNebulae';
  group.position.set(0.64, 0.39, 0.02);
  group.rotation.set(-0.03, 0.02, 0);

  nebulae.forEach((nebula) => {
    group.add(nebula.group);
  });

  function update(delta, time, interaction) {
    group.rotation.y = Math.sin(time * 0.009) * 0.012;
    group.rotation.x = -0.03 + Math.sin(time * 0.007) * 0.008;

    nebulae.forEach((nebula, index) => {
      const isEntryTarget = nebula.name === entryState.name;

      nebula.update(
        delta,
        time,
        index,
        isEntryTarget ? entryState.progress : 0,
        entryState.progress,
        isEntryTarget,
        interaction,
        nebula.name === intentState.name ? intentState.progress : 0
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
    setResponsiveComposition(mode = 'desktop') {
      const mobilePreset = BRAND_GROWTH_V4_MOBILE_COMPOSITION[mode];
      group.position.fromArray(mobilePreset?.groupPosition ?? [0.64, 0.39, 0.02]);
      group.scale.setScalar(mobilePreset?.groupScale ?? 1);
      nebulae.forEach((nebula) => {
        nebula.setResponsiveComposition(mobilePreset?.nebulae?.[nebula.name] ?? null);
      });
    },
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
    setPlanetEntryIntent(name, progress) {
      intentState.name = name;
      intentState.progress = Math.min(Math.max(progress, 0), 1);
    },
    getPlanetInteractionTarget(interaction) {
      if (!businessInteraction.hover || !interaction) return null;

      let bestMatch = null;
      let bestStrength = 0.42;
      nebulae.forEach((nebula, index) => {
        const strength = calculateHoverStrength(configs[index], interaction);
        if (strength > bestStrength) {
          bestMatch = nebula.name;
          bestStrength = strength;
        }
      });
      return bestMatch;
    },
    setLabelsVisible(visible) {
      nebulae.forEach((nebula) => nebula.setLabelVisible(visible));
    },
    getCompositionStatus() {
      return Object.freeze({
        mode: homeComposition,
        groupPosition: group.position.toArray(),
        nebulae: Object.freeze(nebulae.map((nebula, index) => Object.freeze({
          name: nebula.name,
          position: nebula.getCompositionStatus().position,
          scale: nebula.getCompositionStatus().scale,
          opacity: configs[index].compositionOpacity ?? 1,
          layers: configs[index].compositionLayers ?? null,
          identity: configs[index].homeIdentity?.mode ?? null,
          label: configs[index].label,
          depth: nebula.getCompositionStatus().position[2]
        })))
      });
    },
    pointCount: BUSINESS_NEBULA_POINT_COUNT,
    update,
    dispose
  };
}

function createV4HomeConfigs() {
  const presetByName = new Map(
    BRAND_GROWTH_V4_HOME_COMPOSITION.map((preset) => [preset.name, preset])
  );

  return BRAND_GROWTH_NEBULAE.map((config) => {
    const preset = presetByName.get(config.name);
    return {
      ...config,
      anchor: preset.position,
      hoverX: preset.hover[0],
      hoverY: preset.hover[1],
      labelScale: preset.labelScale,
      visualScale: config.visualScale.map((value) => value * preset.scale),
      compositionScale: preset.scale,
      compositionOpacity: preset.opacity,
      compositionLayers: preset.layers,
      homeIdentity: preset.identity
    };
  });
}

function createBusinessNebula(config, particleTexture, seed, businessInteraction) {
  const orbitalGroup = new THREE.Group();
  const nebulaGroup = new THREE.Group();
  const visualGroup = new THREE.Group();
  const cluster = createNebulaCluster(config, particleTexture, seed);
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
  const anchorPosition = new THREE.Vector3(...config.anchor);
  const baseVisualScale = new THREE.Vector3(...config.visualScale);
  let driftAngle = config.driftPhase;
  let hoverAmount = 0;
  let labelVisible = false;

  orbitalGroup.name = `${config.name.replace(/\s+/g, '')}Orbit`;
  orbitalGroup.visible = isBusinessNebulaVisible(config.name);
  orbitalGroup.rotation.set(0, 0, 0);
  nebulaGroup.name = config.name.replace(/\s+/g, '');
  visualGroup.name = `${config.name.replace(/\s+/g, '')}VisualEnvelope`;
  visualGroup.scale.copy(baseVisualScale);
  visualGroup.rotation.z = config.visualRotation;
  visualGroup.add(
    nebula.points,
    dust.points,
    cluster.points,
    nodes.points,
    visibleCore.group,
    coreCluster.group
  );
  nebulaGroup.add(visualGroup);
  orbitalGroup.add(nebulaGroup, label.sprite);

  function update(
    delta,
    time,
    index,
    entryProgress,
    focusProgress,
    isEntryTarget,
    interaction,
    intentProgress
  ) {
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
    const hoverTarget = businessInteraction.forcedHoverTarget
      ? Number(config.name === businessInteraction.forcedHoverTarget)
      : businessInteraction.hover
        ? calculateHoverStrength(config, interaction)
        : 0;
    const hoverFollow = 1 - Math.exp(-8 * delta);
    hoverAmount += (hoverTarget - hoverAmount) * hoverFollow;
    const intentPulse = Math.sin(Math.min(Math.max(intentProgress, 0), 1) * Math.PI);
    const hoverProfile = getBusinessHoverProfile(config, hoverAmount, time);
    const intentBoost = 1 + intentPulse * 0.16;
    const entryBoost = isEntryTarget ? 1 + entryFocus * 0.72 : 1;
    const transitionBoost = intentBoost * entryBoost;
    const homeBlend = 1 - smoothstep(0.02, 0.18, focusProgress);
    const compositionOpacity = lerp(1, config.compositionOpacity ?? 1, homeBlend);
    const layerWeight = (name) => compositionOpacity * lerp(
      1,
      config.compositionLayers?.[name] ?? 1,
      homeBlend
    );

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
    nebulaGroup.rotation.z += delta * config.spin * 0.28 * (
      1 + (hoverProfile.motion - 1) * 0.32 + intentPulse * 0.16
    );
    nebulaGroup.rotation.x = 0;
    nebulaGroup.rotation.y = 0;
    label.sprite.position.set(
      nebulaGroup.position.x + config.labelOffset[0],
      nebulaGroup.position.y + config.labelOffset[1],
      nebulaGroup.position.z + config.labelOffset[2]
    );
    visualGroup.scale.copy(baseVisualScale).multiplyScalar(1 - intentPulse * 0.025);
    cluster.update(
      delta,
      time,
      pulse,
      visibility * layerWeight('cluster'),
      entryFocus,
      transitionBoost * hoverProfile.cluster,
      homeBlend,
      hoverProfile.motion
    );
    nebula.update(
      delta,
      time,
      pulse,
      visibility * layerWeight('flow'),
      transitionBoost * hoverProfile.flow,
      homeBlend,
      hoverProfile.motion
    );
    dust.update(
      delta,
      time,
      pulse,
      visibility * layerWeight('dust'),
      transitionBoost * hoverProfile.dust,
      homeBlend,
      hoverProfile.motion
    );
    nodes.update(
      delta,
      time,
      pulse,
      visibility * layerWeight('nodes'),
      entryFocus,
      transitionBoost * hoverProfile.nodes,
      homeBlend,
      hoverProfile.motion
    );
    visibleCore.update(
      time,
      pulse,
      visibility * layerWeight('visibleCore'),
      transitionBoost * hoverProfile.core,
      homeBlend
    );
    coreCluster.update(
      delta,
      time,
      pulse,
      visibility * layerWeight('core'),
      entryFocus,
      transitionBoost * hoverProfile.core
    );
    label.update(delta, labelVisibility, hoverAmount, intentPulse, labelVisible);
  }

  function dispose() {
    cluster.dispose();
    nebula.dispose();
    dust.dispose();
    nodes.dispose();
    visibleCore.dispose();
    coreCluster.dispose();
    label.dispose();
    orbitalGroup.clear();
  }

  return {
    name: config.name,
    group: orbitalGroup,
    nebulaGroup,
    setLabelVisible(visible) {
      labelVisible = Boolean(visible && businessInteraction.labels);
      label.sprite.visible = labelVisible;
    },
    setResponsiveComposition(preset) {
      anchorPosition.fromArray(preset?.position ?? config.anchor);
      baseVisualScale.fromArray(config.visualScale).multiplyScalar(preset?.scale ?? 1);
      label.setScale(preset?.labelScale ?? config.labelScale ?? 0.4);
    },
    getCompositionStatus() {
      return {
        position: anchorPosition.toArray(),
        scale: baseVisualScale.x / config.visualScale[0]
      };
    },
    update,
    dispose
  };
}

function isBusinessNebulaVisible(name) {
  if (name === 'GEO Nebula') return UNIVERSE_RENDER_DEBUG.geoNebula;
  if (name === '5A Nebula') return UNIVERSE_RENDER_DEBUG.fiveANebula;
  if (name === 'Brand Mind Nebula') return UNIVERSE_RENDER_DEBUG.brandMindNebula;
  return true;
}

function createNebulaCluster(config, texture, seed) {
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

  const identityPositions = createHomeIdentityPositions(config, 'cluster', count, seed + 401);
  geometry.setAttribute('position', new THREE.BufferAttribute(identityPositions?.slice() ?? positions, 3));
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

  function update(delta, time, pulse, visibility, entryProgress, hoverBoost, homeBlend, motionBoost = 1) {
    applyHomeIdentityPositions(geometry, positions, identityPositions, homeBlend);
    points.rotation.z += delta * config.spin * 0.38 * motionBoost;
    points.rotation.y = Math.sin(time * 0.08 + config.phase) * 0.08;
    material.opacity = (0.64 + pulse * 0.1 + entryProgress * 0.08) * visibility * hoverBoost * config.brightness;
    const legacySize = 0.026 + pulse * 0.002 + entryProgress * 0.005;
    const identitySize = (config.homeIdentity?.pointSizes.cluster ?? legacySize) * (1 + pulse * 0.04);
    material.size = lerp(legacySize, identitySize, homeBlend) * (0.98 + (hoverBoost - 1) * 0.25);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
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

  const identityPositions = createHomeIdentityPositions(config, 'dust', count, seed + 409);
  geometry.setAttribute('position', new THREE.BufferAttribute(identityPositions?.slice() ?? positions, 3));
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

  function update(delta, time, pulse, visibility, hoverBoost, homeBlend, motionBoost = 1) {
    applyHomeIdentityPositions(geometry, positions, identityPositions, homeBlend);
    points.rotation.z -= delta * config.spin * 0.12 * motionBoost;
    material.opacity = (0.3 + pulse * 0.12) * visibility * (0.96 + (hoverBoost - 1) * 0.5) * config.brightness;
    material.size = lerp(0.011, config.homeIdentity?.pointSizes.dust ?? 0.011, homeBlend);
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

  const identityPositions = createHomeIdentityPositions(config, 'flow', count, seed + 419);
  geometry.setAttribute('position', new THREE.BufferAttribute(identityPositions?.slice() ?? positions, 3));
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
  function update(delta, time, pulse, visibility, hoverBoost, homeBlend, motionBoost = 1) {
    applyHomeIdentityPositions(geometry, positions, identityPositions, homeBlend);
    points.rotation.z += delta * config.spin * 0.18 * motionBoost;
    material.opacity = (0.16 + pulse * 0.045) * visibility * hoverBoost;
    const legacySize = 0.072 + Math.sin(time * 0.18 + config.phase) * 0.003;
    const identitySize = (config.homeIdentity?.pointSizes.flow ?? legacySize)
      + Math.sin(time * 0.18 + config.phase) * 0.002;
    material.size = lerp(legacySize, identitySize, homeBlend);
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

  const identityPositions = createHomeIdentityPositions(config, 'nodes', count, seed + 431);
  geometry.setAttribute('position', new THREE.BufferAttribute(identityPositions?.slice() ?? positions, 3));
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

  function update(delta, time, pulse, visibility, entryProgress, hoverBoost, homeBlend, motionBoost = 1) {
    applyHomeIdentityPositions(geometry, positions, identityPositions, homeBlend);
    points.rotation.z += delta * config.spin * 0.54 * motionBoost;
    material.opacity = (0.52 + pulse * 0.3 + entryProgress * 0.12) * visibility * hoverBoost * config.brightness;
    const legacySize = 0.04 + pulse * 0.01 + entryProgress * 0.012;
    const identitySize = (config.homeIdentity?.pointSizes.nodes ?? legacySize) * (1 + pulse * 0.1);
    material.size = lerp(legacySize, identitySize, homeBlend) * (0.98 + (hoverBoost - 1) * 0.4);
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

  const identityStarPositions = createHomeIdentityPositions(
    config,
    'core',
    config.visibleCoreCount,
    seed + 443
  );
  starGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(identityStarPositions?.slice() ?? starPositions, 3)
  );
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

  const identityHighlightPositions = createHomeIdentityPositions(config, 'highlights', 3, seed + 449);
  highlightGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(identityHighlightPositions?.slice() ?? highlightPositions, 3)
  );
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
  function update(time, pulse, visibility, hoverBoost, homeBlend) {
    applyHomeIdentityPositions(starGeometry, starPositions, identityStarPositions, homeBlend);
    applyHomeIdentityPositions(
      highlightGeometry,
      highlightPositions,
      identityHighlightPositions,
      homeBlend
    );
    const scale = 0.985 + Math.sin(time * 0.22 + config.phase) * 0.015;

    group.scale.setScalar(scale);
    starMaterial.opacity = (0.78 + pulse * 0.12) * visibility * hoverBoost;
    highlightMaterial.opacity = (0.7 + pulse * 0.16) * visibility * hoverBoost;
    starMaterial.size = lerp(0.034, config.homeIdentity?.pointSizes.core ?? 0.034, homeBlend);
    highlightMaterial.size = lerp(
      0.064,
      config.homeIdentity?.pointSizes.highlights ?? 0.064,
      homeBlend
    );
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
  const markerTexture = createLabelMarkerTexture(config.accent);
  let width = config.labelScale ?? 0.4;
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    fog: false
  });
  const markerMaterial = new THREE.SpriteMaterial({
    map: markerTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    fog: false
  });
  const textSprite = new THREE.Sprite(material);
  const marker = new THREE.Sprite(markerMaterial);
  const sprite = new THREE.Group();
  let opacity = 0;
  let markerOpacity = 0;

  sprite.name = `${config.name.replace(/\s+/g, '')}Label`;
  applyScale(width);
  textSprite.raycast = () => {};
  marker.raycast = () => {};
  sprite.add(textSprite, marker);

  function update(delta, visibility, hover, intentPulse, visible) {
    const targetOpacity = visible
      ? (0.48 + hover * 0.52) * visibility
      : 0;
    const targetMarkerOpacity = visible
      ? Math.max(hover, intentPulse * 0.9) * visibility
      : 0;
    const follow = 1 - Math.exp(-8 * delta);
    opacity += (targetOpacity - opacity) * follow;
    markerOpacity += (targetMarkerOpacity - markerOpacity) * follow;
    material.opacity = opacity;
    material.color.setScalar(0.82 + hover * 0.18);
    markerMaterial.opacity = markerOpacity;
    marker.visible = markerOpacity > 0.01;
  }

  function applyScale(nextWidth) {
    width = nextWidth;
    textSprite.scale.set(width, width * 0.25, 1);
    marker.scale.set(width * 0.48, width * 0.12, 1);
    marker.position.set(0, -width * 0.15, 0.001);
  }

  function dispose() {
    texture.dispose();
    markerTexture.dispose();
    material.dispose();
    markerMaterial.dispose();
    sprite.clear();
  }

  return { sprite, update, setScale: applyScale, dispose };
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
  context.font = '500 38px Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.letterSpacing = '5px';
  context.shadowColor = `rgba(${Math.round(labelColor.r * 255)}, ${Math.round(labelColor.g * 255)}, ${Math.round(labelColor.b * 255)}, 0.22)`;
  context.shadowBlur = 4;
  context.fillStyle = `rgba(${Math.round(labelColor.r * 220 + 35)}, ${Math.round(labelColor.g * 220 + 35)}, ${Math.round(labelColor.b * 220 + 35)}, 0.82)`;
  context.fillText(text, width * 0.5, height * 0.5);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function createLabelMarkerTexture(color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const markerColor = new THREE.Color(color);
  const red = Math.round(markerColor.r * 255);
  const green = Math.round(markerColor.g * 255);
  const blue = Math.round(markerColor.b * 255);

  canvas.width = 128;
  canvas.height = 32;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.96)`;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(18, 16);
  context.lineTo(88, 16);
  context.stroke();
  context.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.95)`;
  context.beginPath();
  context.arc(101, 16, 4, 0, TAU);
  context.fill();

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

function getBusinessHoverProfile(config, hover, time) {
  const mode = config.homeIdentity?.mode;

  if (mode === 'signal') {
    const nodePulse = 0.5 + Math.sin(time * 3.2 + config.phase) * 0.5;
    return {
      cluster: 1 + hover * 0.3,
      flow: 1 + hover * 0.48,
      dust: 1 + hover * 0.22,
      nodes: 1 + hover * (0.55 + nodePulse * 0.12),
      core: 1 + hover * 0.3,
      motion: 1 + hover * 0.28
    };
  }

  if (mode === 'flow') {
    return {
      cluster: 1 + hover * 0.18,
      flow: 1 + hover * 0.78,
      dust: 1 + hover * 0.4,
      nodes: 1 + hover * 0.24,
      core: 1 + hover * 0.1,
      motion: 1 + hover * 0.4
    };
  }

  const breathing = 0.5 + Math.sin(time * 0.72 + config.phase) * 0.5;
  return {
    cluster: 1 + hover * 0.16,
    flow: 1 + hover * (0.58 + breathing * 0.1),
    dust: 1 + hover * (0.68 + breathing * 0.12),
    nodes: 1 + hover * (0.5 + breathing * 0.08),
    core: 1 + hover * 0.5,
    motion: 1 + hover * 0.1
  };
}

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * (3 - 2 * x);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function readLocationSearch() {
  return typeof window === 'undefined' ? '' : window.location.search;
}

function createHomeIdentityPositions(config, layer, count, seed) {
  const identity = config.homeIdentity;
  if (!identity) return null;

  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const size = config.size;

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const gaussianX = clampGaussian(gaussianRandom(random));
    const gaussianY = clampGaussian(gaussianRandom(random));
    const gaussianZ = clampGaussian(gaussianRandom(random));
    let x;
    let y;
    let z;

    if (identity.mode === 'signal') {
      const coreLayer = layer === 'core' || layer === 'highlights';
      const concentration = layer === 'cluster'
        ? identity.coreConcentration
        : layer === 'nodes'
          ? 0.35
          : 0.12;
      const concentrated = coreLayer || index / Math.max(count, 1) < concentration;
      if (concentrated) {
        const spread = coreLayer ? 0.11 : 0.2;
        x = gaussianX * size * spread;
        y = gaussianY * size * spread * 0.48;
        z = gaussianZ * size * spread * 0.28;
      } else {
        const railIndex = index % identity.railCount;
        const railAngle = -2.65 + railIndex * (3.2 / Math.max(identity.railCount - 1, 1));
        const railProgress = 0.18 + random() * 0.82;
        const railLength = size * (layer === 'dust' ? 0.62 : 0.52) * railProgress;
        x = Math.cos(railAngle) * railLength - Math.sin(railAngle) * gaussianY * size * 0.012;
        y = Math.sin(railAngle) * railLength + Math.cos(railAngle) * gaussianY * size * 0.012;
        z = gaussianZ * size * 0.035;
      }
    } else if (identity.mode === 'flow') {
      const clusterCount = identity.flowClusters;
      const clusterIndex = index % clusterCount;
      const bridgeParticle = layer === 'flow' && index % 3 === 0;
      const progress = bridgeParticle
        ? random()
        : clusterIndex / Math.max(clusterCount - 1, 1);
      const scatter = layer === 'dust' ? 0.1 : layer === 'flow' ? 0.075 : 0.052;
      x = (progress - 0.5) * size * 1.5 + gaussianX * size * scatter;
      y = Math.sin((progress * 0.9 + 0.05) * Math.PI) * size * 0.38
        - size * 0.1
        + gaussianY * size * scatter * 0.72;
      z = gaussianZ * size * scatter * 0.75;
    } else {
      const layerSpread = layer === 'flow'
        ? 1.2
        : layer === 'dust'
          ? 1
          : layer === 'core' || layer === 'highlights'
            ? 0.46
            : 0.78;
      const angle = random() * TAU;
      const irregularity = 0.78 + Math.sin(angle * 3 + 0.9) * 0.14 + random() * 0.12;
      const radius = Math.pow(random(), 0.58)
        * size
        * identity.haloSpread
        * layerSpread
        * irregularity;
      x = Math.cos(angle) * radius + gaussianX * size * 0.04;
      y = Math.sin(angle) * radius * 0.7 + gaussianY * size * 0.035;
      z = gaussianZ * size * 0.17 * layerSpread;
    }

    positions[stride] = x;
    positions[stride + 1] = y;
    positions[stride + 2] = z;
  }

  return positions;
}

function applyHomeIdentityPositions(geometry, legacyPositions, identityPositions, homeBlend) {
  if (!identityPositions) return;

  const blend = Math.min(Math.max(homeBlend, 0), 1);
  if (geometry.userData.homeIdentityBlend === blend) return;

  const attribute = geometry.getAttribute('position');
  for (let index = 0; index < attribute.array.length; index += 1) {
    attribute.array[index] = lerp(legacyPositions[index], identityPositions[index], blend);
  }
  attribute.needsUpdate = true;
  geometry.userData.homeIdentityBlend = blend;
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
