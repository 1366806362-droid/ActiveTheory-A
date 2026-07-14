import * as THREE from 'three';

const TAU = Math.PI * 2;
const DEFAULT_PARAMETERS = Object.freeze({
  innerRadius: 0.07,
  outerRadius: 0.78,
  turns: 0.88,
  radiusExponent: 1.12,
  globalArmPhase: 0
});

// Every layer is assembled from short, overlapping quads following the two
// spiral paths. There is no galaxy-sized plane or radial mask, so the space
// between the arms remains genuinely transparent.
export function createCinematicGalaxyShell(parameters = DEFAULT_PARAMETERS) {
  const config = { ...DEFAULT_PARAMETERS, ...parameters };
  const group = new THREE.Group();
  const cloudGroup = new THREE.Group();
  const dustGroup = new THREE.Group();
  let layerWeight = 1;
  let journeyFloor = 0;
  const diffuseVeil = createArmRibbonLayer(config, {
    name: 'CinematicGalaxyDiffuseCloudVeil',
    segmentsPerArm: 94,
    startT: 0.055,
    endT: 0.855,
    widthScale: 1.55,
    overlap: 2.05,
    opacity: 0.031,
    z: -0.092,
    seed: 13457,
    colors: [0x203f72, 0x51416f],
    breakup: 0.4,
    continuity: 0.52,
    gapFloor: 0.24,
    clusterCount: 5.1,
    clusterPhase: 1.08,
    secondaryClusterCount: 2.05,
    secondaryClusterPhase: 0.82,
    kind: 'cloud'
  });
  const broadClouds = createArmRibbonLayer(config, {
    name: 'CinematicGalaxyBroadCloudBands',
    segmentsPerArm: 116,
    startT: 0.035,
    endT: 0.875,
    widthScale: 1.152,
    overlap: 1.98,
    opacity: 0.1275,
    z: -0.072,
    seed: 92341,
    colors: [0x347ac2, 0x765db2],
    breakup: 0.5,
    continuity: 0.25,
    gapFloor: 0.1,
    clusterCount: 5.65,
    clusterPhase: 0.32,
    secondaryClusterCount: 2.18,
    secondaryClusterPhase: 0.45,
    kind: 'cloud'
  });
  const innerMist = createArmRibbonLayer(config, {
    name: 'CinematicGalaxyInnerCloudFilaments',
    segmentsPerArm: 132,
    startT: 0.045,
    endT: 0.84,
    widthScale: 0.7,
    overlap: 1.9,
    opacity: 0.076,
    z: -0.052,
    seed: 67129,
    colors: [0x67c4ee, 0xa07ed0],
    breakup: 0.5,
    continuity: 0.26,
    gapFloor: 0.1,
    clusterCount: 6.15,
    clusterPhase: 0.82,
    secondaryClusterCount: 2.46,
    secondaryClusterPhase: 1.2,
    kind: 'cloud'
  });
  const innerShoulder = createArmRibbonLayer(config, {
    name: 'CinematicGalaxyInnerCloudShoulder',
    segmentsPerArm: 86,
    startT: 0.11,
    endT: 0.79,
    widthScale: 0.45,
    overlap: 1.78,
    opacity: 0.055,
    radialOffsetScale: -1.08,
    z: -0.06,
    seed: 80713,
    colors: [0x397fae, 0x73578f],
    breakup: 0.72,
    continuity: 0.08,
    gapFloor: 0.04,
    clusterCount: 5.85,
    clusterPhase: 1.44,
    secondaryClusterCount: 2.28,
    secondaryClusterPhase: 2.15,
    kind: 'cloud'
  });
  const outerShoulder = createArmRibbonLayer(config, {
    name: 'CinematicGalaxyOuterCloudShoulder',
    segmentsPerArm: 82,
    startT: 0.16,
    endT: 0.77,
    widthScale: 0.42,
    overlap: 1.72,
    opacity: 0.049,
    radialOffsetScale: 1.18,
    z: -0.064,
    seed: 50929,
    colors: [0x286899, 0x674b89],
    breakup: 0.76,
    continuity: 0.06,
    gapFloor: 0.03,
    clusterCount: 6.35,
    clusterPhase: 2.16,
    secondaryClusterCount: 2.72,
    secondaryClusterPhase: 0.72,
    kind: 'cloud'
  });
  const fineWisps = createArmRibbonLayer(config, {
    name: 'CinematicGalaxyFineCloudWisps',
    segmentsPerArm: 42,
    startT: 0.12,
    endT: 0.78,
    widthScale: 0.22,
    overlap: 0.72,
    opacity: 0.03,
    radialOffsetScale: 0.18,
    z: -0.046,
    seed: 28411,
    colors: [0x244d75, 0x527fa8],
    breakup: 0.72,
    continuity: 0.03,
    clusterCount: 6.7,
    clusterPhase: 2.42,
    secondaryClusterCount: 3.05,
    secondaryClusterPhase: 1.58,
    featherWindows: [
      [
        { start: 0.35, end: 0.49, direction: 1, strength: 2.1 },
        { start: 0.57, end: 0.69, direction: -1, strength: 1.78 }
      ],
      [
        { start: 0.39, end: 0.52, direction: -1, strength: 1.95 },
        { start: 0.6, end: 0.71, direction: 1, strength: 1.68 }
      ]
    ],
    kind: 'wisps'
  });
  const dustBands = createArmRibbonLayer(config, {
    name: 'CinematicGalaxyDustBands',
    segmentsPerArm: 104,
    startT: 0.09,
    endT: 0.79,
    widthScale: 0.245,
    overlap: 1.34,
    opacity: 0.4085,
    radialOffsetScale: -0.56,
    z: -0.018,
    seed: 41827,
    colors: [0x13283d, 0x2b233b],
    breakup: 0.55,
    clusterCount: 5.65,
    clusterPhase: 0.38,
    secondaryClusterCount: 2.18,
    secondaryClusterPhase: 0.56,
    kind: 'dust'
  });
  const layers = [
    diffuseVeil,
    broadClouds,
    innerMist,
    innerShoulder,
    outerShoulder,
    fineWisps,
    dustBands
  ];

  group.name = 'CinematicGalaxyShell';
  cloudGroup.name = 'CinematicGalaxyCloudBands';
  dustGroup.name = 'CinematicGalaxyDustBandsLayer';
  diffuseVeil.mesh.renderOrder = -5;
  broadClouds.mesh.renderOrder = -4;
  innerMist.mesh.renderOrder = -3;
  innerShoulder.mesh.renderOrder = -3;
  outerShoulder.mesh.renderOrder = -3;
  fineWisps.mesh.renderOrder = -2.5;
  dustBands.mesh.renderOrder = -2;
  cloudGroup.add(
    diffuseVeil.mesh,
    broadClouds.mesh,
    innerMist.mesh,
    innerShoulder.mesh,
    outerShoulder.mesh,
    fineWisps.mesh
  );
  dustGroup.add(dustBands.mesh);
  group.add(cloudGroup, dustGroup);

  function update(delta, time, journeyProgress = 0) {
    const transition = smootherstep(0.35, 0.7, journeyProgress);
    const visibility = 1 - transition * (1 - journeyFloor);
    const pulse = 0.985 + Math.sin(time * 0.11) * 0.015;

    group.rotation.z += delta * 0.0032;
    layers.forEach((layer) => {
      layer.material.uniforms.uOpacity.value = layer.baseOpacity
        * visibility
        * layerWeight
        * pulse
        * (layer.debugMultiplier ?? 1);
      layer.material.uniforms.uTime.value = time;
    });
  }

  function setHybridWeight(weight = 1, minimumJourneyVisibility = 0) {
    layerWeight = Math.min(Math.max(weight, 0), 1);
    journeyFloor = Math.min(Math.max(minimumJourneyVisibility, 0), 1);
  }

  function setLayerMode(mode = 'combined') {
    cloudGroup.visible = mode !== 'particlesOnly' && mode !== 'dustOnly';
    dustGroup.visible = mode !== 'particlesOnly' && mode !== 'cloudsOnly';
    layers.forEach((layer) => {
      layer.debugMultiplier = mode === 'cloudsOnly' && layer.kind !== 'dust' ? 1.9 : 1;
      layer.material.uniforms.uColorBoost.value = mode === 'cloudsOnly'
        ? 1.25
        : mode === 'dustOnly'
          ? 2.4
          : 1;
    });
    dustBands.debugMultiplier = mode === 'dustOnly' ? 3.1 : 1;
  }

  function dispose() {
    layers.forEach((layer) => {
      layer.geometry.dispose();
      layer.material.dispose();
    });
    group.clear();
  }

  return {
    group,
    cloudGroup,
    dustGroup,
    update,
    setLayerMode,
    setHybridWeight,
    dispose
  };
}

