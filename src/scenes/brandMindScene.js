import * as THREE from 'three';

const CORE_PARTICLE_LAYER_COUNTS = Object.freeze([96, 158, 218]);
const CORE_PARTICLE_LAYER_RADII = Object.freeze([0.2, 0.5, 0.78]);
const CORE_PARTICLE_COUNT = CORE_PARTICLE_LAYER_COUNTS.reduce((total, count) => total + count, 0);
const MEMORY_HALO_PARTICLE_COUNT = 520;
const MEMORY_HALO_MAX_POINT_SIZE = 1.6;
const NODE_PARTICLE_COUNTS = Object.freeze({ near: 44, mid: 34, far: 24 });
const INTERNAL_CIRCULATION_PARTICLE_COUNT = 18;
const SHORT_ASSOCIATION_FLOW_NODE_INDICES = Object.freeze([0, 1, 3, 4]);
const SHORT_ASSOCIATION_FLOW_PARTICLES_PER_DIRECTION = 7;
const CORE_MID_LOW_DENSITY_GAIN = 0.12;
const DOMINANT_NEAR_NODE_SCALE_REDUCTION = 0.17;
const FAR_NODE_COHESION_GAIN = 0.1;
const SHORT_ASSOCIATION_FLOW_OPACITY = 0.365;

const ASSOCIATION_NODE_LAYOUT = Object.freeze([
  Object.freeze({ type: 'particle-shell', depth: 'near', position: [-1.6, 0.6, 0.12], scale: 0.38 * (1 - DOMINANT_NEAR_NODE_SCALE_REDUCTION), phase: 0.3 }),
  Object.freeze({ type: 'soft-glow', depth: 'mid', position: [1.33, 0.85, -0.72], scale: 0.23, phase: 1.4 }),
  Object.freeze({ type: 'sparse-wire', depth: 'far', position: [1.87, -0.38, -1.92], scale: 0.21, phase: 2.5 }),
  Object.freeze({ type: 'particle-shell', depth: 'mid', position: [-1.21, -1.12, -0.52], scale: 0.21, phase: 3.7 }),
  Object.freeze({ type: 'soft-glow', depth: 'near', position: [0.65, -1.14, 0.34], scale: 0.31, phase: 4.8 }),
  Object.freeze({ type: 'sparse-wire', depth: 'far', position: [-0.2, 1.35, -2.02], scale: 0.14, phase: 5.6 })
]);

const ASSOCIATION_PATH_NODE_INDICES = Object.freeze([0, 2, 4]);

export const BRAND_MIND_VISUAL_V131 = Object.freeze({
  version: '1.3.1',
  coreParticleCount: CORE_PARTICLE_COUNT,
  coreParticleLayerCount: CORE_PARTICLE_LAYER_COUNTS.length,
  coreEffectiveRadius: CORE_PARTICLE_LAYER_RADII.at(-1),
  coreMidLowDensityGain: CORE_MID_LOW_DENSITY_GAIN,
  nucleusParticleCount: CORE_PARTICLE_LAYER_COUNTS[0],
  internalCirculationParticleCount: INTERNAL_CIRCULATION_PARTICLE_COUNT,
  internalAssociationFlowCount: 7,
  shortAssociationFlowCount: SHORT_ASSOCIATION_FLOW_NODE_INDICES.length,
  shortAssociationFlowOpacity: SHORT_ASSOCIATION_FLOW_OPACITY,
  outerShellIncomplete: true,
  memoryHaloParticleCount: MEMORY_HALO_PARTICLE_COUNT,
  memoryHaloMaxPointSize: MEMORY_HALO_MAX_POINT_SIZE,
  associationNodeCount: ASSOCIATION_NODE_LAYOUT.length,
  dominantNearNodeScaleReduction: DOMINANT_NEAR_NODE_SCALE_REDUCTION,
  farNodeCohesionGain: FAR_NODE_COHESION_GAIN,
  associationNodeTypes: Object.freeze([...new Set(ASSOCIATION_NODE_LAYOUT.map(({ type }) => type))]),
  associationPathCount: ASSOCIATION_PATH_NODE_INDICES.length,
  associationPathsBroken: true,
  palette: Object.freeze(['deep-blue', 'icy-blue', 'silver-white', 'muted-violet-accent'])
});

