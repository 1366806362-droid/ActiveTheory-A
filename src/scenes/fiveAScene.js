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
const TRANSFER_PARTICLE_COUNT = 432;
const FIVE_A_FINAL_POSITION = Object.freeze([-2.35, -0.22, -2.08]);
const FIVE_A_FINAL_SCALE = 0.94;
const STABLE_DRIFT_START = 0.72;

export function createFiveAScene() {
  const group = new THREE.Group();
  const core = createFiveACore();
  const orbitSystem = createFiveAOrbitSystem();
  const transferFlow = createFiveATransferFlow();
  const dust = createFiveABackgroundDust();
  const title = createSceneTitle();
  let diagnostics;
  let lastMotionProgress = 0;

  group.name = 'FiveAScene';
  group.position.set(...FIVE_A_FINAL_POSITION);
  group.visible = false;
  group.add(dust.points, orbitSystem.group, transferFlow.points, core.group, title.group);
  diagnostics = createFiveAMotionDiagnostics(group, orbitSystem, transferFlow);

  function update(renderState, delta, time, transitionProgress) {
    const entrance = smoothstep(0.04, 1, transitionProgress);
    const motionProgress = diagnostics.getProgressOverride(entrance);
    const motion = getGlobalMotionState(motionProgress);
    const direction = motionProgress > lastMotionProgress + 0.0001
      ? 'forward'
      : motionProgress < lastMotionProgress - 0.0001
        ? 'reverse'
        : 'idle';
    const cameraExplore = motionProgress * motionProgress;

    group.visible = transitionProgress > 0.01 || diagnostics.isDebugEnabled;
    group.position.set(...FIVE_A_FINAL_POSITION);
    group.rotation.y = Math.sin(time * 0.025) * 0.04 * motion.stable;
    group.rotation.x = Math.sin(time * 0.018) * 0.02 * motion.stable;
    group.scale.setScalar(FIVE_A_FINAL_SCALE);

    renderState.cameraOffset.x += Math.sin(time * 0.038 + 0.6) * 0.18 * cameraExplore;
    renderState.cameraOffset.y += Math.sin(time * 0.032) * 0.07 * cameraExplore;
    renderState.cameraOffset.z -= (0.2 + Math.sin(time * 0.028) * 0.08) * cameraExplore;
    renderState.cameraOffset.targetY += 0.08 * cameraExplore;

    dust.update(delta, time, motionProgress);
    orbitSystem.update(delta, time, motionProgress);
    transferFlow.update(delta, time, motionProgress, motion);
    core.update(delta, time, motion);
    title.update(time, motionProgress);
    diagnostics.update(motionProgress, motion, direction);
    lastMotionProgress = motionProgress;
  }

  function dispose() {
    dust.dispose();
    orbitSystem.dispose();
    transferFlow.dispose();
    core.dispose();
    title.dispose();
    diagnostics.dispose();
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

  function update(delta, time, motion) {
    const chargeWave = Math.sin(motion.charge * Math.PI);
    const stableSparkle = (0.5 + Math.sin(time * 0.34) * 0.5) * motion.stable;

    group.scale.setScalar(0.83 - chargeWave * 0.045 + motion.release * 0.17);
    group.rotation.y = motion.release * 0.34 + time * 0.012 * motion.stable;
    group.rotation.z = -motion.release * 0.11 - time * 0.004 * motion.stable;
    mesh.rotation.x = time * 0.026 * motion.stable;
    mesh.rotation.y = time * 0.041 * motion.stable;
    haloA.rotation.z = time * 0.018 * motion.stable;
    haloB.rotation.x = time * -0.013 * motion.stable;
    material.emissiveIntensity = 0.2 + motion.release * 0.34 + chargeWave * 0.09 + stableSparkle * 0.025;
    haloMaterial.opacity = 0.035 + motion.release * 0.19 + chargeWave * 0.1;
    haloB.material.opacity = 0.025 + motion.release * 0.15 + chargeWave * 0.075;
    haloA.scale.setScalar(1 + chargeWave * 0.72);
    haloB.scale.setScalar(1 + chargeWave * 0.48);
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
  let lastMotions = FIVE_A_STAGES.map((stage, index) => evaluateStageMotion(stage, index, 0, 0));

  group.name = 'FiveAOrbitSystem';
  orbits.forEach((orbit) => group.add(orbit.group));
  labels.forEach((label) => group.add(label.group));

  function update(delta, time, entrance) {
    const stable = getGlobalMotionState(entrance).stable;

    group.rotation.y = Math.sin(time * 0.018) * 0.06 * stable;
    group.rotation.z = Math.sin(time * 0.014) * 0.018 * stable;
    orbits.forEach((orbit, index) => {
      const motion = evaluateStageMotion(FIVE_A_STAGES[index], index, entrance, time);

      lastMotions[index] = motion;
      orbit.update(delta, time, motion);
      labels[index].update(time, motion);
    });
  }

  function dispose() {
    orbits.forEach((orbit) => orbit.dispose());
    labels.forEach((label) => label.dispose());
    group.clear();
  }

  return {
    group,
    update,
    dispose,
    getStatus() {
      return orbits.map((orbit, index) => orbit.getStatus(lastMotions[index]));
    }
  };
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

  function update(delta, time, motion) {
    group.rotation.y = motion.orbitRotationY;
    group.scale.setScalar(1);
    orbitLines.update(time, motion);
    population.update(delta, time, motion);
    stageNode.update(time, motion);
  }

  function dispose() {
    orbitLines.dispose();
    population.dispose();
    stageNode.dispose();
    group.clear();
  }

  return {
    group,
    update,
    dispose,
    getStatus(motion) {
      return stageNode.getStatus(motion, orbitLines.getDrawProgress());
    }
  };
}

function createBrokenOrbitLines(stage, index) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const color = new THREE.Color(stage.color);
  const finalAngle = getStageFinalAngle(index);
  const arcs = getOrbitArcLayout(index);
  const arcVertexEnds = [];
  let vertexCursor = 0;

  arcs.forEach((arc, arcIndex) => {
    const segmentCount = 14 + ((index + arcIndex * 3) % 8);

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const t0 = segment / segmentCount;
      const t1 = (segment + 1) / segmentCount;
      const a0 = finalAngle + THREE.MathUtils.lerp(arc.start, arc.end, t0);
      const a1 = finalAngle + THREE.MathUtils.lerp(arc.start, arc.end, t1);
      const wave0 = orbitLineNoise(a0, index, arcIndex, t0);
      const wave1 = orbitLineNoise(a1, index, arcIndex, t1);
      const fade = arc.strength * Math.sin(((t0 + t1) * 0.5) * Math.PI);
      const brightness = 0.2 + fade * 0.58;

      positions.push(
        Math.cos(a0) * (stage.radius + wave0),
        stage.height + Math.sin(a0 * 1.7 + index) * 0.012,
        Math.sin(a0) * (stage.radius * 0.42 + wave0 * 0.32),
        Math.cos(a1) * (stage.radius + wave1),
        stage.height + Math.sin(a1 * 1.7 + index) * 0.012,
        Math.sin(a1) * (stage.radius * 0.42 + wave1 * 0.32)
      );

      for (let c = 0; c < 2; c += 1) {
        colors.push(
          color.r * brightness,
          color.g * brightness * 1.08,
          color.b * brightness * 1.24
        );
      }
      vertexCursor += 2;
    }
    arcVertexEnds.push(vertexCursor);
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.11,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);
  const vertexCount = geometry.getAttribute('position').count;
  let drawProgress = 0;

  geometry.setDrawRange(0, 0);

  function update(time, motion) {
    const flowingHighlight = Math.sin(time * (0.1 + index * 0.008) + index) * 0.008 * motion.stable;
    const activeArc = Math.min(arcs.length - 1, Math.floor(motion.drawProgress * arcs.length));
    const priorVertices = activeArc === 0 ? 0 : arcVertexEnds[activeArc - 1];
    const arcStartProgress = activeArc / arcs.length;
    const arcLocalProgress = clamp01((motion.drawProgress - arcStartProgress) * arcs.length);
    const arcVertices = arcVertexEnds[activeArc] - priorVertices;
    const visibleVertices = priorVertices + Math.floor(arcVertices * arcLocalProgress * 0.5) * 2;

    drawProgress = motion.drawProgress;
    geometry.setDrawRange(0, Math.max(0, Math.min(vertexCount, visibleVertices)));
    material.opacity = motion.drawProgress * (
      0.018 + motion.capture * 0.105 + flowingHighlight
    );
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    lines,
    update,
    dispose,
    getDrawProgress() {
      return drawProgress;
    }
  };
}

function getOrbitArcLayout(index) {
  const layouts = [
    [{ start: -0.46, end: 0.4, strength: 1 }, { start: 1.3, end: 1.86, strength: 0.5 }],
    [{ start: -0.62, end: 0.32, strength: 1 }, { start: -2.18, end: -1.58, strength: 0.42 }, { start: 1.52, end: 2.0, strength: 0.34 }],
    [{ start: -0.52, end: 0.48, strength: 1 }, { start: 1.08, end: 1.56, strength: 0.38 }, { start: -2.5, end: -1.98, strength: 0.32 }],
    [{ start: -0.7, end: 0.38, strength: 1 }, { start: 1.36, end: 1.94, strength: 0.4 }],
    [{ start: -0.6, end: 0.5, strength: 1 }, { start: -2.34, end: -1.78, strength: 0.34 }, { start: 1.18, end: 1.62, strength: 0.28 }],
    [{ start: -0.74, end: 0.44, strength: 1 }, { start: 1.44, end: 1.9, strength: 0.3 }, { start: -2.54, end: -2.04, strength: 0.24 }]
  ];

  return layouts[index];
}

function orbitLineNoise(angle, index, arcIndex, progress) {
  return (
    Math.sin(angle * (2.1 + index * 0.08) + arcIndex * 1.73) * 0.018
    + Math.sin(progress * Math.PI * (3.2 + index * 0.14) + index) * 0.009
  );
}

function createOrbitPopulationParticles(stage, index) {
  const random = seededRandom(6100 + index * 97);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(stage.particleCount * 3);
  const colors = new Float32Array(stage.particleCount * 3);
  const phases = new Float32Array(stage.particleCount);
  const angles = new Float32Array(stage.particleCount);
  const lanes = new Float32Array(stage.particleCount);
  const sizes = new Float32Array(stage.particleCount);
  const alphas = new Float32Array(stage.particleCount);
  const arcLayout = getOrbitArcLayout(index);
  const color = new THREE.Color(stage.color);
  const white = new THREE.Color(0xffffff);
  const purpleBlue = new THREE.Color(0x7188d9);

  for (let i = 0; i < stage.particleCount; i += 1) {
    const i3 = i * 3;
    const arcIndex = i % arcLayout.length;
    const arc = arcLayout[arcIndex];
    const sizeRoll = random();

    phases[i] = random();
    angles[i] = getStageFinalAngle(index) + THREE.MathUtils.lerp(arc.start, arc.end, random());
    lanes[i] = (random() - 0.5) * (0.024 + index * 0.004);
    sizes[i] = sizeRoll < 0.76 ? 0.022 : sizeRoll < 0.96 ? 0.035 : 0.053;
    alphas[i] = 0;
    color.set(stage.color).lerp(white, i % 13 === 0 ? 0.44 : 0.08);
    if (i % 41 === 0) color.lerp(purpleBlue, 0.18);
    colors[i3] = color.r * 0.7;
    colors[i3 + 1] = color.g * 0.78;
    colors[i3 + 2] = color.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const alphaAttribute = new THREE.BufferAttribute(alphas, 1);

  alphaAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aAlpha', alphaAttribute);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspective = clamp(170.0 / max(1.0, -viewPosition.z), 0.82, 4.8);
        gl_PointSize = max(1.0, aSize * perspective * 38.0);
        gl_Position = projectionMatrix * viewPosition;
        vColor = color;
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float radius = length(centered);
        float core = 1.0 - smoothstep(0.05, 0.28, radius);
        float feather = 1.0 - smoothstep(0.22, 0.5, radius);
        if (feather <= 0.001) discard;
        gl_FragColor = vec4(vColor, (core * 0.4 + feather * 0.6) * vAlpha);
      }
    `
  });
  const points = new THREE.Points(geometry, material);

  function update(delta, time, motion) {
    const positionArray = positionAttribute.array;
    const alphaArray = alphaAttribute.array;

    for (let i = 0; i < stage.particleCount; i += 1) {
      const i3 = i * 3;
      const flow = time * stage.speed * (0.038 + index * 0.003) * motion.stable;
      const angle = angles[i] + flow + (1 - motion.release) * (phases[i] - 0.5) * 0.28;
      const radius = stage.radius * (0.05 + easeOutCubic(motion.release) * 0.95) + lanes[i] * motion.release;
      const depthCurl = Math.sin(angles[i] * 3.2 + i * 0.37) * motion.depthArc * 0.13;
      const captureCluster = Math.exp(-Math.pow((angles[i] - getStageFinalAngle(index)) * 1.35, 2));

      positionArray[i3] = Math.cos(angle) * radius;
      positionArray[i3 + 1] = stage.height * motion.release + Math.sin(angle * 2 + i) * 0.025 * motion.release;
      positionArray[i3 + 2] = Math.sin(angle) * radius * 0.42 + depthCurl;
      alphaArray[i] = motion.release * (
        0.1 + motion.capture * (0.2 + captureCluster * 0.2) + motion.stable * 0.08
      );
    }

    positionAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;
    points.rotation.y = motion.orbitRotationY * 0.42;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createStageNode(stage, index) {
  const group = new THREE.Group();
  const angle = getStageFinalAngle(index);
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
  const haloGeometry = new THREE.RingGeometry(
    0.16,
    0.17,
    40,
    1,
    0.32 + index * 0.47,
    Math.PI * (1.12 + (index % 3) * 0.14)
  );
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

  function update(time, motion) {
    const sparkle = (0.5 + Math.sin(time * (0.5 + index * 0.06) + index) * 0.5) * motion.stable;

    group.position.set(motion.position.x, motion.position.y, motion.position.z);
    group.rotation.set(motion.rotation.x, motion.rotation.y, motion.rotation.z);
    group.scale.setScalar(motion.scale * motion.depthScale);
    material.opacity = motion.release * (0.22 + motion.capture * 0.5 + sparkle * 0.12);
    haloMaterial.opacity = motion.release * (0.018 + motion.capture * 0.11 + sparkle * 0.035);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    haloGeometry.dispose();
    haloMaterial.dispose();
  }

  return {
    group,
    update,
    dispose,
    getStatus(motion, drawProgress) {
      return {
        id: stage.id,
        progress: roundStatusValue(motion.progress),
        position: group.position.toArray().map(roundStatusValue),
        rotation: group.rotation.toArray().slice(0, 3).map(roundStatusValue),
        scale: roundStatusValue(group.scale.x),
        orbitDrawProgress: roundStatusValue(drawProgress),
        uuid: group.uuid
      };
    }
  };
}

function createFiveATransferFlow() {
  const random = seededRandom(8851);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(TRANSFER_PARTICLE_COUNT * 3);
  const colors = new Float32Array(TRANSFER_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const alphas = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const phases = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const stageIndices = new Uint8Array(TRANSFER_PARTICLE_COUNT);
  const curlSeeds = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const freedom = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const color = new THREE.Color(0x8df7ff);
  const white = new THREE.Color(0xffffff);
  const purpleBlue = new THREE.Color(0x7185cf);

  for (let i = 0; i < TRANSFER_PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    const stageIndex = i % FIVE_A_STAGES.length;
    const stage = FIVE_A_STAGES[stageIndex];
    const sizeRoll = random();

    phases[i] = (random() * 0.82 + (i % 7) * 0.027) % 1;
    stageIndices[i] = stageIndex;
    curlSeeds[i] = random() * Math.PI * 2;
    freedom[i] = random() < 0.16 ? 1 : 0;
    sizes[i] = sizeRoll < 0.76 ? 0.023 : sizeRoll < 0.96 ? 0.039 : 0.061;
    color.set(stage.color).lerp(white, i % 15 === 0 ? 0.58 : 0.18 + random() * 0.12);
    if (i % 67 === 0) color.lerp(purpleBlue, 0.22);
    colors[i3] = color.r * 0.78;
    colors[i3 + 1] = color.g * 0.82;
    colors[i3 + 2] = color.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const alphaAttribute = new THREE.BufferAttribute(alphas, 1);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  alphaAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', alphaAttribute);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspective = clamp(150.0 / max(1.0, -viewPosition.z), 0.8, 5.2);
        gl_PointSize = max(1.0, aSize * perspective * 42.0);
        gl_Position = projectionMatrix * viewPosition;
        vColor = color;
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float radius = length(centered);
        float falloff = 1.0 - smoothstep(0.16, 0.5, radius);
        if (falloff <= 0.001) discard;
        gl_FragColor = vec4(vColor, falloff * vAlpha);
      }
    `
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'FiveACoreReleaseParticleFlow';

  function update(delta, time, entrance, globalMotion) {
    const positionArray = positionAttribute.array;
    const alphaArray = alphaAttribute.array;

    for (let i = 0; i < TRANSFER_PARTICLE_COUNT; i += 1) {
      const i3 = i * 3;
      const stageIndex = stageIndices[i];
      const stage = FIVE_A_STAGES[stageIndex];
      const timing = getStageTiming(stageIndex);
      const motion = evaluateStageMotion(stage, stageIndex, entrance, time);
      const pathProgress = clamp01((entrance - timing.start) / (timing.captureEnd - timing.start));
      const travel = clamp01(pathProgress * 1.16 - phases[i] * 0.22);
      const path = evaluateReleaseParticlePosition(
        stage,
        stageIndex,
        travel,
        phases[i],
        curlSeeds[i],
        freedom[i],
        time,
        motion.stable
      );
      const trailWindow = smoothstep(0.02, 0.28, travel) * (1 - smoothstep(0.7, 1, travel));
      const midStream = smoothstep(0.18, 0.42, travel) * (1 - smoothstep(0.58, 0.82, travel));
      const captureGather = smoothstep(0.72, 0.92, travel) * (1 - smoothstep(0.94, 1, travel));
      const chargeAlpha = globalMotion.chargePulse * (1 - phases[i]) * 0.2;
      const depthCue = THREE.MathUtils.clamp(0.9 + path.z * 0.28, 0.72, 1.16);

      positionArray[i3] = path.x;
      positionArray[i3 + 1] = path.y;
      positionArray[i3 + 2] = path.z;
      alphaArray[i] = Math.min(
        0.8,
        (
          chargeAlpha
          + motion.release * (0.07 + trailWindow * 0.38 + midStream * 0.28 + captureGather * 0.24)
          + motion.stable * 0.09
        ) * depthCue
      );
    }

    positionAttribute.needsUpdate = true;
    alphaAttribute.needsUpdate = true;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose,
    particleCount: TRANSFER_PARTICLE_COUNT,
    uuid: points.uuid
  };
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
  const angle = getStageFinalAngle(index);

  group.name = `FiveALabel${stage.id}`;
  group.position.set(
    Math.cos(angle) * (stage.radius + 0.26),
    stage.height + 0.12,
    Math.sin(angle) * stage.radius * 0.42
  );
  sprite.scale.set(0.7 + index * 0.035, 0.14, 1);
  group.add(sprite);

  function update(time, motion) {
    const pulse = (0.5 + Math.sin(time * 0.28 + index) * 0.5) * motion.stable;
    const labelReveal = smoothstep(0.28, 0.9, motion.capture);
    const offset = 0.26 * labelReveal;

    group.position.set(
      motion.position.x + Math.cos(angle) * offset,
      motion.position.y + 0.12 + Math.sin(time * 0.1 + index) * 0.025 * motion.stable,
      motion.position.z
    );
    material.opacity = labelReveal * (0.42 + pulse * 0.035);
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
    const titleReveal = smoothstep(0.68, 0.94, entrance);

    material.opacity = titleReveal * (0.5 + Math.sin(time * 0.22) * 0.025);
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

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * (3 - 2 * x);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function smootherstep01(value) {
  const x = clamp01(value);

  return x * x * x * (x * (x * 6 - 15) + 10);
}

function getGlobalMotionState(progress) {
  const localProgress = clamp01(progress);
  const charge = smoothstep(0, 0.12, localProgress);

  return {
    localProgress,
    charge,
    chargePulse: Math.sin(charge * Math.PI),
    release: smoothstep(0.08, 0.52, localProgress),
    capture: smoothstep(0.42, 0.78, localProgress),
    stable: smoothstep(STABLE_DRIFT_START, 1, localProgress),
    stage: getMotionStage(localProgress)
  };
}

function getStageTiming(index) {
  return {
    start: 0.08 + index * 0.048,
    releaseEnd: 0.52 + index * 0.018,
    captureStart: 0.42 + index * 0.028,
    captureEnd: 0.78 + index * 0.028,
    stableStart: 0.72 + index * 0.025
  };
}

function evaluateStageMotion(stage, index, progress, time) {
  const timing = getStageTiming(index);
  const initialPhaseOffsets = [-1.12, -0.86, -1.31, -0.72, -1.46, -0.96];
  const depthPeaks = [-0.08, 0.12, -0.24, 0.28, -0.36, 0.44];
  const planeTilts = [-0.07, 0.1, -0.16, 0.15, -0.23, 0.25];
  const pathStrengths = [0.03, 0.038, 0.055, 0.064, 0.088, 0.1];
  const travelRaw = clamp01((progress - timing.start) / (timing.captureEnd - timing.start));
  const releaseRaw = clamp01((progress - timing.start) / (timing.releaseEnd - timing.start));
  const captureRaw = clamp01((progress - timing.captureStart) / (timing.captureEnd - timing.captureStart));
  const travel = getLayerTravelCurve(index, travelRaw);
  const release = getLayerReleaseCurve(index, releaseRaw);
  const capture = getLayerCaptureCurve(index, captureRaw);
  const stable = smoothstep(timing.stableStart, 1, progress);
  const captureArc = Math.sin(capture * Math.PI);
  const travelArc = Math.sin(travel * Math.PI);
  const finalAngle = getStageFinalAngle(index);
  const overshootAngle = THREE.MathUtils.degToRad(3 + index * 0.75) * captureArc * (index % 2 === 0 ? 1 : -1);
  const relaxEnvelope = travelArc * (1 - smootherstep01(capture * 0.9));
  const noiseSeed = 0.73 + index * 1.37;
  const pathStrength = stage.radius * pathStrengths[index] * relaxEnvelope;
  const curlX = (
    Math.sin(travel * Math.PI * (1.55 + index * 0.05) + noiseSeed)
    + Math.sin(travel * Math.PI * 3.1 + noiseSeed * 0.61) * 0.34
  ) * pathStrength;
  const curlY = (
    Math.cos(travel * Math.PI * (1.32 + index * 0.07) + noiseSeed * 1.2)
    + Math.sin(travel * Math.PI * 2.45 + noiseSeed) * 0.28
  ) * pathStrength * 0.68;
  const curlZ = Math.sin(travel * Math.PI * (1.8 + index * 0.08) + noiseSeed * 0.84) * pathStrength * 1.12;
  const angle = finalAngle
    + (1 - release) * initialPhaseOffsets[index]
    + overshootAngle
    + Math.sin(time * (0.085 + index * 0.004) + index) * 0.006 * stable;
  const overshootScale = captureArc * (0.02 + index * 0.0035);
  const radius = stage.radius * (0.04 + easeOutCubic(travel) * 0.96) * (1 + overshootScale);
  const depthArc = travelArc * depthPeaks[index];
  const lift = travelArc * (0.075 + index * 0.032) * (index % 2 === 0 ? 1 : -0.72);
  const stableAmplitude = stage.radius * (0.005 + index * 0.00135);
  const stableX = Math.sin(time * (0.068 + index * 0.008) + index * 1.3) * stableAmplitude * stable;
  const stableY = Math.cos(time * (0.057 + index * 0.006) + index) * stableAmplitude * 0.52 * stable;
  const stableZ = Math.sin(time * (0.061 + index * 0.007) + index * 0.7) * stableAmplitude * 0.82 * stable;
  const planeOffsetY = Math.sin(angle) * radius * planeTilts[index] * relaxEnvelope * 0.42;
  const planeOffsetZ = Math.cos(angle) * radius * planeTilts[index] * relaxEnvelope * 0.28;
  const depthScale = 1 + THREE.MathUtils.clamp(depthArc * 0.18, -0.05, 0.07) * (1 - capture);

  return {
    progress: travel,
    release,
    capture,
    stable,
    depthArc,
    drawProgress: clamp01(travel * 0.56 + capture * 0.44),
    orbitRotationY: Math.sin(time * (0.045 + index * 0.004) + index) * (0.006 + index * 0.001) * stable,
    position: {
      x: Math.cos(angle) * radius + curlX + stableX,
      y: stage.height * travel + lift + planeOffsetY + curlY + stableY,
      z: Math.sin(angle) * radius * 0.42 + depthArc + planeOffsetZ + curlZ + stableZ
    },
    rotation: {
      x: travelArc * (0.14 + index * 0.018) * (index % 2 === 0 ? 1 : -1),
      y: (1 - travel) * initialPhaseOffsets[index] * 0.34 + time * (0.022 + index * 0.002) * stable,
      z: travelArc * (0.11 + index * 0.014) * (index % 3 === 0 ? -1 : 1)
    },
    scale: 0.1 + release * 0.9 + overshootScale,
    depthScale,
    travelArc,
    relaxEnvelope
  };
}

function evaluateReleaseParticlePosition(stage, index, travel, phase, curlSeed, isFree, time, stable) {
  const configPhase = [-1.12, -0.86, -1.31, -0.72, -1.46, -0.96][index];
  const depthPeaks = [-0.08, 0.12, -0.24, 0.28, -0.36, 0.44];
  const pathStrengths = [0.03, 0.038, 0.055, 0.064, 0.088, 0.1];
  const finalAngle = getStageFinalAngle(index);
  const curlAmount = stage.radius * pathStrengths[index] * (isFree ? 1.65 : 0.72);
  const curlEnvelope = Math.sin(travel * Math.PI);
  const curl = (
    Math.sin(curlSeed + travel * Math.PI * (1.48 + index * 0.09))
    + Math.sin(curlSeed * 0.63 + travel * Math.PI * 3.1) * 0.34
  ) * curlAmount * curlEnvelope;
  const orbitFlow = time * (0.028 + index * 0.002) * stable;
  const angle = finalAngle
    + (1 - travel) * configPhase
    + phase * 0.24
    + curl
    + orbitFlow;
  const radius = stage.radius * (0.025 + easeOutCubic(travel) * 0.975) * (0.97 + phase * 0.06);
  const arc = Math.sin(travel * Math.PI);
  const freeLift = isFree ? Math.sin(curlSeed * 1.7 + travel * Math.PI * 2.4) * 0.075 * arc : 0;
  const streamPinch = 1 - Math.sin(travel * Math.PI) * (0.04 + phase * 0.035);

  return {
    x: Math.cos(angle) * radius * streamPinch + Math.cos(curlSeed) * curl,
    y: stage.height * travel + arc * (0.065 + index * 0.022) * (index % 2 === 0 ? 1 : -0.7) + freeLift + Math.sin(curlSeed * 1.2) * curl * 0.42,
    z: Math.sin(angle) * radius * 0.42 + arc * depthPeaks[index] + Math.sin(curlSeed) * curl
  };
}

function getLayerTravelCurve(index, value) {
  const x = clamp01(value);

  switch (index) {
    case 0:
      return 1 - Math.pow(1 - x, 1.65);
    case 1:
      return 1 - Math.pow(1 - x, 1.55);
    case 2:
      return smootherstep01(Math.pow(x, 1.32));
    case 3:
      return clamp01(smootherstep01(x) + Math.sin(x * Math.PI * 2) * 0.065);
    case 4:
      return smootherstep01(Math.pow(x, 1.16));
    case 5:
      return smootherstep01(Math.pow(x, 1.08));
    default:
      return smootherstep01(x);
  }
}

function getLayerReleaseCurve(index, value) {
  const x = clamp01(value);

  if (index === 0) return easeOutCubic(x);
  if (index === 1) return 1 - Math.pow(1 - x, 2.25);
  if (index === 2) return smootherstep01(Math.pow(x, 1.24));
  if (index === 3) return clamp01(smootherstep01(x) + Math.sin(x * Math.PI * 2) * 0.052);
  if (index === 4) return smootherstep01(Math.pow(x, 1.18));
  return smootherstep01(Math.pow(x, 1.1));
}

function getLayerCaptureCurve(index, value) {
  const x = clamp01(value);

  if (index === 0) return easeOutCubic(x);
  if (index === 1) return smoothstep(0, 1, x);
  if (index === 2) return smootherstep01(Math.pow(x, 1.1));
  if (index === 3) return clamp01(smootherstep01(x) + Math.sin(x * Math.PI * 2) * 0.035);
  if (index === 4) return smootherstep01(Math.pow(x, 1.16));
  return smootherstep01(Math.pow(x, 1.22));
}

function createFiveAMotionDiagnostics(group, orbitSystem, transferFlow) {
  const params = new URLSearchParams(window.location.search);
  const isDebugEnabled = import.meta.env.DEV && params.get('debugFiveAMotion') === '1';
  const requestedProgress = Number.parseFloat(params.get('progress'));
  const progressOverride = isDebugEnabled && Number.isFinite(requestedProgress)
    ? clamp01(requestedProgress)
    : null;
  const resourceCounts = inspectFiveAResources(group);
  const orbitParticleCount = FIVE_A_STAGES.reduce((total, stage) => total + stage.particleCount, 0);
  const status = {
    localProgress: 0,
    currentStage: 'core-charge',
    layers: [],
    particleCount: orbitParticleCount + transferFlow.particleCount + BACKGROUND_DUST_COUNT,
    releaseParticleCount: transferFlow.particleCount,
    scrollDirection: 'idle',
    resourceCounts,
    objectUuids: [],
    debugProgressOverride: progressOverride
  };

  function publish() {
    if (!import.meta.env.DEV) return;
    const serialized = JSON.stringify(status);

    window.__FIVE_A_MOTION_STATUS__ = status;
    document.documentElement.dataset.fiveAMotionStatus = serialized;
  }

  publish();

  return {
    isDebugEnabled,
    getProgressOverride(progress) {
      return progressOverride ?? progress;
    },
    update(progress, motion, direction) {
      status.localProgress = roundStatusValue(progress);
      status.currentStage = motion.stage;
      status.layers = orbitSystem.getStatus();
      status.scrollDirection = direction;
      status.objectUuids = [group.uuid, transferFlow.uuid, ...status.layers.map((layer) => layer.uuid)];
      publish();
    },
    dispose() {
      if (!import.meta.env.DEV) return;
      if (window.__FIVE_A_MOTION_STATUS__ === status) {
        delete window.__FIVE_A_MOTION_STATUS__;
      }
      delete document.documentElement.dataset.fiveAMotionStatus;
    }
  };
}

function inspectFiveAResources(group) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry.uuid);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];

    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material.uuid);
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value.uuid);
      });
    });
  });

  return {
    geometries: geometries.size,
    materials: materials.size,
    textures: textures.size
  };
}

function getMotionStage(progress) {
  if (progress < 0.12) return 'core-charge';
  if (progress < 0.52) return 'spiral-release';
  if (progress < 0.78) return 'orbit-capture';
  return 'stable';
}

function getStageFinalAngle(index) {
  return -0.75 + index * 0.38;
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function roundStatusValue(value) {
  return Math.round(value * 10000) / 10000;
}

export const fiveASceneManager = {
  createFiveAScene
};
