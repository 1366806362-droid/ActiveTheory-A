import * as THREE from 'three';

const TAU = Math.PI * 2;
const SUPPORTED_DEBUG_MODES = new Set([
  'off',
  'rearMistOnly',
  'starSpillOnly',
  'wispsOnly',
  'foregroundDustOnly',
  'combined'
]);

const PARAMETERS = Object.freeze({
  rearMist: Object.freeze({
    alpha: 0.043,
    width: 2.04,
    height: 1.42,
    extent: 1.14
  }),
  starSpill: Object.freeze({
    count: 960,
    alpha: 0.17,
    extent: 1.13
  }),
  wisps: Object.freeze({
    regions: 3,
    targetCount: 315,
    alpha: 0.068,
    extent: 1.12
  }),
  foregroundDust: Object.freeze({
    count: 104,
    alpha: 0.078,
    extent: 1.1,
    parallaxX: 0.014,
    parallaxY: 0.01
  })
});

export function readGalaxyAtmosphereDebugState() {
  if (typeof window === 'undefined') {
    return Object.freeze({ enabled: false, mode: 'combined' });
  }

  const params = new URLSearchParams(window.location.search);
  const rawDebugValue = params.get('debugGalaxyAtmosphere');
  const enabled = import.meta.env.DEV
    && rawDebugValue !== null
    && rawDebugValue !== '0'
    && rawDebugValue !== 'false';
  const requestedMode = params.get('galaxyAtmosphereMode')
    || (SUPPORTED_DEBUG_MODES.has(rawDebugValue) ? rawDebugValue : 'combined');
  const mode = SUPPORTED_DEBUG_MODES.has(requestedMode)
    ? requestedMode
    : 'combined';

  return Object.freeze({ enabled, mode });
}

export function createGalaxyAtmosphere({
  debugState = Object.freeze({ enabled: false, mode: 'combined' })
} = {}) {
  const activeMode = debugState.enabled ? debugState.mode : 'combined';
  const debugGain = debugState.enabled && activeMode.endsWith('Only') ? 4 : 1;
  const group = new THREE.Group();
  const rearMist = createRearNebulaMist(debugGain);
  const starSpill = createOuterStarSpill(debugGain);
  const wisps = createArmEdgeWisps(debugGain);
  const foregroundDust = createForegroundDust(debugGain);
  const layers = {
    rearMist: rearMist.mesh,
    starSpill: starSpill.points,
    wisps: wisps.points,
    foregroundDust: foregroundDust.points
  };
  let journeyOpacity = 1;
  let phaseTime = 0;
  let frameCount = 0;
  let fpsWindowStart = performance.now();
  let measuredFps = 0;
  let disposed = false;

  group.name = 'GalaxyAtmosphereGroup';
  group.add(
    rearMist.mesh,
    starSpill.points,
    wisps.points,
    foregroundDust.points
  );
  applyMode(activeMode);
  publishDiagnostics();

  function update(delta, time, interaction, journeyProgress = 0) {
    if (disposed) return;

    journeyOpacity = 1 - smootherstep(0.18, 0.72, journeyProgress);
    phaseTime = time;
    rearMist.update(time, journeyOpacity);
    starSpill.update(time, journeyOpacity);
    wisps.update(time, journeyOpacity);
    foregroundDust.update(time, journeyOpacity, interaction);
    updateFpsMeasurement();
  }

  function applyMode(mode = 'combined') {
    const normalizedMode = SUPPORTED_DEBUG_MODES.has(mode) ? mode : 'combined';

    group.visible = normalizedMode !== 'off';
    rearMist.mesh.visible = normalizedMode === 'combined'
      || normalizedMode === 'rearMistOnly';
    starSpill.points.visible = normalizedMode === 'combined'
      || normalizedMode === 'starSpillOnly';
    wisps.points.visible = normalizedMode === 'combined'
      || normalizedMode === 'wispsOnly';
    foregroundDust.points.visible = normalizedMode === 'combined'
      || normalizedMode === 'foregroundDustOnly';
  }

  function updateFpsMeasurement() {
    frameCount += 1;
    const now = performance.now();
    const elapsed = now - fpsWindowStart;

    if (elapsed < 2000) return;
    measuredFps = frameCount * 1000 / elapsed;
    frameCount = 0;
    fpsWindowStart = now;
    publishDiagnostics();
  }

  function publishDiagnostics() {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;

    const diagnostics = {
      enabled: group.visible,
      mode: activeMode,
      debugGain,
      instanceUuid: group.uuid,
      phaseTime,
      journeyOpacity,
      fps: measuredFps,
      layers: {
        rearMist: {
          primitives: 1,
          alpha: PARAMETERS.rearMist.alpha,
          extent: PARAMETERS.rearMist.extent,
          visible: rearMist.mesh.visible
        },
        starSpill: {
          particles: PARAMETERS.starSpill.count,
          alpha: PARAMETERS.starSpill.alpha,
          extent: PARAMETERS.starSpill.extent,
          visible: starSpill.points.visible
        },
        wisps: {
          regions: PARAMETERS.wisps.regions,
          particles: wisps.count,
          alpha: PARAMETERS.wisps.alpha,
          extent: PARAMETERS.wisps.extent,
          visible: wisps.points.visible
        },
        foregroundDust: {
          particles: PARAMETERS.foregroundDust.count,
          alpha: PARAMETERS.foregroundDust.alpha,
          extent: PARAMETERS.foregroundDust.extent,
          visible: foregroundDust.points.visible
        }
      }
    };
    window.__ACTIVE_THEORY_GALAXY_ATMOSPHERE__ = diagnostics;
    document.documentElement.dataset.galaxyAtmosphereDiagnostics = JSON.stringify(
      diagnostics
    );
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    rearMist.dispose();
    starSpill.dispose();
    wisps.dispose();
    foregroundDust.dispose();
    group.clear();
    if (typeof window !== 'undefined') {
      delete window.__ACTIVE_THEORY_GALAXY_ATMOSPHERE__;
      delete document.documentElement.dataset.galaxyAtmosphereDiagnostics;
    }
  }

  return {
    group,
    layers,
    update,
    applyMode,
    dispose,
    parameters: PARAMETERS,
    debugState,
    getFps: () => measuredFps
  };
}

