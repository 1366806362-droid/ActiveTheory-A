import * as THREE from 'three';
import { getCamera } from '../engine/camera.js';
import { createCinematicGalaxy } from './cinematicGalaxy.js';
import { createEnergyCore } from './core.js';
import { createDeepSpaceBackground } from './deepSpaceBackground.js';
import { createEarthHorizon } from './earthHorizon.js';
import { createGalaxyPlanets } from './galaxyPlanets.js';
import { readGalaxyAtmosphereDebugState } from './galaxyAtmosphere.js';
import {
  getHeroGalaxyMainFrameQuaternion,
  getHeroGalaxyVersionConfig,
  readHeroGalaxyVersionState
} from './galaxyPreviewConfig.js';
import { getInteractionState } from './interaction.js';
import { createNebulaVolume } from './nebulaVolume.js';
import { createNodeSystem } from './nodeSystem.js';
import { createParticleField } from './particleField.js';

const DEBUG_MAIN_GALAXY_ONLY = readDebugFlag('debugMainGalaxyOnly', false);
const DEBUG_MAIN_GALAXY_RENDER = readDebugFlag('debugMainGalaxyRender', false);
const DEBUG_MAIN_GALAXY_ACTIVE = DEBUG_MAIN_GALAXY_ONLY
  || DEBUG_MAIN_GALAXY_RENDER;
const DEBUG_HERO_COMPOSITION = import.meta.env.DEV
  && readDebugFlag('debugHeroComposition', false);
const EARTH_LAYER_DEBUG = readEarthLayerDebugState();
const HERO_MAIN_GALAXY_POSITION = new THREE.Vector3(0.95, 0.03, 0);
const HERO_MAIN_GALAXY_SCALE = 0.82;
const HERO_MAIN_GALAXY_QUATERNION = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(
    THREE.MathUtils.degToRad(20),
    0,
    THREE.MathUtils.degToRad(44),
    'XYZ'
  )
);
const HERO_GALAXY_VERSION_STATE = readHeroGalaxyVersionState();
const HERO_GALAXY_VERSION_CONFIG = getHeroGalaxyVersionConfig(
  HERO_GALAXY_VERSION_STATE.version
);
const HERO_GALAXY_ATMOSPHERE_DEBUG = readGalaxyAtmosphereDebugState();
const HERO_GALAXY_VIDEO_PREVIEW = readGalaxyVideoPreview();
const HERO_GALAXY_VIDEO_COMPOSITION = readGalaxyVideoComposition();
const GALAXY_RUNTIME_AUDIT = import.meta.env.DEV
  && readDebugFlag('galaxyAudit', false);
const galaxyVideoPerformance = {
  elapsed: 0,
  frames: 0,
  fps: null,
  minFps: null,
  journeyMinFps: null,
  p95FrameMs: null,
  maxP95FrameMs: null,
  frameTimes: [],
  heapStartBytes: null,
  heapCurrentBytes: null,
  heapPeakBytes: null
};
if (HERO_GALAXY_VIDEO_PREVIEW) {
  document.documentElement.dataset.galaxyVideoPreview = HERO_GALAXY_VIDEO_PREVIEW;
}
if (HERO_GALAXY_VIDEO_COMPOSITION) {
  document.documentElement.dataset.galaxyVideoComposition = HERO_GALAXY_VIDEO_COMPOSITION;
}

const DEBUG_GALAXY_ATMOSPHERE_ISOLATION = HERO_GALAXY_VERSION_STATE.isV2
  && HERO_GALAXY_ATMOSPHERE_DEBUG.enabled
  && HERO_GALAXY_ATMOSPHERE_DEBUG.mode.endsWith('Only');
const CINEMATIC_GALAXY_DEBUG = readCinematicGalaxyDebugState();
export const useCinematicGalaxy = true;
const HERO_DEBUG = Object.freeze({
  showBackground: DEBUG_MAIN_GALAXY_ACTIVE ? false : readDebugFlag('showBackground', true),
  showMainGalaxy: readDebugFlag('showMainGalaxy', true),
  showMainGalaxyArms: readDebugFlag('showMainGalaxyArms', true),
  showMainGalaxyCore: readDebugFlag(
    'showMainGalaxyCore',
    readDebugFlag('showMainCoreCluster', true)
  ),
  showSubGalaxies: DEBUG_MAIN_GALAXY_ACTIVE ? false : readDebugFlag('showSubGalaxies', true),
  showNebula: DEBUG_MAIN_GALAXY_ACTIVE ? false : readDebugFlag('showNebula', true),
  showDust: DEBUG_MAIN_GALAXY_ACTIVE ? false : readDebugFlag('showDust', true),
  showGlow: DEBUG_MAIN_GALAXY_ONLY ? false : readDebugFlag('showGlow', true),
  showLabels: DEBUG_MAIN_GALAXY_ACTIVE ? false : readDebugFlag('showLabels', true),
  freezeHeroMotion: DEBUG_MAIN_GALAXY_ACTIVE
    || DEBUG_HERO_COMPOSITION
    || readDebugFlag('freezeHeroMotion', false)
});
const frozenInteraction = {
  parallaxX: 0,
  parallaxY: 0,
  proximity: 0,
  active: 0,
  x: 0,
  y: 0
};

