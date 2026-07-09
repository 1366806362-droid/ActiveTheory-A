import * as THREE from 'three';

const PLANETS = [
  {
    name: 'GEO Universe',
    color: 0x1b7dff,
    accent: 0x72d8ff,
    radius: 1.62,
    zScale: 0.34,
    size: 0.118,
    speed: 0.046,
    phase: 0.58,
    offset: 0.12,
    tilt: [0.04, -0.08, -0.04]
  },
  {
    name: '5A Universe',
    color: 0xffb84d,
    accent: 0xffe1a3,
    radius: 1.24,
    zScale: 0.42,
    size: 0.1,
    speed: -0.034,
    phase: 2.38,
    offset: -0.06,
    tilt: [-0.12, 0.2, 0.14]
  },
  {
    name: 'Brand Mind Universe',
    color: 0xa76bff,
    accent: 0xe0c7ff,
    radius: 1.96,
    zScale: 0.3,
    size: 0.106,
    speed: 0.028,
    phase: 4.42,
    offset: 0.08,
    tilt: [0.32, 0.1, 0.38]
  }
];

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export function createGalaxyPlanets() {
  const group = new THREE.Group();
  const planets = PLANETS.map((config, index) => createGalaxyPlanet(config, 7022026 + index * 211));
  const targetPosition = new THREE.Vector3();

  group.name = 'ActiveTheoryHeroGalaxy';
  group.position.set(0.5, 0.02, -0.08);
  group.rotation.set(-0.03, 0.04, 0);
  group.scale.setScalar(0.92);

  planets.forEach((planet) => {
    group.add(planet.group);
  });

  function update(delta, time) {
    group.rotation.y = Math.sin(time * 0.018) * 0.035;
    group.rotation.x = -0.03 + Math.sin(time * 0.012) * 0.018;

    planets.forEach((planet, index) => {
      planet.update(delta, time, index);
    });
  }

  function dispose() {
    planets.forEach((planet) => {
      planet.dispose();
    });
    group.clear();
  }

  return {
    group,
    getPlanetWorldPosition(name, target = targetPosition) {
      const planet = planets.find((candidate) => candidate.name === name);

      if (!planet) {
        return null;
      }

      return planet.planetGroup.getWorldPosition(target);
    },
    update,
    dispose
  };
}

function createGalaxyPlanet(config, seed) {
  const orbitalGroup = new THREE.Group();
  const planetGroup = new THREE.Group();
  const shellGeometry = new THREE.SphereGeometry(config.size, 24, 16);
  const coreGeometry = new THREE.IcosahedronGeometry(config.size * 0.56, 2);
  const haloGeometry = new THREE.SphereGeometry(config.size * 1.65, 24, 12);
  const color = new THREE.Color(config.color);
  const accent = new THREE.Color(config.accent);
  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.2,
    metalness: 0.08,
    roughness: 0.16,
    envMapIntensity: 0.7,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.32,
    transmission: 0.26,
    thickness: 0.55,
    ior: 1.48,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true,
    fog: false
  });
  const haloMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false
  });
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  const dust = createPlanetDust(config, seed);
  const orbit = createGalaxyOrbit(config);
  const orbitDust = createOrbitDust(config, seed + 41);
  const connection = createCoreConnection(config);

  orbitalGroup.name = `${config.name.replace(/\s+/g, '')}OrbitSystem`;
  orbitalGroup.rotation.set(config.tilt[0], config.tilt[1], config.tilt[2]);
  planetGroup.name = config.name.replace(/\s+/g, '');
  planetGroup.add(halo, shell, core, dust.points);
  orbitalGroup.add(orbit.lines, orbitDust.points, connection.lines, planetGroup);

  function update(delta, time, index) {
    const angle = config.phase + config.offset + time * config.speed;
    const radiusPulse = Math.sin(time * 0.18 + config.phase) * 0.025;
    const radius = config.radius + radiusPulse;
    const yFloat = Math.sin(time * (0.2 + index * 0.035) + config.phase) * 0.045;
    const pulse = 0.5 + Math.sin(time * (0.52 + index * 0.04) + config.phase) * 0.5;
    const planetPosition = {
      x: Math.cos(angle) * radius,
      y: yFloat,
      z: Math.sin(angle) * radius * config.zScale
    };

    planetGroup.position.set(planetPosition.x, planetPosition.y, planetPosition.z);
    planetGroup.rotation.y += delta * (0.22 + index * 0.07);
    planetGroup.rotation.x = Math.sin(time * 0.14 + config.phase) * 0.16;
    shell.material.opacity = 0.23 + pulse * 0.09;
    shell.material.emissiveIntensity = 0.14 + pulse * 0.1;
    core.material.opacity = 0.2 + pulse * 0.14;
    halo.material.opacity = 0.038 + pulse * 0.048;
    dust.update(delta, time, pulse);
    orbit.update(delta, time, pulse);
    orbitDust.update(delta, time, pulse);
    connection.update(time, pulse, planetPosition);
  }

  function dispose() {
    shellGeometry.dispose();
    coreGeometry.dispose();
    haloGeometry.dispose();
    shellMaterial.dispose();
    coreMaterial.dispose();
    haloMaterial.dispose();
    dust.dispose();
    orbit.dispose();
    orbitDust.dispose();
    connection.dispose();
  }

  return {
    name: config.name,
    group: orbitalGroup,
    planetGroup,
    update,
    dispose
  };
}