function createArmRibbonLayer(config, options) {
  const positions = [];
  const colors = [];
  const uvs = [];
  const opacities = [];
  const seeds = [];
  const progressValues = [];
  const random = seededRandom(options.seed);
  const primary = new THREE.Color(options.colors[0]);
  const secondary = new THREE.Color(options.colors[1]);
  const color = new THREE.Color();
  const step = (options.endT - options.startT) / options.segmentsPerArm;

  for (let armIndex = 0; armIndex < 2; armIndex += 1) {
    for (let index = 0; index < options.segmentsPerArm; index += 1) {
      const t = options.startT + (index + 0.5) * step;
      const previous = pointOnArm(config, armIndex, Math.max(options.startT, t - step * 0.52));
      const next = pointOnArm(config, armIndex, Math.min(options.endT, t + step * 0.52));
      const center = pointOnArm(config, armIndex, t);
      const tangentX = next.x - previous.x;
      const tangentY = next.y - previous.y;
      const tangentLength = Math.max(Math.hypot(tangentX, tangentY), 0.0001);
      const tx = tangentX / tangentLength;
      const ty = tangentY / tangentLength;
      const rotationRange = options.kind === 'dust'
        ? 0.11
        : options.kind === 'wisps'
          ? 0.52
          : 0.36;
      const rotationJitter = (random() - 0.5) * rotationRange;
      const rotationCosine = Math.cos(rotationJitter);
      const rotationSine = Math.sin(rotationJitter);
      const segmentTx = tx * rotationCosine - ty * rotationSine;
      const segmentTy = tx * rotationSine + ty * rotationCosine;
      const segmentNx = -segmentTy;
      const segmentNy = segmentTx;
      const clusterCount = options.clusterCount ?? 4.85;
      const clusterPhase = options.clusterPhase ?? 0;
      const secondaryClusterCount = options.secondaryClusterCount ?? 1.72;
      const secondaryClusterPhase = options.secondaryClusterPhase ?? 0.5;
      const cluster = 0.5 + Math.sin(
        t * TAU * clusterCount + armIndex * 0.82 + clusterPhase
      ) * 0.5;
      const secondaryCluster = 0.5
        + Math.sin(
          t * TAU * secondaryClusterCount
          + armIndex * 1.8
          + secondaryClusterPhase
        ) * 0.5;
      const clusterEnvelope = smootherstep(0.24, 0.78, cluster);
      const widthVariation = 0.54 + clusterEnvelope * 0.46;
      const armBalance = smootherstep(0.12, 0.28, t);
      const widthBalance = armIndex === 1
        ? 1 - armBalance * 0.18
        : 1 + armBalance * 0.02;
      const width = shellWidthAt(t)
        * options.widthScale
        * widthVariation
        * widthBalance;
      const radialLength = Math.max(Math.hypot(center.x, center.y), 0.0001);
      const radialX = center.x / radialLength;
      const radialY = center.y / radialLength;
      const featherWindows = options.featherWindows?.[armIndex] ?? [];
      let featherEnvelope = featherWindows.length > 0 ? 0 : 1;
      let featherDrift = 0;

      featherWindows.forEach((feather) => {
        if (t < feather.start || t > feather.end) return;
        const localT = (t - feather.start) / (feather.end - feather.start);
        const envelope = smootherstep(0, 0.18, localT)
          * (1 - smootherstep(0.7, 1, localT));

        if (envelope > featherEnvelope) {
          featherEnvelope = envelope;
          featherDrift = feather.direction
            * feather.strength
            * smootherstep(0.04, 0.86, localT)
            * envelope;
        }
      });
      const radialOffset = width * ((options.radialOffsetScale ?? 0) + featherDrift);
      const lateralJitter = (random() - 0.5)
        * width
        * (options.kind === 'dust' ? 0.2 : options.kind === 'wisps' ? 0.92 : 0.58);
      const cx = center.x + radialX * radialOffset + segmentNx * lateralJitter;
      const cy = center.y + radialY * radialOffset + segmentNy * lateralJitter;
      const lengthVariation = options.kind === 'dust'
        ? 0.88 + random() * 0.25
        : options.kind === 'wisps'
          ? 0.5 + random() * 0.72
          : 0.62 + random() * 0.76;
      const widthRandomness = options.kind === 'dust'
        ? 0.78 + random() * 0.3
        : options.kind === 'wisps'
          ? 0.38 + random() * 0.78
          : 0.5 + random() * 0.86;
      const halfLength = Math.max(
        tangentLength * options.overlap * 0.92 * lengthVariation,
        width * 0.64
      );
      const halfWidth = width * widthRandomness;
      const outerFade = 1 - smootherstep(0.66, 0.86, t);
      const rootFade = smootherstep(options.startT, options.startT + 0.035, t);
      let localOpacity = (0.045 + clusterEnvelope * 0.8 + secondaryCluster * 0.155)
        * outerFade
        * rootFade;

      if (options.featherWindows) {
        localOpacity *= 0.06 + featherEnvelope * 0.94;
      }

      if (options.kind === 'dust') {
        const localBand = 0.5 + Math.sin(t * TAU * 3.35 + armIndex * 1.2) * 0.5;
        const gap = clusterEnvelope < 0.42
          || localBand < 0.26
          || secondaryCluster < 0.16
          || random() < 0.1;
        localOpacity *= gap ? 0 : (0.42 + localBand * 0.58) * clusterEnvelope;
      } else {
        const hardGap = cluster < (armIndex === 0 ? 0.12 : 0.17)
          || random() < (armIndex === 0 ? 0.025 : 0.045);
        const softenedGap = cluster < (armIndex === 0 ? 0.28 : 0.34)
          || secondaryCluster < (armIndex === 0 ? 0.1 : 0.14);
        const gapFloor = options.gapFloor ?? 0;
        localOpacity *= hardGap
          ? gapFloor
          : softenedGap
            ? Math.max(0.075, gapFloor * 0.6)
            : 1;

        if (armIndex === 1) {
          const upperGapSignal = 0.5
            + Math.sin(t * TAU * 3.15 + 0.9) * 0.5;
          const upperGapStrength = smootherstep(0.64, 0.9, upperGapSignal)
            * smootherstep(0.16, 0.28, t)
            * (1 - smootherstep(0.72, 0.8, t));
          const upperGapA = smootherstep(0.31, 0.355, t)
            * (1 - smootherstep(0.405, 0.455, t));
          const upperGapB = smootherstep(0.535, 0.58, t)
            * (1 - smootherstep(0.63, 0.685, t));
          const upperWindowGap = Math.max(upperGapA, upperGapB);
          localOpacity *= (1 - upperGapStrength * 0.68)
            * (1 - upperWindowGap * 0.7);
        }
      }
      localOpacity *= options.kind === 'dust'
        ? 0.86 + random() * 0.24
        : 0.48 + random() * 0.72;
      if (options.kind !== 'dust') {
        const opacityBalance = armIndex === 1
          ? 1 - armBalance * 0.16
          : 1 + armBalance * 0.1;
        localOpacity *= opacityBalance;
      }

      color.copy(primary).lerp(secondary, smootherstep(0.18, 0.82, t) * 0.72 + random() * 0.14);
      color.multiplyScalar(options.kind === 'dust'
        ? 0.62 + cluster * 0.12
        : 1.02 + cluster * 0.3);

      appendQuad({
        positions,
        colors,
        uvs,
        opacities,
        seeds,
        progressValues,
        centerX: cx,
        centerY: cy,
        z: options.z + (random() - 0.5) * 0.012,
        tx: segmentTx,
        ty: segmentTy,
        nx: segmentNx,
        ny: segmentNy,
        halfLength,
        halfWidth,
        color,
        opacity: localOpacity,
        seed: t * 4.1 + armIndex * 7.3,
        progress: t
      });
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(opacities, 1));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('aProgress', new THREE.Float32BufferAttribute(progressValues, 1));
  geometry.computeBoundingSphere();

  const material = createRibbonMaterial(options);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = options.name;
  mesh.frustumCulled = false;

  return {
    mesh,
    geometry,
    material,
    baseOpacity: options.opacity,
    kind: options.kind
  };
}

function appendQuad({
  positions,
  colors,
  uvs,
  opacities,
  seeds,
  progressValues,
  centerX,
  centerY,
  z,
  tx,
  ty,
  nx,
  ny,
  halfLength,
  halfWidth,
  color,
  opacity,
  seed,
  progress
}) {
  const corners = [
    [-1, -1, 0, 0],
    [1, -1, 1, 0],
    [1, 1, 1, 1],
    [-1, -1, 0, 0],
    [1, 1, 1, 1],
    [-1, 1, 0, 1]
  ];

  corners.forEach(([along, across, u, v]) => {
    positions.push(
      centerX + tx * halfLength * along + nx * halfWidth * across,
      centerY + ty * halfLength * along + ny * halfWidth * across,
      z
    );
    colors.push(color.r, color.g, color.b);
    uvs.push(u, v);
    opacities.push(opacity);
    seeds.push(seed);
    progressValues.push(progress);
  });
}

function createRibbonMaterial(options) {
  const isDust = options.kind === 'dust';

  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: options.opacity },
      uTime: { value: 0 },
      uBreakup: { value: options.breakup },
      uContinuity: { value: options.continuity ?? 0 },
      uColorBoost: { value: 1 }
    },
    vertexShader: `
      attribute float aOpacity;
      attribute float aSeed;
      attribute float aProgress;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vSeed;
      varying float vProgress;

      void main() {
        vUv = uv;
        vColor = color;
        vOpacity = aOpacity;
        vSeed = aSeed;
        vProgress = aProgress;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uTime;
      uniform float uBreakup;
      uniform float uContinuity;
      uniform float uColorBoost;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vSeed;
      varying float vProgress;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        mat2 rotation = mat2(0.8, 0.6, -0.6, 0.8);
        for (int octave = 0; octave < 4; octave += 1) {
          value += noise2(p) * amplitude;
          p = rotation * p * 2.03 + 7.17;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        p.y += sin(p.x * (2.1 + fract(vSeed) * 1.7) + vSeed) * 0.1;
        vec2 domain = vec2(p.x * 1.7, p.y * 2.35) + vec2(vSeed, vSeed * 0.37);
        vec2 warp = vec2(
          fbm(domain * 0.72 + 3.1),
          fbm(domain * 0.72 + 8.7)
        ) - 0.5;
        float cloudNoise = fbm(domain + warp * 1.35 + uTime * 0.006);
        float edgeVariation = 0.78 + fract(sin(vSeed * 12.73) * 437.5) * 0.22;
        float lengthFeather = 1.0 - smoothstep(
          (0.56 + cloudNoise * 0.14) * edgeVariation,
          1.0,
          abs(p.x)
        );
        float widthFeather = 1.0 - smoothstep(
          0.14 * edgeVariation,
          0.68 + edgeVariation * 0.14 + cloudNoise * 0.16,
          abs(p.y + warp.y * 0.26)
        );
        float feather = pow(max(lengthFeather * widthFeather, 0.0), ${isDust ? '1.45' : '1.2'});
        float brokenCloud = smoothstep(
          uBreakup - 0.2,
          uBreakup + 0.34,
          cloudNoise + feather * 0.22
        );
        brokenCloud = max(
          brokenCloud,
          feather * uContinuity * (0.65 + cloudNoise * 0.35)
        );
        float strand = 0.74 + 0.26 * sin((p.x + warp.x * 0.4) * 5.4 + vSeed);
        float cloudBody = brokenCloud * strand * vOpacity;
        float connectionMist = uContinuity
          * (0.24 + cloudNoise * 0.22)
          * (0.34 + vOpacity * 0.66);
        float alpha = feather * max(cloudBody, connectionMist) * uOpacity;

        alpha *= 1.0 - smoothstep(0.66, 0.86, vProgress);
        if (alpha < 0.0005) discard;
        gl_FragColor = vec4(vColor * uColorBoost, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true
  });
}

function pointOnArm(config, armIndex, t) {
  const radius = config.innerRadius
    + (config.outerRadius - config.innerRadius) * Math.pow(t, config.radiusExponent);
  const angle = config.globalArmPhase + armIndex * Math.PI + t * TAU * config.turns;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

function shellWidthAt(t) {
  const middleWidth = 0.022 + Math.sin(Math.PI * Math.min(t, 0.82) / 0.82) * 0.052;
  const rootTaper = 0.46 + smootherstep(0.035, 0.18, t) * 0.54;
  const outerThin = 1 - smootherstep(0.64, 0.86, t) * 0.82;

  return middleWidth * rootTaper * outerThin;
}

function smootherstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export const cinematicGalaxyShellFactory = { createCinematicGalaxyShell };
