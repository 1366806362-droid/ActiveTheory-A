import * as THREE from 'three';

const FIVE_A_STAGES = [
  {
    id: 'O',
    label: 'OPPORTUNITY',
    value: '1.28M',
    radius: 0.82,
    height: -0.76,
    color: 0x245dff,
    particleCount: 72,
    speed: 0.09
  },
  {
    id: 'A1',
    label: 'AWARE',
    value: '486K',
    radius: 1.12,
    height: -0.46,
    color: 0x1b8dff,
    particleCount: 62,
    speed: 0.078
  },
  {
    id: 'A2',
    label: 'APPEAL',
    value: '216K',
    radius: 1.42,
    height: -0.14,
    color: 0x00b7ff,
    particleCount: 52,
    speed: 0.066
  },
  {
    id: 'A3',
    label: 'ASK',
    value: '92K',
    radius: 1.72,
    height: 0.18,
    color: 0x00dcff,
    particleCount: 42,
    speed: 0.058
  },
  {
    id: 'A4',
    label: 'ACT',
    value: '31K',
    radius: 2.02,
    height: 0.52,
    color: 0x74f7ff,
    particleCount: 34,
    speed: 0.05
  },
  {
    id: 'A5',
    label: 'ADVOCATE',
    value: '8.6K',
    radius: 2.32,
    height: 0.9,
    color: 0xd8fbff,
    particleCount: 26,
    speed: 0.044
  }
];

const BACKGROUND_DUST_COUNT = 260;
const TRANSFER_PARTICLE_COUNT = 96;

export function createFiveAScene() {
  const group = new THREE.Group();
  const core = createFiveACore();
  const orbitSystem = createFiveAOrbitSystem();
  const transferFlow = createFiveATransferFlow();
  const dust = createFiveABackgroundDust();
  const title = createSceneTitle();

  group.name = 'FiveAScene';
  group.position.set(0, 0, -5.8);
  group.visible = false;
  group.add(dust.points, orbitSystem.group, transferFlow.points, core.group, title.group);

  function update(renderState, delta, time, transitionProgress) {
    const entrance = smoothstep(0.04, 1, transitionProgress);
    const eased = easeOutCubic(entrance);
    const cameraExplore = entrance * entrance;

    group.visible = transitionProgress > 0.01;
    group.position.x = -2.35 * eased;
    group.position.z = -5.8 + eased * 3.72;
    group.position.y = -0.42 + eased * 0.2;
    group.rotation.y = (1 - eased) * -0.24 + Math.sin(time * 0.025) * 0.04;
    group.rotation.x = -0.12 + eased * 0.12 + Math.sin(time * 0.018) * 0.02;
    group.scale.setScalar(0.84 + eased * 0.1);

    renderState.cameraOffset.x += Math.sin(time * 0.038 + 0.6) * 0.18 * cameraExplore;
    renderState.cameraOffset.y += Math.sin(time * 0.032) * 0.07 * cameraExplore;
    renderState.cameraOffset.z -= (0.2 + Math.sin(time * 0.028) * 0.08) * cameraExplore;
    renderState.cameraOffset.targetY += 0.08 * cameraExplore;

    dust.update(delta, time, entrance);
    orbitSystem.update(delta, time, entrance);
    transferFlow.update(delta, time, entrance);
    core.update(delta, time, entrance);
    title.update(time, entrance);
  }

  function dispose() {
    dust.dispose();
    orbitSystem.dispose();
    transferFlow.dispose();
    core.dispose();
    title.dispose();
    group.clear();
  }

  return {
    name: 'FiveAScene',
    group,
    update,
    dispose
  };
}