function createGalaxyOrbit(config) {
  const segmentCount = 168;
  const positions = [];
  const colors = [];
  const color = new THREE.Color(config.color);
  const geometry = new THREE.BufferGeometry();

  for (let i = 0; i < segmentCount; i += 1) {
    const t0 = i / segmentCount;
    const t1 = (i + 1) / segmentCount;
    const angle0 = t0 * Math.PI * 2;
    const angle1 = t1 * Math.PI * 2;
    const breakPattern = Math.sin(angle0 * 4.0 + config.phase) + Math.sin(angle0 * 10.0 + config.radius) * 0.34;

    if (breakPattern < -0.34 || i % 17 === 0) {
      continue;
    }

    const r0 = config.radius + Math.sin(angle0 * 2.0 + config.phase) * 0.04;
    const r1 = config.radius + Math.sin(angle1 * 2.0 + config.phase) * 0.04;
    const y0 = Math.sin(angle0 * 2.0 + config.phase) * 0.045;
    const y1 = Math.sin(angle1 * 2.0 + config.phase) * 0.045;

    positions.push(
      Math.cos(angle0) * r0,
      y0,
      Math.sin(angle0) * r0 * config.zScale,
      Math.cos(angle1) * r1,
      y1,
      Math.sin(angle1) * r1 * config.zScale
    );

    for (let j = 0; j < 2; j += 1) {
      colors.push(color.r * 0.42, color.g * 0.62, color.b);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  function update(delta, time, pulse) {
    lines.rotation.y += delta * config.speed * 0.18;
    material.opacity = 0.044 + pulse * 0.032;
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

function createOrbitDust(config, seed) {
  const random = seededRandom(seed);
  const count = 42;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const angles = new Float32Array(count);
  const radii = new Float32Array(count);
  const phases = new Float32Array(count);
  const color = new THREE.Color(config.color);
  const accent = new THREE.Color(config.accent);
  const particleColor = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const angle = random() * Math.PI * 2;
    const radius = config.radius + (random() - 0.5) * 0.09;

    angles[i] = angle;
    radii[i] = radius;
    phases[i] = random() * Math.PI * 2;
    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = (random() - 0.5) * 0.08;
    positions[i3 + 2] = Math.sin(angle) * radius * config.zScale;
    particleColor.copy(color).lerp(accent, 0.24 + random() * 0.28);
    colors[i3] = particleColor.r;
    colors[i3 + 1] = particleColor.g;
    colors[i3 + 2] = particleColor.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.008,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  function update(delta, time, pulse) {
    const array = positionAttribute.array;
    const flow = time * config.speed * 1.4;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const angle = angles[i] + flow + Math.sin(time * 0.12 + phases[i]) * 0.025;
      const radius = radii[i] + Math.sin(time * 0.22 + phases[i]) * 0.035;

      array[i3] = Math.cos(angle) * radius;
      array[i3 + 1] = Math.sin(angle * 2.0 + phases[i]) * 0.045;
      array[i3 + 2] = Math.sin(angle) * radius * config.zScale;
    }

    positionAttribute.needsUpdate = true;
    material.opacity = 0.12 + pulse * 0.12;
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

function createCoreConnection(config) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(6);
  const colors = new Float32Array(6);
  const color = new THREE.Color(config.accent);

  colors[0] = color.r * 0.55;
  colors[1] = color.g * 0.55;
  colors[2] = color.b * 0.55;
  colors[3] = color.r;
  colors[4] = color.g;
  colors[5] = color.b;

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.045,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  function update(time, pulse, planetPosition) {
    const array = positionAttribute.array;
    const breath = 0.88 + Math.sin(time * 0.34 + config.phase) * 0.06;

    array[0] = 0;
    array[1] = 0;
    array[2] = 0;
    array[3] = planetPosition.x * breath;
    array[4] = planetPosition.y * breath;
    array[5] = planetPosition.z * breath;
    positionAttribute.needsUpdate = true;
    material.opacity = 0.022 + pulse * 0.034;
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

function createPlanetDust(config, seed) {
  const random = seededRandom(seed);
  const count = 18;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const radii = new Float32Array(count);
  const color = new THREE.Color(config.color);
  const accent = new THREE.Color(config.accent);
  const particleColor = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const angle = random() * Math.PI * 2;
    const radius = config.size * (1.55 + random() * 1.05);

    radii[i] = radius;
    phases[i] = angle;
    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = (random() - 0.5) * config.size * 0.9;
    positions[i3 + 2] = Math.sin(angle) * radius * 0.42;
    particleColor.copy(color).lerp(accent, random() * 0.32);
    colors[i3] = particleColor.r;
    colors[i3 + 1] = particleColor.g;
    colors[i3 + 2] = particleColor.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.01,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  function update(delta, time, pulse) {
    const array = positionAttribute.array;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const angle = phases[i] + time * 0.16;
      const radius = radii[i] + Math.sin(time * 0.42 + phases[i]) * config.size * 0.06;

      array[i3] = Math.cos(angle) * radius;
      array[i3 + 1] = Math.sin(angle * 1.7 + phases[i]) * config.size * 0.3;
      array[i3 + 2] = Math.sin(angle) * radius * 0.42;
    }

    positionAttribute.needsUpdate = true;
    points.rotation.y += delta * 0.1;
    material.opacity = 0.14 + pulse * 0.12;
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

export const galaxyPlanetsManager = {
  createGalaxyPlanets
};
