import * as THREE from 'three';
import { createAtmosphereLayer } from './atmosphereLayer.js';
import { createEnergyCore } from './core.js';
import { createGalaxyPlanets } from './galaxyPlanets.js';
import { getInteractionState } from './interaction.js';
import { createNodeSystem } from './nodeSystem.js';
import { createParticleField } from './particleField.js';

const universeState = {
  root: null,
  atmosphereLayer: null,
  energyCore: null,
  galaxyPlanets: null,
  nodeSystem: null,
  particleField: null
};

export function createUniverseRoot() {
  const root = new THREE.Group();
  const atmosphereLayer = createAtmosphereLayer();
  const energyCore = createEnergyCore();
  const galaxyPlanets = createGalaxyPlanets();
  const nodeSystem = createNodeSystem();
  const particleField = createParticleField();

  root.name = 'ActiveTheoryUniverseRoot';
  nodeSystem.group.visible = false;
  root.add(atmosphereLayer.points, particleField.points, galaxyPlanets.group, energyCore.group);

  universeState.root = root;
  universeState.atmosphereLayer = atmosphereLayer;
  universeState.energyCore = energyCore;
  universeState.galaxyPlanets = galaxyPlanets;
  universeState.nodeSystem = nodeSystem;
  universeState.particleField = particleField;

  return {
    root,
    atmosphereLayer,
    energyCore,
    galaxyPlanets,
    nodeSystem,
    particleCount: particleField.count,
    getPlanetWorldPosition(name, target) {
      return galaxyPlanets.getPlanetWorldPosition(name, target);
    },
    update: updateUniverseRoot,
    dispose: disposeUniverseRoot
  };
}

export function updateUniverseRoot(renderState, delta, time) {
  if (!universeState.root || !universeState.particleField) {
    return;
  }

  const interaction = getInteractionState();

  universeState.atmosphereLayer.update(delta, time);
  universeState.particleField.update(delta, time, interaction);
  universeState.galaxyPlanets.update(delta, time);
  universeState.energyCore.update(delta, time, interaction);
  universeState.root.rotation.y = Math.sin(time * 0.025) * 0.035;
  universeState.root.position.x = interaction.parallaxX * 0.06;
  universeState.root.position.y = interaction.parallaxY * 0.035;
}

export function disposeUniverseRoot() {
  if (universeState.atmosphereLayer) {
    universeState.atmosphereLayer.dispose();
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

  if (universeState.root) {
    universeState.root.clear();
  }

  universeState.root = null;
  universeState.atmosphereLayer = null;
  universeState.energyCore = null;
  universeState.galaxyPlanets = null;
  universeState.nodeSystem = null;
  universeState.particleField = null;
}

export const universeRootManager = {
  createUniverseRoot,
  updateUniverseRoot,
  disposeUniverseRoot
};
