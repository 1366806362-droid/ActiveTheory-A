import * as THREE from 'three';
import { createCinematicGalaxy } from './cinematicGalaxy.js';
import { createEnergyCore } from './core.js';
import { createDeepSpaceBackground } from './deepSpaceBackground.js';
import { createEarthHorizon } from './earthHorizon.js';
import { createGalaxyPlanets } from './galaxyPlanets.js';
import { getInteractionState } from './interaction.js';
import { createNebulaVolume } from './nebulaVolume.js';
import { createNodeSystem } from './nodeSystem.js';
import { createParticleField } from './particleField.js';

const DEBUG_MAIN_GALAXY_ONLY = readDebugFlag('debugMainGalaxyOnly', false);
const DEBUG_MAIN_GALAXY_RENDER = readDebugFlag('debugMainGalaxyRender', false);
const DEBUG_MAIN_GALAXY_ACTIVE = DEBUG_MAIN_GALAXY_ONLY
  || DEBUG_MAIN_GALAXY_RENDER;
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
  freezeHeroMotion: DEBUG_MAIN_GALAXY_ACTIVE || readDebugFlag('freezeHeroMotion', false)
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
  deepSpaceBackground: null,
  nebulaVolume: null,
  energyCore: null,
  galaxyPlanets: null,
  nodeSystem: null,
  particleField: null,
  earthHorizon: null,
  debugBackdrop: null,
  cinematicDebugSignature: null,
  scrollHintDebugState: null
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
  const cinematicDebug = readCinematicGalaxyDebugState();
  const debugActive = DEBUG_MAIN_GALAXY_ACTIVE || cinematicDebug.enabled;
  const root = new THREE.Group();
  const nebulaVolume = createNebulaVolume();
  const deepSpaceBackground = createDeepSpaceBackground(nebulaVolume);
  const energyCore = useCinematicGalaxy
    ? createCinematicGalaxy({
      debugVisibility: cinematicDebug.layers,
      shellDebugMode: cinematicDebug.shellDebugMode
    })
    : createEnergyCore();
  const galaxyPlanets = createGalaxyPlanets();
  const galaxyGroup = new THREE.Group();
  const nodeSystem = createNodeSystem();
  const particleField = createParticleField();
  const earthHorizon = createEarthHorizon();
  const debugBackdrop = createDebugBackdrop();

  root.name = 'ActiveTheoryUniverseRoot';
  galaxyGroup.name = 'HeroBrandGalaxyComposition';
  applyGalaxyComposition(galaxyGroup, cinematicDebug.enabled);
  if (!useCinematicGalaxy) {
    energyCore.group.add(nebulaVolume.galaxyDustGroup);
  }
  galaxyGroup.add(galaxyPlanets.group, energyCore.group);
  nodeSystem.group.visible = false;
  deepSpaceBackground.group.visible = debugActive ? false : HERO_DEBUG.showBackground;
  nebulaVolume.backgroundGroup.visible = debugActive ? false : HERO_DEBUG.showNebula;
  nebulaVolume.galaxyDustGroup.visible = debugActive
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
      coreNebula.visible = HERO_DEBUG.showGlow;
    }
  }
  energyCore.group.visible = HERO_DEBUG.showMainGalaxy;
  galaxyPlanets.group.visible = debugActive ? false : HERO_DEBUG.showSubGalaxies;
  galaxyPlanets.setLabelsVisible(debugActive ? false : HERO_DEBUG.showLabels);
  particleField.points.visible = false;
  earthHorizon.group.visible = !debugActive;
  debugBackdrop.visible = debugActive;
  root.add(debugBackdrop);

  root.add(deepSpaceBackground.group, particleField.points, earthHorizon.group, galaxyGroup);

  universeState.root = root;
  universeState.galaxyGroup = galaxyGroup;
  universeState.deepSpaceBackground = deepSpaceBackground;
  universeState.nebulaVolume = nebulaVolume;
  universeState.energyCore = energyCore;
  universeState.galaxyPlanets = galaxyPlanets;
  universeState.nodeSystem = nodeSystem;
  universeState.particleField = particleField;
  universeState.earthHorizon = earthHorizon;
  universeState.debugBackdrop = debugBackdrop;
  universeState.cinematicDebugSignature = cinematicDebug.signature;
  setScrollHintDebugVisibility(debugActive);

  return {
    root,
    galaxyGroup,
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

  const cinematicDebug = readCinematicGalaxyDebugState();

  syncCinematicGalaxyDebugState(cinematicDebug);
  const debugActive = DEBUG_MAIN_GALAXY_ACTIVE || cinematicDebug.enabled;

  setScrollHintDebugVisibility(debugActive);

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
    universeState.root.rotation.set(0, 0, 0);
    universeState.root.position.set(0, 0, 0);
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
  universeState.earthHorizon.update(motionDelta, motionTime);
  universeState.galaxyPlanets.update(motionDelta, motionTime, interaction);
  universeState.energyCore.update(motionDelta, motionTime, interaction, journeyProgress);
  applyGalaxyComposition(universeState.galaxyGroup, false);
  universeState.root.rotation.y = Math.sin(motionTime * 0.008) * 0.008;
  universeState.root.position.x = interaction.parallaxX * 0.04;
  universeState.root.position.y = interaction.parallaxY * 0.025;
}

function applyGalaxyComposition(galaxyGroup, cinematicDebugEnabled) {
  const compactViewport = window.innerWidth < 700;

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

export function disposeUniverseRoot() {
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