const universeState = {
  root: null,
  galaxyGroup: null,
  mainGalaxyFrame: null,
  deepSpaceBackground: null,
  nebulaVolume: null,
  energyCore: null,
  galaxyPlanets: null,
  nodeSystem: null,
  particleField: null,
  earthHorizon: null,
  debugBackdrop: null,
  cinematicDebugSignature: null,
  scrollHintDebugState: null,
  heroCompositionDebug: null
};
const mouseParallaxState = { x: 0, y: 0 };
const backgroundUpdateState = {
  delta: 0,
  time: 0,
  cameraPosition: null,
  cameraQuaternion: null,
  mouseParallax: mouseParallaxState,
  journeyProgress: 0,
  targetGalaxyColor: 0x087f99,
  exposureMultiplier: 1
};

export function createUniverseRoot() {
  const cinematicDebug = CINEMATIC_GALAXY_DEBUG;
  const debugActive = DEBUG_MAIN_GALAXY_ACTIVE || cinematicDebug.enabled;
  const sceneDebugActive = debugActive
    || EARTH_LAYER_DEBUG.enabled
    || DEBUG_GALAXY_ATMOSPHERE_ISOLATION;
  const root = new THREE.Group();
  const nebulaVolume = createNebulaVolume();
  const deepSpaceBackground = createDeepSpaceBackground(nebulaVolume);
  const energyCore = useCinematicGalaxy
    ? createCinematicGalaxy({
      debugVisibility: cinematicDebug.layers,
      shellDebugMode: cinematicDebug.shellDebugMode,
      galaxyVersion: HERO_GALAXY_VERSION_STATE.version,
      galaxyVersionConfig: HERO_GALAXY_VERSION_CONFIG,
      galaxyVideoPreview: HERO_GALAXY_VIDEO_PREVIEW,
      galaxyVideoComposition: HERO_GALAXY_VIDEO_COMPOSITION,
      diagnosticsEnabled: HERO_GALAXY_VERSION_STATE.diagnostics
    })
    : createEnergyCore();
  const galaxyPlanets = createGalaxyPlanets();
  const galaxyGroup = new THREE.Group();
  const mainGalaxyFrame = new THREE.Group();
  const nodeSystem = createNodeSystem();
  const particleField = createParticleField();
  const earthHorizon = createEarthHorizon();
  const debugBackdrop = createDebugBackdrop();

  root.name = 'ActiveTheoryUniverseRoot';
  galaxyGroup.name = 'HeroBrandGalaxyComposition';
  mainGalaxyFrame.name = 'HeroMainGalaxyCompositionFrame';
  applyGalaxyComposition(galaxyGroup, cinematicDebug.enabled);
  applyMainGalaxyComposition(mainGalaxyFrame);
  if (!useCinematicGalaxy) {
    energyCore.group.add(nebulaVolume.galaxyDustGroup);
  }
  mainGalaxyFrame.add(energyCore.group);
  mainGalaxyFrame.visible = !EARTH_LAYER_DEBUG.enabled;
  galaxyGroup.add(galaxyPlanets.group, mainGalaxyFrame);
  nodeSystem.group.visible = false;
  deepSpaceBackground.group.visible = sceneDebugActive ? false : HERO_DEBUG.showBackground;
  nebulaVolume.backgroundGroup.visible = sceneDebugActive ? false : HERO_DEBUG.showNebula;
  nebulaVolume.galaxyDustGroup.visible = sceneDebugActive
    ? false
    : !useCinematicGalaxy && HERO_DEBUG.showDust;
  if (cinematicDebug.enabled) {
    energyCore.applyDebugVisibility?.(cinematicDebug.layers);
    energyCore.applyShellDebugMode?.(cinematicDebug.shellDebugMode);
  } else {
    energyCore.layers.arms.visible = HERO_DEBUG.showMainGalaxyArms;
    energyCore.layers.dust.visible = DEBUG_MAIN_GALAXY_ACTIVE ? true : HERO_DEBUG.showDust;
    energyCore.layers.core.visible = HERO_DEBUG.showMainGalaxyCore;
    const coreNebula = energyCore.layers.core.getObjectByName('GalaxyCoreSoftNebula');

    if (coreNebula) {
      // This full-core haze reads as a large translucent disc at the hero scale.
      // Keep the core stars and spiral-arm nebulae, but remove the global shell.
      coreNebula.visible = false;
    }
  }
  energyCore.group.visible = EARTH_LAYER_DEBUG.enabled ? false : HERO_DEBUG.showMainGalaxy;
  galaxyPlanets.group.visible = sceneDebugActive ? false : HERO_DEBUG.showSubGalaxies;
  galaxyPlanets.setLabelsVisible(sceneDebugActive ? false : HERO_DEBUG.showLabels);
  particleField.points.visible = false;
  earthHorizon.group.visible = EARTH_LAYER_DEBUG.enabled
    || (!debugActive && !DEBUG_GALAXY_ATMOSPHERE_ISOLATION);
  earthHorizon.setLayerMode(EARTH_LAYER_DEBUG.mode);
  debugBackdrop.visible = sceneDebugActive;
  if (EARTH_LAYER_DEBUG.enabled) {
    debugBackdrop.material.color.set(0x020a20);
  }
  root.add(debugBackdrop);

  root.add(deepSpaceBackground.group, particleField.points, earthHorizon.group, galaxyGroup);
  const heroCompositionDebug = DEBUG_HERO_COMPOSITION
    ? createHeroCompositionDebug({
      earth: earthHorizon.group,
      mainGalaxyFrame,
      mainGalaxy: energyCore.group
    })
    : null;

  universeState.root = root;
  universeState.galaxyGroup = galaxyGroup;
  universeState.mainGalaxyFrame = mainGalaxyFrame;
  universeState.deepSpaceBackground = deepSpaceBackground;
  universeState.nebulaVolume = nebulaVolume;
  universeState.energyCore = energyCore;
  universeState.galaxyPlanets = galaxyPlanets;
  universeState.nodeSystem = nodeSystem;
  universeState.particleField = particleField;
  universeState.earthHorizon = earthHorizon;
  universeState.debugBackdrop = debugBackdrop;
  universeState.cinematicDebugSignature = cinematicDebug.signature;
  universeState.heroCompositionDebug = heroCompositionDebug;
  if (HERO_GALAXY_VIDEO_PREVIEW) {
    const diagnostics = addGalaxyVideoPerformance(
      energyCore.measureVideoAlignment?.(getCamera()) ?? null
    );
    window.__ACTIVE_THEORY_H1_VIDEO__ = diagnostics;
    document.documentElement.dataset.galaxyVideoDiagnostics = JSON.stringify(diagnostics);
  }
  setScrollHintDebugVisibility(sceneDebugActive);

  return {
    root,
    galaxyGroup,
    mainGalaxyFrame,
    atmosphereLayer: deepSpaceBackground,
    deepSpaceBackground,
    nebulaVolume,
    energyCore,
    galaxyPlanets,
    nodeSystem,
    particleCount: particleField.count,
    earthHorizon,
    getPlanetWorldPosition(name, target) {
      return galaxyPlanets.getPlanetWorldPosition(name, target);
    },
    setPlanetEntryProgress(name, progress) {
      galaxyPlanets.setPlanetEntryProgress(name, progress);
    },
    update: updateUniverseRoot,
    dispose: disposeUniverseRoot
  };
}

