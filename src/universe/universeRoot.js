import * as THREE from 'three';
import { createAtmosphereLayer } from './atmosphereLayer.js';
import { createEnergyCore } from './core.js';
import { getInteractionState } from './interaction.js';
import { createParticleField } from './particleField.js';

const universeState = {
  root: null,
  atmosphereLayer: null,
  energyCore: null,
  particleField: null
};

export function createUniverseRoot() {
  const root = new THREE.Group();
  const atmosphereLayer = createAtmosphereLayer();
  const energyCore = createEnergyCore();
  const particleField = createParticleField();

  root.name = 'ActiveTheoryUniverseRoot';
  root.add(atmosphereLayer.points, particleField.points, energyCore.group);

  universeState.root = root;
  universeState.atmosphereLayer = atmosphereLayer;
  universeState.energyCore = energyCore;
  universeState.particleField = particleField;

  return {
    root,
    atmosphereLayer,
    energyCore,
    particleCount: particleField.count,
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
  universeState.energyCore.update(delta, time, interaction);
  universeState.root.rotation.y = Math.sin(time * 0.025) * 0.035;
  universeState.root.position.x = interaction.x * 0.06;
  universeState.root.position.y = interaction.y * 0.035;
}

export function disposeUniverseRoot() {
  if (universeState.atmosphereLayer) {
    universeState.atmosphereLayer.dispose();
  }

  if (universeState.energyCore) {
    universeState.energyCore.dispose();
  }

  if (universeState.particleField) {
    universeState.particleField.dispose();
  }

  if (universeState.root) {
    universeState.root.clear();
  }

  universeState.root = null;
  universeState.atmosphereLayer = null;
  universeState.energyCore = null;
  universeState.particleField = null;
}

export const universeRootManager = {
  createUniverseRoot,
  updateUniverseRoot,
  disposeUniverseRoot
};
