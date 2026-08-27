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
    speed: 0.09,
    depthOffset: -0.42,
    nodeRadius: 0.09,
    nodeParticleCount: 24,
    nodeScale: 0.48,
    nodeBrightness: 0.34,
    populationOpacity: 0.3,
    populationSizeScale: 0.72,
    populationSpread: 0.55
  },
  {
    id: 'A1',
    label: 'AWARE',
    value: '486K',
    radius: 1.13,
    height: -0.62,
    color: 0x1b8dff,
    particleCount: 62,
    speed: 0.078,
    depthOffset: -0.62,
    nodeRadius: 0.115,
    nodeParticleCount: 68,
    gpuParticleCount: 780,
    nodeScale: 0.82,
    nodeBrightness: 0.8,
    visualRadiusScale: 1.34,
    shellVisibility: 1.22,
    innerEnergyScale: 1.16,
    angleOffset: -0.22,
    wireBrightness: 0.66,
    populationOpacity: 0.68,
    populationSizeScale: 0.85,
    populationSpread: 0.85
  },
  {
    id: 'A2',
    label: 'APPEAL',
    value: '216K',
    radius: 1.45,
    height: -0.12,
    color: 0x00b7ff,
    particleCount: 52,
    speed: 0.066,
    depthOffset: 0.44,
    nodeRadius: 0.13,
    nodeParticleCount: 84,
    gpuParticleCount: 980,
    nodeScale: 0.94,
    nodeBrightness: 0.96,
    visualRadiusScale: 1.15,
    shellVisibility: 1.12,
    innerEnergyScale: 1.16,
    angleOffset: -0.18,
    wireBrightness: 0.9,
    populationOpacity: 0.82,
    populationSizeScale: 1,
    populationSpread: 1.05
  },
  {
    id: 'A3',
    label: 'ASK',
    value: '92K',
    radius: 2,
    height: 0.32,
    color: 0x00dcff,
    particleCount: 42,
    speed: 0.058,
    depthOffset: 0.82,
    nodeRadius: 0.15,
    nodeParticleCount: 104,
    gpuParticleCount: 1180,
    nodeScale: 1.08,
    nodeBrightness: 1.08,
    visualRadiusScale: 1.12,
    shellVisibility: 1.16,
    innerEnergyScale: 1.18,
    angleOffset: 0.24,
    wireBrightness: 1,
    populationOpacity: 0.95,
    populationSizeScale: 1.12,
    populationSpread: 1.15
  },
  {
    id: 'A4',
    label: 'ACT',
    value: '31K',
    radius: 2.15,
    height: 0.72,
    color: 0x74f7ff,
    particleCount: 34,
    speed: 0.05,
    depthOffset: -0.12,
    nodeRadius: 0.148,
    nodeParticleCount: 76,
    gpuParticleCount: 880,
    nodeScale: 1.11,
    nodeBrightness: 0.86,
    visualRadiusScale: 2.22,
    shellVisibility: 1.42,
    innerEnergyScale: 1.2,
    angleOffset: 0.22,
    wireBrightness: 0.82,
    populationOpacity: 0.78,
    populationSizeScale: 0.92,
    populationSpread: 1
  },
  {
    id: 'A5',
    label: 'ADVOCATE',
    value: '8.6K',
    radius: 2.48,
    height: 1.18,
    color: 0xd8fbff,
    particleCount: 26,
    speed: 0.044,
    depthOffset: -0.86,
    nodeRadius: 0.136,
    nodeParticleCount: 64,
    gpuParticleCount: 680,
    nodeScale: 0.87,
    nodeBrightness: 0.7,
    visualRadiusScale: 2.42,
    shellVisibility: 1.48,
    innerEnergyScale: 1.24,
    angleOffset: 0.2,
    wireBrightness: 0.58,
    populationOpacity: 0.62,
    populationSizeScale: 0.82,
    populationSpread: 0.78
  }
];

const BACKGROUND_DUST_COUNT = 260;
const TRANSFER_PARTICLE_COUNT = 432;
const FIVE_A_CORE_RADIUS = 0.56;
const FIVE_A_CORE_PARTICLE_COUNT = 2200;
const FIVE_A_STAGE_GPU_PARTICLE_COUNT = FIVE_A_STAGES
  .slice(1)
  .reduce((total, stage) => total + stage.gpuParticleCount, 0);
const FIVE_A_FINAL_POSITION = Object.freeze([-2.35, -0.22, -2.08]);
const FIVE_A_FINAL_SCALE = 0.94;
const FIVE_A_STAGE_GROUP_CORE_PULL = -0.13;
const STABLE_DRIFT_START = 0.72;