function createFiveACore() {
  const group = new THREE.Group();
  const geometry = new THREE.IcosahedronGeometry(0.38, 2);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x061a32,
    emissive: 0x007da8,
    emissiveIntensity: 0.42,
    metalness: 0.12,
    roughness: 0.22,
    envMapIntensity: 0.65,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.58,
    transmission: 0.18,
    thickness: 0.6,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  const haloGeometry = new THREE.RingGeometry(0.58, 0.6, 64);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x64eeff,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false
  });
  const haloA = new THREE.Mesh(haloGeometry, haloMaterial);
  const haloB = new THREE.Mesh(haloGeometry, haloMaterial.clone());

  group.name = 'FiveACore';
  haloA.rotation.x = Math.PI * 0.5;
  haloB.rotation.y = Math.PI * 0.5;
  group.add(mesh, haloA, haloB);

  function update(delta, time, entrance) {
    const pulse = 0.5 + Math.sin(time * 0.52) * 0.5;

    group.scale.setScalar(0.75 + entrance * 0.25 + pulse * 0.035);
    group.rotation.y += delta * 0.12;
    group.rotation.z -= delta * 0.045;
    material.emissiveIntensity = 0.18 + entrance * 0.38 + pulse * 0.12;
    haloMaterial.opacity = 0.04 + entrance * 0.2 + pulse * 0.05;
    haloB.material.opacity = 0.03 + entrance * 0.16 + pulse * 0.04;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    haloGeometry.dispose();
    haloMaterial.dispose();
    haloB.material.dispose();
  }

  return { group, update, dispose };
}

function createFiveAOrbitSystem() {
  const group = new THREE.Group();
  const orbits = FIVE_A_STAGES.map((stage, index) => createFiveAOrbit(stage, index));
  const labels = FIVE_A_STAGES.map((stage, index) => createFiveALabel(stage, index));

  group.name = 'FiveAOrbitSystem';
  orbits.forEach((orbit) => group.add(orbit.group));
  labels.forEach((label) => group.add(label.group));

  function update(delta, time, entrance) {
    group.rotation.y = Math.sin(time * 0.018) * 0.06;
    group.rotation.z = Math.sin(time * 0.014) * 0.018;
    orbits.forEach((orbit) => orbit.update(delta, time, entrance));
    labels.forEach((label) => label.update(time, entrance));
  }

  function dispose() {
    orbits.forEach((orbit) => orbit.dispose());
    labels.forEach((label) => label.dispose());
    group.clear();
  }

  return { group, update, dispose };
}

function createFiveAOrbit(stage, index) {
  const group = new THREE.Group();
  const orbitLines = createBrokenOrbitLines(stage, index);
  const population = createOrbitPopulationParticles(stage, index);
  const stageNode = createStageNode(stage, index);

  group.name = `FiveAOrbit${stage.id}`;
  group.rotation.x = 0.78 + index * 0.055;
  group.rotation.z = -0.22 + index * 0.07;
  group.add(orbitLines.lines, population.points, stageNode.group);

  function update(delta, time, entrance) {
    group.rotation.y += delta * (0.015 + index * 0.004);
    orbitLines.update(time, entrance);
    population.update(delta, time, entrance);
    stageNode.update(time, entrance);
  }

  function dispose() {
    orbitLines.dispose();
    population.dispose();
    stageNode.dispose();
    group.clear();
  }

  return { group, update, dispose };
}

