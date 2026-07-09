import * as THREE from 'three';
import { applyEnergyShader, updateEnergyShader } from './energyShader.js';

export function createEnergyCore() {
  const group = new THREE.Group();
  const coreGeometry = new THREE.IcosahedronGeometry(0.82, 5);
  const coreMaterial = applyEnergyShader(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x04111f),
    emissive: new THREE.Color(0x073a5f),
    emissiveIntensity: 0.24,
    metalness: 0.18,
    roughness: 0.14,
    envMapIntensity: 0.82,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.14,
    transmission: 0.5,
    thickness: 0.86,
    ior: 1.58,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  const outerGlass = createOuterGlassLayer();
  const innerGlass = createInnerGlassLayer();
  const brandEnergy = createBrandEnergyLayer();
  const aura = createCoreAura();
  const dataBeams = createCoreDataBeams();
  const shell = createCoreShell(coreGeometry);
  const innerCrystal = createInnerCrystal();
  const quantumGlow = createQuantumGlow();

  group.name = 'ActiveTheoryEnergyCore';
  group.position.set(0.58, 0.04, 0);
  group.add(aura.mesh, dataBeams.lines, outerGlass, innerGlass, brandEnergy, quantumGlow.mesh, innerCrystal, shell);

  function update(delta, time, interaction) {
    const interactionProximity = interaction?.proximity ?? 0;

    updateEnergyShader(time, interaction);
    const corePulse = 0.5 + Math.sin(time * 0.72) * 0.5;

    const heroPulse = Math.sin(time * 0.42) * 0.5 + 0.5;

    group.position.x = 0.58 + Math.sin(time * 0.1) * 0.044;
    group.position.y = 0.04 + Math.sin(time * 0.16) * 0.058;
    group.scale.setScalar(0.96 + Math.sin(time * 0.24) * 0.014 + heroPulse * 0.008 + interactionProximity * 0.012);
    group.rotation.y += delta * 0.058;
    group.rotation.x = Math.sin(time * 0.075) * 0.038;
    coreMesh.rotation.x += delta * 0.046;
    coreMesh.rotation.y -= delta * 0.032;
    coreMesh.rotation.z -= delta * 0.026;
    coreMesh.scale.setScalar(1 + Math.sin(time * 0.46) * 0.014 + heroPulse * 0.008);
    outerGlass.rotation.y -= delta * 0.022;
    outerGlass.rotation.z = Math.sin(time * 0.11) * 0.08;
    outerGlass.scale.setScalar(0.84 + heroPulse * 0.01 + interactionProximity * 0.01);
    outerGlass.material.opacity = 0.04 + corePulse * 0.014 + interactionProximity * 0.01;
    innerGlass.rotation.y += delta * 0.034;
    innerGlass.rotation.x = Math.sin(time * 0.13) * 0.09;
    innerGlass.scale.setScalar(0.68 + corePulse * 0.012 + interactionProximity * 0.016);
    innerGlass.material.opacity = 0.055 + heroPulse * 0.02 + interactionProximity * 0.016;
    brandEnergy.rotation.y -= delta * 0.18;
    brandEnergy.rotation.z += delta * 0.08;
    brandEnergy.scale.setScalar(0.84 + heroPulse * 0.05 + interactionProximity * 0.035);
    brandEnergy.material.opacity = 0.045 + corePulse * 0.08 + interactionProximity * 0.03;
    aura.update(delta, time, corePulse, interactionProximity);
    dataBeams.update(delta, time, heroPulse, interactionProximity);
    coreMaterial.emissiveIntensity = 0.2 + corePulse * 0.09 + heroPulse * 0.05 + interactionProximity * 0.1;
    coreMaterial.clearcoatRoughness = 0.06 + (1 - corePulse) * 0.045 - interactionProximity * 0.018;
    coreMaterial.opacity = 0.105 + heroPulse * 0.025 + interactionProximity * 0.02;
    innerCrystal.rotation.y -= delta * 0.22;
    innerCrystal.rotation.x = Math.sin(time * 0.24) * 0.14;
    innerCrystal.material.emissiveIntensity = 1.05 + corePulse * 0.28 + heroPulse * 0.18 + interactionProximity * 0.18;
    innerCrystal.scale.setScalar(1.26 + corePulse * 0.04 + interactionProximity * 0.04);
    innerCrystal.material.opacity = 0.42 + corePulse * 0.2 + interactionProximity * 0.08;
    quantumGlow.update(delta, time, corePulse, interactionProximity);
    shell.rotation.y -= delta * 0.082;
    shell.rotation.x = Math.sin(time * 0.16) * 0.07;
    shell.scale.setScalar(0.86 + interactionProximity * 0.035 + corePulse * 0.01 + heroPulse * 0.004);
    shell.material.opacity = 0.02 + corePulse * 0.014 + interactionProximity * 0.024;
  }

  function dispose() {
    coreGeometry.dispose();
    coreMaterial.dispose();
    outerGlass.geometry.dispose();
    outerGlass.material.dispose();
    innerGlass.geometry.dispose();
    innerGlass.material.dispose();
    brandEnergy.geometry.dispose();
    brandEnergy.material.dispose();
    aura.dispose();
    dataBeams.dispose();
    quantumGlow.dispose();
    innerCrystal.geometry.dispose();
    innerCrystal.material.dispose();
    shell.geometry.dispose();
    shell.material.dispose();
  }

  return {
    group,
    update,
    dispose
  };
}