export function updateUniverseRoot(renderState, delta, time, journeyProgress = 0) {
  if (!universeState.root || !universeState.particleField) {
    return;
  }

  const cinematicDebug = CINEMATIC_GALAXY_DEBUG;

  syncCinematicGalaxyDebugState(cinematicDebug);
  updateGalaxyRuntimePerformance(delta, journeyProgress);
  const debugActive = DEBUG_MAIN_GALAXY_ACTIVE || cinematicDebug.enabled;
  const sceneDebugActive = debugActive
    || EARTH_LAYER_DEBUG.enabled
    || DEBUG_GALAXY_ATMOSPHERE_ISOLATION;

  setScrollHintDebugVisibility(sceneDebugActive);

  if (EARTH_LAYER_DEBUG.enabled) {
    renderState.backgroundColor = '#020a20';
    renderState.fogColor = '#020a20';
    universeState.debugBackdrop.visible = true;
    universeState.deepSpaceBackground.group.visible = false;
    universeState.nebulaVolume.backgroundGroup.visible = false;
    universeState.nebulaVolume.galaxyDustGroup.visible = false;
    universeState.galaxyPlanets.group.visible = false;
    universeState.galaxyPlanets.setLabelsVisible(false);
    universeState.particleField.points.visible = false;
    universeState.energyCore.group.visible = false;
    universeState.mainGalaxyFrame.visible = false;
    universeState.earthHorizon.group.visible = true;
    universeState.earthHorizon.setLayerMode(EARTH_LAYER_DEBUG.mode);
    universeState.earthHorizon.update(0, 0);
    universeState.root.rotation.set(0, 0, 0);
    universeState.root.position.set(0, 0, 0);
    return;
  }

  if (DEBUG_GALAXY_ATMOSPHERE_ISOLATION) {
    renderState.backgroundColor = '#010612';
    renderState.fogColor = '#010612';
    universeState.debugBackdrop.visible = true;
    universeState.deepSpaceBackground.group.visible = false;
    universeState.nebulaVolume.backgroundGroup.visible = false;
    universeState.nebulaVolume.galaxyDustGroup.visible = false;
    universeState.galaxyPlanets.group.visible = false;
    universeState.galaxyPlanets.setLabelsVisible(false);
    universeState.particleField.points.visible = false;
    universeState.earthHorizon.group.visible = false;
    universeState.mainGalaxyFrame.visible = true;
    universeState.energyCore.group.visible = true;
    universeState.energyCore.update(0, 0, frozenInteraction, 0);
    applyGalaxyComposition(universeState.galaxyGroup, false);
    applyMainGalaxyComposition(universeState.mainGalaxyFrame);
    universeState.root.rotation.set(0, 0, 0);
    universeState.root.position.set(0, 0, 0);
    return;
  }

  if (debugActive) {
    renderState.backgroundColor = '#010612';
    renderState.fogColor = '#010612';
    universeState.deepSpaceBackground.group.visible = false;
    universeState.nebulaVolume.backgroundGroup.visible = false;
    universeState.nebulaVolume.galaxyDustGroup.visible = false;
    universeState.galaxyPlanets.group.visible = false;
    universeState.galaxyPlanets.setLabelsVisible(false);
    universeState.particleField.points.visible = false;
    universeState.earthHorizon.group.visible = false;
    universeState.energyCore.group.visible = true;
    if (cinematicDebug.enabled) {
      universeState.energyCore.applyDebugVisibility?.(cinematicDebug.layers);
      universeState.energyCore.applyShellDebugMode?.(cinematicDebug.shellDebugMode);
    } else {
      universeState.energyCore.layers.arms.visible = true;
      universeState.energyCore.layers.dust.visible = DEBUG_MAIN_GALAXY_RENDER;
      universeState.energyCore.layers.nodes.visible = true;
      universeState.energyCore.layers.core.visible = true;
    }
    universeState.energyCore.update(0, 0, frozenInteraction, 0);
    applyGalaxyComposition(universeState.galaxyGroup, cinematicDebug.enabled);
    applyMainGalaxyComposition(universeState.mainGalaxyFrame);
    universeState.root.rotation.set(0, 0, 0);
    universeState.root.position.set(0, 0, 0);
    universeState.heroCompositionDebug?.update();
    return;
  }

  const liveInteraction = getInteractionState();
  const interaction = HERO_DEBUG.freezeHeroMotion ? frozenInteraction : liveInteraction;
  const motionDelta = HERO_DEBUG.freezeHeroMotion ? 0 : delta;
  const motionTime = HERO_DEBUG.freezeHeroMotion ? 0 : time;

  mouseParallaxState.x = interaction.parallaxX;
  mouseParallaxState.y = interaction.parallaxY;
  backgroundUpdateState.delta = motionDelta;
  backgroundUpdateState.time = motionTime;
  backgroundUpdateState.cameraPosition = renderState.cameraPosition;
  backgroundUpdateState.journeyProgress = journeyProgress;
  backgroundUpdateState.exposureMultiplier = renderState.exposure;
  universeState.deepSpaceBackground.update(backgroundUpdateState);
  universeState.nebulaVolume.update(motionDelta, motionTime, interaction, journeyProgress);
  const earthRotationActive = universeState.earthHorizon.group.visible
    && journeyProgress < 0.92;
  universeState.earthHorizon.update(
    earthRotationActive ? motionDelta : 0,
    motionTime,
    earthRotationActive
  );
  universeState.galaxyPlanets.update(motionDelta, motionTime, interaction);
  universeState.energyCore.update(motionDelta, motionTime, interaction, journeyProgress);
  applyGalaxyComposition(universeState.galaxyGroup, false);
  applyMainGalaxyComposition(universeState.mainGalaxyFrame);
  universeState.root.rotation.y = Math.sin(motionTime * 0.008) * 0.008;
  universeState.root.position.x = interaction.parallaxX * 0.04;
  universeState.root.position.y = interaction.parallaxY * 0.025;
  if (HERO_GALAXY_VERSION_STATE.diagnostics) {
    updateGalaxyVersionDiagnostics();
  }
  if (HERO_GALAXY_VIDEO_PREVIEW) {
    const diagnostics = addGalaxyVideoPerformance(
      universeState.energyCore.measureVideoAlignment?.(getCamera()) ?? null
    );
    window.__ACTIVE_THEORY_H1_VIDEO__ = diagnostics;
    document.documentElement.dataset.galaxyVideoDiagnostics = JSON.stringify(diagnostics);
  }
  if (GALAXY_RUNTIME_AUDIT) {
    document.documentElement.dataset.galaxyRuntimePerformance = JSON.stringify(
      readGalaxyRuntimePerformance()
    );
  }
  universeState.heroCompositionDebug?.update();
}