function createBrokenOrbitLines(stage, index) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const color = new THREE.Color(stage.color);
  const segments = 132;

  for (let i = 0; i < segments; i += 1) {
    const broken = Math.sin(i * 0.43 + index * 1.7) < -0.45 || i % 17 === 0;

    if (broken) {
      continue;
    }

    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const wave0 = Math.sin(a0 * 3 + index) * 0.045;
    const wave1 = Math.sin(a1 * 3 + index) * 0.045;

    positions.push(
      Math.cos(a0) * (stage.radius + wave0),
      stage.height,
      Math.sin(a0) * (stage.radius * 0.42),
      Math.cos(a1) * (stage.radius + wave1),
      stage.height,
      Math.sin(a1) * (stage.radius * 0.42)
    );

    for (let c = 0; c < 2; c += 1) {
      colors.push(color.r * 0.45, color.g * 0.58, color.b * 0.78);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  function update(time, entrance) {
    material.opacity = 0.04 + entrance * 0.2 + Math.sin(time * 0.18 + index) * 0.018;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { lines, update, dispose };
}

function createOrbitPopulationParticles(stage, index) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(stage.particleCount * 3);
  const colors = new Float32Array(stage.particleCount * 3);
  const phases = new Float32Array(stage.particleCount);
  const color = new THREE.Color(stage.color);
  const white = new THREE.Color(0xffffff);

  for (let i = 0; i < stage.particleCount; i += 1) {
    const i3 = i * 3;

    phases[i] = (i / stage.particleCount + (i % 9) * 0.031) % 1;
    color.set(stage.color).lerp(white, i % 13 === 0 ? 0.44 : 0.08);
    colors[i3] = color.r * 0.7;
    colors[i3 + 1] = color.g * 0.78;
    colors[i3 + 2] = color.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.032,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  function update(delta, time, entrance) {
    const positionArray = positionAttribute.array;

    for (let i = 0; i < stage.particleCount; i += 1) {
      const i3 = i * 3;
      const phase = (phases[i] + time * stage.speed) % 1;
      const angle = phase * Math.PI * 2;
      const lane = (i % 5) * 0.022;
      const radius = stage.radius + Math.sin(time * 0.26 + i) * 0.035 + lane;

      positionArray[i3] = Math.cos(angle) * radius;
      positionArray[i3 + 1] = stage.height + Math.sin(angle * 2 + i) * 0.035;
      positionArray[i3 + 2] = Math.sin(angle) * radius * 0.42;
    }

    positionAttribute.needsUpdate = true;
    points.rotation.y += delta * (0.01 + index * 0.003);
    material.opacity = 0.08 + entrance * 0.46 + Math.sin(time * 0.22 + index) * 0.025;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createStageNode(stage, index) {
  const group = new THREE.Group();
  const angle = -0.75 + index * 0.38;
  const geometry = new THREE.IcosahedronGeometry(0.08 + index * 0.006, 1);
  const material = new THREE.MeshBasicMaterial({
    color: stage.color,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    wireframe: true,
    depthWrite: false,
    fog: false
  });
  const haloGeometry = new THREE.RingGeometry(0.16, 0.17, 40);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: stage.color,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);

  group.position.set(Math.cos(angle) * stage.radius, stage.height, Math.sin(angle) * stage.radius * 0.42);
  halo.rotation.x = Math.PI * 0.5;
  group.add(mesh, halo);

  function update(time, entrance) {
    const pulse = 0.5 + Math.sin(time * (0.5 + index * 0.06) + index) * 0.5;

    group.rotation.y += 0.008 + index * 0.001;
    group.scale.setScalar(0.78 + entrance * 0.24 + pulse * 0.06);
    material.opacity = 0.18 + entrance * 0.55 + pulse * 0.14;
    haloMaterial.opacity = 0.04 + entrance * 0.16 + pulse * 0.08;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    haloGeometry.dispose();
    haloMaterial.dispose();
  }

  return { group, update, dispose };
}

function createFiveATransferFlow() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(TRANSFER_PARTICLE_COUNT * 3);
  const colors = new Float32Array(TRANSFER_PARTICLE_COUNT * 3);
  const phases = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const segmentIndex = new Uint8Array(TRANSFER_PARTICLE_COUNT);
  const color = new THREE.Color(0x8df7ff);

  for (let i = 0; i < TRANSFER_PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    const stage = FIVE_A_STAGES[Math.min(i % FIVE_A_STAGES.length, FIVE_A_STAGES.length - 1)];

    phases[i] = (i * 0.021 + (i % 6) * 0.09) % 1;
    segmentIndex[i] = i % (FIVE_A_STAGES.length - 1);
    color.set(stage.color).lerp(new THREE.Color(0xffffff), i % 12 === 0 ? 0.5 : 0.12);
    colors[i3] = color.r * 0.78;
    colors[i3 + 1] = color.g * 0.82;
    colors[i3 + 2] = color.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.038,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'FiveAAudienceTransferFlow';

  function update(delta, time, entrance) {
    const positionArray = positionAttribute.array;

    for (let i = 0; i < TRANSFER_PARTICLE_COUNT; i += 1) {
      const i3 = i * 3;
      const fromStage = FIVE_A_STAGES[segmentIndex[i]];
      const toStage = FIVE_A_STAGES[segmentIndex[i] + 1];
      const t = (phases[i] + time * (0.052 + segmentIndex[i] * 0.004)) % 1;
      const easedT = smoothstep(0, 1, t);
      const angle = (-0.78 + segmentIndex[i] * 0.38) + easedT * 0.42;
      const radius = lerp(fromStage.radius, toStage.radius, easedT);
      const height = lerp(fromStage.height, toStage.height, easedT);
      const lift = Math.sin(easedT * Math.PI) * 0.14;

      positionArray[i3] = Math.cos(angle) * radius;
      positionArray[i3 + 1] = height + lift;
      positionArray[i3 + 2] = Math.sin(angle) * radius * 0.42;
    }

    positionAttribute.needsUpdate = true;
    points.rotation.y += delta * 0.008;
    material.opacity = 0.08 + entrance * 0.5 + Math.sin(time * 0.24) * 0.03;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createFiveABackgroundDust() {
  const random = seededRandom(5151);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(BACKGROUND_DUST_COUNT * 3);
  const colors = new Float32Array(BACKGROUND_DUST_COUNT * 3);
  const color = new THREE.Color(0x0d4f8f);
  const cyan = new THREE.Color(0x5df0ff);

  for (let i = 0; i < BACKGROUND_DUST_COUNT; i += 1) {
    const i3 = i * 3;
    const depth = random();

    positions[i3] = (random() - 0.5) * (12 + depth * 10);
    positions[i3 + 1] = (random() - 0.5) * (7 + depth * 6);
    positions[i3 + 2] = -2 - random() * 16;
    color.set(0x0d4f8f).lerp(cyan, random() * 0.24);
    colors[i3] = color.r * (0.18 + depth * 0.28);
    colors[i3 + 1] = color.g * (0.18 + depth * 0.28);
    colors[i3 + 2] = color.b * (0.18 + depth * 0.28);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.045,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'FiveADeepAudienceDust';

  function update(delta, time, entrance) {
    points.rotation.y += delta * 0.005;
    points.rotation.z = Math.sin(time * 0.016) * 0.018;
    material.opacity = 0.05 + entrance * 0.2;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createFiveALabel(stage, index) {
  const group = new THREE.Group();
  const texture = createTextTexture(`${stage.id}  ${stage.label}  ${stage.value}`);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  const angle = -0.75 + index * 0.38;

  group.name = `FiveALabel${stage.id}`;
  group.position.set(
    Math.cos(angle) * (stage.radius + 0.26),
    stage.height + 0.12,
    Math.sin(angle) * stage.radius * 0.42
  );
  sprite.scale.set(0.7 + index * 0.035, 0.14, 1);
  group.add(sprite);

  function update(time, entrance) {
    const pulse = 0.5 + Math.sin(time * 0.28 + index) * 0.5;

    group.position.y = stage.height + 0.12 + Math.sin(time * 0.1 + index) * 0.025;
    material.opacity = 0.035 + entrance * 0.42 + pulse * 0.035;
  }

  function dispose() {
    texture.dispose();
    material.dispose();
  }

  return { group, update, dispose };
}

function createSceneTitle() {
  const group = new THREE.Group();
  const texture = createTextTexture('5A AUDIENCE FLOW UNIVERSE');
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);

  group.name = 'FiveASceneTitle';
  group.position.set(-2.4, 2.15, 0.18);
  sprite.scale.set(1.45, 0.2, 1);
  group.add(sprite);

  function update(time, entrance) {
    material.opacity = 0.04 + entrance * 0.5 + Math.sin(time * 0.22) * 0.025;
  }

  function dispose() {
    texture.dispose();
    material.dispose();
  }

  return { group, update, dispose };
}

function createTextTexture(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 768;
  canvas.height = 128;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(150, 246, 255, 0.92)';
  context.font = '700 42px Inter, Arial, sans-serif';
  context.fillText(text, 24, 76);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * (3 - 2 * x);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

export const fiveASceneManager = {
  createFiveAScene
};
