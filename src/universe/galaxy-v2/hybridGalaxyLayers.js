import * as THREE from 'three';
import { createGalaxyArmVolumeMaterial } from './galaxyArmVolumeMaterial.js';
import { createGalaxyCoreVolumeMaterial } from './galaxyCoreVolumeMaterial.js';
import { GPU_GALAXY_HYBRID_CONFIG } from './galaxyHybridConfig.js';
import { GPU_GALAXY_V2_ARM_PROFILES } from './galaxyV2Config.js';

export function createHybridGalaxyLayers(galaxyConfig, hybridConfig = GPU_GALAXY_HYBRID_CONFIG) {
  const group = new THREE.Group();
  const armGeometry = createHybridGalaxyArmGeometry(galaxyConfig, hybridConfig);
  const armMaterial = createGalaxyArmVolumeMaterial(hybridConfig.armOpacity);
  const coreGeometry = new THREE.IcosahedronGeometry(1, hybridConfig.coreDetail);
  const coreMaterial = createGalaxyCoreVolumeMaterial(hybridConfig.coreOpacity);
  const arms = new THREE.Mesh(armGeometry, armMaterial);
  const core = new THREE.Mesh(coreGeometry, coreMaterial);

  group.name = 'GpuGalaxyV2HybridLayers';
  arms.name = 'GpuGalaxyV2VolumetricArms';
  core.name = 'GpuGalaxyV2VolumetricCore';
  arms.renderOrder = 1;
  core.renderOrder = 2;
  arms.frustumCulled = false;
  core.scale.fromArray(hybridConfig.coreScale);
  group.add(arms, core);

  function update(time, journeyOpacity) {
    armMaterial.uniforms.uTime.value = time;
    armMaterial.uniforms.uJourneyOpacity.value = journeyOpacity;
    coreMaterial.uniforms.uTime.value = time;
    coreMaterial.uniforms.uJourneyOpacity.value = journeyOpacity;
  }

  function dispose() {
    armGeometry.dispose();
    coreGeometry.dispose();
    armMaterial.dispose();
    coreMaterial.dispose();
    group.clear();
  }

  return {
    group,
    arms,
    core,
    update,
    dispose,
    drawCalls: hybridConfig.addedDrawCalls
  };
}

export function createHybridGalaxyArmGeometry(galaxyConfig, hybridConfig = GPU_GALAXY_HYBRID_CONFIG) {
  const positions = [];
  const armUvs = [];
  const radii = [];
  const armIndices = [];
  const indices = [];
  const layers = [-1, 1];
  const verticesPerRow = hybridConfig.armWidthSegments + 1;

  for (const armIndex of hybridConfig.primaryArmIndices) {
    const profile = GPU_GALAXY_V2_ARM_PROFILES[armIndex];
    const innerRadius = galaxyConfig.coreRadius * 0.54;

    for (const layer of layers) {
      const vertexStart = positions.length / 3;

      for (let segment = 0; segment <= hybridConfig.armSegments; segment += 1) {
        const progress = segment / hybridConfig.armSegments;
        const radius = innerRadius + (profile.reach - innerRadius) * progress;
        const angle = getArmAngle(profile, progress, galaxyConfig)
          + Math.sin(radius * 9.4 + armIndex) * 0.035;
        const nextProgress = Math.min(1, progress + 0.002);
        const nextRadius = innerRadius + (profile.reach - innerRadius) * nextProgress;
        const nextAngle = getArmAngle(profile, nextProgress, galaxyConfig)
          + Math.sin(nextRadius * 9.4 + armIndex) * 0.035;
        const centerX = Math.cos(angle) * radius;
        const centerY = Math.sin(angle) * radius;
        const tangentX = Math.cos(nextAngle) * nextRadius - centerX;
        const tangentY = Math.sin(nextAngle) * nextRadius - centerY;
        const tangentLength = Math.max(Math.hypot(tangentX, tangentY), 1e-5);
        const normalX = -tangentY / tangentLength;
        const normalY = tangentX / tangentLength;
        const widthEnvelope = 0.034 + Math.sin(progress * Math.PI) * 0.055 + progress * 0.018;
        const width = widthEnvelope * profile.widthScale;
        const thickness = (0.022 + Math.sin(progress * Math.PI) * 0.028) * profile.zScale;
        const sideDepth = Math.sin(angle + 0.28) * mix(0.036, 0.014, progress) * profile.zScale;

        for (let lane = 0; lane <= hybridConfig.armWidthSegments; lane += 1) {
          const lateral = lane / hybridConfig.armWidthSegments * 2 - 1;
          const dome = Math.sqrt(Math.max(0, 1 - lateral * lateral));
          positions.push(
            centerX + normalX * lateral * width,
            centerY + normalY * lateral * width,
            sideDepth + layer * dome * thickness
          );
          armUvs.push(progress, lateral);
          radii.push(radius);
          armIndices.push(armIndex);
        }
      }

      for (let segment = 0; segment < hybridConfig.armSegments; segment += 1) {
        for (let lane = 0; lane < hybridConfig.armWidthSegments; lane += 1) {
          const current = vertexStart + segment * verticesPerRow + lane;
          const next = current + verticesPerRow;
          if (layer > 0) indices.push(current, next, current + 1, current + 1, next, next + 1);
          else indices.push(current, current + 1, next, current + 1, next + 1, next);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aArmUv', new THREE.Float32BufferAttribute(armUvs, 2));
  geometry.setAttribute('aRadius', new THREE.Float32BufferAttribute(radii, 1));
  geometry.setAttribute('aArmIndex', new THREE.Float32BufferAttribute(armIndices, 1));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
  return geometry;
}

function getArmAngle(profile, progress, config) {
  return profile.phase + Math.log1p(Math.max(progress, 0) * 7) * config.turns * 1.82;
}

function mix(start, end, amount) {
  return start + (end - start) * Math.min(Math.max(amount, 0), 1);
}