function applyGalaxyComposition(galaxyGroup, cinematicDebugEnabled) {
  const compactViewport = window.innerWidth < 700;

  if (HERO_GALAXY_VERSION_STATE.isV2) {
    galaxyGroup.position.fromArray(
      HERO_GALAXY_VERSION_CONFIG.composition.galaxyGroupPosition
    );
    galaxyGroup.scale.setScalar(
      HERO_GALAXY_VERSION_CONFIG.composition.galaxyGroupScale
    );
    return;
  }

  if (cinematicDebugEnabled) {
    galaxyGroup.position.set(-0.02, 0.16, 0);
    galaxyGroup.scale.setScalar(1.27);
    return;
  }

  galaxyGroup.position.set(
    compactViewport ? -0.3 : 0.12,
    compactViewport ? 0.04 : 0.4,
    0
  );
  galaxyGroup.scale.setScalar(compactViewport ? 1.02 : 1.42);
}

function applyMainGalaxyComposition(mainGalaxyFrame) {
  if (!mainGalaxyFrame) {
    return;
  }

  if (HERO_GALAXY_VERSION_STATE.isV2) {
    mainGalaxyFrame.position.fromArray(
      HERO_GALAXY_VERSION_CONFIG.composition.mainFramePosition
    );
    mainGalaxyFrame.scale.setScalar(
      HERO_GALAXY_VERSION_CONFIG.composition.mainFrameScale
    );
    mainGalaxyFrame.quaternion.copy(
      getHeroGalaxyMainFrameQuaternion(HERO_GALAXY_VERSION_STATE.version)
    );
  } else {
    mainGalaxyFrame.position.copy(HERO_MAIN_GALAXY_POSITION);
    mainGalaxyFrame.scale.setScalar(HERO_MAIN_GALAXY_SCALE);
    mainGalaxyFrame.quaternion.copy(HERO_MAIN_GALAXY_QUATERNION);
  }
}