export const FIVE_A_VISUAL_V2 = Object.freeze({
  version: '2.0',
  stageCount: FIVE_A_STAGES.length,
  primaryStageCount: FIVE_A_STAGES.length - 1,
  opportunityIsSecondary: true,
  coreRadius: FIVE_A_CORE_RADIUS,
  coreParticleCount: FIVE_A_CORE_PARTICLE_COUNT,
  stageParticleCount: FIVE_A_STAGE_GPU_PARTICLE_COUNT,
  stageParticleDrawCalls: 1,
  coreParticleDrawCalls: 1,
  transferParticleCount: TRANSFER_PARTICLE_COUNT,
  backgroundDustCount: BACKGROUND_DUST_COUNT,
  brokenOrbits: true,
  labelsIncludeValues: false,
  stageProfiles: Object.freeze(FIVE_A_STAGES.map((stage) => Object.freeze({
    id: stage.id,
    depthOffset: stage.depthOffset,
    nodeParticleCount: stage.nodeParticleCount,
    gpuParticleCount: stage.gpuParticleCount ?? 0,
    nodeScale: stage.nodeScale,
    nodeBrightness: stage.nodeBrightness,
    visualRadiusScale: stage.visualRadiusScale ?? 1,
    shellVisibility: stage.shellVisibility ?? 1,
    innerEnergyScale: stage.innerEnergyScale ?? 1,
    angleOffset: stage.angleOffset ?? 0,
    nodeRadius: stage.nodeRadius,
    radius: stage.radius,
    height: stage.height
  }))),
  depthLayers: Object.freeze({ near: ['A2', 'A3'], mid: ['A4'], far: ['A1', 'A5'] }),
  coreActivityGain: 1.18,
  flowOpacityGain: 1.25,
  flowHasShortTrails: true,
  flowHasGaps: true,
  gpuParticleAttributes: Object.freeze(['nodeId', 'seed', 'radius', 'size', 'brightness', 'depthBias']),
  selectiveEnergyRatios: Object.freeze({ lowMid: 0.9, brighter: 0.08, hero: 0.02 }),
  coreActivitySpread: 1.22,
  journeyEnergyPacketStride: 53,
  stageGroupCorePull: FIVE_A_STAGE_GROUP_CORE_PULL,
  wireframeVisualWeight: 0.075,
  stageNodeComposition: Object.freeze(['particle-shell', 'soft-inner-glow', 'sparse-wireframe', 'soft-fresnel-edge']),
  stageRootContract: 'single-orbit-stage-root',
  stageRootVisualChildren: Object.freeze(['particle-sphere', 'inner-glow', 'halo-fresnel', 'sparse-wireframe', 'label-anchor']),
  journeyUsesStageRoot: true,
  compositionReference: '137b3de-original-five-a',
  palette: Object.freeze(['deep-navy', 'icy-blue', 'cyan-blue', 'silver-white'])
});