export function createBrandMindScene() {
  const group = new THREE.Group();
  const glowTexture = createRadialGlowTexture();
  const memoryHalo = createMemoryHalo();
  const paths = createAssociationPaths();
  const nodes = createAssociationNodes(glowTexture);
  const core = createMindCore(glowTexture);
  const label = createLabel();

  group.name = 'BrandMindScene';
  group.position.set(0, -0.06, -0.82);
  group.add(memoryHalo.points, paths.group, nodes.group, core.group, label.sprite);

  function update(renderState, delta, time, transitionProgress = 1) {
    const reveal = smootherstep(0.06, 0.94, transitionProgress);

    group.visible = transitionProgress > 0.001;
    group.scale.setScalar(0.78 + reveal * 0.22);
    group.rotation.y = Math.sin(time * 0.018) * 0.018;
    group.rotation.x = Math.sin(time * 0.013 + 0.8) * 0.008;
    memoryHalo.update(time, reveal);
    paths.update(time, reveal);
    nodes.update(time, reveal);
    core.update(time, reveal);
    label.material.opacity = smootherstep(0.72, 0.96, reveal) * 0.54;
    renderState.exposure += reveal * 0.008;
  }

  function dispose() {
    memoryHalo.dispose();
    paths.dispose();
    nodes.dispose();
    core.dispose();
    label.dispose();
    glowTexture.dispose();
    group.clear();
  }

  return {
    name: 'BrandMindScene',
    group,
    update,
    dispose,
    isShell: false
  };
}