function updateGalaxyVersionDiagnostics() {
  if (!universeState.energyCore) return;

  universeState.root.updateWorldMatrix(true, true);
  window.__ACTIVE_THEORY_GALAXY_VERSION__ =
    universeState.energyCore.measureVersionAlignment?.(getCamera()) ?? null;
}

export function disposeUniverseRoot() {
  if (HERO_GALAXY_VERSION_STATE.diagnostics) {
    delete window.__ACTIVE_THEORY_GALAXY_VERSION__;
  }
  if (HERO_GALAXY_VIDEO_PREVIEW) {
    delete window.__ACTIVE_THEORY_H1_VIDEO__;
    delete document.documentElement.dataset.galaxyVideoDiagnostics;
    delete document.documentElement.dataset.galaxyVideoPreview;
  }
  if (HERO_GALAXY_VIDEO_COMPOSITION) {
    delete document.documentElement.dataset.galaxyVideoComposition;
  }
  if (GALAXY_RUNTIME_AUDIT) {
    delete document.documentElement.dataset.galaxyRuntimePerformance;
  }
  universeState.heroCompositionDebug?.dispose();

  if (universeState.deepSpaceBackground) {
    universeState.deepSpaceBackground.dispose();
  }

  if (universeState.nebulaVolume) {
    universeState.nebulaVolume.dispose();
  }

  if (universeState.energyCore) {
    universeState.energyCore.dispose();
  }

  if (universeState.galaxyPlanets) {
    universeState.galaxyPlanets.dispose();
  }

  if (universeState.particleField) {
    universeState.particleField.dispose();
  }

  if (universeState.earthHorizon) {
    universeState.earthHorizon.dispose();
  }

  if (universeState.nodeSystem) {
    universeState.nodeSystem.dispose();
  }

  if (universeState.debugBackdrop) {
    universeState.debugBackdrop.geometry.dispose();
    universeState.debugBackdrop.material.dispose();
  }

  if (universeState.root) {
    universeState.root.clear();
  }

  universeState.root = null;
  universeState.galaxyGroup = null;
  universeState.mainGalaxyFrame = null;
  universeState.deepSpaceBackground = null;
  universeState.nebulaVolume = null;
  universeState.energyCore = null;
  universeState.galaxyPlanets = null;
  universeState.nodeSystem = null;
  universeState.particleField = null;
  universeState.earthHorizon = null;
  universeState.debugBackdrop = null;
  universeState.cinematicDebugSignature = null;
  universeState.scrollHintDebugState = null;
  universeState.heroCompositionDebug = null;
}

export const universeRootManager = {
  createUniverseRoot,
  updateUniverseRoot,
  disposeUniverseRoot
};

function readDebugFlag(name, fallback) {
  const params = new URLSearchParams(window.location.search);

  if (!params.has(name)) {
    return fallback;
  }

  return params.get(name) !== '0' && params.get(name) !== 'false';
}

function readGalaxyVideoPreview() {
  if (typeof window === 'undefined') return 'h1-hd';
  const params = new URLSearchParams(window.location.search);
  const version = params.get('galaxyVersion');
  const preview = params.get('galaxyVideoPreview');

  if (version === 'v24' || version === 'v1') return null;

  return preview === 'h1' || preview === 'h1-hd' ? preview : 'h1-hd';
}

function readGalaxyVideoComposition() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const version = params.get('galaxyVersion');

  if (version === 'v24' || version === 'v1') return null;

  return params.get('galaxyComposition') === 'classic' ? 'classic' : 'd';
}

function addGalaxyVideoPerformance(diagnostics) {
  if (!diagnostics) return null;

  return {
    ...diagnostics,
    performance: readGalaxyRuntimePerformance()
  };
}

