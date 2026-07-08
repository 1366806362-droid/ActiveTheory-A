import * as THREE from 'three';
import { applyEnergyShader, updateEnergyShader } from './energyShader.js';

const RING_PARTICLE_COUNT = 540;

export function createEnergyCore() {
  const group = new THREE.Group();
  const coreGeometry = new THREE.IcosahedronGeometry(0.82, 5);
  const coreMaterial = applyEnergyShader(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x05213d),
    emissive: new THREE.Color(0x052d54),
    emissiveIntensity: 0.36,
    metalness: 0.18,
    roughness: 0.14,
    envMapIntensity: 0.82,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.54,
    transmission: 0.2,
    thickness: 1.15,
    ior: 1.58,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  const outerGlass = createOuterGlassLayer();
  const shell = createCoreShell(coreGeometry);
  const innerCrystal = createInnerCrystal();
  const orbitParticles = createOrbitParticles();

  group.name = 'ActiveTheoryEnergyCore';
  group.position.set(-0.32, 0.12, 0);
  group.add(outerGlass, coreMesh, innerCrystal, shell, orbitParticles.group);

  function update(delta, time, interaction) {
    const interactionProximity = interaction?.proximity ?? 0;

    updateEnergyShader(time, interaction);
    const corePulse = 0.5 + Math.sin(time * 0.72) * 0.5;

    const heroPulse = Math.sin(time * 0.42) * 0.5 + 0.5;

    group.position.x = -0.32 + Math.sin(time * 0.1) * 0.038;
    group.position.y = 0.12 + Math.sin(time * 0.16) * 0.065;
    group.scale.setScalar(1.045 + Math.sin(time * 0.24) * 0.02 + heroPulse * 0.006 + interactionProximity * 0.018);
    group.rotation.y += delta * 0.058;
    group.rotation.x = Math.sin(time * 0.075) * 0.038;
    coreMesh.rotation.x += delta * 0.046;
    coreMesh.rotation.y -= delta * 0.032;
    coreMesh.rotation.z -= delta * 0.026;
    coreMesh.scale.setScalar(1 + Math.sin(time * 0.46) * 0.014 + heroPulse * 0.008);
    outerGlass.rotation.y -= delta * 0.022;
    outerGlass.rotation.z = Math.sin(time * 0.11) * 0.08;
    outerGlass.scale.setScalar(1.08 + heroPulse * 0.018 + interactionProximity * 0.018);
    outerGlass.material.opacity = 0.12 + corePulse * 0.035 + interactionProximity * 0.025;
    coreMaterial.emissiveIntensity = 0.36 + corePulse * 0.14 + heroPulse * 0.07 + interactionProximity * 0.16;
    coreMaterial.clearcoatRoughness = 0.06 + (1 - corePulse) * 0.045 - interactionProximity * 0.018;
    coreMaterial.opacity = 0.52 + heroPulse * 0.03 + interactionProximity * 0.04;
    innerCrystal.rotation.y -= delta * 0.22;
    innerCrystal.rotation.x = Math.sin(time * 0.24) * 0.14;
    innerCrystal.material.emissiveIntensity = 0.86 + corePulse * 0.4 + heroPulse * 0.22 + interactionProximity * 0.26;
    shell.rotation.y -= delta * 0.082;
    shell.rotation.x = Math.sin(time * 0.16) * 0.07;
    shell.scale.setScalar(1.05 + interactionProximity * 0.055 + corePulse * 0.012 + heroPulse * 0.006);
    shell.material.opacity = 0.16 + corePulse * 0.07 + interactionProximity * 0.12;
    orbitParticles.update(delta, time, interactionProximity);
  }

  function dispose() {
    coreGeometry.dispose();
    coreMaterial.dispose();
    outerGlass.geometry.dispose();
    outerGlass.material.dispose();
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

function createOuterGlassLayer() {
  const geometry = new THREE.IcosahedronGeometry(0.9, 3);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x031a31,
    emissive: 0x003f68,
    emissiveIntensity: 0.18,
    metalness: 0.05,
    roughness: 0.08,
    envMapIntensity: 0.95,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.13,
    transmission: 0.34,
    thickness: 1.55,
    ior: 1.66,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return new THREE.Mesh(geometry, material);
}

function createInnerCrystal() {
  const geometry = new THREE.OctahedronGeometry(0.48, 2);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x073862,
    emissive: 0x0088cc,
    emissiveIntensity: 0.7,
    metalness: 0.05,
    roughness: 0.2,
    envMapIntensity: 0.65,
    transparent: true,
    opacity: 0.58,
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
  const tracks = [
    createOrbitTrackLayer(1.38, 0.28, [0.28, -0.08, -0.22], 0.18, 0.046, 0x1b7dff),
    createOrbitTrackLayer(1.82, 0.44, [-0.16, 0.58, 0.2], 0.42, -0.032, 0x00d5ff),
    createOrbitTrackLayer(2.24, 0.24, [0.52, -0.14, 0.5], 0.68, 0.022, 0x8df7ff)
  ];
  const rings = [
    createOrbitParticleLayer(RING_PARTICLE_COUNT * 0.42, 1.38, 0.28, 0.16, [0.28, -0.08, -0.22], 0.046, 0.18, 0.08, 0x1b7dff),
    createOrbitParticleLayer(RING_PARTICLE_COUNT * 0.34, 1.82, 0.44, 0.12, [-0.16, 0.58, 0.2], -0.032, 0.42, -0.058, 0x00d5ff),
    createOrbitParticleLayer(RING_PARTICLE_COUNT * 0.24, 2.24, 0.24, 0.09, [0.52, -0.14, 0.5], 0.022, 0.68, 0.036, 0x8df7ff)
  ];
  const nodes = [
    createOrbitNodeLayer(4, 1.38, 0.28, [0.28, -0.08, -0.22], 0.08, 0.18, 0x1b7dff),
    createOrbitNodeLayer(3, 1.82, 0.44, [-0.16, 0.58, 0.2], -0.058, 0.42, 0x00d5ff),
    createOrbitNodeLayer(3, 2.24, 0.24, [0.52, -0.14, 0.5], 0.036, 0.68, 0x8df7ff),
    createOrbitNodeLayer(2, 2.42, 0.34, [0.1, 0.22, -0.42], 0.028, 0.9, 0xf2feff)
  ];

  tracks.forEach((track) => {
    group.add(track.lines);
  });
  rings.forEach((ring) => {
    group.add(ring.points);
  });
  nodes.forEach((nodeLayer) => {
    group.add(nodeLayer.points);
  });

  function update(delta, time, interactionProximity) {
    tracks.forEach((track, index) => {
      track.update(delta, time, index, interactionProximity);
    });
    rings.forEach((ring, index) => {
      ring.update(delta, time, index, interactionProximity);
    });
    nodes.forEach((nodeLayer, index) => {
      nodeLayer.update(delta, time, index, interactionProximity);
    });
  }

  function dispose() {
    tracks.forEach((track) => {
      track.dispose();
    });
    rings.forEach((ring) => {
      ring.dispose();
    });
    nodes.forEach((nodeLayer) => {
      nodeLayer.dispose();
    });
  }

  return {
    group,
    update,
    dispose
  };
}

function createOrbitTrackLayer(radius, zScale, rotation, phaseOffset, speed, colorValue) {
  const segmentCount = 96;
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const color = new THREE.Color(colorValue);

  for (let i = 0; i < segmentCount; i += 1) {
    const t0 = i / segmentCount;
    const t1 = (i + 1) / segmentCount;
    const angle0 = t0 * Math.PI * 2;
    const angle1 = t1 * Math.PI * 2;
    const breakPattern = Math.sin(angle0 * 3.0 + phaseOffset * Math.PI) + Math.sin(angle0 * 7.0 + radius) * 0.45;

    if (breakPattern < -0.42 || i % 9 === 0) {
      continue;
    }

    const r0 = radius + Math.sin(angle0 * 2.0 + phaseOffset) * 0.035;
    const r1 = radius + Math.sin(angle1 * 2.0 + phaseOffset) * 0.035;
    const y0 = Math.sin(angle0 * 2.0 + phaseOffset) * 0.075;
    const y1 = Math.sin(angle1 * 2.0 + phaseOffset) * 0.075;

    positions.push(
      Math.cos(angle0) * r0,
      y0,
      Math.sin(angle0) * r0 * zScale,
      Math.cos(angle1) * r1,
      y1,
      Math.sin(angle1) * r1 * zScale
    );

    for (let j = 0; j < 2; j += 1) {
      colors.push(color.r * 0.5, color.g * 0.72, color.b);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.rotation.set(rotation[0], rotation[1], rotation[2]);

  function update(delta, time, index, interactionProximity) {
    lines.rotation.y += delta * speed;
    lines.rotation.x = rotation[0] + Math.sin(time * (0.07 + index * 0.02) + phaseOffset) * 0.018;
    lines.rotation.z = rotation[2] + Math.sin(time * (0.08 + index * 0.018) + phaseOffset) * 0.02;
    material.opacity = 0.07 + Math.sin(time * (0.34 + index * 0.05) + phaseOffset) * 0.018 + interactionProximity * 0.028;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    lines,
    update,
    dispose
  };
}

function createOrbitNodeLayer(count, radius, zScale, rotation, particleSpeed, phaseOffset, colorValue) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const angles = new Float32Array(count);
  const radii = new Float32Array(count);
  const phases = new Float32Array(count);
  const cyan = new THREE.Color(colorValue);
  const whiteEnergy = new THREE.Color(0xf2feff);
  const nodeColor = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const angle = (i / count) * Math.PI * 2 + phaseOffset * Math.PI + Math.sin(i * 2.13) * 0.28;
    const layerRadius = radius + Math.sin(i * 4.7 + phaseOffset) * 0.055;

    angles[i] = angle;
    radii[i] = layerRadius;
    phases[i] = phaseOffset + i * 0.61;
    positions[i3] = Math.cos(angle) * layerRadius;
    positions[i3 + 1] = Math.sin(angle * 2.0 + phaseOffset) * 0.1;
    positions[i3 + 2] = Math.sin(angle) * layerRadius * zScale;
    nodeColor.copy(cyan).lerp(whiteEnergy, 0.35 + (i % 2) * 0.18);
    colors[i3] = nodeColor.r;
    colors[i3 + 1] = nodeColor.g;
    colors[i3 + 2] = nodeColor.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.034,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.rotation.set(rotation[0], rotation[1], rotation[2]);

  function update(delta, time, index, interactionProximity) {
    const positionArray = positionAttribute.array;
    const flow = time * particleSpeed * 0.62;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const angle = angles[i] + flow;
      const layerRadius = radii[i] + Math.sin(time * 0.34 + phases[i]) * 0.025 + interactionProximity * 0.025;

      positionArray[i3] = Math.cos(angle) * layerRadius;
      positionArray[i3 + 1] = Math.sin(angle * 1.8 + phases[i]) * 0.11;
      positionArray[i3 + 2] = Math.sin(angle) * layerRadius * zScale;
    }

    positionAttribute.needsUpdate = true;
    points.rotation.y += delta * (0.018 + index * 0.006);
    material.opacity = 0.28 + Math.sin(time * (0.48 + index * 0.08) + phaseOffset) * 0.08 + interactionProximity * 0.08;
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

function createOrbitParticleLayer(count, radius, zScale, opacity, rotation, speed, phaseOffset, particleSpeed, colorValue) {
  const particleCount = Math.floor(count);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const angles = new Float32Array(particleCount);
  const radii = new Float32Array(particleCount);
  const heights = new Float32Array(particleCount);
  const phases = new Float32Array(particleCount);
  const energyWeights = new Float32Array(particleCount);
  const color = new THREE.Color();
  const coldBlue = new THREE.Color(0x0088ff);
  const cyan = new THREE.Color(colorValue);
  const whiteEnergy = new THREE.Color(0xe8fbff);
  let written = 0;

  for (let i = 0; i < particleCount; i += 1) {
    const angle = (i / particleCount) * Math.PI * 2;
    const breakPattern = Math.sin(angle * 3.0 + phaseOffset * Math.PI) + Math.sin(angle * 7.0 + radius * 1.2) * 0.45;

    if (breakPattern < -0.55 || (i % 19 === 0 && breakPattern < 0.45)) {
      continue;
    }

    const i3 = written * 3;
    const radiusJitter = Math.sin(i * 12.9898 + phaseOffset * 9.0) * 0.04;
    const layerRadius = radius + radiusJitter;
    const height = Math.sin(angle * 2.0 + radius + phaseOffset) * 0.095;
    const energyWeight = Math.max(0, Math.sin(angle * 5.0 + phaseOffset * 8.0));

    positions[i3] = Math.cos(angle) * layerRadius;
    positions[i3 + 1] = height;
    positions[i3 + 2] = Math.sin(angle) * layerRadius * zScale;
    angles[written] = angle;
    radii[written] = layerRadius;
    heights[written] = height;
    phases[written] = phaseOffset + i * 0.017;
    energyWeights[written] = energyWeight;

    color.copy(coldBlue).lerp(cyan, 0.2 + Math.abs(Math.sin(angle * 1.5 + phaseOffset)) * 0.42);
    color.lerp(whiteEnergy, energyWeight > 0.92 ? 0.32 : 0.04);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
    written += 1;
  }

  const positionAttribute = new THREE.BufferAttribute(positions.slice(0, written * 3), 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, written * 3), 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.017,
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

  function update(delta, time, index, interactionProximity) {
    const positionArray = positionAttribute.array;
    const flow = time * particleSpeed;

    for (let i = 0; i < written; i += 1) {
      const i3 = i * 3;
      const angle = angles[i] + flow * (0.72 + energyWeights[i] * 0.42);
      const orbitPulse = Math.sin(time * 0.52 + phases[i]) * 0.018;
      const layerRadius = radii[i] + orbitPulse + interactionProximity * 0.018;
      const height = heights[i] + Math.sin(angle * 1.7 + time * 0.24 + phases[i]) * 0.026;

      positionArray[i3] = Math.cos(angle) * layerRadius;
      positionArray[i3 + 1] = height;
      positionArray[i3 + 2] = Math.sin(angle) * layerRadius * zScale;
    }

    positionAttribute.needsUpdate = true;
    points.rotation.y += delta * speed;
    points.rotation.x = rotation[0] + Math.sin(time * (0.1 + index * 0.035) + phaseOffset) * 0.026;
    points.rotation.z = rotation[2] + Math.sin(time * (0.12 + index * 0.026) + phaseOffset) * 0.028;
    material.opacity = opacity + Math.sin(time * (0.42 + index * 0.08) + phaseOffset) * 0.018 + interactionProximity * 0.035;
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