function createMindCore(glowTexture) {
  const group = new THREE.Group();
  const volumeGeometry = new THREE.SphereGeometry(0.72, 40, 28);
  const volumeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uDeep: { value: new THREE.Color('#031126') },
      uBlue: { value: new THREE.Color('#174f89') },
      uIce: { value: new THREE.Color('#a9d8f2') }
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vLocalPosition = position;
        vViewNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uDeep;
      uniform vec3 uBlue;
      uniform vec3 uIce;
      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;

      void main() {
        float fresnel = pow(1.0 - max(dot(vViewNormal, vViewDirection), 0.0), 2.7);
        float flowA = sin(vLocalPosition.y * 12.0 + vLocalPosition.x * 4.0 + uTime * 0.18);
        float flowB = sin(vLocalPosition.z * 15.0 - vLocalPosition.y * 5.0 - uTime * 0.11);
        float energy = smoothstep(0.35, 0.92, flowA * 0.34 + flowB * 0.28 + 0.5);
        float fieldMask = smoothstep(-0.25, 0.72, sin(vLocalPosition.x * 7.0 - vLocalPosition.y * 5.0 + vLocalPosition.z * 4.0));
        vec3 color = mix(uDeep, uBlue, 0.13 + fresnel * 0.46 + energy * 0.08);
        color = mix(color, uIce, fresnel * fresnel * 0.12);
        float alpha = uOpacity * (0.012 + fresnel * 0.16 + energy * 0.018) * (0.24 + fieldMask * 0.76);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const volume = new THREE.Mesh(volumeGeometry, volumeMaterial);
  const shellGeometry = createIncompleteMemoryShellGeometry(0.8);
  const shellMaterial = new THREE.LineBasicMaterial({
    color: '#6ca8d6',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const shell = new THREE.LineSegments(shellGeometry, shellMaterial);
  const innerParticles = createCoreParticleLayers();
  const associationField = createInternalAssociationField(glowTexture);
  const haloMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: '#2d78bf',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    fog: false
  });
  const halo = new THREE.Sprite(haloMaterial);

  group.name = 'BrandMindMindCore';
  volume.name = 'BrandMindCoreVolume';
  shell.name = 'BrandMindCoreStructure';
  halo.name = 'BrandMindCoreHalo';
  halo.renderOrder = 0;
  volume.renderOrder = 1;
  shell.renderOrder = 2;
  halo.position.z = -0.18;
  halo.scale.set(2.9, 2.9, 1);
  group.add(halo, volume, associationField.group, shell, innerParticles.group);

  return {
    group,
    update(time, reveal) {
      const breath = 1 + Math.sin(time * 0.24) * 0.018;
      const settledScale = (0.9 + reveal * 0.1) * breath;

      group.scale.set(settledScale * 1.035, settledScale * 0.97, settledScale * 1.012);
      group.rotation.y = Math.sin(time * 0.027) * 0.022;
      group.rotation.z = Math.sin(time * 0.019 + 0.7) * 0.011;
      volumeMaterial.uniforms.uTime.value = time;
      volumeMaterial.uniforms.uOpacity.value = reveal * 0.42;
      shellMaterial.opacity = reveal * (0.009 + Math.sin(time * 0.19) * 0.0025);
      haloMaterial.opacity = reveal * (0.074 + Math.sin(time * 0.21) * 0.01);
      halo.position.x = -0.1 + Math.sin(time * 0.018) * 0.012;
      innerParticles.update(time, reveal);
      associationField.update(time, reveal);
    },
    dispose() {
      volumeGeometry.dispose();
      volumeMaterial.dispose();
      shellGeometry.dispose();
      shellMaterial.dispose();
      innerParticles.dispose();
      associationField.dispose();
      haloMaterial.dispose();
      group.clear();
    }
  };
}

function createIncompleteMemoryShellGeometry(radius) {
  const sourceGeometry = new THREE.IcosahedronGeometry(radius, 2);
  const edgeGeometry = new THREE.EdgesGeometry(sourceGeometry, 18);
  const edgePositions = edgeGeometry.getAttribute('position');
  const positions = [];

  for (let index = 0; index < edgePositions.count; index += 2) {
    const ax = edgePositions.getX(index);
    const ay = edgePositions.getY(index);
    const az = edgePositions.getZ(index);
    const bx = edgePositions.getX(index + 1);
    const by = edgePositions.getY(index + 1);
    const bz = edgePositions.getZ(index + 1);
    const midpointX = (ax + bx) * 0.5;
    const midpointY = (ay + by) * 0.5;
    const midpointZ = (az + bz) * 0.5;
    const inPrimaryVoid = midpointX > 0.16 && midpointY > 0.02;
    const inSecondaryVoid = midpointX < -0.26 && midpointY < -0.12 && midpointZ > -0.2;

    if (inPrimaryVoid || inSecondaryVoid || pseudoRandom(index * 1.73) < 0.44) continue;
    positions.push(ax, ay, az, bx, by, bz);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  edgeGeometry.dispose();
  sourceGeometry.dispose();
  return geometry;
}

function createInternalAssociationField(glowTexture) {
  const group = new THREE.Group();
  const flowDefinitions = [
    { start: [-0.38, 0.08, -0.04], bend: [-0.12, 0.32, -0.16], end: [0.3, 0.2, 0.1], fraction: 0.64, color: '#8fc5df' },
    { start: [-0.3, -0.22, 0.12], bend: [0.02, -0.34, 0.2], end: [0.35, -0.08, -0.02], fraction: 0.52, color: '#709fbd' },
    { start: [-0.18, 0.34, 0.14], bend: [0.08, 0.12, -0.28], end: [0.32, -0.2, -0.12], fraction: 0.7, color: '#a9d5e8' },
    { start: [-0.42, -0.02, -0.18], bend: [-0.08, 0.16, 0.24], end: [0.2, 0.34, 0.02], fraction: 0.58, color: '#658eae' },
    { start: [-0.08, -0.38, -0.1], bend: [-0.26, -0.04, 0.26], end: [0.2, 0.28, 0.16], fraction: 0.46, color: '#7f82a5' },
    { start: [0.02, 0.4, -0.08], bend: [0.3, 0.12, 0.18], end: [0.18, -0.32, 0.04], fraction: 0.61, color: '#79abc7' },
    { start: [-0.34, 0.18, 0.16], bend: [0.04, -0.04, -0.34], end: [0.4, 0.04, -0.08], fraction: 0.55, color: '#a4cbdc' }
  ];
  const positions = [];
  const colors = [];

  flowDefinitions.forEach((definition, flowIndex) => {
    const start = new THREE.Vector3(...definition.start);
    const end = new THREE.Vector3(...definition.end);
    const bend = new THREE.Vector3(...definition.bend);
    const secondBend = bend.clone().lerp(end, 0.48).add(new THREE.Vector3(
      0.03 * (flowIndex % 2 === 0 ? 1 : -1),
      -0.02 + flowIndex * 0.004,
      0.025 * (flowIndex % 3 - 1)
    ));
    const curve = new THREE.CatmullRomCurve3([start, bend, secondBend, end]);
    const points = curve.getPoints(22);
    const visibleSegments = Math.floor((points.length - 1) * definition.fraction);
    const color = new THREE.Color(definition.color);

    for (let segment = 0; segment < visibleSegments; segment += 1) {
      if ((segment + flowIndex * 2) % 7 >= 4) continue;
      positions.push(...points[segment].toArray(), ...points[segment + 1].toArray());
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
  });

  const flowGeometry = new THREE.BufferGeometry();
  flowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  flowGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const flowMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(flowGeometry, flowMaterial);
  const signalTargets = SHORT_ASSOCIATION_FLOW_NODE_INDICES.map((nodeIndex) => (
    new THREE.Vector3(...ASSOCIATION_NODE_LAYOUT[nodeIndex].position)
  ));
  const signalDirections = signalTargets.map((target) => target.clone().normalize());
  const signalGeometry = new THREE.BufferGeometry();
  const shortFlowParticleCount = signalDirections.length * SHORT_ASSOCIATION_FLOW_PARTICLES_PER_DIRECTION;
  const signalParticleCount = INTERNAL_CIRCULATION_PARTICLE_COUNT + shortFlowParticleCount;
  const signalPositions = new Float32Array(signalParticleCount * 3);
  const signalColors = new Float32Array(signalParticleCount * 3);
  const signalPhases = new Float32Array(signalParticleCount);

  for (let index = 0; index < signalParticleCount; index += 1) {
    signalPhases[index] = pseudoRandom(index * 2.7 + 1.9);
  }
  signalGeometry.setAttribute('position', new THREE.BufferAttribute(signalPositions, 3));
  signalGeometry.setAttribute('color', new THREE.BufferAttribute(signalColors, 3));
  const signalMaterial = new THREE.PointsMaterial({
    map: glowTexture,
    vertexColors: true,
    size: 0.022,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const signals = new THREE.Points(signalGeometry, signalMaterial);

  group.name = 'BrandMindInternalAssociationField';
  lines.name = 'BrandMindInternalAssociationFlows';
  signals.name = 'BrandMindEdgeSignalDrift';
  lines.renderOrder = 3;
  signals.renderOrder = 4;
  group.add(lines, signals);

  return {
    group,
    update(time, reveal) {
      const positionAttribute = signalGeometry.getAttribute('position');

      group.rotation.y = Math.sin(time * 0.023) * 0.03;
      group.rotation.z = Math.sin(time * 0.017 + 0.8) * 0.018;
      flowMaterial.opacity = reveal * (0.11 + Math.sin(time * 0.16) * 0.012);
      signalMaterial.opacity = reveal * SHORT_ASSOCIATION_FLOW_OPACITY;
      const colorAttribute = signalGeometry.getAttribute('color');

      for (let index = 0; index < INTERNAL_CIRCULATION_PARTICLE_COUNT; index += 1) {
        const phase = signalPhases[index] * Math.PI * 2;
        const orbitProgress = phase + time * (0.009 + (index % 3) * 0.002);
        const radius = 0.2 + pseudoRandom(index * 4.1) * 0.25;
        const brokenArc = 0.58 + pseudoRandom(index * 7.7) * 0.42;
        const brightness = 0.24 + Math.sin(orbitProgress * 1.7) * 0.06;

        positionAttribute.setXYZ(
          index,
          0.045 + Math.cos(orbitProgress) * radius * brokenArc,
          -0.025 + Math.sin(orbitProgress * 0.83) * radius * 0.6,
          0.02 + Math.sin(orbitProgress * 1.31 + phase) * radius * 0.52
        );
        colorAttribute.setXYZ(index, brightness * 0.55, brightness * 0.78, brightness);
      }
      signalDirections.forEach((direction, directionIndex) => {
        const coverage = [0.31, 0.38, 0.28, 0.43][directionIndex];
        const flowLength = Math.max(0.18, signalTargets[directionIndex].length() * coverage - 0.46);

        for (let signalIndex = 0; signalIndex < SHORT_ASSOCIATION_FLOW_PARTICLES_PER_DIRECTION; signalIndex += 1) {
          const index = INTERNAL_CIRCULATION_PARTICLE_COUNT
            + directionIndex * SHORT_ASSOCIATION_FLOW_PARTICLES_PER_DIRECTION
            + signalIndex;
          const progress = (signalPhases[index] + time * 0.014) % 1;
          const distance = 0.46 + progress * flowLength;
          const lateral = Math.sin(progress * Math.PI * 2 + directionIndex) * 0.012;
          const fade = Math.sin(progress * Math.PI) * (0.42 + (signalIndex % 3) * 0.08);

          positionAttribute.setXYZ(
            index,
            direction.x * distance - direction.y * lateral,
            direction.y * distance + direction.x * lateral,
            direction.z * distance + lateral * 0.45
          );
          colorAttribute.setXYZ(index, fade * 0.58, fade * 0.78, fade);
        }
      });
      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
    },
    dispose() {
      flowGeometry.dispose();
      flowMaterial.dispose();
      signalGeometry.dispose();
      signalMaterial.dispose();
      group.clear();
    }
  };
}

function createCoreParticleLayers() {
  const group = new THREE.Group();
  const layerConfigs = [
    { radius: CORE_PARTICLE_LAYER_RADII[0], radialExponent: 0.58, size: 0.042, opacity: 0.59, deep: '#526f82', ice: '#8fb4c7', iceMix: 0.36, clump: 0.54, offset: [0.075, -0.03, 0.035] },
    { radius: CORE_PARTICLE_LAYER_RADII[1], radialExponent: 0.52, size: 0.032, opacity: 0.55 * (1 + CORE_MID_LOW_DENSITY_GAIN), deep: '#28679e', ice: '#b9ddf0', iceMix: 0.54, clump: 0.36, offset: [0.025, 0.018, -0.012] },
    { radius: CORE_PARTICLE_LAYER_RADII[2], radialExponent: 0.48, size: 0.022, opacity: 0.35 * (1 + CORE_MID_LOW_DENSITY_GAIN), deep: '#123c70', ice: '#78a9ca', iceMix: 0.48, clump: 0.22, offset: [-0.018, 0.01, -0.02] }
  ];
  const layers = layerConfigs.map((config, layerIndex) => {
    const count = CORE_PARTICLE_LAYER_COUNTS[layerIndex];
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const deep = new THREE.Color(config.deep);
    const ice = new THREE.Color(config.ice);
    const clumpCenters = [
      new THREE.Vector3(config.radius * 0.24, config.radius * 0.08, -config.radius * 0.1),
      new THREE.Vector3(-config.radius * 0.2, -config.radius * 0.14, config.radius * 0.16),
      new THREE.Vector3(config.radius * 0.02, config.radius * 0.24, config.radius * 0.08)
    ];

    for (let index = 0; index < count; index += 1) {
      const stride = index * 3;
      const radius = Math.pow(
        pseudoRandom(index * 2.31 + layerIndex * 11.7),
        config.radialExponent
      ) * config.radius;
      const theta = pseudoRandom(index * 5.17 + layerIndex * 7.1) * Math.PI * 2;
      const phi = Math.acos(2 * pseudoRandom(index * 7.43 + layerIndex * 3.9) - 1);
      const position = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius
      );
      const clump = clumpCenters[index % clumpCenters.length];
      const clumpWeight = config.clump * (0.34 + pseudoRandom(index * 9.13) * 0.66);
      const color = deep.clone().lerp(ice, pseudoRandom(index * 3.71 + layerIndex) * config.iceMix);

      position.lerp(clump, clumpWeight);
      if (position.distanceToSquared(new THREE.Vector3(0.08, -0.06, 0.04)) < config.radius * config.radius * 0.035) {
        position.multiplyScalar(1.36);
      }
      positions[stride] = position.x;
      positions[stride + 1] = position.y;
      positions[stride + 2] = position.z;
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: config.size,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    const points = new THREE.Points(geometry, material);

    points.name = `BrandMindCoreEnergyLayer${layerIndex + 1}`;
    points.position.fromArray(config.offset);
    points.renderOrder = 5 + layerIndex;
    group.add(points);
    return { config, geometry, material, points, layerIndex };
  });

  group.name = 'BrandMindCoreEnergyLayers';
  return {
    group,
    update(time, reveal) {
      layers.forEach(({ config, material, points, layerIndex }) => {
        const speeds = [0.029, -0.012, 0.007];

        points.rotation.y = time * speeds[layerIndex];
        points.rotation.x = Math.sin(time * (0.028 + layerIndex * 0.005) + layerIndex) * 0.06;
        points.position.x = config.offset[0] + Math.sin(time * (0.052 - layerIndex * 0.008) + layerIndex) * (0.008 - layerIndex * 0.002);
        points.position.y = config.offset[1] + Math.cos(time * (0.046 - layerIndex * 0.006) + layerIndex) * (0.006 - layerIndex * 0.0015);
        material.opacity = reveal * config.opacity * (
          0.94 + Math.sin(time * (0.22 + layerIndex * 0.04) + layerIndex) * 0.06
        );
      });
    },
    dispose() {
      layers.forEach(({ geometry, material }) => {
        geometry.dispose();
        material.dispose();
      });
      group.clear();
    }
  };
}

function createAssociationNodes(glowTexture) {
  const group = new THREE.Group();
  const pointGeometries = Object.fromEntries(
    Object.entries(NODE_PARTICLE_COUNTS).map(([depth, count], index) => (
      [depth, createNodeParticleGeometry(count, index * 17.3)]
    ))
  );
  const wireGeometry = new THREE.IcosahedronGeometry(1, 1);
  const typeMaterials = {
    'particle-shell': {
      points: createNodePointsMaterial('#c4e4f3', 0.032),
      wire: createNodeWireMaterial('#477da9')
    },
    'soft-glow': {
      points: createNodePointsMaterial('#9bc8e0', 0.022),
      glow: new THREE.SpriteMaterial({
        map: glowTexture,
        color: '#6faed2',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        fog: false
      })
    },
    'sparse-wire': {
      points: createNodePointsMaterial('#668fac', 0.018),
      wire: createNodeWireMaterial('#416c91')
    }
  };
  const nodes = ASSOCIATION_NODE_LAYOUT.map((definition, index) => {
    const node = new THREE.Group();
    const materials = typeMaterials[definition.type];
    const particles = new THREE.Points(pointGeometries[definition.depth], materials.points);

    node.name = `BrandMindAssociationNode${index + 1}`;
    node.position.fromArray(definition.position);
    node.scale.setScalar(definition.scale);
    node.add(particles);
    if (materials.wire) {
      const wire = new THREE.Mesh(wireGeometry, materials.wire);

      wire.rotation.set(definition.phase * 0.07, definition.phase * 0.11, 0);
      node.add(wire);
    }
    if (materials.glow) {
      const glow = new THREE.Sprite(materials.glow);

      glow.position.z = -0.08;
      glow.scale.set(2.35, 2.35, 1);
      node.add(glow);
    }
    group.add(node);
    return { node, definition };
  });

  group.name = 'BrandMindAssociationNodes';
  return {
    group,
    update(time, reveal) {
      typeMaterials['particle-shell'].points.opacity = reveal * 0.62;
      typeMaterials['particle-shell'].wire.opacity = reveal * 0.018;
      typeMaterials['soft-glow'].points.opacity = reveal * 0.22;
      typeMaterials['soft-glow'].glow.opacity = reveal * (
        0.105 + Math.sin(time * 0.17) * 0.014
      );
      typeMaterials['sparse-wire'].points.opacity = reveal * 0.069 * (1 + FAR_NODE_COHESION_GAIN);
      typeMaterials['sparse-wire'].wire.opacity = reveal * 0.027 * (1 + FAR_NODE_COHESION_GAIN);
      nodes.forEach(({ node, definition }, index) => {
        const phase = definition.phase;

        node.position.set(
          definition.position[0] + Math.sin(time * (0.034 + index * 0.002) + phase) * 0.045,
          definition.position[1] + Math.sin(time * (0.027 + index * 0.001) + phase * 1.3) * 0.036,
          definition.position[2] + Math.cos(time * 0.023 + phase) * 0.04
        );
        node.rotation.y = Math.sin(time * 0.025 + phase) * 0.12;
        node.rotation.x = Math.sin(time * 0.019 + phase * 0.6) * 0.06;
        node.scale.setScalar(definition.scale * (1 + Math.sin(time * 0.16 + phase) * 0.018));
      });
    },
    dispose() {
      Object.values(pointGeometries).forEach((geometry) => geometry.dispose());
      wireGeometry.dispose();
      Object.values(typeMaterials).forEach((materials) => {
        Object.values(materials).forEach((material) => material.dispose());
      });
      group.clear();
    }
  };
}

function createNodePointsMaterial(color, size) {
  return new THREE.PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
}

function createNodeWireMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
}

function createNodeParticleGeometry(particleCount, seedOffset) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let index = 0; index < particleCount; index += 1) {
    const stride = index * 3;
    const theta = pseudoRandom(index * 3.41 + seedOffset) * Math.PI * 2;
    const phi = Math.acos(2 * pseudoRandom(index * 5.93 + seedOffset) - 1);
    const radius = 0.78 + pseudoRandom(index * 7.11 + seedOffset) * 0.28;

    positions[stride] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[stride + 1] = Math.cos(phi) * radius;
    positions[stride + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function createMemoryHalo() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MEMORY_HALO_PARTICLE_COUNT * 3);
  const colors = new Float32Array(MEMORY_HALO_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(MEMORY_HALO_PARTICLE_COUNT);
  const alphas = new Float32Array(MEMORY_HALO_PARTICLE_COUNT);
  const blue = new THREE.Color('#2d689a');
  const ice = new THREE.Color('#b9d9e9');
  const violet = new THREE.Color('#716f9b');
  const clumpCenters = [
    new THREE.Vector3(-1.08, 0.28, -1.02),
    new THREE.Vector3(1.02, 0.36, -1.26),
    new THREE.Vector3(0.46, -0.74, -1.42)
  ];

  for (let index = 0; index < MEMORY_HALO_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const color = index % 41 === 0
      ? violet
      : blue.clone().lerp(ice, pseudoRandom(index * 7.63) * 0.46);

    const distribution = pseudoRandom(index * 3.17 + 0.4);

    if (distribution < 0.32) {
      const center = clumpCenters[index % clumpCenters.length];
      const spread = 0.24 + Math.pow(pseudoRandom(index * 5.37), 1.35) * 0.68;
      const theta = pseudoRandom(index * 11.3) * Math.PI * 2;
      const phi = Math.acos(2 * pseudoRandom(index * 13.7) - 1);

      positions[stride] = center.x + Math.sin(phi) * Math.cos(theta) * spread;
      positions[stride + 1] = center.y + Math.cos(phi) * spread * 0.68;
      positions[stride + 2] = center.z + Math.sin(phi) * Math.sin(theta) * spread * 0.72;
      sizes[index] = 0.72 + pseudoRandom(index * 19.9) * 0.88;
      alphas[index] = 0.15 + pseudoRandom(index * 23.3) * 0.32;
    } else if (distribution < 0.9) {
      let angle = pseudoRandom(index * 2.97) * Math.PI * 2;
      const radius = 0.52 + Math.pow(pseudoRandom(index * 5.37), 0.78) * 2.05;

      if (angle > 5.1 || angle < 0.55) angle += 0.82;
      if (angle > 2.25 && angle < 3.05) angle += 0.74;
      positions[stride] = Math.cos(angle) * radius * 1.06 + (pseudoRandom(index * 11.3) - 0.5) * 0.28;
      positions[stride + 1] = Math.sin(angle) * radius * 0.64 + (pseudoRandom(index * 13.7) - 0.5) * 0.3;
      positions[stride + 2] = -0.72 - pseudoRandom(index * 17.1) * 1.42;
      sizes[index] = 0.62 + pseudoRandom(index * 19.9) * 0.78;
      alphas[index] = 0.12 + pseudoRandom(index * 23.3) * 0.28;
    } else {
      let angle = pseudoRandom(index * 2.97) * Math.PI * 2;
      const radius = 0.9 + Math.pow(pseudoRandom(index * 5.37), 0.8) * 1.7;

      if (angle > 5.1 || angle < 0.55) angle += 0.82;
      if (angle > 2.25 && angle < 3.05) angle += 0.74;
      positions[stride] = Math.cos(angle) * radius;
      positions[stride + 1] = Math.sin(angle) * radius * 0.58;
      positions[stride + 2] = 0.04 + pseudoRandom(index * 17.1) * 0.48;
      sizes[index] = 0.4 + pseudoRandom(index * 19.9) * 0.55;
      alphas[index] = 0.07 + pseudoRandom(index * 23.3) * 0.14;
    }
    if (sizes[index] > 1.15) alphas[index] *= 0.68;
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;

      void main() {
        vec3 drifted = position;
        drifted.x += sin(uTime * 0.035 + position.y * 1.7) * 0.018;
        drifted.y += cos(uTime * 0.028 + position.x * 1.4) * 0.014;
        vec4 viewPosition = modelViewMatrix * vec4(drifted, 1.0);
        vColor = color;
        vAlpha = aAlpha;
        gl_PointSize = aSize * (30.0 / max(1.0, -viewPosition.z));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float distanceToCenter = length(gl_PointCoord - vec2(0.5));
        float softPoint = smoothstep(0.5, 0.08, distanceToCenter);
        gl_FragColor = vec4(vColor, softPoint * vAlpha * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'BrandMindMemoryHalo';
  return {
    points,
    update(time, reveal) {
      material.uniforms.uTime.value = time;
      material.uniforms.uOpacity.value = reveal * (
        0.46 + Math.sin(time * 0.09) * 0.025
      );
      points.rotation.y = Math.sin(time * 0.014) * 0.022;
      points.rotation.z = Math.sin(time * 0.011 + 1.2) * 0.012;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createAssociationPaths() {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const paths = ASSOCIATION_PATH_NODE_INDICES.map((nodeIndex, pathIndex) => {
    const target = new THREE.Vector3(...ASSOCIATION_NODE_LAYOUT[nodeIndex].position);
    const bend = new THREE.Vector3(
      target.x * (0.32 + pathIndex * 0.07) + (pathIndex - 1) * 0.18,
      target.y * 0.5 + (pathIndex === 1 ? 0.22 : -0.06),
      target.z * 0.42 + (pathIndex - 1) * 0.12
    );
    const nearCore = new THREE.Vector3(
      target.x * 0.12,
      target.y * 0.16,
      target.z * 0.08
    );
    const curve = new THREE.CatmullRomCurve3([
      nearCore,
      bend,
      target.clone().multiplyScalar(0.72),
      target
    ]);
    const curvePoints = curve.getPoints(36);
    const brokenPoints = [];
    const brokenColors = [];
    const deep = new THREE.Color('#173a55');
    const ice = new THREE.Color('#83b7d5');

    for (let segment = 0; segment < curvePoints.length - 1; segment += 1) {
      if ((segment + pathIndex * 2) % 8 >= 5) continue;
      const progress = segment / (curvePoints.length - 2);
      const fade = Math.sin(progress * Math.PI) * 0.72;
      const color = deep.clone().lerp(ice, fade);

      brokenPoints.push(curvePoints[segment], curvePoints[segment + 1]);
      brokenColors.push(color, color);
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(brokenPoints);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(
      brokenColors.flatMap((color) => [color.r, color.g, color.b]),
      3
    ));
    const line = new THREE.LineSegments(geometry, material);

    line.name = `BrandMindAssociationPath${pathIndex + 1}`;
    group.add(line);
    return { geometry, line };
  });

  group.name = 'BrandMindAssociationPaths';
  return {
    group,
    update(time, reveal) {
      material.opacity = reveal * (0.028 + Math.sin(time * 0.12) * 0.003);
      paths.forEach(({ line }, index) => {
        line.position.y = Math.sin(time * 0.026 + index * 1.7) * 0.012;
      });
    },
    dispose() {
      paths.forEach(({ geometry }) => geometry.dispose());
      material.dispose();
      group.clear();
    }
  };
}

function createRadialGlowTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 128;
  canvas.height = 128;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(174, 224, 255, 0.34)');
  gradient.addColorStop(0.24, 'rgba(73, 145, 207, 0.16)');
  gradient.addColorStop(0.58, 'rgba(23, 79, 137, 0.055)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLabel() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 1024;
  canvas.height = 128;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = '#3d79a7';
  context.shadowBlur = 10;
  context.fillStyle = '#c8dfec';
  context.font = '500 38px Inter, Arial, sans-serif';
  context.fillText('BRAND MIND', 512, 60);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);

  sprite.name = 'BrandMindSceneLabel';
  sprite.position.set(0, -2.18, 0.12);
  sprite.scale.set(2.15, 0.27, 1);
  sprite.renderOrder = 20;

  return {
    sprite,
    material,
    dispose() {
      texture.dispose();
      material.dispose();
    }
  };
}

function pseudoRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898 + 78.233) * 43758.5453) % 1;
}

function smootherstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * x * (x * (x * 6 - 15) + 10);
}

export const brandMindSceneManager = {
  createBrandMindScene
};