function updateGalaxyRuntimePerformance(delta, journeyProgress) {
  if (delta > 0) {
    galaxyVideoPerformance.elapsed += delta;
    galaxyVideoPerformance.frames += 1;
    galaxyVideoPerformance.frameTimes.push(delta * 1000);
    if (galaxyVideoPerformance.elapsed >= 1) {
      const fps = galaxyVideoPerformance.frames / galaxyVideoPerformance.elapsed;
      const sortedFrameTimes = [...galaxyVideoPerformance.frameTimes]
        .sort((a, b) => a - b);
      const p95Index = Math.min(
        sortedFrameTimes.length - 1,
        Math.floor(sortedFrameTimes.length * 0.95)
      );

      galaxyVideoPerformance.fps = fps;
      galaxyVideoPerformance.minFps = Math.min(
        galaxyVideoPerformance.minFps ?? fps,
        fps
      );
      galaxyVideoPerformance.p95FrameMs = sortedFrameTimes[p95Index] ?? null;
      galaxyVideoPerformance.maxP95FrameMs = Math.max(
        galaxyVideoPerformance.maxP95FrameMs ?? 0,
        galaxyVideoPerformance.p95FrameMs ?? 0
      );
      if (journeyProgress > 0.01 && journeyProgress < 0.99) {
        galaxyVideoPerformance.journeyMinFps = Math.min(
          galaxyVideoPerformance.journeyMinFps ?? fps,
          fps
        );
      }
      galaxyVideoPerformance.elapsed = 0;
      galaxyVideoPerformance.frames = 0;
      galaxyVideoPerformance.frameTimes.length = 0;
    }
  }

  const memory = window.performance?.memory;
  if (memory) {
    galaxyVideoPerformance.heapCurrentBytes = memory.usedJSHeapSize;
    galaxyVideoPerformance.heapStartBytes ??= memory.usedJSHeapSize;
    galaxyVideoPerformance.heapPeakBytes = Math.max(
      galaxyVideoPerformance.heapPeakBytes ?? 0,
      memory.usedJSHeapSize
    );
  }

}

function readGalaxyRuntimePerformance() {
  const {
    frameTimes: _frameTimes,
    ...performance
  } = galaxyVideoPerformance;

  return performance;
}

function readCinematicGalaxyDebugState() {
  const params = new URLSearchParams(window.location.search);
  const cinematicEnabled = params.get('debugCinematicGalaxy') === '1';
  const shellValue = params.get('debugGalaxyShell');
  const shellDebugMode = shellValue === 'particles'
    ? 'particles'
    : shellValue === 'combined'
      ? 'combined'
      : shellValue && shellValue !== '0' && shellValue !== 'false'
        ? 'shell'
        : null;
  const enabled = cinematicEnabled || shellDebugMode !== null;
  const readLayer = (name) => !cinematicEnabled || params.get(name) !== '0';
  const layers = {
    core: readLayer('showGalaxyCore'),
    mainArms: readLayer('showGalaxyMainArms'),
    nebula: readLayer('showGalaxyNebula'),
    dust: readLayer('showGalaxyDust'),
    highlights: readLayer('showGalaxyHighlightStars')
  };
  const signature = [
    Number(enabled),
    Number(layers.core),
    Number(layers.mainArms),
    Number(layers.nebula),
    Number(layers.dust),
    Number(layers.highlights),
    shellDebugMode || 'normal'
  ].join(':');

  return { enabled, layers, shellDebugMode, signature };
}

function readEarthLayerDebugState() {
  const params = new URLSearchParams(window.location.search);
  const debugValue = params.get('debugEarthLayers');
  const enabled = debugValue !== null && debugValue !== '0' && debugValue !== 'false';
  const supportedModes = new Set([
    'surfaceOnly',
    'landOnly',
    'cityOnly',
    'cloudOnly',
    'atmosphereOnly',
    'combined'
  ]);
  const requestedMode = params.get('earthLayer')
    || (supportedModes.has(debugValue) ? debugValue : 'combined');
  const mode = supportedModes.has(requestedMode) ? requestedMode : 'combined';

  return { enabled, mode };
}

function syncCinematicGalaxyDebugState(debugState) {
  if (universeState.cinematicDebugSignature === debugState.signature) {
    return;
  }

  universeState.cinematicDebugSignature = debugState.signature;
  const debugActive = DEBUG_MAIN_GALAXY_ACTIVE || debugState.enabled;

  universeState.debugBackdrop.visible = debugActive;
  universeState.deepSpaceBackground.group.visible = debugActive
    ? false
    : HERO_DEBUG.showBackground;
  universeState.nebulaVolume.backgroundGroup.visible = debugActive
    ? false
    : HERO_DEBUG.showNebula;
  universeState.nebulaVolume.galaxyDustGroup.visible = debugActive
    ? false
    : !useCinematicGalaxy && HERO_DEBUG.showDust;
  universeState.galaxyPlanets.group.visible = debugActive
    ? false
    : HERO_DEBUG.showSubGalaxies;
  universeState.galaxyPlanets.setLabelsVisible(
    debugActive ? false : HERO_DEBUG.showLabels
  );
  universeState.particleField.points.visible = false;
  universeState.earthHorizon.group.visible = !debugActive;
  universeState.energyCore.group.visible = HERO_DEBUG.showMainGalaxy;
  universeState.energyCore.applyDebugVisibility?.(
    debugState.enabled ? debugState.layers : undefined
  );
  universeState.energyCore.applyShellDebugMode?.(debugState.shellDebugMode);
  setScrollHintDebugVisibility(debugActive);
  applyGalaxyComposition(universeState.galaxyGroup, debugState.enabled);
}

function setScrollHintDebugVisibility(debugActive) {
  if (universeState.scrollHintDebugState === debugActive) {
    return;
  }

  const scrollHint = document.querySelector('.hero-scroll-hint');

  if (scrollHint) {
    scrollHint.style.display = debugActive ? 'none' : '';
    universeState.scrollHintDebugState = debugActive;
  }
}

