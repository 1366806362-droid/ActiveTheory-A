import * as THREE from 'three';
import { GPU_GALAXY_V2_CONFIG } from './galaxyV2Config.js';
import { createGpuGalaxyGeometry } from './gpuGalaxyGeometry.js';
import {
  createGpuGalaxyDustMaterial,
  createGpuGalaxyStarMaterial
} from './gpuGalaxyMaterial.js';
import { readGpuGalaxyHybridState } from './galaxyHybridConfig.js';
import { createHybridGalaxyLayers } from './hybridGalaxyLayers.js';

export function createGpuGalaxy(config = GPU_GALAXY_V2_CONFIG) {
  const group = new THREE.Group();
  const geometry = createGpuGalaxyGeometry(config);
  const starMaterial = createGpuGalaxyStarMaterial();
  const dustMaterial = createGpuGalaxyDustMaterial();
  const stars = new THREE.Points(geometry.starGeometry, starMaterial);
  const dust = new THREE.Points(geometry.dustGeometry, dustMaterial);
  const hybridState = readGpuGalaxyHybridState();
  const hybrid = hybridState.enabled ? createHybridGalaxyLayers(config) : null;
  starMaterial.uniforms.uHybridMix.value = hybrid ? 1 : 0;

  group.name = 'GpuProceduralGalaxyV2';
  group.position.fromArray(config.composition.position);
  group.rotation.fromArray(config.composition.rotation);
  group.scale.setScalar(config.composition.scale);
  stars.name = 'GpuGalaxyV2Stars';
  dust.name = 'GpuGalaxyV2DustLanes';
  stars.frustumCulled = false;
  dust.frustumCulled = false;
  stars.renderOrder = 3;
  dust.renderOrder = 4;
  group.add(...(hybrid ? [hybrid.group] : []), stars, dust);

  const diagnostics = Object.freeze({
    enabled: true,
    particleCount: geometry.counts.total,
    counts: geometry.counts,
    armCount: config.armCount,
    drawCalls: 2 + (hybrid?.drawCalls ?? 0),
    hybridEnabled: hybridState.enabled,
    hybridDrawCalls: hybrid?.drawCalls ?? 0,
    usesBloom: true,
    motion: 'GPU vertex shader differential rotation',
    instanceUuid: group.uuid
  });
  publishDiagnostics(diagnostics);

  function update(_delta, time, interaction, journeyProgress = 0) {
    const journeyOpacity = 1 - smootherstep(0.28, 0.78, journeyProgress) * 0.95;
    const parallaxX = interaction?.parallaxX ?? 0;
    const parallaxY = interaction?.parallaxY ?? 0;

    updateMaterial(starMaterial, time, parallaxX, parallaxY, journeyOpacity);
    updateMaterial(dustMaterial, time, parallaxX, parallaxY, journeyOpacity);
    hybrid?.update(time, journeyOpacity);
  }

  function dispose() {
    geometry.starGeometry.dispose();
    geometry.dustGeometry.dispose();
    starMaterial.dispose();
    dustMaterial.dispose();
    hybrid?.dispose();
    group.clear();
    if (typeof window !== 'undefined'
      && window.__ACTIVE_THEORY_GPU_GALAXY_V2__?.instanceUuid === group.uuid) {
      delete window.__ACTIVE_THEORY_GPU_GALAXY_V2__;
      delete document.documentElement.dataset.gpuGalaxyV2;
    }
  }

  return {
    group,
    stars,
    dust,
    hybrid,
    update,
    dispose,
    diagnostics,
    particleCount: geometry.counts.total,
    drawCalls: diagnostics.drawCalls
  };
}

function updateMaterial(material, time, parallaxX, parallaxY, journeyOpacity) {
  material.uniforms.uTime.value = time;
  material.uniforms.uParallax.value.set(parallaxX, parallaxY);
  material.uniforms.uJourneyOpacity.value = journeyOpacity;
}

function publishDiagnostics(diagnostics) {
  if (typeof window === 'undefined') return;

  window.__ACTIVE_THEORY_GPU_GALAXY_V2__ = diagnostics;
  document.documentElement.dataset.gpuGalaxyV2 = JSON.stringify(diagnostics);
}

function smootherstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