function createRearNebulaMist(debugGain = 1) {
  const geometry = new THREE.PlaneGeometry(
    PARAMETERS.rearMist.width,
    PARAMETERS.rearMist.height,
    1,
    1
  );
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: PARAMETERS.rearMist.alpha },
      uDebugGain: { value: debugGain },
      uJourneyOpacity: { value: 1 }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uDebugGain;
      uniform float uJourneyOpacity;

      float hash21(vec2 point) {
        point = fract(point * vec2(123.34, 456.21));
        point += dot(point, point + 45.32);
        return fract(point.x * point.y);
      }

      float valueNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        float a = hash21(cell);
        float b = hash21(cell + vec2(1.0, 0.0));
        float c = hash21(cell + vec2(0.0, 1.0));
        float d = hash21(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }

      float fbm(vec2 point) {
        float value = 0.0;
        float amplitude = 0.58;
        for (int octave = 0; octave < 4; octave += 1) {
          value += valueNoise(point) * amplitude;
          point = mat2(1.62, -1.18, 1.18, 1.62) * point + 3.7;
          amplitude *= 0.48;
        }
        return value;
      }

      float softBlob(vec2 point, vec2 center, vec2 radius) {
        return 1.0 - smoothstep(0.34, 1.0, length((point - center) / radius));
      }

      void main() {
        vec2 point = vUv;
        vec2 centered = point - 0.5;
        float ellipticalRadius = length(centered / vec2(0.52, 0.39));
        float centerCut = smoothstep(0.27, 0.47, ellipticalRadius);
        float outerFade = 1.0 - smoothstep(0.76, 1.08, ellipticalRadius);
        float topRegion = softBlob(point, vec2(0.58, 0.76), vec2(0.43, 0.26));
        float rightRegion = softBlob(point, vec2(0.83, 0.56), vec2(0.28, 0.32));
        float leftRearRegion = softBlob(point, vec2(0.27, 0.67), vec2(0.23, 0.2));
        float regionalMask = max(max(topRegion, rightRegion), leftRearRegion * 0.62);
        float broadNoise = fbm(point * 4.2 + vec2(2.1, 7.4));
        float breakNoise = fbm(point * 9.6 + vec2(11.3, 1.7));
        float brokenDensity = smoothstep(0.36, 0.78, broadNoise * 0.72 + breakNoise * 0.28);
        float edgeFade = smoothstep(0.0, 0.08, min(min(point.x, point.y), min(1.0 - point.x, 1.0 - point.y)));
        float alpha = regionalMask
          * centerCut
          * outerFade
          * brokenDensity
          * edgeFade
          * uOpacity
          * uDebugGain
          * uJourneyOpacity;
        vec3 deepBlue = vec3(0.04, 0.16, 0.4);
        vec3 iceBlue = vec3(0.15, 0.42, 0.7);
        vec3 restrainedPurple = vec3(0.22, 0.13, 0.4);
        vec3 color = mix(deepBlue, iceBlue, broadNoise * 0.48);
        color = mix(color, restrainedPurple, leftRearRegion * breakNoise * 0.2);

        if (alpha < 0.001) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'RearNebulaMist';
  mesh.position.set(0.02, 0.025, -0.04);
  mesh.renderOrder = -9;
  mesh.frustumCulled = false;

  return {
    mesh,
    update(time, journeyOpacity) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createOuterStarSpill(debugGain = 1) {
  const random = createSeededRandom(27021991);
  const count = PARAMETERS.starSpill.count;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const phases = new Float32Array(count);
  const twinkles = new Float32Array(count);
  const palette = [
    new THREE.Color(0xdcefff),
    new THREE.Color(0x9ddcff),
    new THREE.Color(0x5f9bd4),
    new THREE.Color(0x384f91),
    new THREE.Color(0x9d8fcd)
  ];
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    let angle;
    let radius;
    const regionRoll = random();

    if (regionRoll < 0.5) {
      angle = THREE.MathUtils.degToRad(24 + random() * 128);
      radius = 0.73 + Math.pow(random(), 1.35) * 0.3;
    } else if (regionRoll < 0.88) {
      angle = THREE.MathUtils.degToRad(-43 + random() * 76);
      radius = 0.69 + Math.pow(random(), 1.2) * 0.36;
    } else {
      angle = THREE.MathUtils.degToRad(132 + random() * 39);
      radius = 0.7 + random() * 0.22;
    }

    const clump = Math.sin(angle * 5.7 + radius * 14.3) * 0.5 + 0.5;
    const localJitter = (random() - 0.5) * (0.035 + clump * 0.04);
    const x = Math.cos(angle) * (radius + localJitter);
    const y = Math.sin(angle) * (radius + localJitter) * 0.63;
    const z = -0.008 + random() * 0.046;
    const sizeRoll = random();
    const paletteRoll = random();
    const paletteIndex = paletteRoll < 0.38
      ? 0
      : paletteRoll < 0.67
        ? 1
        : paletteRoll < 0.87
          ? 2
          : paletteRoll < 0.97
            ? 3
            : 4;

    color.copy(palette[paletteIndex]);
    color.multiplyScalar(0.42 + random() * 0.36);
    positions.set([x, y, z], index * 3);
    colors.set([color.r, color.g, color.b], index * 3);
    sizes[index] = sizeRoll < 0.87
      ? 0.28 + random() * 0.27
      : sizeRoll < 0.985
        ? 0.62 + random() * 0.37
        : 1.08 + random() * 0.34;
    opacities[index] = (0.18 + random() * 0.55) * (0.55 + clump * 0.45);
    phases[index] = random() * TAU;
    twinkles[index] = random() < 0.085 ? 0.35 + random() * 0.5 : 0;
  }

  const geometry = createPointGeometry({
    positions,
    colors,
    attributes: {
      aSize: sizes,
      aOpacity: opacities,
      aPhase: phases,
      aTwinkle: twinkles
    }
  });
  const material = createStarPointMaterial({
    opacity: PARAMETERS.starSpill.alpha,
    pointScale: 22,
    blending: THREE.AdditiveBlending,
    debugGain
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'OuterStarSpill';
  points.renderOrder = -5;
  points.frustumCulled = false;

  return {
    points,
    update(time, journeyOpacity) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createArmEdgeWisps(debugGain = 1) {
  const random = createSeededRandom(9012457);
  const paths = [
    {
      start: new THREE.Vector2(0.53, 0.43),
      control: new THREE.Vector2(0.76, 0.67),
      end: new THREE.Vector2(0.98, 0.61),
      count: 118,
      width: 0.052
    },
    {
      start: new THREE.Vector2(0.64, -0.18),
      control: new THREE.Vector2(0.85, -0.16),
      end: new THREE.Vector2(1.0, -0.34),
      count: 104,
      width: 0.042
    },
    {
      start: new THREE.Vector2(-0.49, 0.38),
      control: new THREE.Vector2(-0.72, 0.56),
      end: new THREE.Vector2(-0.92, 0.47),
      count: 93,
      width: 0.037
    }
  ];
  const positions = [];
  const colors = [];
  const sizes = [];
  const opacities = [];
  const phases = [];
  const rotations = [];
  const stretches = [];
  const blue = new THREE.Color(0x77bdf2);
  const ice = new THREE.Color(0xc1e7ff);
  const purple = new THREE.Color(0x776fb5);
  const point = new THREE.Vector2();
  const tangent = new THREE.Vector2();
  const normal = new THREE.Vector2();
  const color = new THREE.Color();

  paths.forEach((path, pathIndex) => {
    for (let index = 0; index < path.count; index += 1) {
      const t = (index + random() * 0.84) / path.count;
      const fragmentation = Math.sin(t * 31 + pathIndex * 2.7)
        + Math.sin(t * 73 + 1.6) * 0.55;

      if (fragmentation < -0.93 && random() < 0.78) continue;
      quadraticBezier(point, path.start, path.control, path.end, t);
      quadraticBezierTangent(tangent, path.start, path.control, path.end, t);
      normal.set(-tangent.y, tangent.x).normalize();
      const envelope = Math.pow(Math.sin(Math.PI * t), 0.58);
      const width = path.width * (0.55 + envelope * 1.05);
      const offset = (random() - 0.5) * width * 2;

      point.addScaledVector(normal, offset);
      point.addScaledVector(tangent, (random() - 0.5) * 0.018);
      positions.push(point.x, point.y, 0.012 + random() * 0.026);
      color.copy(pathIndex === 2 ? purple : blue).lerp(ice, random() * 0.42);
      color.multiplyScalar(0.36 + random() * 0.32);
      colors.push(color.r, color.g, color.b);
      sizes.push(0.58 + random() * 0.82);
      opacities.push(envelope * (0.24 + random() * 0.64));
      phases.push(random() * TAU);
      rotations.push(Math.atan2(tangent.y, tangent.x));
      stretches.push(2.5 + random() * 2.4);
    }
  });

  const geometry = createPointGeometry({
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    attributes: {
      aSize: new Float32Array(sizes),
      aOpacity: new Float32Array(opacities),
      aPhase: new Float32Array(phases),
      aRotation: new Float32Array(rotations),
      aStretch: new Float32Array(stretches)
    }
  });
  const material = createWispPointMaterial({
    opacity: PARAMETERS.wisps.alpha,
    pointScale: 26,
    debugGain
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'ArmEdgeWisps';
  points.renderOrder = -4;
  points.frustumCulled = false;

  return {
    points,
    count: sizes.length,
    update(time, journeyOpacity) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createForegroundDust(debugGain = 1) {
  const random = createSeededRandom(7719021);
  const count = PARAMETERS.foregroundDust.count;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const phases = new Float32Array(count);
  const twinkles = new Float32Array(count);
  const clusters = [
    { center: new THREE.Vector2(0.58, 0.49), spread: new THREE.Vector2(0.19, 0.12), weight: 0.46 },
    { center: new THREE.Vector2(0.86, 0.09), spread: new THREE.Vector2(0.11, 0.15), weight: 0.34 },
    { center: new THREE.Vector2(0.05, 0.67), spread: new THREE.Vector2(0.19, 0.08), weight: 0.2 }
  ];
  const palette = [
    new THREE.Color(0xbfe8ff),
    new THREE.Color(0x7fbce4),
    new THREE.Color(0x6077b5)
  ];
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const roll = random();
    const cluster = roll < clusters[0].weight
      ? clusters[0]
      : roll < clusters[0].weight + clusters[1].weight
        ? clusters[1]
        : clusters[2];
    const radial = Math.sqrt(random());
    const angle = random() * TAU;
    const x = cluster.center.x + Math.cos(angle) * cluster.spread.x * radial;
    const y = cluster.center.y + Math.sin(angle) * cluster.spread.y * radial;

    positions.set([x, y, 0.075 + random() * 0.105], index * 3);
    color.copy(palette[Math.floor(random() * palette.length)]);
    color.multiplyScalar(0.3 + random() * 0.3);
    colors.set([color.r, color.g, color.b], index * 3);
    sizes[index] = 0.72 + random() * 1.18;
    opacities[index] = 0.18 + random() * 0.48;
    phases[index] = random() * TAU;
    twinkles[index] = random() < 0.05 ? 0.2 + random() * 0.22 : 0;
  }

  const geometry = createPointGeometry({
    positions,
    colors,
    attributes: {
      aSize: sizes,
      aOpacity: opacities,
      aPhase: phases,
      aTwinkle: twinkles
    }
  });
  const material = createStarPointMaterial({
    opacity: PARAMETERS.foregroundDust.alpha,
    pointScale: 24,
    blending: THREE.NormalBlending,
    debugGain
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'ForegroundDust';
  points.renderOrder = 3;
  points.frustumCulled = false;

  return {
    points,
    update(time, journeyOpacity, interaction) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
      points.position.x = (interaction?.parallaxX ?? 0) * PARAMETERS.foregroundDust.parallaxX;
      points.position.y = (interaction?.parallaxY ?? 0) * PARAMETERS.foregroundDust.parallaxY;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createPointGeometry({ positions, colors, attributes }) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  Object.entries(attributes).forEach(([name, values]) => {
    geometry.setAttribute(name, new THREE.BufferAttribute(values, 1));
  });
  geometry.computeBoundingSphere();
  return geometry;
}

function createStarPointMaterial({ opacity, pointScale, blending, debugGain = 1 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uDebugGain: { value: debugGain },
      uJourneyOpacity: { value: 1 },
      uPointScale: { value: pointScale }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute float aPhase;
      attribute float aTwinkle;
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uTime;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 1.0 + sin(uTime * 0.86 + aPhase) * aTwinkle;
        vColor = color;
        vOpacity = aOpacity * twinkle;
        gl_PointSize = clamp(aSize * uPointScale / max(-viewPosition.z, 1.0), 0.65, 3.8);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uOpacity;
      uniform float uDebugGain;
      uniform float uJourneyOpacity;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered) * 2.0;
        if (radius >= 1.0) discard;
        float core = 1.0 - smoothstep(0.0, 0.34, radius);
        float halo = 1.0 - smoothstep(0.12, 1.0, radius);
        float alpha = (core * 0.74 + halo * 0.26)
          * vOpacity
          * uOpacity
          * uDebugGain
          * uJourneyOpacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
}

function createWispPointMaterial({ opacity, pointScale, debugGain = 1 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uDebugGain: { value: debugGain },
      uJourneyOpacity: { value: 1 },
      uPointScale: { value: pointScale }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute float aPhase;
      attribute float aRotation;
      attribute float aStretch;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vRotation;
      varying float vStretch;
      uniform float uTime;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vOpacity = aOpacity * (0.92 + sin(uTime * 0.18 + aPhase) * 0.08);
        vRotation = aRotation;
        vStretch = aStretch;
        gl_PointSize = clamp(aSize * aStretch * uPointScale / max(-viewPosition.z, 1.0), 1.2, 7.5);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      varying float vRotation;
      varying float vStretch;
      uniform float uOpacity;
      uniform float uDebugGain;
      uniform float uJourneyOpacity;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float sine = sin(vRotation);
        float cosine = cos(vRotation);
        vec2 rotated = mat2(cosine, -sine, sine, cosine) * centered;
        vec2 stretched = vec2(rotated.x, rotated.y * vStretch);
        float radius = length(stretched) * 2.0;
        if (radius >= 1.0) discard;
        float alpha = (1.0 - smoothstep(0.08, 1.0, radius))
          * vOpacity
          * uOpacity
          * uDebugGain
          * uJourneyOpacity;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
}

function quadraticBezier(target, start, control, end, t) {
  const oneMinusT = 1 - t;

  target.set(
    oneMinusT * oneMinusT * start.x
      + 2 * oneMinusT * t * control.x
      + t * t * end.x,
    oneMinusT * oneMinusT * start.y
      + 2 * oneMinusT * t * control.y
      + t * t * end.y
  );
}

function quadraticBezierTangent(target, start, control, end, t) {
  target.set(
    2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x),
    2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y)
  ).normalize();
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6D2B79F5;
    let value = state;

    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function smootherstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return t * t * t * (t * (t * 6 - 15) + 10);
}

export const galaxyAtmosphereFactory = {
  createGalaxyAtmosphere,
  readGalaxyAtmosphereDebugState
};