function createDebugBackdrop() {
  const geometry = new THREE.PlaneGeometry(120, 120);
  const material = new THREE.MeshBasicMaterial({
    color: 0x010612,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const backdrop = new THREE.Mesh(geometry, material);

  backdrop.name = 'MainGalaxyDebugBackdrop';
  backdrop.position.set(0, 0, -5);
  backdrop.renderOrder = -1000;
  return backdrop;
}

function createHeroCompositionDebug({ earth, mainGalaxyFrame, mainGalaxy }) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const targetResolutions = [
    [1920, 1080],
    [1440, 900],
    [1366, 768]
  ];

  canvas.className = 'hero-composition-debug';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '9999'
  });
  document.body.append(canvas);

  function update() {
    const camera = getCamera();

    if (!camera || !context || !earth.visible || !mainGalaxy.visible) {
      return;
    }

    earth.updateWorldMatrix(true, true);
    mainGalaxyFrame.updateWorldMatrix(true, true);
    camera.updateMatrixWorld(true);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const metrics = measureHeroComposition({
      camera,
      width,
      height,
      earth,
      mainGalaxy
    });
    const resolutions = Object.fromEntries(targetResolutions.map(([targetWidth, targetHeight]) => {
      const targetCamera = camera.clone();

      targetCamera.aspect = targetWidth / targetHeight;
      targetCamera.updateProjectionMatrix();
      targetCamera.updateMatrixWorld(true);
      return [
        `${targetWidth}x${targetHeight}`,
        measureHeroComposition({
          camera: targetCamera,
          width: targetWidth,
          height: targetHeight,
          earth,
          mainGalaxy
        })
      ];
    }));

    const debugPayload = {
      current: metrics,
      resolutions,
      transforms: {
        earth: {
          position: earth.position.toArray(),
          scale: earth.scale.x,
          quaternion: earth.quaternion.toArray()
        },
        mainGalaxy: {
          position: mainGalaxyFrame.position.toArray(),
          scale: mainGalaxyFrame.scale.x,
          quaternion: mainGalaxyFrame.quaternion.toArray()
        }
      }
    };
    window.__ACTIVE_THEORY_HERO_COMPOSITION__ = debugPayload;
    canvas.dataset.metrics = JSON.stringify(debugPayload);
    drawCompositionGuide(context, canvas, metrics, width, height);
  }

  function dispose() {
    canvas.remove();
    delete window.__ACTIVE_THEORY_HERO_COMPOSITION__;
  }

  return { update, dispose };
}

function measureHeroComposition({ camera, width, height, earth, mainGalaxy }) {
  const earthCenterWorld = earth.getWorldPosition(new THREE.Vector3());
  const mainVisual = mainGalaxy.getObjectByName('CinematicGalaxyVisual') || mainGalaxy;
  const mainCenterWorld = mainVisual.getWorldPosition(new THREE.Vector3());
  const earthCenter = projectToScreen(earthCenterWorld, camera, width, height);
  const mainCenter = projectToScreen(mainCenterWorld, camera, width, height);
  const earthBounds = projectEarthSilhouetteBounds(
    earth,
    earthCenterWorld,
    camera,
    width,
    height
  );
  const mainBounds = projectGalaxyPlaneBounds(mainVisual, camera, width, height);
  const { axisStart, axisEnd, axisAngle } = mainBounds.principalAxis;

  return {
    viewport: { width, height },
    earth: formatProjectionMetrics(earthCenter, earthBounds, width, height, true),
    mainGalaxy: {
      ...formatProjectionMetrics(mainCenter, mainBounds, width, height, false),
      axisAngle,
      axisStart,
      axisEnd
    }
  };
}

function projectEarthSilhouetteBounds(earth, center, camera, width, height) {
  const worldScale = earth.getWorldScale(new THREE.Vector3());
  const radius = 1.861 * worldScale.x;
  const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const points = [];

  for (let index = 0; index < 96; index += 1) {
    const angle = index / 96 * Math.PI * 2;
    const worldPoint = center.clone()
      .addScaledVector(cameraRight, Math.cos(angle) * radius)
      .addScaledVector(cameraUp, Math.sin(angle) * radius);

    points.push(projectToScreen(worldPoint, camera, width, height));
  }

  return boundsFromProjectedPoints(points);
}

function projectGalaxyPlaneBounds(mainVisual, camera, width, height) {
  const points = [];

  for (const depth of [-0.09, 0.09]) {
    for (let index = 0; index < 128; index += 1) {
      const angle = index / 128 * Math.PI * 2;
      const localPoint = new THREE.Vector3(
        Math.cos(angle) * 0.86,
        Math.sin(angle) * 0.86,
        depth
      );

      points.push(projectToScreen(
        mainVisual.localToWorld(localPoint),
        camera,
        width,
        height
      ));
    }
  }

  return {
    ...boundsFromProjectedPoints(points),
    principalAxis: calculatePrincipalAxis(points)
  };
}

