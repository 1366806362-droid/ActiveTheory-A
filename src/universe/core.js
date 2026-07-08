import * as THREE from 'three';
import { applyEnergyShader, updateEnergyShader } from './energyShader.js';

const RING_PARTICLE_COUNT = 540;

export function createEnergyCore() {
  const group = new THREE.Group();
  const coreGeometry = new THREE.IcosahedronGeometry(0.82, 5);
  const coreMaterial = applyEnergyShader(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x05213d),
    emissive: new THREE.Color(0x06345f),
    emissiveIntensity: 0.55,
    metalness: 0.18,
    roughness: 0.14,
    envMapIntensity: 0.82,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.68,
    transmission: 0.2,
    thickness: 1.15,
    ior: 1.58,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  const shell = createCoreShell(coreGeometry);
  const innerCrystal = createInnerCrystal();
  const orbitParticles = createOrbitParticles();

  group.name = 'ActiveTheoryEnergyCore';
  group.position.set(-0.38, 0.08, 0);
  group.add(coreMesh, innerCrystal, shell, orbitParticles.group);

  function update(delta, time, interaction) {
    const interactionStrength = interaction?.strength ?? 0;

    updateEnergyShader(time, interactionStrength);
    const corePulse = 0.5 + Math.sin(time * 0.72) * 0.5;

    group.position.x = -0.38 + Math.sin(time * 0.12) * 0.045;
    group.position.y = 0.08 + Math.sin(time * 0.18) * 0.075;
    group.scale.setScalar(1 + Math.sin(time * 0.36) * 0.018);
    group.rotation.y += delta * 0.085;
    group.rotation.x = Math.sin(time * 0.09) * 0.045;
    coreMesh.rotation.x += delta * 0.052;
    coreMesh.rotation.y -= delta * 0.038;
    coreMesh.rotation.z -= delta * 0.032;
    coreMesh.scale.setScalar(1 + Math.sin(time * 0.58) * 0.012);
    coreMaterial.emissiveIntensity = 0.48 + corePulse * 0.18 + interactionStrength * 0.08;
    coreMaterial.clearcoatRoughness = 0.06 + (1 - corePulse) * 0.045;
    innerCrystal.rotation.y -= delta * 0.14;
    innerCrystal.rotation.x = Math.sin(time * 0.22) * 0.12;
    innerCrystal.material.emissiveIntensity = 0.42 + corePulse * 0.18 + interactionStrength * 0.12;
    shell.rotation.y -= delta * 0.065;
    shell.rotation.x = Math.sin(time * 0.18) * 0.08;
    shell.material.opacity = 0.26 + corePulse * 0.12;
    orbitParticles.update(delta, time);
  }

  function dispose() {
    coreGeometry.dispose();
    coreMaterial.dispose();
    innerCrystal.geometry.dispose();
    innerCrystal.material.dispose();
    shell.geometry.dispose();
    shell.material.dispose();
    orbitParticles.dispose();
  }

  return {
    group,
    update,
    dispose
  };
}

function createInnerCrystal() {
  const geometry = new THREE.OctahedronGeometry(0.48, 2);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x073862,
    emissive: 0x0088cc,
    emissiveIntensity: 0.48,
    metalness: 0.05,
    roughness: 0.2,
    envMapIntensity: 0.65,
    transparent: true,
    opacity: 0.42,
    transmission: 0.28,
    thickness: 0.7,
    ior: 1.62,
    depthWrite: false
  });
  const crystal = new THREE.Mesh(geometry, material);

  crystal.scale.set(0.72, 1.18, 0.72);

  return crystal;
}

function createCoreShell(coreGeometry) {
  const shellGeometry = new THREE.EdgesGeometry(coreGeometry, 24);
  const shellMaterial = new THREE.LineBasicMaterial({
    color: 0x00d5ff,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const shell = new THREE.LineSegments(shellGeometry, shellMaterial);

  shell.scale.setScalar(1.045);

  return shell;
}

function createOrbitParticles() {
  const group = new THREE.Group();
  const rings = [
    createOrbitParticleLayer(RING_PARTICLE_COUNT * 0.42, 1.28, 0.32, 0.26, [0.22, 0.02, -0.18], 0.12),
    createOrbitParticleLayer(RING_PARTICLE_COUNT * 0.34, 1.62, 0.5, 0.2, [-0.22, 0.5, 0.24], -0.08),
    createOrbitParticleLayer(RING_PARTICLE_COUNT * 0.24, 1.98, 0.26, 0.14, [0.58, -0.18, 0.42], 0.055)
  ];

  rings.forEach((ring) => {
    group.add(ring.points);
  });

  function update(delta, time) {
    rings.forEach((ring, index) => {
      ring.update(delta, time, index);
    });
  }

  function dispose() {
    rings.forEach((ring) => {
      ring.dispose();
    });
  }

  return {
    group,
    update,
    dispose
  };
}

function createOrbitParticleLayer(count, radius, zScale, opacity, rotation, speed) {
  const particleCount = Math.floor(count);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const color = new THREE.Color();
  const coldBlue = new THREE.Color(0x0088ff);
  const cyan = new THREE.Color(0x00f0ff);
  let written = 0;

  for (let i = 0; i < particleCount; i += 1) {
    const angle = (i / particleCount) * Math.PI * 2;
    const breakPattern = Math.sin(angle * 4.0 + radius * 1.7) + Math.sin(angle * 9.0);

    if (breakPattern < -0.25 || (i % 13 === 0)) {
      continue;
    }

    const i3 = written * 3;
    const radiusJitter = Math.sin(i * 12.9898) * 0.055;
    const layerRadius = radius + radiusJitter;
    const height = Math.sin(angle * 3.0 + radius) * 0.13;

    positions[i3] = Math.cos(angle) * layerRadius;
    positions[i3 + 1] = height;
    positions[i3 + 2] = Math.sin(angle) * layerRadius * zScale;

    color.copy(coldBlue).lerp(cyan, 0.25 + Math.abs(Math.sin(angle * 2.0)) * 0.45);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
    written += 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, written * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, written * 3), 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.021,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.rotation.set(rotation[0], rotation[1], rotation[2]);

  function update(delta, time, index) {
    points.rotation.y += delta * speed;
    points.rotation.x = rotation[0] + Math.sin(time * (0.13 + index * 0.04)) * 0.035;
    points.rotation.z = rotation[2] + Math.sin(time * (0.16 + index * 0.03)) * 0.04;
    material.opacity = opacity + Math.sin(time * (0.52 + index * 0.1)) * 0.025;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose
  };
}

export const energyCoreManager = {
  createEnergyCore
};