// Kept as a compatibility alias for existing diagnostics and external review scripts.
export const FIVE_A_VISUAL_V1 = FIVE_A_VISUAL_V2;

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
    transferFlow.update(delta, time, motionProgress, motion, orbitSystem.getJourneyStagePositions());
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
  const geometry = new THREE.SphereGeometry(FIVE_A_CORE_RADIUS, 40, 28);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x031126,
    emissive: 0x063d68,
    emissiveIntensity: 0.24,
    metalness: 0.08,
    roughness: 0.38,
    envMapIntensity: 0.18,
    clearcoat: 0.3,
    clearcoatRoughness: 0.28,
    transparent: true,
    opacity: 0.72,
    transmission: 0.06,
    thickness: 0.82,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uDeep: { value: new THREE.Color(0x08325a) },
      uIce: { value: new THREE.Color(0x78c9ed) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uDeep;
      uniform vec3 uIce;
      varying vec3 vNormal;
      varying vec3 vViewDirection;

      void main() {
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDirection), 0.0), 3.2);
        vec3 color = mix(uDeep, uIce, fresnel * 0.46);
        gl_FragColor = vec4(color, fresnel * uOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const atmosphere = new THREE.Mesh(geometry, atmosphereMaterial);
  const internalParticles = createFiveACoreParticles();
  const haloGeometry = createBrokenCoreHaloGeometry(FIVE_A_CORE_RADIUS * 1.46);
  const haloMaterial = new THREE.LineBasicMaterial({
    color: 0x559bc5,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const halo = new THREE.LineSegments(haloGeometry, haloMaterial);

  group.name = 'FiveACore';
  atmosphere.name = 'FiveACoreAtmosphere';
  atmosphere.scale.setScalar(1.055);
  halo.name = 'FiveACoreBrokenHalo';
  group.add(atmosphere, mesh, internalParticles.points, halo);

  function update(delta, time, motion) {
    const chargeWave = Math.sin(motion.charge * Math.PI);
    const stableSparkle = (0.5 + Math.sin(time * 0.34) * 0.5) * motion.stable;

    group.scale.setScalar(0.83 - chargeWave * 0.045 + motion.release * 0.17);
    group.rotation.y = motion.release * 0.34 + time * 0.012 * motion.stable;
    group.rotation.z = -motion.release * 0.11 - time * 0.004 * motion.stable;
    mesh.rotation.x = time * 0.026 * motion.stable;
    mesh.rotation.y = time * 0.041 * motion.stable;
    atmosphere.rotation.y = -time * 0.015 * motion.stable;
    halo.rotation.y = time * 0.009 * motion.stable;
    halo.rotation.z = Math.sin(time * 0.022) * 0.08 * motion.stable;
    material.emissiveIntensity = 0.12 + motion.release * 0.17 + chargeWave * 0.04 + stableSparkle * 0.015;
    atmosphereMaterial.uniforms.uOpacity.value = 0.015 + motion.release * 0.075 + chargeWave * 0.025;
    haloMaterial.opacity = 0.008 + motion.release * 0.034 + chargeWave * 0.018;
    internalParticles.update(time, motion);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    atmosphereMaterial.dispose();
    internalParticles.dispose();
    haloGeometry.dispose();
    haloMaterial.dispose();
  }

  return { group, update, dispose };
}

function createFiveACoreParticles() {
  const random = seededRandom(7319);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(FIVE_A_CORE_PARTICLE_COUNT * 3);
  const colors = new Float32Array(FIVE_A_CORE_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(FIVE_A_CORE_PARTICLE_COUNT);
  const alphas = new Float32Array(FIVE_A_CORE_PARTICLE_COUNT);
  const seeds = new Float32Array(FIVE_A_CORE_PARTICLE_COUNT);
  const radii = new Float32Array(FIVE_A_CORE_PARTICLE_COUNT);
  const brightness = new Float32Array(FIVE_A_CORE_PARTICLE_COUNT);
  const layers = new Float32Array(FIVE_A_CORE_PARTICLE_COUNT);
  const deep = new THREE.Color(0x174d7c);
  const ice = new THREE.Color(0x8fbcd4);
  const silver = new THREE.Color(0xb8ccd7);
  const clumps = [
    new THREE.Vector3(0.22, 0.058, -0.092),
    new THREE.Vector3(-0.1, -0.115, 0.127),
    new THREE.Vector3(0.06, 0.184, 0.04),
    new THREE.Vector3(0, 0.035, -0.184)
  ];
  const voidCenter = new THREE.Vector3(0.045, -0.03, 0.025);

  for (let index = 0; index < FIVE_A_CORE_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const layer = random() < 0.7 ? 0 : random() < 0.88 ? 1 : 2;
    const radius = layer === 0
      ? Math.pow(random(), 0.58) * FIVE_A_CORE_RADIUS * 1.02
      : layer === 1
        ? (0.55 + Math.pow(random(), 0.78) * 0.55) * FIVE_A_CORE_RADIUS
        : (0.9 + random() * 0.32) * FIVE_A_CORE_RADIUS;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const position = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius,
      Math.sin(phi) * Math.sin(theta) * radius
    );
    const clump = clumps[Math.floor(random() * clumps.length)];
    const isHighlight = index % 131 === 0;
    const color = deep.clone().lerp(ice, 0.16 + random() * (layer === 0 ? 0.36 : 0.24));

    if (layer < 2) position.lerp(clump, 0.12 + random() * 0.28);
    if (position.distanceToSquared(voidCenter) < 0.011) {
      position.multiplyScalar(1.46);
    }
    position.x += (0.012 + random() * 0.022) * (layer === 2 ? 0.55 : 1);
    if (isHighlight) color.lerp(silver, 0.48);
    positions[stride] = position.x;
    positions[stride + 1] = position.y;
    positions[stride + 2] = position.z;
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = layer === 2
      ? 0.008 + random() * 0.012
      : isHighlight
        ? 0.024 + random() * 0.012
        : 0.006 + random() * 0.015;
    alphas[index] = layer === 2 ? 0.13 + random() * 0.18 : 0.205 + random() * 0.37;
    seeds[index] = random() * Math.PI * 2;
    radii[index] = radius / FIVE_A_CORE_RADIUS;
    brightness[index] = isHighlight ? 0.74 : 0.24 + random() * 0.42;
    layers[index] = layer;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
  geometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
  const material = createSoftParticleMaterial();
  const points = new THREE.Points(geometry, material);

  points.name = 'FiveACoreInternalParticles';
  return {
    points,
    update(time, motion) {
      points.rotation.y = time * 0.018 * motion.stable;
      points.rotation.x = Math.sin(time * 0.024) * 0.09 * motion.stable;
      material.uniforms.uTime.value = time;
      material.uniforms.uStable.value = motion.stable;
      material.uniforms.uOpacity.value = motion.release * (
        0.232 + motion.stable * 0.097 + Math.sin(time * 0.18) * 0.0155
      );
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createBrokenCoreHaloGeometry(radius) {
  const positions = [];

  for (let arc = 0; arc < 3; arc += 1) {
    const segments = 54;
    const phase = arc * 0.83;

    for (let segment = 0; segment < segments; segment += 1) {
      if ((segment + arc * 3) % 11 >= 6 || (segment > 20 + arc * 3 && segment < 29 + arc * 2)) continue;
      const a0 = phase + segment / segments * Math.PI * 2;
      const a1 = phase + (segment + 1) / segments * Math.PI * 2;
      const point0 = getCoreHaloPoint(arc, a0, radius);
      const point1 = getCoreHaloPoint(arc, a1, radius);

      positions.push(...point0, ...point1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function getCoreHaloPoint(arc, angle, radius) {
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * 0.72;

  if (arc === 0) return [x, y, Math.sin(angle * 1.7) * 0.035];
  if (arc === 1) return [x * 0.64, Math.sin(angle * 1.3) * 0.04, y];
  return [Math.sin(angle * 1.5) * 0.04, x * 0.7, y];
}

function createSoftParticleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uStable: { value: 0 }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aSeed;
      attribute float aRadius;
      attribute float aBrightness;
      attribute float aLayer;
      uniform float uTime;
      uniform float uStable;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBrightness;

      void main() {
        vec3 animated = position;
        float flow = uTime * (0.045 + fract(aSeed * 1.37) * 0.035) * uStable;
        float drift = (0.0025 + aRadius * 0.0035) * uStable;
        animated.x += sin(flow + aSeed) * drift;
        animated.y += cos(flow * 0.83 + aSeed * 1.7) * drift * 0.7;
        animated.z += sin(flow * 0.67 + aSeed * 2.1) * drift;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        float perspective = clamp(170.0 / max(1.0, -viewPosition.z), 0.82, 4.8);
        float depthScale = mix(0.78, 1.12, clamp(0.5 - viewPosition.z * 0.06, 0.0, 1.0));
        gl_PointSize = max(1.0, aSize * perspective * 44.0 * depthScale);
        gl_Position = projectionMatrix * viewPosition;
        vColor = color;
        vAlpha = aAlpha * mix(1.0, 0.58, step(1.5, aLayer));
        vBrightness = aBrightness;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBrightness;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float softPoint = 1.0 - smoothstep(0.06, 0.5, radius);
        float tinyCore = 1.0 - smoothstep(0.0, 0.13, radius);
        if (softPoint <= 0.001) discard;
        vec3 luminousColor = vColor * (0.72 + vBrightness * 0.5 + tinyCore * 0.12);
        gl_FragColor = vec4(luminousColor, softPoint * (0.78 + tinyCore * 0.16) * vAlpha * uOpacity);
      }
    `
  });
}

function createFiveAOrbitSystem() {
  const group = new THREE.Group();
  const orbits = FIVE_A_STAGES.map((stage, index) => createFiveAOrbit(stage, index));
  const labels = FIVE_A_STAGES.map((stage, index) => createFiveALabel(stage, index));
  const stageParticleSpheres = createBatchedStageParticleSpheres();
  const stageRoots = FIVE_A_STAGES.map(() => ({
    matrix: new THREE.Matrix4(),
    localPosition: new THREE.Vector3(),
    journeyPosition: new THREE.Vector3()
  }));
  const journeyStagePositions = stageRoots.map(({ journeyPosition }) => journeyPosition);
  let lastMotions = FIVE_A_STAGES.map((stage, index) => evaluateStageMotion(stage, index, 0, 0));

  group.name = 'FiveAOrbitSystem';
  orbits.forEach((orbit) => group.add(orbit.group));
  labels.forEach((label) => group.add(label.group));
  group.add(stageParticleSpheres.points);

  function update(delta, time, entrance) {
    const stable = getGlobalMotionState(entrance).stable;

    group.rotation.y = Math.sin(time * 0.018) * 0.06 * stable;
    group.rotation.z = Math.sin(time * 0.014) * 0.018 * stable;
    orbits.forEach((orbit, index) => {
      const motion = evaluateStageMotion(FIVE_A_STAGES[index], index, entrance, time);

      lastMotions[index] = motion;
      orbit.update(delta, time, motion);
      orbit.getParticleMatrix(stageRoots[index].matrix);
      stageRoots[index].localPosition.setFromMatrixPosition(stageRoots[index].matrix);
    });
    group.updateMatrix();
    stageRoots.forEach((stageRoot, index) => {
      stageRoot.journeyPosition.copy(stageRoot.localPosition).applyMatrix4(group.matrix);
      labels[index].update(time, lastMotions[index], stageRoot.localPosition);
    });
    stageParticleSpheres.update(time, stable, stageRoots, lastMotions);
  }

  function dispose() {
    orbits.forEach((orbit) => orbit.dispose());
    labels.forEach((label) => label.dispose());
    stageParticleSpheres.dispose();
    group.clear();
  }

  return {
    group,
    update,
    dispose,
    getJourneyStagePositions() {
      return journeyStagePositions;
    },
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
    group.position.x = index === 0 ? 0 : FIVE_A_STAGE_GROUP_CORE_PULL * motion.release;
    group.position.z = stage.depthOffset * motion.release;
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
    getParticleMatrix(target) {
      group.updateMatrix();
      stageNode.group.updateMatrix();
      return target.multiplyMatrices(group.matrix, stageNode.group.matrix);
    },
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
      if ((segment + index + arcIndex * 2) % 7 >= 4) continue;
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
      0.008 + motion.capture * 0.058 + flowingHighlight * 0.5
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
    sizes[i] = (sizeRoll < 0.76 ? 0.019 : sizeRoll < 0.96 ? 0.031 : 0.047) * stage.populationSizeScale;
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
      const depthCurl = Math.sin(angles[i] * 3.2 + i * 0.37) * motion.depthArc * 0.13 * stage.populationSpread;
      const captureCluster = Math.exp(-Math.pow((angles[i] - getStageFinalAngle(index)) * 1.35, 2));

      positionArray[i3] = Math.cos(angle) * radius;
      positionArray[i3 + 1] = stage.height * motion.release + Math.sin(angle * 2 + i) * 0.025 * motion.release * stage.populationSpread;
      positionArray[i3 + 2] = Math.sin(angle) * radius * 0.42 + depthCurl;
      alphaArray[i] = motion.release * stage.populationOpacity * (
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

function createBatchedStageParticleSpheres() {
  const primaryStages = FIVE_A_STAGES.slice(1);
  const random = seededRandom(14731);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT * 3);
  const colors = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT * 3);
  const nodeIds = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT);
  const seeds = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT);
  const radii = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT);
  const sizes = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT);
  const brightness = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT);
  const depthBias = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT);
  const layers = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT);
  const alphas = new Float32Array(FIVE_A_STAGE_GPU_PARTICLE_COUNT);
  const ice = new THREE.Color(0xa8d6e8);
  const silver = new THREE.Color(0xd1dce2);
  let cursor = 0;

  primaryStages.forEach((stage, nodeIndex) => {
    const visualRadius = stage.nodeRadius * stage.visualRadiusScale;
    const base = new THREE.Color(stage.color).lerp(new THREE.Color(0x163b5d), 0.36);
    const clumps = Array.from({ length: 2 + (nodeIndex % 3) }, () => {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const radius = visualRadius * (0.12 + random() * 0.28);

      return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius
      );
    });

    for (let localIndex = 0; localIndex < stage.gpuParticleCount; localIndex += 1) {
      const stride = cursor * 3;
      const roll = random();
      const layer = roll < 0.68 ? 0 : roll < 0.91 ? 1 : 2;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const unit = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      );
      const isHeroHighlight = localIndex % (47 + nodeIndex * 2) === 0;
      const isEnergyHighlight = !isHeroHighlight && (localIndex + nodeIndex * 3) % 10 === 0;
      const radius = layer === 0
        ? visualRadius * (0.78 + random() * 0.3 + Math.sin(theta * 3 + phi * 2) * 0.035)
        : layer === 1
          ? Math.pow(random(), 0.68) * visualRadius * 0.48 * stage.innerEnergyScale
          : visualRadius * (1.16 + Math.pow(random(), 1.8) * 0.58);
      const position = unit.multiplyScalar(radius);

      if (layer === 1) {
        const clump = clumps[Math.floor(random() * clumps.length)];
        position.lerp(clump, 0.34 + random() * 0.38);
      }

      const color = base.clone().lerp(
        layer === 1 ? silver : ice,
        isHeroHighlight
          ? 0.72
          : isEnergyHighlight
            ? 0.46 + random() * 0.16
            : layer === 1
              ? 0.32 + random() * 0.24
              : 0.14 + random() * 0.24
      );

      positions[stride] = position.x;
      positions[stride + 1] = position.y;
      positions[stride + 2] = position.z;
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      nodeIds[cursor] = nodeIndex;
      seeds[cursor] = random() * Math.PI * 2;
      radii[cursor] = radius / visualRadius;
      sizes[cursor] = layer === 2
        ? 0.008 + random() * 0.012
        : isHeroHighlight
          ? 0.028 + random() * 0.012
          : isEnergyHighlight
            ? 0.016 + random() * 0.01
          : layer === 1
            ? 0.011 + random() * 0.017
            : 0.008 + random() * 0.015;
      brightness[cursor] = isHeroHighlight
        ? 1.35
        : isEnergyHighlight
          ? 0.78 + random() * 0.18
          : layer === 1
            ? 0.52 + random() * 0.32
            : 0.22 + random() * 0.42;
      depthBias[cursor] = random() * 2 - 1;
      layers[cursor] = layer;
      const baseAlpha = layer === 2 ? 0.1 + random() * 0.18 : 0.26 + random() * 0.48;

      const energyAlpha = isHeroHighlight ? 1.25 : isEnergyHighlight ? 1.12 : 1;

      alphas[cursor] = (layer === 1 ? baseAlpha : baseAlpha * stage.shellVisibility) * energyAlpha;
      cursor += 1;
    }
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aNodeId', new THREE.BufferAttribute(nodeIds, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('aDepthBias', new THREE.BufferAttribute(depthBias, 1));
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const nodeMatrices = Array.from({ length: 5 }, () => new THREE.Matrix4());
  const nodeOpacities = new Float32Array(5);
  const nodeScales = new Float32Array(5);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStable: { value: 0 },
      uNodeMatrices: { value: nodeMatrices },
      uNodeOpacities: { value: nodeOpacities },
      uNodeScales: { value: nodeScales }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    vertexColors: true,
    vertexShader: `
      attribute float aNodeId;
      attribute float aSeed;
      attribute float aRadius;
      attribute float aSize;
      attribute float aBrightness;
      attribute float aDepthBias;
      attribute float aLayer;
      attribute float aAlpha;
      uniform float uTime;
      uniform float uStable;
      uniform mat4 uNodeMatrices[5];
      uniform float uNodeOpacities[5];
      uniform float uNodeScales[5];
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBrightness;
      varying float vLayer;
      varying float vEdgeEnergy;

      mat4 getNodeMatrix(float nodeId) {
        if (nodeId < 0.5) return uNodeMatrices[0];
        if (nodeId < 1.5) return uNodeMatrices[1];
        if (nodeId < 2.5) return uNodeMatrices[2];
        if (nodeId < 3.5) return uNodeMatrices[3];
        return uNodeMatrices[4];
      }

      float getNodeOpacity(float nodeId) {
        if (nodeId < 0.5) return uNodeOpacities[0];
        if (nodeId < 1.5) return uNodeOpacities[1];
        if (nodeId < 2.5) return uNodeOpacities[2];
        if (nodeId < 3.5) return uNodeOpacities[3];
        return uNodeOpacities[4];
      }

      float getNodeScale(float nodeId) {
        if (nodeId < 0.5) return uNodeScales[0];
        if (nodeId < 1.5) return uNodeScales[1];
        if (nodeId < 2.5) return uNodeScales[2];
        if (nodeId < 3.5) return uNodeScales[3];
        return uNodeScales[4];
      }

      void main() {
        float activity = sin(uTime * (0.22 + fract(aSeed * 1.71) * 0.16) + aSeed);
        vec3 localPosition = position;
        float innerLayer = 1.0 - step(0.5, aLayer);
        float drift = innerLayer * (0.0015 + aRadius * 0.0015) * uStable;
        localPosition += vec3(
          sin(aSeed * 1.3 + uTime * 0.13),
          cos(aSeed * 1.7 + uTime * 0.11),
          sin(aSeed * 2.1 + uTime * 0.09)
        ) * drift;
        vec4 localWorld = getNodeMatrix(aNodeId) * vec4(localPosition, 1.0);
        vec4 worldPosition = modelMatrix * localWorld;
        vec4 viewPosition = viewMatrix * worldPosition;
        vec3 worldNormal = normalize(mat3(modelMatrix * getNodeMatrix(aNodeId)) * normalize(localPosition));
        vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
        float perspective = clamp(178.0 / max(1.0, -viewPosition.z), 0.82, 5.2);
        float depthVariation = mix(0.86, 1.14, aDepthBias * 0.5 + 0.5);
        float shimmer = 1.0 + activity * (0.025 + aBrightness * 0.035) * uStable;

        gl_PointSize = max(1.0, aSize * perspective * 44.0 * getNodeScale(aNodeId) * depthVariation);
        gl_Position = projectionMatrix * viewPosition;
        vColor = color;
        vAlpha = aAlpha * getNodeOpacity(aNodeId) * shimmer;
        vBrightness = aBrightness;
        vLayer = aLayer;
        float rimGap = smoothstep(0.38, 0.72, fract(aSeed * 1.618 + aNodeId * 0.173));
        vEdgeEnergy = (1.0 - step(0.5, aLayer))
          * pow(1.0 - abs(dot(worldNormal, viewDirection)), 2.35)
          * rimGap;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBrightness;
      varying float vLayer;
      varying float vEdgeEnergy;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float softFalloff = 1.0 - smoothstep(0.06, 0.5, radius);
        float brightCore = 1.0 - smoothstep(0.0, 0.105, radius);
        float haloLayer = step(1.5, vLayer);
        float alpha = softFalloff * mix(1.0, 0.58, haloLayer) * vAlpha;
        if (alpha <= 0.001) discard;
        float heroGain = smoothstep(1.08, 1.32, vBrightness);
        vec3 luminous = vColor * (
          0.74
          + vBrightness * 0.74
          + brightCore * min(vBrightness, 0.84) * 0.26
          + vEdgeEnergy * 0.34
          + heroGain * 0.46
        );
        gl_FragColor = vec4(luminous, alpha * (0.78 + brightCore * 0.18 + vEdgeEnergy * 0.14));
      }
    `
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'FiveAStageGpuParticleSpheres';
  points.frustumCulled = false;

  return {
    points,
    update(time, stable, stageRoots, motions) {
      material.uniforms.uTime.value = time;
      material.uniforms.uStable.value = stable;
      primaryStages.forEach((stage, nodeIndex) => {
        const motion = motions[nodeIndex + 1];
        const sparkle = (0.5 + Math.sin(time * (0.5 + nodeIndex * 0.06) + nodeIndex) * 0.5) * motion.stable;

        nodeMatrices[nodeIndex].copy(stageRoots[nodeIndex + 1].matrix);
        nodeOpacities[nodeIndex] = motion.release * stage.nodeBrightness * (
          0.22 + motion.capture * 0.34 + sparkle * 0.035
        );
        nodeScales[nodeIndex] = motion.scale * motion.depthScale * stage.nodeScale;
      });
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createStageNode(stage, index) {
  const group = new THREE.Group();
  const angle = getStageFinalAngle(index);
  const particleNode = index === 0 ? createStageNodeParticles(stage, index) : null;
  const wireGeometry = index === 0
    ? null
    : new THREE.IcosahedronGeometry(stage.nodeRadius * 0.94, 1);
  const wireMaterial = index === 0
    ? null
    : new THREE.MeshBasicMaterial({
      color: stage.color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      wireframe: true,
      depthWrite: false,
      fog: false
    });
  const wire = wireGeometry ? new THREE.Mesh(wireGeometry, wireMaterial) : null;

  group.position.set(Math.cos(angle) * stage.radius, stage.height, Math.sin(angle) * stage.radius * 0.42);
  group.name = `FiveAStageNode${stage.id}`;
  if (particleNode) group.add(particleNode.points);
  if (wire) group.add(wire);

  function update(time, motion) {
    const sparkle = (0.5 + Math.sin(time * (0.5 + index * 0.06) + index) * 0.5) * motion.stable;

    group.position.set(motion.position.x, motion.position.y, motion.position.z);
    group.rotation.set(motion.rotation.x, motion.rotation.y, motion.rotation.z);
    group.scale.setScalar(motion.scale * motion.depthScale * stage.nodeScale);
    particleNode?.update(time, motion, sparkle);
    if (wireMaterial) {
      wire.rotation.y = time * (0.018 + index * 0.0015) * motion.stable;
      wire.rotation.x = Math.sin(time * 0.024 + index) * 0.12 * motion.stable;
      wireMaterial.opacity = motion.release * stage.wireBrightness * (
        0.0025 + motion.capture * 0.008 + sparkle * 0.0015
      );
    }
  }

  function dispose() {
    particleNode?.dispose();
    wireGeometry?.dispose();
    wireMaterial?.dispose();
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

function createStageNodeParticles(stage, index) {
  const random = seededRandom(9200 + index * 137);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(stage.nodeParticleCount * 3);
  const colors = new Float32Array(stage.nodeParticleCount * 3);
  const sizes = new Float32Array(stage.nodeParticleCount);
  const alphas = new Float32Array(stage.nodeParticleCount);
  const layers = new Float32Array(stage.nodeParticleCount);
  const base = new THREE.Color(stage.color).multiplyScalar(index === 0 ? 0.48 : 0.72);
  const ice = new THREE.Color(index === 5 ? 0xc7dce8 : 0xa8e4f5);

  for (let particleIndex = 0; particleIndex < stage.nodeParticleCount; particleIndex += 1) {
    const stride = particleIndex * 3;
    const roll = random();
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const isInnerGlow = roll < 0.22;
    const isLocalHighlight = !isInnerGlow && particleIndex % 17 === 0;
    const radius = isInnerGlow
      ? Math.pow(random(), 0.82) * stage.nodeRadius * 0.38
      : roll > 0.92
        ? stage.nodeRadius * (1.28 + random() * 0.42)
        : stage.nodeRadius * (0.88 + random() * 0.18);
    const color = base.clone().lerp(
      ice,
      isInnerGlow ? 0.32 + random() * 0.2 : isLocalHighlight ? 0.62 : 0.16 + random() * 0.2
    );

    positions[stride] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[stride + 1] = Math.cos(phi) * radius;
    positions[stride + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[particleIndex] = isInnerGlow
      ? 0.046 + random() * 0.026
      : isLocalHighlight
        ? 0.038 + random() * 0.014
        : 0.018 + random() * 0.02;
    alphas[particleIndex] = roll > 0.92
      ? 0.08 + random() * 0.12
      : isInnerGlow
        ? 0.24 + random() * 0.24
        : isLocalHighlight
          ? 0.64 + random() * 0.18
          : 0.38 + random() * 0.34;
    layers[particleIndex] = isInnerGlow ? 0 : isLocalHighlight ? 2 : 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
  const material = createStageParticleMaterial();
  const points = new THREE.Points(geometry, material);

  points.name = `FiveAStageNodeParticles${stage.id}`;
  return {
    points,
    update(time, motion, sparkle) {
      points.rotation.y = time * (0.014 + index * 0.001) * motion.stable;
      points.rotation.z = Math.sin(time * 0.019 + index) * 0.1 * motion.stable;
      material.uniforms.uOpacity.value = motion.release * stage.nodeBrightness * (
        0.28 + motion.capture * 0.48 + sparkle * 0.06
      );
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createStageParticleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aLayer;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vLayer;
      varying float vFresnel;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec4 viewPosition = viewMatrix * worldPosition;
        vec3 worldNormal = normalize(mat3(modelMatrix) * normalize(position));
        vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
        float perspective = clamp(170.0 / max(1.0, -viewPosition.z), 0.82, 4.8);

        gl_PointSize = max(1.0, aSize * perspective * 38.0);
        gl_Position = projectionMatrix * viewPosition;
        vColor = color;
        vAlpha = aAlpha;
        vLayer = aLayer;
        vFresnel = pow(1.0 - abs(dot(worldNormal, viewDirection)), 2.8);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vLayer;
      varying float vFresnel;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float innerGlow = 1.0 - smoothstep(0.02, 0.5, radius);
        float shellPoint = 1.0 - smoothstep(0.09, 0.5, radius);
        float isShell = step(0.5, vLayer);
        float isHighlight = step(1.5, vLayer);
        float shape = mix(innerGlow * innerGlow, shellPoint, isShell);
        float edgeGain = isShell * vFresnel * 0.38;
        float highlightGain = isHighlight * 0.16;

        if (shape <= 0.001) discard;
        gl_FragColor = vec4(vColor, shape * vAlpha * uOpacity * (1.0 + edgeGain + highlightGain));
      }
    `
  });
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
  const gapWeights = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const renderSeeds = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const trailRoles = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const renderBrightness = new Float32Array(TRANSFER_PARTICLE_COUNT);
  const color = new THREE.Color(0x8df7ff);
  const white = new THREE.Color(0xffffff);
  const purpleBlue = new THREE.Color(0x7185cf);

  for (let i = 0; i < TRANSFER_PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    const stageIndex = i % FIVE_A_STAGES.length;
    const stage = FIVE_A_STAGES[stageIndex];
    const stageParticleOrdinal = Math.floor(i / FIVE_A_STAGES.length);
    const migrationClusterRole = stageParticleOrdinal % 12;
    const isMigrationCluster = migrationClusterRole < 3;
    const sizeRoll = random();

    phases[i] = isMigrationCluster
      ? (Math.floor(stageParticleOrdinal / 12) * 0.137 + migrationClusterRole * 0.014 + stageIndex * 0.021) % 0.88
      : (random() * 0.82 + (i % 7) * 0.027) % 1;
    stageIndices[i] = stageIndex;
    curlSeeds[i] = random() * Math.PI * 2;
    freedom[i] = random() < 0.16 ? 1 : 0;
    gapWeights[i] = isMigrationCluster ? 1 : random() < 0.22 ? 0.18 : 0.72 + random() * 0.28;
    renderSeeds[i] = random() * Math.PI * 2;
    trailRoles[i] = isMigrationCluster ? migrationClusterRole : 3;
    renderBrightness[i] = i % 53 === 0
      ? 1.3
      : isMigrationCluster
        ? 0.58 + random() * 0.22
        : 0.26 + random() * 0.4;
    sizes[i] = sizeRoll < 0.55
      ? 0.017
      : sizeRoll < 0.82
        ? 0.026
        : sizeRoll < 0.97
          ? 0.041
          : 0.058;
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
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(renderSeeds, 1));
  geometry.setAttribute('aTrailRole', new THREE.BufferAttribute(trailRoles, 1));
  geometry.setAttribute('aBrightness', new THREE.BufferAttribute(renderBrightness, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aSeed;
      attribute float aTrailRole;
      attribute float aBrightness;
      uniform float uTime;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBrightness;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspective = clamp(150.0 / max(1.0, -viewPosition.z), 0.8, 5.2);
        float trailScale = aTrailRole < 2.5 ? 1.0 + (2.0 - aTrailRole) * 0.1 : 1.0;
        float shimmer = 1.0 + sin(uTime * 0.7 + aSeed) * 0.05;
        gl_PointSize = max(1.0, aSize * perspective * 42.0 * trailScale);
        gl_Position = projectionMatrix * viewPosition;
        vColor = color;
        vAlpha = aAlpha * shimmer;
        vBrightness = aBrightness;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBrightness;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float radius = length(centered);
        float falloff = 1.0 - smoothstep(0.1, 0.5, radius);
        float core = 1.0 - smoothstep(0.0, 0.12, radius);
        if (falloff <= 0.001) discard;
        float packetEnergy = smoothstep(1.05, 1.28, vBrightness);
        gl_FragColor = vec4(
          vColor * (0.76 + vBrightness * 0.48 + core * 0.12 + packetEnergy * 0.5),
          falloff * vAlpha * (0.84 + core * 0.14 + packetEnergy * 0.12)
        );
      }
    `
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'FiveACoreReleaseParticleFlow';

  function update(delta, time, entrance, globalMotion, stageRootPositions) {
    const positionArray = positionAttribute.array;
    const alphaArray = alphaAttribute.array;

    material.uniforms.uTime.value = time;

    for (let i = 0; i < TRANSFER_PARTICLE_COUNT; i += 1) {
      const i3 = i * 3;
      const stageIndex = stageIndices[i];
      const stage = FIVE_A_STAGES[stageIndex];
      const timing = getStageTiming(stageIndex);
      const motion = evaluateStageMotion(stage, stageIndex, entrance, time);
      const pathProgress = clamp01((entrance - timing.start) / (timing.captureEnd - timing.start));
      const packetBurst = i % 53 === 0
        ? (0.5 + Math.sin(time * 0.86 + curlSeeds[i]) * 0.5) * motion.stable
        : 0;
      const travel = clamp01(pathProgress * 1.16 - phases[i] * 0.22 + packetBurst * 0.022);
      const path = evaluateReleaseParticlePosition(
        stage,
        stageIndex,
        travel,
        phases[i],
        curlSeeds[i],
        freedom[i],
        time,
        motion.stable,
        stageRootPositions
      );
      const trailWindow = smoothstep(0.02, 0.28, travel) * (1 - smoothstep(0.7, 1, travel));
      const midStream = smoothstep(0.18, 0.42, travel) * (1 - smoothstep(0.58, 0.82, travel));
      const captureGather = smoothstep(0.72, 0.92, travel) * (1 - smoothstep(0.94, 1, travel));
      const chargeAlpha = globalMotion.chargePulse * (1 - phases[i]) * 0.2;
      const depthCue = THREE.MathUtils.clamp(0.86 + path.z * 0.34, 0.62, 1.22);
      const brokenCadence = (travel > 0.32 && travel < 0.43) || (travel > 0.63 && travel < 0.72)
        ? 0.24
        : 1;
      const microStreakGain = trailRoles[i] < 3 ? 1.18 : 1;
      const packetGain = i % 53 === 0 ? 1.28 + packetBurst * 0.3 : 1;

      positionArray[i3] = path.x;
      positionArray[i3 + 1] = path.y;
      positionArray[i3 + 2] = path.z;
      alphaArray[i] = Math.min(
        0.86,
        (
          chargeAlpha
          + motion.release * (0.1 + trailWindow * 0.54 + midStream * 0.4 + captureGather * 0.34)
          + motion.stable * 0.126
        ) * depthCue * gapWeights[i] * brokenCadence * microStreakGain * packetGain
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
    const layer = random();
    const spread = layer < 0.78 ? 15 : layer < 0.94 ? 10 : 7;
    let x = (random() - 0.5) * spread;
    let y = (random() - 0.5) * spread * 0.58;
    const distanceFromCore = Math.hypot(x, y);

    if (distanceFromCore < 1.18) {
      const angle = random() * Math.PI * 2;
      const radius = 1.18 + random() * 0.72;

      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius * 0.68;
    }
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = layer < 0.78
      ? -3.4 - random() * 12.6
      : layer < 0.94
        ? -1.2 - random() * 4.2
        : 0.3 + random() * 1.15;
    color.set(0x0d4f8f).lerp(cyan, random() * 0.18);
    const brightness = layer < 0.78 ? 0.2 : layer < 0.94 ? 0.27 : 0.12;
    const edgeFade = THREE.MathUtils.clamp(1 - distanceFromCore / 11, 0.38, 1);

    colors[i3] = color.r * brightness * edgeFade;
    colors[i3 + 1] = color.g * brightness * edgeFade;
    colors[i3 + 2] = color.b * brightness * edgeFade;
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

  group.name = `FiveALabel${stage.id}`;
  if (index === 0) {
    return {
      group,
      update() {},
      dispose() {}
    };
  }

  const texture = createTextTexture(`${stage.id}  ${stage.label}`);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  const angle = getStageFinalAngle(index);

  group.position.set(
    Math.cos(angle) * (stage.radius + 0.26),
    stage.height + 0.12,
    Math.sin(angle) * stage.radius * 0.42 + stage.depthOffset
  );
  sprite.scale.set(0.54 + index * 0.025, 0.105, 1);
  group.add(sprite);

  function update(time, motion, stageRootPosition) {
    const pulse = (0.5 + Math.sin(time * 0.28 + index) * 0.5) * motion.stable;
    const labelReveal = smoothstep(0.28, 0.9, motion.capture);

    group.position.set(
      stageRootPosition.x + Math.cos(angle) * 0.16 * labelReveal,
      stageRootPosition.y + 0.12 + Math.sin(time * 0.1 + index) * 0.018 * motion.stable,
      stageRootPosition.z + 0.02
    );
    material.opacity = labelReveal * (0.28 + pulse * 0.025);
  }

  function dispose() {
    texture.dispose();
    material.dispose();
  }

  return { group, update, dispose };
}

function createSceneTitle() {
  const group = new THREE.Group();
  const texture = createTextTexture('5A GROWTH JOURNEY');
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

    material.opacity = titleReveal * (0.24 + Math.sin(time * 0.22) * 0.018);
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
  context.fillStyle = 'rgba(170, 226, 244, 0.82)';
  context.font = '500 32px Inter, Arial, sans-serif';
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

function evaluateReleaseParticlePosition(stage, index, travel, phase, curlSeed, isFree, time, stable, stageRootPositions) {
  const source = index === 0 ? null : stageRootPositions[index - 1];
  const target = stageRootPositions[index];
  const sourceX = source?.x ?? 0;
  const sourceY = source?.y ?? 0;
  const sourceZ = source?.z ?? 0;
  const progress = smootherstep01(travel);
  const arc = Math.sin(progress * Math.PI);
  const curlAmount = (0.035 + index * 0.012) * (isFree ? 1.65 : 0.72) * arc;
  const curl = (
    Math.sin(curlSeed + progress * Math.PI * (1.7 + index * 0.08))
    + Math.sin(curlSeed * 0.63 + progress * Math.PI * 3.2) * 0.32
  ) * curlAmount;
  const stableDrift = time * (0.018 + index * 0.0015) * stable;
  const lateral = Math.sin(curlSeed + progress * Math.PI * 2 + stableDrift) * curlAmount;
  const freeLift = isFree ? Math.cos(curlSeed * 1.7 + progress * Math.PI * 2.4) * 0.06 * arc : 0;

  return {
    x: THREE.MathUtils.lerp(sourceX, target.x, progress) + Math.cos(curlSeed) * curl,
    y: THREE.MathUtils.lerp(sourceY, target.y, progress)
      + arc * (0.08 + index * 0.018) * (index % 2 === 0 ? 1 : -0.72)
      + freeLift,
    z: THREE.MathUtils.lerp(sourceZ, target.z, progress) + lateral
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
    particleCount: orbitParticleCount
      + transferFlow.particleCount
      + BACKGROUND_DUST_COUNT
      + FIVE_A_STAGE_GPU_PARTICLE_COUNT
      + FIVE_A_CORE_PARTICLE_COUNT,
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
  return -0.75 + index * 0.38 + (FIVE_A_STAGES[index].angleOffset ?? 0);
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