function calculatePrincipalAxis(points) {
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let covarianceXX = 0;
  let covarianceXY = 0;
  let covarianceYY = 0;

  points.forEach((point) => {
    const dx = point.x - meanX;
    const dy = point.y - meanY;

    covarianceXX += dx * dx;
    covarianceXY += dx * dy;
    covarianceYY += dy * dy;
  });
  let axisAngle = 0.5 * Math.atan2(
    2 * covarianceXY,
    covarianceXX - covarianceYY
  );
  const axisX = Math.cos(axisAngle);
  const axisY = Math.sin(axisAngle);
  const projections = points.map((point) => (
    (point.x - meanX) * axisX + (point.y - meanY) * axisY
  ));
  const minProjection = Math.min(...projections);
  const maxProjection = Math.max(...projections);

  axisAngle = THREE.MathUtils.radToDeg(axisAngle);
  if (axisAngle > 90) axisAngle -= 180;
  if (axisAngle <= -90) axisAngle += 180;
  return {
    axisAngle,
    axisStart: {
      x: meanX + axisX * minProjection,
      y: meanY + axisY * minProjection
    },
    axisEnd: {
      x: meanX + axisX * maxProjection,
      y: meanY + axisY * maxProjection
    }
  };
}

function boundsFromProjectedPoints(points) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y))
  };
}

function projectToScreen(worldPoint, camera, width, height) {
  const projected = worldPoint.clone().project(camera);

  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height
  };
}

function formatProjectionMetrics(center, bounds, width, height, clampVisible) {
  const visibleMinX = clampVisible ? Math.max(0, bounds.minX) : bounds.minX;
  const visibleMaxX = clampVisible ? Math.min(width, bounds.maxX) : bounds.maxX;
  const visibleMinY = clampVisible ? Math.max(0, bounds.minY) : bounds.minY;
  const visibleMaxY = clampVisible ? Math.min(height, bounds.maxY) : bounds.maxY;

  return {
    centerPercent: {
      x: center.x / width * 100,
      y: center.y / height * 100
    },
    widthPercent: Math.max(0, visibleMaxX - visibleMinX) / width * 100,
    heightPercent: Math.max(0, visibleMaxY - visibleMinY) / height * 100,
    bounds,
    center
  };
}

function drawCompositionGuide(context, canvas, metrics, width, height) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.clearRect(0, 0, width, height);
  context.save();
  context.font = '12px monospace';
  context.lineWidth = 1;
  context.setLineDash([7, 5]);
  context.strokeStyle = 'rgba(87, 220, 255, 0.72)';
  context.beginPath();
  context.moveTo(width * 0.38, 0);
  context.lineTo(width * 0.38, height);
  context.stroke();
  context.fillStyle = '#57dcff';
  context.fillText('38% TEXT SAFE', width * 0.38 + 8, 18);

  drawDebugBounds(context, metrics.earth, '#ffbd57', 'EARTH');
  drawDebugBounds(context, metrics.mainGalaxy, '#9b8cff', 'MAIN GALAXY');
  context.setLineDash([]);
  context.strokeStyle = '#ff6fd8';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(metrics.mainGalaxy.axisStart.x, metrics.mainGalaxy.axisStart.y);
  context.lineTo(metrics.mainGalaxy.axisEnd.x, metrics.mainGalaxy.axisEnd.y);
  context.stroke();

  const panelX = Math.max(12, width - 430);
  const panelY = Math.max(12, height - 112);

  context.fillStyle = 'rgba(1, 6, 18, 0.82)';
  context.fillRect(panelX - 10, panelY - 20, 420, 105);
  context.fillStyle = '#e7f7ff';
  context.fillText(
    `EARTH center ${metrics.earth.centerPercent.x.toFixed(1)}%, ${metrics.earth.centerPercent.y.toFixed(1)}%  visible ${metrics.earth.widthPercent.toFixed(1)}% x ${metrics.earth.heightPercent.toFixed(1)}%`,
    panelX,
    panelY
  );
  context.fillText(
    `GALAXY center ${metrics.mainGalaxy.centerPercent.x.toFixed(1)}%, ${metrics.mainGalaxy.centerPercent.y.toFixed(1)}%  bounds ${metrics.mainGalaxy.widthPercent.toFixed(1)}% x ${metrics.mainGalaxy.heightPercent.toFixed(1)}%`,
    panelX,
    panelY + 22
  );
  context.fillText(
    `GALAXY axis ${metrics.mainGalaxy.axisAngle.toFixed(1)} deg`,
    panelX,
    panelY + 44
  );
  context.restore();
}

function drawDebugBounds(context, metrics, color, label) {
  const { bounds, center } = metrics;
  const centerX = Math.min(Math.max(center.x, 6), window.innerWidth - 6);
  const centerY = Math.min(Math.max(center.y, 6), window.innerHeight - 6);

  context.setLineDash([6, 4]);
  context.strokeStyle = color;
  context.strokeRect(
    bounds.minX,
    bounds.minY,
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY
  );
  context.setLineDash([]);
  context.fillStyle = color;
  context.beginPath();
  context.arc(centerX, centerY, 4, 0, Math.PI * 2);
  context.fill();
  context.fillText(
    `${label} ${metrics.centerPercent.x.toFixed(1)}%, ${metrics.centerPercent.y.toFixed(1)}%`,
    centerX + 8,
    centerY - 8
  );
}
