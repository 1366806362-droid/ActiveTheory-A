import * as THREE from 'three';
import { getCamera } from '../engine/camera.js';
import { createGalaxyCoreCluster } from './galaxyCoreCluster.js';
import { createCinematicGalaxyShell } from './cinematicGalaxyShell.js';
import { createGalaxyBaseLayer } from './galaxyBaseLayer.js';
import { createGalaxyTextureLayer } from './galaxyTextureLayer.js';
import { createHeroTextureLoader } from './heroTextureLoader.js';

const TAU = Math.PI * 2;
const INNER_RADIUS = 0.07;
const OUTER_RADIUS = 0.78;
const TURNS = 0.88;
const RADIUS_EXPONENT = 1.12;
const GALAXY_ALIGNMENT_DEBUG = prepareGalaxyAlignmentDebug();
const DEFAULT_LAYER_VISIBILITY = Object.freeze({
  core: true,
  mainArms: true,
  nebula: true,
  dust: true,
  highlights: true
});

export function createCinematicGalaxy({
  debugVisibility = DEFAULT_LAYER_VISIBILITY,
  shellDebugMode = null,
  useGalaxyShell = true,
  galaxyVersion = 'v1',
  galaxyVersionConfig = null,
  diagnosticsEnabled = false
} = {}) {
  const galaxyLayerDebugMode = readGalaxyLayerDebugMode();
  const galaxyHybridDebug = readGalaxyHybridDebugState();
  const galaxyAlignmentDebug = GALAXY_ALIGNMENT_DEBUG;
  const galaxyV2Config = galaxyVersion === 'v2' ? galaxyVersionConfig : null;

  if (galaxyV2Config && diagnosticsEnabled) {
    publishVersionDiagnostics({
      version: galaxyVersion,
      textureLoadStatus: 'initializing'
    });
  }
  const group = new THREE.Group();
  const visual = new THREE.Group();
  const baseLayerGroup = new THREE.Group();
  const textureLayerGroup = new THREE.Group();
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
    radiusExponent: RADIUS_EXPONENT,
    globalArmPhase: 0
  });
  const baseLayer = createGalaxyBaseLayer({
    innerRadius: INNER_RADIUS,
    outerRadius: OUTER_RADIUS,
    turns: TURNS,
    radiusExponent: RADIUS_EXPONENT,
    globalArmPhase: 0
  });
  const galaxyTextureLayer = createGalaxyTextureLayer(galaxyV2Config
    ? galaxyV2Config.textureLayer
    : {
      outerRadius: OUTER_RADIUS,
      extentScale: 2.7
    });
  const alignmentDebugGroup = createGalaxyAlignmentDebug(galaxyTextureLayer);
  const heroTextureLoader = createHeroTextureLoader({
    anisotropy: 6,
    urls: galaxyV2Config?.urls
  });
  const hybridDebugOverlay = galaxyHybridDebug.enabled || galaxyAlignmentDebug.enabled
    ? createGalaxyHybridDebugOverlay(
      galaxyAlignmentDebug.enabled ? 'alignmentDebug' : galaxyHybridDebug.mode
    )
    : null;
  let textureLoadStatus = 'idle';
  let textureLayerWeight = 0;
  let disposed = false;
  let unsubscribeTextureLoader = null;
  const arms = createSpiralArms(texture);
  const armNebula = createArmNebula(texture);
  const dustLanes = createDustLanes(texture);
  const outskirts = createOutskirts(texture);
  const armHighlights = createArmHighlights(texture);
  const core = createGalaxyCoreCluster({
    name: 'CinematicGalaxyCoreCluster',
    starCount: 742,
    highlightCount: 7,
    radius: 0.278,
    depthRange: 0.205,
    coreColor: 0xffe3bd,
    secondaryColors: [0xd8efff, 0x82ccf6, 0xa99ade, 0xffd3a1],
    bloomIntensity: 0.62,
    pulseSpeed: 0.24,
    starOpacity: 0.68,
    highlightOpacity: 0.53,
    hazeOpacity: 0.075,
    seed: 88217
  });
  const coreGlow = createWarmCoreGlow();
  const innerStarDisk = createInnerStarDisk(texture);
  const coreMicroStars = core.group.getObjectByName('GalaxyCoreMicroStars');
  const coreHighlightStars = core.group.getObjectByName('GalaxyCoreHighlightStars');

  if (coreMicroStars?.material) {
    coreMicroStars.material.size *= 1.15;
    coreMicroStars.material.blending = THREE.AdditiveBlending;
    coreMicroStars.material.needsUpdate = true;
  }
  if (coreHighlightStars?.geometry?.attributes?.position) {
    const positions = coreHighlightStars.geometry.attributes.position;
    const colors = coreHighlightStars.geometry.attributes.color;
    const sizes = coreHighlightStars.geometry.attributes.aSize;
    const layout = [
      [0, 0, 0.012],
      [-0.029, 0.036, -0.006],
      [0.034, -0.039, 0.009],
      [-0.043, -0.013, 0.018],
      [0.022, 0.049, -0.014],
      [-0.044, 0.018, -0.022],
      [0.011, -0.052, 0.006]
    ];
    const highlightColors = [
      new THREE.Color(0xffd8a8),
      new THREE.Color(0xdcefff),
      new THREE.Color(0xb9e5ff),
      new THREE.Color(0x8fd2fb),
      new THREE.Color(0xc8dcff),
      new THREE.Color(0x91c9ee),
      new THREE.Color(0xffe1bd)
    ];
    highlightColors.forEach((color, index) => {
      color.multiplyScalar(index === 0 ? 0.82 : index < 3 ? 0.207 : 0.144);
    });
    const highlightSizes = [0.18, 0.038, 0.034, 0.031, 0.029, 0.027, 0.026];

    layout.forEach((position, index) => {
      positions.setXYZ(index, position[0], position[1], position[2]);
      colors?.setXYZ(
        index,
        highlightColors[index].r,
        highlightColors[index].g,
        highlightColors[index].b
      );
      sizes?.setX(index, highlightSizes[index]);
    });
    positions.needsUpdate = true;
    if (colors) colors.needsUpdate = true;
    if (sizes) sizes.needsUpdate = true;
    coreHighlightStars.geometry.computeBoundingSphere();
  }
  const baseQuaternion = galaxyV2Config
    ? new THREE.Quaternion()
    : new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(24),
      THREE.MathUtils.degToRad(-6),
      THREE.MathUtils.degToRad(-10),
      'XYZ'
    ));
  const spinQuaternion = new THREE.Quaternion();
  const localNormal = new THREE.Vector3(0, 0, 1);
  let spinAngle = galaxyV2Config || galaxyAlignmentDebug.enabled ? 0 : -0.2;

  group.name = 'ActiveTheoryCinematicGalaxy';
  visual.name = 'CinematicGalaxyVisual';
  baseLayerGroup.name = 'CinematicGalaxyBaseLayerGroup';
  textureLayerGroup.name = 'CinematicGalaxyTextureLayerGroup';
  shellLayer.name = 'CinematicGalaxyShellLayer';
  armsLayer.name = 'CinematicGalaxyArmsLayer';
  nebulaLayer.name = 'CinematicGalaxyNebulaLayer';
  dustLayer.name = 'CinematicGalaxyDustLayer';
  nodesLayer.name = 'CinematicGalaxyNodesLayer';
  coreLayer.name = 'CinematicGalaxyCoreLayer';
  if (galaxyV2Config) {
    group.position.fromArray(galaxyV2Config.composition.galaxyRootPosition);
    visual.position.fromArray(galaxyV2Config.composition.visualPosition);
    visual.scale.setScalar(galaxyV2Config.composition.visualScale);
  } else {
    group.position.set(0.46, -0.04, 0);
    visual.position.set(0, 0.34, 0);
    visual.scale.set(0.9, 0.84, 0.9);
  }
  baseLayerGroup.add(baseLayer.mesh);
  textureLayerGroup.add(galaxyTextureLayer.mesh);
  shellLayer.add(shell.group);
  armsLayer.add(arms.points);
  nebulaLayer.add(armNebula.points);
  dustLayer.add(outskirts.points, dustLanes.points);
  nodesLayer.add(armHighlights.points);
  coreLayer.add(coreGlow.sprite, innerStarDisk.points, core.group);
  coreLayer.scale.set(1.12, 0.78, 0.28);
  visual.add(
    baseLayerGroup,
    textureLayerGroup,
    shellLayer,
    dustLayer,
    nebulaLayer,
    armsLayer,
    nodesLayer,
    coreLayer,
    alignmentDebugGroup
  );
  group.add(visual);
  applyDebugVisibility();
  applyShellDebugMode(shellDebugMode);
  applyGalaxyHybridMode();
  applyOrientation();
  unsubscribeTextureLoader = heroTextureLoader.subscribe(({ status, textures }) => {
    if (disposed) return;
    textureLoadStatus = status;
    galaxyTextureLayer.setTextures(status === 'ready' ? textures : null);
    applyGalaxyHybridMode();
    updateHybridDebugOverlay();
  });
  void heroTextureLoader.loadGalaxyTextures();

  function update(delta, time, interaction, journeyProgress = 0) {
    const alignmentTime = galaxyAlignmentDebug.enabled ? 0 : time;
    const proximity = galaxyAlignmentDebug.enabled
      ? 0
      : (interaction?.proximity ?? 0);
    const pulse = 0.5 + Math.sin(alignmentTime * 0.34) * 0.5;
    const breathing = galaxyAlignmentDebug.enabled
      ? 0
      : Math.sin(alignmentTime * 0.16 + 0.6);

    if (galaxyV2Config) {
      group.position.fromArray(galaxyV2Config.composition.galaxyRootPosition);
      group.scale.setScalar(
        galaxyV2Config.composition.galaxyRootScale + breathing * 0.006
      );
    } else {
      group.position.set(0.46, -0.04, 0);
      group.scale.setScalar(1.5 + breathing * 0.006);
    }
    group.rotation.set(0, 0, 0);
    if (galaxyV2Config || galaxyAlignmentDebug.enabled) {
      spinAngle = 0;
    } else {
      spinAngle -= delta * 0.012;
    }
    applyOrientation();
    shell.update(delta, time, journeyProgress);
    baseLayer.update(time, pulse, journeyProgress);
    const textureFade = smootherstep(0.22, 0.72, journeyProgress);
    const textureJourneyOpacity = 1 - textureFade * 0.84;

    galaxyTextureLayer.setOpacity(textureLayerWeight * textureJourneyOpacity);
    galaxyTextureLayer.update(alignmentTime);
    arms.update(alignmentTime, pulse, proximity);
    armNebula.update(alignmentTime, pulse);
    dustLanes.update(alignmentTime, pulse);
    outskirts.update(alignmentTime, pulse);
    armHighlights.update(alignmentTime, pulse);
    innerStarDisk.update(alignmentTime, pulse);
    coreGlow.update(pulse);
    core.update(galaxyAlignmentDebug.enabled ? 0 : delta, alignmentTime, pulse, 1, proximity, 1);
    applyGalaxyV2LayerWeights();
    if (galaxyV2Config && diagnosticsEnabled) {
      publishVersionDiagnostics(measureVersionAlignment(getCamera()));
    }
    updateAlignmentDebugOverlay();
  }

  function applyOrientation() {
    spinQuaternion.setFromAxisAngle(localNormal, spinAngle);
    visual.quaternion.copy(baseQuaternion).multiply(spinQuaternion);
  }

  function applyDebugVisibility(visibility = DEFAULT_LAYER_VISIBILITY) {
    baseLayerGroup.visible = visibility.mainArms || visibility.nebula;
    armsLayer.visible = visibility.mainArms;
    nebulaLayer.visible = visibility.nebula;
    dustLayer.visible = visibility.dust;
    nodesLayer.visible = visibility.highlights;
    coreLayer.visible = visibility.core;
  }

  function applyShellDebugMode(mode = null) {
    if (galaxyHybridDebug.enabled || galaxyAlignmentDebug.enabled) {
      applyGalaxyHybridMode();
      return;
    }
    if (galaxyLayerDebugMode) {
      applyGalaxyLayerMode(galaxyLayerDebugMode);
      return;
    }

    const normalizedMode = mode === 'shell' ? 'shellOnly'
      : mode === 'particles' ? 'particlesOnly'
        : mode;
    const shellEnabled = useGalaxyShell && normalizedMode !== 'particlesOnly';
    const particlesEnabled = normalizedMode !== 'shellOnly';

    baseLayerGroup.visible = shellEnabled;
    shellLayer.visible = shellEnabled;
    shell.setLayerMode('combined');
    armsLayer.visible = particlesEnabled && debugVisibility.mainArms;
    nebulaLayer.visible = particlesEnabled && debugVisibility.nebula;
    dustLayer.visible = particlesEnabled && debugVisibility.dust;
    nodesLayer.visible = particlesEnabled && debugVisibility.highlights;
    coreLayer.visible = particlesEnabled && debugVisibility.core;
  }

  function applyGalaxyHybridMode() {
    const textureReady = galaxyTextureLayer.isReady();
    const legacyDebugActive = Boolean(galaxyLayerDebugMode || shellDebugMode);

    if (galaxyV2Config) {
      const weights = galaxyV2Config.layerWeights;

      textureLayerWeight = textureReady ? weights.texture : 0;
      textureLayerGroup.visible = textureReady;
      baseLayerGroup.visible = false;
      shellLayer.visible = useGalaxyShell;
      shell.setLayerMode('combined');
      shell.setHybridWeight(weights.shell, 0);
      armsLayer.visible = debugVisibility.mainArms;
      nebulaLayer.visible = debugVisibility.nebula;
      dustLayer.visible = debugVisibility.dust;
      nodesLayer.visible = debugVisibility.highlights;
      coreLayer.visible = debugVisibility.core;
      alignmentDebugGroup.visible = false;
      return;
    }

    const mode = galaxyAlignmentDebug.enabled
      ? 'alignmentDebug'
      : galaxyHybridDebug.enabled
        ? galaxyHybridDebug.mode
        : 'combined';

    if (legacyDebugActive && !galaxyHybridDebug.enabled) {
      textureLayerWeight = 0;
      textureLayerGroup.visible = false;
      shell.setHybridWeight(1, 0);
      baseLayer.setHybridWeight(1);
      return;
    }

    const proceduralOnly = mode === 'proceduralOnly';
    const textureOnly = mode === 'textureOnly';
    const particlesOnly = mode === 'particlesOnly';
    const combined = mode === 'combined' || mode === 'alignmentDebug';
    const hybridReady = textureReady && (textureOnly || combined);
    const proceduralFallback = !textureReady && combined;
    const showProcedural = proceduralOnly || proceduralFallback || combined;
    const showParticles = proceduralOnly || particlesOnly || combined;

    textureLayerWeight = hybridReady ? (combined ? 0.74 : 1) : 0;
    textureLayerGroup.visible = hybridReady;
    baseLayerGroup.visible = showProcedural && useGalaxyShell;
    shellLayer.visible = showProcedural && useGalaxyShell;
    shell.setLayerMode('combined');
    shell.setHybridWeight(
      hybridReady && combined ? 0.25 : showProcedural ? 1 : 0,
      hybridReady && combined ? 0.76 : 0
    );
    baseLayer.setHybridWeight(hybridReady && combined ? 0.06 : showProcedural ? 1 : 0);
    armsLayer.visible = showParticles && debugVisibility.mainArms;
    nebulaLayer.visible = showParticles && debugVisibility.nebula;
    dustLayer.visible = showParticles && debugVisibility.dust;
    nodesLayer.visible = showParticles && debugVisibility.highlights;
    coreLayer.visible = showParticles && debugVisibility.core;
    alignmentDebugGroup.visible = mode === 'alignmentDebug';

    if (mode === 'alignmentDebug') {
      baseLayerGroup.visible = false;
      shellLayer.visible = false;
      nebulaLayer.visible = false;
      dustLayer.visible = false;
      nodesLayer.visible = false;
      armsLayer.visible = debugVisibility.mainArms;
      coreLayer.visible = debugVisibility.core;
    }

    if (textureOnly) {
      baseLayerGroup.visible = false;
      shellLayer.visible = false;
      armsLayer.visible = false;
      nebulaLayer.visible = false;
      dustLayer.visible = false;
      nodesLayer.visible = false;
      coreLayer.visible = false;
    }
    if (particlesOnly) {
      baseLayerGroup.visible = false;
      shellLayer.visible = false;
      textureLayerGroup.visible = false;
      textureLayerWeight = 0;
    }
  }

  function updateHybridDebugOverlay() {
    hybridDebugOverlay?.update({
      mode: galaxyAlignmentDebug.enabled ? 'alignmentDebug' : galaxyHybridDebug.mode,
      status: textureLoadStatus,
      fallback: textureLoadStatus !== 'ready'
    });
  }

  function updateAlignmentDebugOverlay() {
    if (!galaxyAlignmentDebug.enabled) return;
    const camera = getCamera();

    if (!camera) return;
    hybridDebugOverlay?.update({
      alignment: alignmentDebugGroup.userData.measureScreen(camera)
    });
  }

  function applyGalaxyLayerMode(mode = 'combined') {
    const particlesOnly = mode === 'particlesOnly';
    const cloudsOnly = mode === 'cloudsOnly';
    const dustOnly = mode === 'dustOnly';
    const combined = mode === 'combined';
    const particlesVisible = particlesOnly || combined;

    baseLayerGroup.visible = useGalaxyShell && (cloudsOnly || combined);
    shellLayer.visible = useGalaxyShell && !particlesOnly;
    shell.setLayerMode(mode);
    armsLayer.visible = particlesVisible && debugVisibility.mainArms;
    nebulaLayer.visible = combined && debugVisibility.nebula;
    dustLayer.visible = combined && debugVisibility.dust;
    nodesLayer.visible = particlesVisible && debugVisibility.highlights;
    coreLayer.visible = particlesVisible && debugVisibility.core;

    if (cloudsOnly || dustOnly) {
      armsLayer.visible = false;
      nebulaLayer.visible = false;
      dustLayer.visible = false;
      nodesLayer.visible = false;
      coreLayer.visible = false;
    }
  }

  function applyGalaxyV2LayerWeights() {
    if (!galaxyV2Config) return;

    const weights = galaxyV2Config.layerWeights;

    scaleObjectOpacity(arms.points, weights.arms);
    scaleObjectOpacity(armNebula.points, weights.nebula);
    scaleObjectOpacity(dustLanes.points, weights.dust);
    scaleObjectOpacity(outskirts.points, weights.dust);
    scaleObjectOpacity(armHighlights.points, weights.highlights);
    scaleObjectOpacity(innerStarDisk.points, weights.innerStarDisk);
    scaleObjectOpacity(core.group, weights.coreParticles);
    scaleObjectOpacity(coreGlow.sprite, weights.warmCoreGlow);
  }

  function measureVersionAlignment(camera) {
    if (!galaxyV2Config || !camera) return null;

    group.updateWorldMatrix(true, true);
    camera.updateWorldMatrix(true, false);
    const textureCore = galaxyTextureLayer.sourceUvToLocalPoint(
      galaxyTextureLayer.alignment.coreUv
    );
    const particleCore = new THREE.Vector3();

    textureLayerGroup.localToWorld(textureCore);
    coreLayer.localToWorld(particleCore);
    const textureScreen = projectToScreen(textureCore, camera);
    const particleScreen = projectToScreen(particleCore, camera);

    return {
      version: galaxyVersion,
      textureLoadStatus,
      textureCore: textureScreen,
      particleCore: particleScreen,
      coreAlignmentErrorPixels: Math.hypot(
        textureScreen.x - particleScreen.x,
        textureScreen.y - particleScreen.y
      ),
      configuration: {
        mainFramePosition: [...galaxyV2Config.composition.mainFramePosition],
        mainFrameScale: galaxyV2Config.composition.mainFrameScale,
        mainFrameRotationDegrees: [
          ...galaxyV2Config.composition.mainFrameRotationDegrees
        ],
        visualPosition: [...galaxyV2Config.composition.visualPosition],
        visualScale: galaxyV2Config.composition.visualScale,
        textureLocalScale: galaxyV2Config.textureLayer.localScale,
        textureOpacity: galaxyV2Config.layerWeights.texture
      }
    };
  }

  function dispose() {
    disposed = true;
    unsubscribeTextureLoader?.();
    hybridDebugOverlay?.dispose();
    alignmentDebugGroup.userData.dispose?.();
    arms.dispose();
    armNebula.dispose();
    dustLanes.dispose();
    outskirts.dispose();
    armHighlights.dispose();
    innerStarDisk.dispose();
    coreGlow.dispose();
    baseLayer.dispose();
    galaxyTextureLayer.dispose();
    heroTextureLoader.dispose();
    shell.dispose();
    core.dispose();
    texture.dispose();
    if (diagnosticsEnabled) {
      delete window.__ACTIVE_THEORY_GALAXY_VERSION__;
      delete document.documentElement.dataset.galaxyVersionDiagnostics;
    }
    group.clear();
  }

  return {
    group,
    layers: {
      base: baseLayerGroup,
      texture: textureLayerGroup,
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
    applyGalaxyLayerMode,
    applyGalaxyHybridMode,
    measureVersionAlignment,
    dispose,
    parameters: {
      turns: TURNS,
      radiusExponent: RADIUS_EXPONENT,
      innerRadius: INNER_RADIUS,
      outerRadius: OUTER_RADIUS
    },
    useGalaxyShell,
    galaxyLayerDebugMode,
    galaxyHybridDebug,
    galaxyAlignmentDebug,
    galaxyVersion,
    getTextureLoadStatus: () => textureLoadStatus
  };
}

