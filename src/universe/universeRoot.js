import * as THREE from 'three';
import { createEnergyCore } from './core.js';
import { createDeepSpaceBackground } from './deepSpaceBackground.js';
import { createGalaxyPlanets } from './galaxyPlanets.js';
import { getInteractionState } from './interaction.js';
import { createNebulaVolume } from './nebulaVolume.js';
import { createNodeSystem } from './nodeSystem.js';
import { createParticleField } from './particleField.js';

const DEBUG_MAIN_GALAXY_ONLY = readDebugFlag('debugMainGalaxyOnly', false);
const HERO_DEBUG = Object.freeze({
  showBackground: DEBUG_MAIN_GALAXY_ONLY ? false : readDebugFlag('showBackground', true),
  showMainGalaxy: readDebugFlag('showMainGalaxy', true),
  showMainGalaxyArms: readDebugFlag('showMainGalaxyArms', true),
  showMainGalaxyCore: readDebugFlag(
    'showMainGalaxyCore',
    readDebugFlag('showMainCoreCluster', true)
  ),
  showSubGalaxies: DEBUG_MAIN_GALAXY_ONLY ? false : readDebugFlag('showSubGalaxies', true),
  showNebula: DEBUG_MAIN_GALAXY_ONLY ? false : readDebugFlag('showNebula', true),
  showDust: DEBUG_MAIN_GALAXY_ONLY ? false : readDebugFlag('showDust', true),
  showGlow: DEBUG_MAIN_GALAXY_ONLY ? false : readDebugFlag('showGlow', true),
  showLabels: DEBUG_MAIN_GALAXY_ONLY ? false : readDebugFlag('showLabels', true),
  freezeHeroMotion: DEBUG_MAIN_GALAXY_ONLY || readDebugFlag('freezeHeroMotion', false)
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
  debugBackdrop: null
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
  const root = new THREE.Group();
  const nebulaVolume = createNebulaVolume();
  const deepSpaceBackground = createDeepSpaceBackground(nebulaVolume);
  const energyCore = createEnergyCore();
  const galaxyPlanets = createGalaxyPlanets();
  const galaxyGroup = new THREE.Group();
  const nodeSystem = createNodeSystem();
  const particleField = createParticleField();
  const debugBackdrop = DEBUG_MAIN_GALAXY_ONLY ? createDebugBackdrop() : null;

  root.name = 'ActiveTheoryUniverseRoot';
  galaxyGroup.name = 'HeroBrandGalaxyComposition';
  applyGalaxyComposition(galaxyGroup);
  energyCore.group.add(nebulaVolume.galaxyDustGroup);
  galaxyGroup.add(galaxyPlanets.group, energyCore.group);
  nodeSystem.group.visible = false;
  deepSpaceBackground.group.visible = HERO_DEBUG.showBackground;
  nebulaVolume.backgroundGroup.visible = HERO_DEBUG.showNebula;
  nebulaVolume.galaxyDustGroup.visible = HERO_DEBUG.showDust;
  energyCore.layers.arms.visible = HERO_DEBUG.showMainGalaxyArms;
  energyCore.layers.dust.visible = HERO_DEBUG.showDust;
  energyCore.layers.core.visible = HERO_DEBUG.showMainGalaxyCore;
  const coreNebula = energyCore.layers.core.getObjectByName('GalaxyCoreSoftNebula');

  if (coreNebula) {
    coreNebula.visible = HERO_DEBUG.showGlow;
  }
  energyCore.group.visible = HERO_DEBUG.showMainGalaxy;
  galaxyPlanets.group.visible = HERO_DEBUG.showSubGalaxies;
  galaxyPlanets.setLabelsVisible(HERO_DEBUG.showLabels);
  particleField.points.visible = false;
  if (debugBackdrop) {
    root.add(debugBackdrop);
  }

  root.add(deepSpaceBackground.group, particleField.points, galaxyGroup);

  universeState.root = root;
  universeState.galaxyGroup = galaxyGroup;
  universeState.deepSpaceBackground = deepSpaceBackground;
  universeState.nebulaVolume = nebulaVolume;
  universeState.energyCore = energyCore;
  universeState.galaxyPlanets = galaxyPlanets;
  universeState.nodeSystem = nodeSystem;
  universeState.particleField = particleField;
  universeState.debugBackdrop = debugBackdrop;

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

  const liveInteraction = getInteractionState();
  const interaction = HERO_DEBUG.freezeHeroMotion ? frozenInteraction : liveInteraction;
  const motionDelta = HERO_DEBUG.freezeHeroMotion ? 0 : delta;
  const motionTime = HERO_DEBUG.freezeHeroMotion ? 0 : time;

  if (DEBUG_MAIN_GALAXY_ONLY) {
    renderState.backgroundColor = '#04122f';
    renderState.fogColor = '#04122f';
  }

  mouseParallaxState.x = interaction.parallaxX;
  mouseParallaxState.y = interaction.parallaxY;
  backgroundUpdateState.delta = motionDelta;
  backgroundUpdateState.time = motionTime;
  backgroundUpdateState.cameraPosition = renderState.cameraPosition;
  backgroundUpdateState.journeyProgress = journeyProgress;
  backgroundUpdateState.exposureMultiplier = renderState.exposure;
  universeState.deepSpaceBackground.update(backgroundUpdateState);
  universeState.nebulaVolume.update(motionDelta, motionTime, interaction, journeyProgress);
  universeState.galaxyPlanets.update(motionDelta, motionTime, interaction);
  universeState.energyCore.update(motionDelta, motionTime, interaction);
  applyGalaxyComposition(universeState.galaxyGroup);
  universeState.root.rotation.y = Math.sin(motionTime * 0.008) * 0.008;
  universeState.root.position.x = interaction.parallaxX * 0.04;
  universeState.root.position.y = interaction.parallaxY * 0.025;
}

function applyGalaxyComposition(galaxyGroup) {
  const compactViewport = window.innerWidth < 700;

  galaxyGroup.position.set(
    compactViewport ? -0.3 : 0.5,
    compactViewport ? 0.04 : 0.4,
    0
  );
  galaxyGroup.scale.setScalar(compactViewport ? 1.02 : 1.56);
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
  universeState.debugBackdrop = null;
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

function createDebugBackdrop() {
  const geometry = new THREE.PlaneGeometry(30, 18);
  const material = new THREE.MeshBasicMaterial({
    color: 0x04122f,
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