function createOuterGlassLayer() {
  const geometry = new THREE.IcosahedronGeometry(0.8, 3);
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
    opacity: 0.04,
    transmission: 0.48,
    thickness: 1.55,
    ior: 1.66,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return new THREE.Mesh(geometry, material);
}

function createInnerGlassLayer() {
  const geometry = new THREE.IcosahedronGeometry(0.66, 4);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x05294a,
    emissive: 0x0075a8,
    emissiveIntensity: 0.24,
    metalness: 0.06,
    roughness: 0.06,
    envMapIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    transparent: true,
    opacity: 0.055,
    transmission: 0.56,
    thickness: 0.72,
    ior: 1.64,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return new THREE.Mesh(geometry, material);
}

function createBrandEnergyLayer() {
  const geometry = new THREE.IcosahedronGeometry(0.34, 3);
  const material = new THREE.MeshBasicMaterial({
    color: 0x9af7ff,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    wireframe: true
  });

  return new THREE.Mesh(geometry, material);
}

function createCoreAura() {
  const geometry = new THREE.SphereGeometry(0.82, 32, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0x0fbfff,
    transparent: true,
    opacity: 0.025,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: THREE.BackSide
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'BrandCoreOuterAura';

  function update(delta, time, corePulse, interactionProximity) {
    mesh.rotation.y += delta * 0.018;
    mesh.scale.setScalar(0.94 + corePulse * 0.035 + interactionProximity * 0.025);
    material.opacity = 0.01 + corePulse * 0.014 + interactionProximity * 0.01;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    mesh,
    update,
    dispose
  };
}

function createCoreDataBeams() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const beamColor = new THREE.Color(0x7ff5ff);
  const beamCount = 5;

  for (let i = 0; i < beamCount; i += 1) {
    const angle = (i / beamCount) * Math.PI * 2;
    const startRadius = 0.72 + (i % 3) * 0.05;
    const endRadius = 1.95 + (i % 4) * 0.22;
    const y = Math.sin(i * 1.37) * 0.28;

    positions.push(
      Math.cos(angle) * startRadius,
      y * 0.42,
      Math.sin(angle) * startRadius * 0.28,
      Math.cos(angle + 0.2) * endRadius,
      y,
      Math.sin(angle + 0.2) * endRadius * 0.34
    );

    for (let j = 0; j < 2; j += 1) {
      const intensity = j === 0 ? 0.5 : 0.16;

      colors.push(beamColor.r * intensity, beamColor.g * intensity, beamColor.b * intensity);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = 'BrandCoreDataBeams';
  lines.rotation.set(0.18, -0.12, 0.08);

  function update(delta, time, heroPulse, interactionProximity) {
    lines.rotation.y += delta * 0.028;
    lines.rotation.z = 0.08 + Math.sin(time * 0.12) * 0.04;
    material.opacity = 0.03 + heroPulse * 0.035 + interactionProximity * 0.018;
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

function createInnerCrystal() {
  const geometry = new THREE.IcosahedronGeometry(0.42, 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0xdffbff,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    wireframe: true
  });
  const crystal = new THREE.Mesh(geometry, material);

  crystal.scale.set(1, 1, 1);

  return crystal;
}

function createQuantumGlow() {
  const geometry = new THREE.SphereGeometry(0.26, 24, 12);
  const material = new THREE.MeshBasicMaterial({
    color: 0xe8fdff,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'BrandQuantumWhiteCore';

  function update(delta, time, corePulse, interactionProximity) {
    mesh.rotation.y += delta * 0.08;
    mesh.scale.setScalar(0.82 + corePulse * 0.14 + interactionProximity * 0.06);
    material.opacity = 0.1 + corePulse * 0.11 + interactionProximity * 0.05;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    mesh,
    update,
    dispose
  };
}

function createCoreShell(coreGeometry) {
  const shellGeometry = new THREE.EdgesGeometry(coreGeometry, 24);
  const shellMaterial = new THREE.LineBasicMaterial({
    color: 0x00d5ff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const shell = new THREE.LineSegments(shellGeometry, shellMaterial);

  shell.scale.setScalar(1.045);

  return shell;
}

export const energyCoreManager = {
  createEnergyCore
};