function scaleObjectOpacity(root, weight) {
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];

    materials.forEach((material) => {
      if (material.uniforms?.uOpacity) {
        material.uniforms.uOpacity.value *= weight;
      } else if (typeof material.opacity === 'number') {
        material.opacity *= weight;
      }
    });
  });
}

function publishVersionDiagnostics(diagnostics) {
  window.__ACTIVE_THEORY_GALAXY_VERSION__ = diagnostics;
  if (diagnostics) {
    document.documentElement.dataset.galaxyVersionDiagnostics = JSON.stringify(
      diagnostics
    );
  }
}

function projectToScreen(worldPosition, camera) {
  const projected = worldPosition.clone().project(camera);

  return {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight
  };
}

function createSpiralArms(texture) {
  const layers = [
    {
      role: 'spine', count: 800, widthScale: 0.42, opacity: 0.266, size: 1.12, brightness: 1.26
    },
    {
      role: 'band', count: 1600, widthScale: 1.48, opacity: 0.46, size: 0.74, brightness: 0.98
    },
    {
      role: 'halo', count: 263, widthScale: 2.05, opacity: 0.13, size: 0.48, brightness: 0.51
    }
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
    const featherWindows = armIndex === 0
      ? [
        { start: 0.36, end: 0.49, direction: 1, strength: 1.7 },
        { start: 0.58, end: 0.69, direction: -1, strength: 1.42 }
      ]
      : [
        { start: 0.4, end: 0.52, direction: -1, strength: 1.62 },
        { start: 0.61, end: 0.71, direction: 1, strength: 1.35 }
      ];

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
        const rootNarrowing = 0.58 + smoothstep(0.04, 0.28, progress) * 0.42;
        const outerScatter = 1 + smoothstep(0.66, 0.88, progress) * 0.24;
        let perpendicular = clampGaussian(gaussianRandom(random))
          * armWidth
          * layer.widthScale
          * rootNarrowing
          * outerScatter;
        const lowerScatterLayer = armIndex === 0 && layer.role !== 'spine';
        if (lowerScatterLayer) perpendicular *= 1.08;
        const radialOffset = clampGaussian(gaussianRandom(random))
          * armWidth
          * layer.widthScale
          * 0.25
          * rootNarrowing;
        let featherOpacity = 1;

        if (layer.role !== 'spine') {
          for (const feather of featherWindows) {
            if (progress < feather.start || progress > feather.end) continue;
            const localT = (progress - feather.start) / (feather.end - feather.start);
            const envelope = smoothstep(0, 0.18, localT)
              * (1 - smoothstep(0.72, 1, localT));
            const featherRoll = layer.role === 'band' ? 0.34 : 0.46;

            if (random() < envelope * featherRoll) {
              perpendicular += feather.direction
                * armWidth
                * feather.strength
                * smoothstep(0.04, 0.82, localT);
              featherOpacity = layer.role === 'band' ? 0.58 : 0.44;
            }
          }
        }
        const noisyRadius = Math.max(INNER_RADIUS * 0.82, radius + radialOffset);
        const x = Math.cos(angle) * noisyRadius - Math.sin(angle) * perpendicular;
        const y = Math.sin(angle) * noisyRadius + Math.cos(angle) * perpendicular;
        const clusterWave = Math.sin(progress * TAU * 5.65 + 0.32 + armIndex * 0.71)
          * 0.5 + 0.5;
        const secondaryCluster = Math.sin(progress * TAU * 2.18 + 1.15 + armIndex * 1.34)
          * 0.5 + 0.5;
        const lowFrequencyDensity = Math.max(0, Math.min(1,
          0.52
          + Math.sin(progress * TAU * 2.35 + armIndex * 1.17) * 0.29
          + Math.sin(progress * TAU * 5.65 + 0.72) * 0.19
        ));
        const densityWeight = 0.5 + smoothstep(0.16, 0.84, lowFrequencyDensity) * 0.58;
        const clusterStrength = 0.4 + clusterWave * 0.38 + secondaryCluster * 0.22;
        const lowerClusterA = smoothstep(0.2, 0.255, progress)
          * (1 - smoothstep(0.31, 0.365, progress));
        const lowerClusterB = smoothstep(0.405, 0.46, progress)
          * (1 - smoothstep(0.515, 0.57, progress));
        const lowerClusterC = smoothstep(0.59, 0.645, progress)
          * (1 - smoothstep(0.7, 0.755, progress));
        const lowerLocalCluster = lowerScatterLayer
          ? Math.max(lowerClusterA, lowerClusterB, lowerClusterC)
          : 0;
        const signedRadial = radialOffset / Math.max(
          armWidth * layer.widthScale * 0.25 * rootNarrowing,
          0.0001
        );
        const laneProfile = Math.exp(-Math.pow((signedRadial + 0.38) / 0.34, 2));
        const dustActivity = smoothstep(0.5, 0.86, clusterWave)
          * (0.38 + secondaryCluster * 0.62)
          * smoothstep(0.12, 0.28, progress)
          * (1 - smoothstep(0.7, 0.82, progress));
        const dustCut = 1 - laneProfile
          * dustActivity
          * (layer.role === 'spine' ? 0.684 : 0.551);
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
        const outerLayerHidden = layer.role === 'halo'
          && progress > 0.7
          && random() < 0.42;
        const outerArmHidden = progress > 0.7
          && random() < smoothstep(0.7, 0.86, progress) * 0.35;
        const densityDropout = lowFrequencyDensity < 0.2
          && layer.role !== 'spine'
          && random() < 0.28;
        const dropout = outerLayerHidden
          || outerArmHidden
          || densityDropout
          || progress > 0.84 && random() < (progress - 0.84) * 3.4;
        const stride = particleIndex * 3;

        positions[stride] = x;
        positions[stride + 1] = y;
        positions[stride + 2] = (random() - 0.5)
          * (0.035 + (1 - progress) * 0.08 + layer.widthScale * 0.018);
        chooseGalaxyColor(color, palette, random());
        color.multiplyScalar(
          layer.brightness
          * (0.7 + clusterStrength * 0.32)
          * dustCut
          * (1 + lowerLocalCluster * 0.055)
        );
        colors[stride] = color.r;
        colors[stride + 1] = color.g;
        colors[stride + 2] = color.b;
        sizes[particleIndex] = layer.size
          * (0.78 + random() * 0.38 + clusterStrength * 0.18);
        opacities[particleIndex] = (dropout ? 0.035 : layer.opacity)
          * outerFade
          * (0.56 + clusterStrength * 0.5)
          * densityWeight
          * dustCut
          * armBreak
          * midDensityBoost
          * featherOpacity
          * (lowerScatterLayer ? 1.12 : 1)
          * (1 + lowerLocalCluster * 0.08);
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
      material.uniforms.uOpacity.value = 1.16 + pulse * 0.07 + proximity * 0.02;
      material.uniforms.uPointScale.value = 1 + pulse * 0.025;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createArmNebula(texture) {
  const countPerArm = 312;
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
      const armBalance = smoothstep(0.12, 0.28, progress);
      const widthBalance = armIndex === 1
        ? 1 - armBalance * 0.17
        : 1 + armBalance * 0.025;
      const spread = armWidth * (1.38 + random() * 0.58) * widthBalance;
      const perpendicular = clampGaussian(gaussianRandom(random)) * spread * 0.34;
      const radialOffset = gaussianRandom(random) * spread * 0.11;
      const noisyRadius = Math.max(INNER_RADIUS, radius + radialOffset);
      const clusterWave = Math.sin(progress * TAU * 5.65 + 0.42 + armIndex * 0.71)
        * 0.5 + 0.5;
      const clusterOpacity = 0.5 + clusterWave * 0.32;
      const outerFade = 1 - smoothstep(0.7, 0.86, progress) * 0.99;
      const innerArmBreak = 1
        - smoothstep(0.3, 0.34, progress)
        * (1 - smoothstep(0.38, 0.42, progress))
        * 0.52;
      const midArmBreak = 1
        - smoothstep(0.46, 0.51, progress)
        * (1 - smoothstep(0.57, 0.62, progress))
        * 0.8;
      const upperGapA = 1
        - smoothstep(0.25, 0.285, progress)
        * (1 - smoothstep(0.34, 0.385, progress))
        * 0.52;
      const upperGapB = 1
        - smoothstep(0.59, 0.625, progress)
        * (1 - smoothstep(0.68, 0.73, progress))
        * 0.62;
      const upperGap = armIndex === 1 ? upperGapA * upperGapB : 1;
      const lowerBreakRecovery = armIndex === 0 ? 0.12 : 0;
      const armBreak = Math.min(
        1,
        innerArmBreak * midArmBreak
          + (1 - innerArmBreak * midArmBreak) * lowerBreakRecovery
      );
      const opacityBalance = armIndex === 1
        ? 1 - armBalance * 0.15
        : 1 + armBalance * 0.1;

      positions[stride] = Math.cos(angle) * noisyRadius - Math.sin(angle) * perpendicular;
      positions[stride + 1] = Math.sin(angle) * noisyRadius + Math.cos(angle) * perpendicular;
      positions[stride + 2] = (random() - 0.5) * (0.08 + spread * 0.5);
      color.copy(iceBlue).lerp(cyanBlue, Math.min(progress * 1.18, 1));
      color.lerp(paleViolet, smoothstep(0.34, 0.88, progress) * 0.62);
      color.multiplyScalar(0.54 + clusterWave * 0.24);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      sizes[particleIndex] = 1.26 + random() * 1.62 + Math.sin(progress * Math.PI) * 0.495;
      opacities[particleIndex] = (0.24 + random() * 0.16)
        * clusterOpacity
        * outerFade
        * armBreak
        * upperGap
        * opacityBalance;
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
      material.uniforms.uOpacity.value = 0.125 + pulse * 0.016;
      material.uniforms.uPointScale.value = 1.03 + pulse * 0.022;
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
      const cloudCluster = 0.5
        + Math.sin(progress * TAU * 5.65 + 0.38 + armIndex * 0.71) * 0.5;
      const dustBreak = 0.5 + Math.sin(progress * TAU * 2.18 + armIndex * 1.4) * 0.5;
      const localDust = cloudCluster > 0.5 && dustBreak > 0.32
        ? 0.62 + cloudCluster * 0.38
        : 0.025;
      color.multiplyScalar(localDust);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: texture,
    size: 0.044,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.399,
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
      material.opacity = 0.361 + pulse * 0.038;
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
  const count = 20;
  const random = seededRandom(66191);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const palette = [
    new THREE.Color(0x9bdcff),
    new THREE.Color(0xa48cf4),
    new THREE.Color(0xffdfb2)
  ];
  const progressByArm = [
    [0.2, 0.225, 0.315, 0.405, 0.49, 0.575, 0.645, 0.715, 0.775, 0.825],
    [0.18, 0.195, 0.285, 0.37, 0.465, 0.55, 0.625, 0.695, 0.755, 0.815]
  ];

  for (let armIndex = 0; armIndex < 2; armIndex += 1) {
    for (let sequenceIndex = 0; sequenceIndex < 10; sequenceIndex += 1) {
      const index = armIndex * 10 + sequenceIndex;
      const stride = index * 3;
      const progress = progressByArm[armIndex][sequenceIndex]
        + (random() - 0.5) * 0.034;
      const radius = INNER_RADIUS
        + (OUTER_RADIUS - INNER_RADIUS) * Math.pow(progress, RADIUS_EXPONENT);
      const angle = armIndex * Math.PI
        + progress * TAU * TURNS
        + (random() - 0.5) * 0.035;
      const color = palette[Math.floor(random() * palette.length)];
      const sideOffset = gaussianRandom(random) * (0.006 + progress * 0.012);

      positions[stride] = Math.cos(angle) * radius - Math.sin(angle) * sideOffset;
      positions[stride + 1] = Math.sin(angle) * radius + Math.cos(angle) * sideOffset;
      positions[stride + 2] = (random() - 0.5) * 0.065;
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      sizes[index] = 0.72 + Math.pow(random(), 1.4) * 0.96;
      opacities[index] = 0.62 + random() * 0.3;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  const material = createParticleMaterial(texture, 0.98, 20, THREE.AdditiveBlending);
  const points = new THREE.Points(geometry, material);

  points.name = 'CinematicGalaxyArmHighlights';
  points.renderOrder = 3;

  return {
    points,
    update(time, pulse) {
      material.uniforms.uOpacity.value = 0.9 + pulse * 0.16;
      material.uniforms.uPointScale.value = 0.98 + pulse * 0.09;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createInnerStarDisk(texture) {
  const count = 1480;
  const random = seededRandom(94027);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const iceBlue = new THREE.Color(0xbce9ff);
  const softBlue = new THREE.Color(0x76bdf1);
  const warmWhite = new THREE.Color(0xffe1b6);
  const paleViolet = new THREE.Color(0xb6a5e8);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const rootBiased = random() < 0.64;
    const rootZone = random();
    const rootProgressRoll = random();
    const armProgress = rootZone < 0.58
      ? Math.pow(rootProgressRoll, 1.58) * 0.18
      : 0.1 + Math.pow(rootProgressRoll, 1.14) * 0.222;
    const radial = rootBiased
      ? 0.038 + (OUTER_RADIUS - INNER_RADIUS) * Math.pow(armProgress, RADIUS_EXPONENT)
      : 0.034 + Math.pow(random(), 2.18) * 0.285;
    const angle = rootBiased
      ? (index % 2) * Math.PI
        + armProgress * TAU * TURNS
        + gaussianRandom(random) * (0.16 + armProgress * 0.28)
      : random() * TAU + radial * 6.2;
    const stride = index * 3;
    const rootBoost = 1 - smoothstep(0.15, 0.31, radial);
    const outerFade = 1 - smoothstep(0.24, 0.355, radial);
    const densityCluster = 0.5 + Math.sin(angle * 5.1 + radial * 31.0) * 0.5;
    const secondaryCluster = 0.5 + Math.sin(angle * 2.05 - radial * 19.0 + 0.9) * 0.5;
    const densityBreak = 0.56 + densityCluster * 0.28 + secondaryCluster * 0.16;
    const localGap = densityCluster < 0.18 && secondaryCluster < 0.4 ? 0.28 : 1;
    const clusterBoost = 0.72 + densityCluster * 0.18 + secondaryCluster * 0.1;
    const rootContinuity = rootBiased
      ? 0.9 + smoothstep(0.08, 0.24, armProgress) * 0.1
      : 0.84;

    positions[stride] = Math.cos(angle) * radial;
    positions[stride + 1] = Math.sin(angle) * radial * (rootBiased ? 0.76 : 0.56);
    positions[stride + 2] = (random() - 0.5) * (0.024 + rootBoost * 0.026);
    const centerWarm = 1 - smoothstep(0.045, 0.15, radial);
    color.copy(warmWhite).lerp(iceBlue, 1 - centerWarm * 0.78);
    color.lerp(softBlue, smoothstep(0.13, 0.32, radial) * (0.3 + random() * 0.32));
    if (random() > 0.91) color.lerp(paleViolet, 0.38 + random() * 0.2);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = 0.28 + random() * 0.45 + rootBoost * 0.14;
    opacities[index] = (0.17 + random() * 0.2 + rootBoost * 0.14)
      * (rootBiased ? 1 : 0.82)
      * outerFade
      * densityBreak
      * localGap
      * clusterBoost
      * rootContinuity;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geometry.computeBoundingSphere();
  const material = createParticleMaterial(texture, 0.68, 12, THREE.NormalBlending);
  const points = new THREE.Points(geometry, material);

  points.name = 'CinematicGalaxyInnerStarDisk';
  points.renderOrder = 2;
  return {
    points,
    update(time, pulse) {
      material.uniforms.uOpacity.value = 0.79 + pulse * 0.035;
      material.uniforms.uPointScale.value = 0.98 + Math.sin(time * 0.28) * 0.025;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createWarmCoreGlow() {
  const size = 128;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);

  canvas.width = size;
  canvas.height = size;
  gradient.addColorStop(0, 'rgba(255,238,207,0.82)');
  gradient.addColorStop(0.065, 'rgba(255,219,176,0.42)');
  gradient.addColorStop(0.22, 'rgba(178,219,248,0.16)');
  gradient.addColorStop(0.56, 'rgba(96,145,232,0.022)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xfff1dc,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: true
  });
  const sprite = new THREE.Sprite(material);

  sprite.name = 'CinematicGalaxyWarmCoreGlow';
  sprite.scale.set(0.4, 0.34, 1);
  sprite.position.z = -0.035;
  sprite.renderOrder = 0;
  return {
    sprite,
    update(pulse) {
      material.opacity = 0.4 + pulse * 0.055;
      const scale = 1 + pulse * 0.025;
      sprite.scale.set(0.4 * scale, 0.34 * scale, 1);
    },
    dispose() {
      texture.dispose();
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

function smootherstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function createGalaxyAlignmentDebug(textureLayer) {
  const group = new THREE.Group();
  const particleCore = new THREE.Vector3(0, 0, 0);
  const textureCore = textureLayer.sourceUvToLocalPoint(textureLayer.alignment.coreUv);
  const textureUAxis = textureLayer.sourceUvToLocalPoint({
    x: textureLayer.alignment.coreUv.x + 0.25,
    y: textureLayer.alignment.coreUv.y
  });
  const textureVAxis = textureLayer.sourceUvToLocalPoint({
    x: textureLayer.alignment.coreUv.x,
    y: textureLayer.alignment.coreUv.y + 0.25
  });
  const textureArmPoints = textureLayer.alignment.armUvs.map((uv) => (
    textureLayer.sourceUvToLocalPoint(uv)
  ));
  const particleArmPoints = [0, 1].map((armIndex) => {
    const progress = 0.19;
    const radius = INNER_RADIUS
      + (OUTER_RADIUS - INNER_RADIUS) * Math.pow(progress, RADIUS_EXPONENT);
    const angle = armIndex * Math.PI + progress * TAU * TURNS;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  });
  const textureMaterial = new THREE.LineBasicMaterial({
    color: 0xff4fd8,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const particleMaterial = new THREE.LineBasicMaterial({
    color: 0x4fffea,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const textureGeometry = new THREE.BufferGeometry().setFromPoints([
    textureCore, textureArmPoints[0], textureCore, textureArmPoints[1]
  ]);
  const particleGeometry = new THREE.BufferGeometry().setFromPoints([
    particleCore, particleArmPoints[0], particleCore, particleArmPoints[1]
  ]);
  const textureLines = new THREE.LineSegments(textureGeometry, textureMaterial);
  const particleLines = new THREE.LineSegments(particleGeometry, particleMaterial);
  const uAxisMaterial = new THREE.LineBasicMaterial({
    color: 0xffd84a,
    transparent: true,
    opacity: 0.98,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const vAxisMaterial = new THREE.LineBasicMaterial({
    color: 0x66ff88,
    transparent: true,
    opacity: 0.98,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const uAxisGeometry = new THREE.BufferGeometry().setFromPoints([
    textureCore, textureUAxis
  ]);
  const vAxisGeometry = new THREE.BufferGeometry().setFromPoints([
    textureCore, textureVAxis
  ]);
  const uAxisLine = new THREE.Line(uAxisGeometry, uAxisMaterial);
  const vAxisLine = new THREE.Line(vAxisGeometry, vAxisMaterial);
  const textureMarker = createAlignmentMarker(textureCore, 0xff4fd8);
  const particleMarker = createAlignmentMarker(particleCore, 0x4fffea);

  group.name = 'CinematicGalaxyAlignmentDebug';
  group.visible = false;
  textureLines.renderOrder = 100;
  particleLines.renderOrder = 100;
  uAxisLine.renderOrder = 100;
  vAxisLine.renderOrder = 100;
  group.add(
    textureLines,
    particleLines,
    uAxisLine,
    vAxisLine,
    textureMarker.mesh,
    particleMarker.mesh
  );
  group.userData.dispose = () => {
    textureGeometry.dispose();
    particleGeometry.dispose();
    uAxisGeometry.dispose();
    vAxisGeometry.dispose();
    textureMaterial.dispose();
    particleMaterial.dispose();
    uAxisMaterial.dispose();
    vAxisMaterial.dispose();
    textureMarker.dispose();
    particleMarker.dispose();
  };
  const textureWorldPosition = new THREE.Vector3();
  const particleWorldPosition = new THREE.Vector3();
  group.userData.measureScreen = (camera) => {
    group.updateWorldMatrix(true, true);
    camera.updateMatrixWorld(true);
    textureMarker.mesh.getWorldPosition(textureWorldPosition).project(camera);
    particleMarker.mesh.getWorldPosition(particleWorldPosition).project(camera);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const textureScreen = {
      x: (textureWorldPosition.x * 0.5 + 0.5) * width,
      y: (-textureWorldPosition.y * 0.5 + 0.5) * height
    };
    const particleScreen = {
      x: (particleWorldPosition.x * 0.5 + 0.5) * width,
      y: (-particleWorldPosition.y * 0.5 + 0.5) * height
    };

    return {
      texture: textureScreen,
      particle: particleScreen,
      error: Math.hypot(
        textureScreen.x - particleScreen.x,
        textureScreen.y - particleScreen.y
      )
    };
  };
  return group;
}

function createAlignmentMarker(position, color) {
  const geometry = new THREE.RingGeometry(0.012, 0.019, 24);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.98,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(position);
  mesh.renderOrder = 101;
  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
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

function readGalaxyLayerDebugMode() {
  const params = new URLSearchParams(window.location.search);

  if (!params.has('debugGalaxyLayers')) {
    return null;
  }

  const supportedModes = new Set([
    'particlesOnly',
    'cloudsOnly',
    'dustOnly',
    'combined'
  ]);
  const directValue = params.get('debugGalaxyLayers');
  const selectedMode = params.get('galaxyLayerMode')
    || params.get('debugGalaxyLayerMode')
    || directValue;

  return supportedModes.has(selectedMode) ? selectedMode : 'combined';
}

function prepareGalaxyAlignmentDebug() {
  const params = new URLSearchParams(window.location.search);
  const directValue = params.get('debugGalaxyAlignment');
  const enabled = directValue !== null
    && directValue !== '0'
    && directValue !== 'false';

  if (enabled && params.get('debugCinematicGalaxy') !== '1') {
    const debugUrl = new URL(window.location.href);

    debugUrl.searchParams.set('debugCinematicGalaxy', '1');
    window.history.replaceState(window.history.state, '', debugUrl);
  }

  return Object.freeze({
    enabled,
    frozenSpinPhase: enabled ? 0 : null,
    parallaxFrozen: enabled
  });
}

function readGalaxyHybridDebugState() {
  const params = new URLSearchParams(window.location.search);
  const directValue = params.get('debugGalaxyHybrid');
  const enabled = directValue !== null
    && directValue !== '0'
    && directValue !== 'false';
  const supportedModes = new Set([
    'proceduralOnly',
    'textureOnly',
    'particlesOnly',
    'combined',
    'alignmentDebug'
  ]);
  const requestedMode = params.get('galaxyHybridMode')
    || params.get('debugGalaxyHybridMode')
    || directValue;

  return {
    enabled,
    mode: supportedModes.has(requestedMode) ? requestedMode : 'combined'
  };
}

function createGalaxyHybridDebugOverlay(initialMode) {
  const panel = document.createElement('div');
  const state = {
    mode: initialMode,
    status: 'idle',
    fallback: true,
    alignment: null
  };

  panel.dataset.activeTheoryDebug = 'galaxy-hybrid';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '18px',
    right: '18px',
    zIndex: '9999',
    padding: '10px 12px',
    color: '#bceeff',
    background: 'rgba(1, 6, 18, 0.82)',
    border: '1px solid rgba(100, 210, 255, 0.28)',
    font: '12px/1.5 monospace',
    letterSpacing: '0.04em',
    pointerEvents: 'none',
    whiteSpace: 'pre-line'
  });
  panel.textContent = `Galaxy hybrid: ${initialMode}\ntexture fallback`;
  document.body.append(panel);

  function update(nextState) {
    Object.assign(state, nextState);
    const statusLabel = state.status === 'loading'
      ? 'texture loading'
      : state.status === 'ready'
        ? 'texture ready'
        : state.status === 'error'
          ? 'texture fallback\ntexture error'
          : state.fallback
            ? 'texture fallback'
            : 'texture fallback';
    const alignmentLabel = state.alignment
      ? `\ntexture core: ${state.alignment.texture.x.toFixed(2)}, ${state.alignment.texture.y.toFixed(2)}`
        + `\nparticle core: ${state.alignment.particle.x.toFixed(2)}, ${state.alignment.particle.y.toFixed(2)}`
        + `\nprojection error: ${state.alignment.error.toFixed(2)} px`
        + '\nspin phase: 0.000 (frozen)'
      : '';

    panel.textContent = `Galaxy hybrid: ${state.mode}\n${statusLabel}${alignmentLabel}`;
  }

  function dispose() {
    panel.remove();
  }

  return { update, dispose };
}

export const cinematicGalaxyFactory = {
  createCinematicGalaxy
};
