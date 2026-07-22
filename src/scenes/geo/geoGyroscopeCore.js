import * as THREE from 'three';
import {
  createLabelSprite,
  createSignalPointsMaterial,
  lerp,
  seededRandom,
  smootherstep
} from './geoSignalCore.js';

const DATA_SEED_PARTICLES = 560;
const DATA_SEED_RADIUS = 0.195;
const ENTRY_RESPONSE_PARTICLES = 180;
const PROCESSING_FRAGMENT_PARTICLES = 132;

const BAND_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'answer',
    name: 'ANSWER Processing Band',
    radius: 0.38,
    coverage: 0.39,
    particleCount: 360,
    color: '#8eeaff',
    accent: '#e4fbff',
    rotation: [0.72, 0.12, -0.48],
    entryAngle: 2.62,
    reveal: [0.14, 0.4],
    response: [0.5, 0.7],
    speed: 0.018,
    direction: 1,
    fragments: Object.freeze([
      [-0.48, 0.78],
      [1.42, 0.82],
      [3.78, 0.85]
    ])
  }),
  Object.freeze({
    id: 'citation',
    name: 'CITATION Processing Band',
    radius: 0.52,
    coverage: 0.42,
    particleCount: 400,
    color: '#e6f7ff',
    accent: '#b9b8dc',
    rotation: [-0.38, 0.52, 0.42],
    entryAngle: 0.58,
    reveal: [0.22, 0.48],
    response: [0.58, 0.78],
    speed: 0.013,
    direction: -1,
    fragments: Object.freeze([
      [0.02, 0.86],
      [2.02, 0.88],
      [4.32, 0.9]
    ])
  }),
  Object.freeze({
    id: 'keyword',
    name: 'KEYWORD Processing Band',
    radius: 0.67,
    coverage: 0.45,
    particleCount: 440,
    color: '#55dfdf',
    accent: '#b6fbff',
    rotation: [0.32, -0.56, -0.12],
    entryAngle: -0.62,
    reveal: [0.3, 0.56],
    response: [0.66, 0.86],
    speed: 0.01,
    direction: 1,
    fragments: Object.freeze([
      [-0.72, 0.94],
      [1.35, 0.92],
      [3.72, 0.97]
    ])
  })
]);

export function createGeoGyroscopeCore(resources, visualProfile) {
  const group = new THREE.Group();
  const seed = createDataSeed(resources.pointTexture);
  const bands = BAND_DEFINITIONS.map((definition, index) => (
    createProcessingBand(resources.pointTexture, definition, index)
  ));
  const fragments = createProcessingFragments(resources.pointTexture);
  const responses = createEntryResponses(resources.pointTexture);
  const label = createLabelSprite(
    'GEO SIGNAL CORE',
    'GEO \u4fe1\u53f7\u6838\u5fc3',
    '#8fe9ff',
    1.2 * visualProfile.core.labelScale,
    true,
    { titleAlpha: 0.78, subtitleAlpha: 0.32, glowBlur: 3.4 }
  );
  const glowMaterial = new THREE.SpriteMaterial({
    map: resources.pointTexture,
    color: '#42c9ef',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const glow = new THREE.Sprite(glowMaterial);
  const contrastMaterial = new THREE.SpriteMaterial({
    map: resources.hazeTexture,
    color: '#03101d',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const contrast = new THREE.Sprite(contrastMaterial);
  let debugLayer = 'full';
  let debugVisuals = true;
  let debugLabel = true;

  group.name = 'GEO Broken Gyroscope Core';
  contrast.name = 'Gyroscope Contrast Buffer';
  contrast.position.z = -0.32;
  contrast.scale.set(1.34, 0.88, 1);
  contrast.renderOrder = 1;
  glow.name = 'Gyroscope Restrained Glow';
  glow.scale.set(0.92, 0.92, 1);
  glow.position.z = -0.08;
  glow.renderOrder = 2;
  label.sprite.position.set(0, -0.485, 0.08);
  group.add(contrast, glow, seed.points);
  bands.forEach((band) => group.add(band.group));
  group.add(fragments.group, responses.points, label.sprite);

  return {
    group,
    particleCount: DATA_SEED_PARTICLES
      + PROCESSING_FRAGMENT_PARTICLES
      + ENTRY_RESPONSE_PARTICLES
      + BAND_DEFINITIONS.reduce((sum, definition) => sum + definition.particleCount, 0),
    bandMetrics: BAND_DEFINITIONS.map(({ id, radius, coverage, rotation, fragments: arcs }) => ({
      id,
      radius,
      coverage,
      rotation,
      fragmentCount: arcs.length
    })),
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyDebugVisibility();
    },
    setDebugVisibility(showVisuals, showLabel) {
      debugVisuals = showVisuals;
      debugLabel = showLabel;
      applyDebugVisibility();
    },
    update(time, progress) {
      const wake = smootherstep(0, 0.16, progress);
      const volumeComplete = smootherstep(0.62, 0.92, progress);
      const stable = smootherstep(0.84, 0.98, progress);
      const labelReveal = smootherstep(0.84, 0.99, progress);
      const baseScale = lerp(0.62, 0.86, wake) + volumeComplete * 0.14;
      const cinematicScale = lerp(0.84, visualProfile.core.scale, volumeComplete);

      group.scale.setScalar(baseScale * cinematicScale);
      seed.update(time, progress, stable);
      bands.forEach((band) => band.update(time, progress, stable));
      fragments.update(time, progress, stable);
      responses.update(time, progress, stable);
      contrastMaterial.opacity = smootherstep(0.08, 0.34, progress) * 0.105;
      glowMaterial.opacity = stable * 0.018;
      glow.scale.setScalar(0.9 + stable * 0.05);
      label.material.opacity = labelReveal * visualProfile.core.labelOpacity;

      return wake * (0.72 + stable * 0.28);
    },
    dispose() {
      seed.dispose();
      bands.forEach((band) => band.dispose());
      fragments.dispose();
      responses.dispose();
      label.dispose();
      glowMaterial.dispose();
      contrastMaterial.dispose();
      group.clear();
    }
  };

  function applyDebugVisibility() {
    const full = debugLayer === 'full' || debugLayer === 'hidden-label';
    seed.points.visible = debugVisuals && (full || debugLayer === 'seed');
    bands.forEach((band) => {
      band.group.visible = debugVisuals && (full || debugLayer === band.id);
    });
    fragments.group.visible = debugVisuals && (full || debugLayer === 'fragments');
    responses.points.visible = debugVisuals && full;
    contrast.visible = debugVisuals && full;
    glow.visible = debugVisuals && full;
    label.sprite.visible = debugLabel && debugLayer === 'full';
  }
}

function createDataSeed(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(DATA_SEED_PARTICLES * 3);
  const colors = new Float32Array(DATA_SEED_PARTICLES * 3);
  const sizes = new Float32Array(DATA_SEED_PARTICLES);
  const phases = new Float32Array(DATA_SEED_PARTICLES);
  const random = seededRandom(230411);
  const center = new THREE.Color('#eafcff');
  const edge = new THREE.Color('#68d8f1');
  const color = new THREE.Color();

  for (let index = 0; index < DATA_SEED_PARTICLES; index += 1) {
    const stride = index * 3;
    const ratio = Math.pow(random(), 2.15);
    const radius = DATA_SEED_RADIUS * ratio;
    const azimuth = random() * Math.PI * 2;
    const cosine = random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);

    positions[stride] = Math.cos(azimuth) * sine * radius;
    positions[stride + 1] = cosine * radius * 0.86;
    positions[stride + 2] = Math.sin(azimuth) * sine * radius;
    color.copy(center).lerp(edge, ratio * 0.78);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 41 === 0 ? 1.78 : index % 9 === 0 ? 1.2 : 0.68;
    phases[index] = random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uProgress: { value: 0 },
      uStable: { value: 0 },
      uTime: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      uniform float uProgress;
      uniform float uStable;
      uniform float uTime;
      varying vec3 vColor;

      void main() {
        vec3 animated = position * mix(0.24, 1.0, uProgress);
        float reorganize = sin(uTime * 0.33 + aPhase) * 0.009 * uStable;
        animated += normalize(position + vec3(0.0001)) * reorganize;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        vColor = color;
        gl_PointSize = aSize * (15.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;

      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a * uOpacity;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'Gyroscope Data Seed';
  points.renderOrder = 10;
  return {
    points,
    update(time, progress, stable) {
      material.uniforms.uOpacity.value = smootherstep(0, 0.18, progress) * 0.48;
      material.uniforms.uProgress.value = smootherstep(0, 0.2, progress);
      material.uniforms.uStable.value = stable;
      material.uniforms.uTime.value = time;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createProcessingBand(texture, definition, bandIndex) {
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(definition.particleCount * 3);
  const colors = new Float32Array(definition.particleCount * 3);
  const sizes = new Float32Array(definition.particleCount);
  const random = seededRandom(240169 + bandIndex * 977);
  const base = new THREE.Color(definition.color);
  const accent = new THREE.Color(definition.accent);
  const color = new THREE.Color();

  for (let index = 0; index < definition.particleCount; index += 1) {
    const fragment = definition.fragments[index % definition.fragments.length];
    const angle = fragment[0] + random() * fragment[1];
    const subLane = (index % 3) - 1;
    const radius = definition.radius
      + subLane * (0.012 + bandIndex * 0.002)
      + (random() - 0.5) * (0.018 + bandIndex * 0.005);
    const stride = index * 3;

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = Math.sin(angle) * radius * 0.7;
    positions[stride + 2] = (random() - 0.5) * (0.024 + bandIndex * 0.008);
    color.copy(base).lerp(accent, 0.08 + random() * (bandIndex === 1 ? 0.2 : 0.28));
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 47 === 0 ? 1.34 : 0.5 + random() * 0.5;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const particleMaterial = createSignalPointsMaterial(texture, 0);
  particleMaterial.depthTest = false;
  const points = new THREE.Points(particleGeometry, particleMaterial);
  const lineLayer = createBandLineFragments(definition);
  const group = new THREE.Group();

  group.name = definition.name;
  group.rotation.set(...definition.rotation);
  points.name = `${definition.name} Particles`;
  points.renderOrder = 8;
  lineLayer.lines.renderOrder = 8;
  group.add(lineLayer.lines, points);

  return {
    id: definition.id,
    group,
    update(time, progress, stable) {
      const reveal = smootherstep(definition.reveal[0], definition.reveal[1], progress);
      const response = smootherstep(definition.response[0], definition.response[1], progress);
      const responsePulse = response * (1 - smootherstep(
        definition.response[1] - 0.035,
        definition.response[1] + 0.085,
        progress
      ));
      particleMaterial.uniforms.uOpacity.value = reveal * (0.5 + responsePulse * 0.17);
      particleMaterial.uniforms.uScale.value = 1.58;
      lineLayer.material.opacity = reveal * (0.31 + responsePulse * 0.09);
      const microRotation = time * definition.speed * definition.direction * stable;
      group.rotation.x = definition.rotation[0] + microRotation * 0.22;
      group.rotation.y = definition.rotation[1] + microRotation * 0.16;
      group.rotation.z = definition.rotation[2] + microRotation;
      group.scale.setScalar(lerp(0.72, 1, reveal));
    },
    dispose() {
      particleGeometry.dispose();
      particleMaterial.dispose();
      lineLayer.dispose();
      group.clear();
    }
  };
}

function createBandLineFragments(definition) {
  const positions = [];

  definition.fragments.forEach(([start, length], fragmentIndex) => {
    const segments = 18 + fragmentIndex * 3;
    for (let index = 0; index < segments; index += 1) {
      if ((index + fragmentIndex) % 6 === 3 || index % 9 === 7) continue;
      const t0 = index / segments;
      const t1 = (index + 0.68) / segments;
      for (const radialOffset of [-0.008, 0.008]) {
        for (const t of [t0, t1]) {
          const angle = start + length * t;
          const irregularity = Math.sin(angle * 7.3 + fragmentIndex) * 0.006;
          const radius = definition.radius + irregularity + radialOffset;
          positions.push(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius * 0.7,
            Math.sin(angle * 3.1 + fragmentIndex) * 0.008
          );
        }
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: definition.color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = `${definition.name} Broken Lines`;
  return {
    lines,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createProcessingFragments(texture) {
  const group = new THREE.Group();
  const positions = new Float32Array(PROCESSING_FRAGMENT_PARTICLES * 3);
  const colors = new Float32Array(PROCESSING_FRAGMENT_PARTICLES * 3);
  const sizes = new Float32Array(PROCESSING_FRAGMENT_PARTICLES);
  const random = seededRandom(251177);
  const fragmentCenters = [
    [-0.46, 0.38, 0.09],
    [0.34, 0.48, -0.12],
    [0.58, -0.23, 0.13],
    [-0.6, -0.14, -0.1],
    [0.08, -0.61, 0.17]
  ];
  const cyan = new THREE.Color('#69e5f3');
  const cold = new THREE.Color('#d8f7ff');
  const color = new THREE.Color();

  for (let index = 0; index < PROCESSING_FRAGMENT_PARTICLES; index += 1) {
    const center = fragmentCenters[index % fragmentCenters.length];
    const stride = index * 3;
    const spread = 0.035 + (index % fragmentCenters.length) * 0.006;

    positions[stride] = center[0] + (random() - 0.5) * spread * 1.8;
    positions[stride + 1] = center[1] + (random() - 0.5) * spread;
    positions[stride + 2] = center[2] + (random() - 0.5) * spread * 1.2;
    color.copy(cyan).lerp(cold, random() * 0.42);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 17 === 0 ? 1.12 : 0.4 + random() * 0.42;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const particleMaterial = createSignalPointsMaterial(texture, 0);
  particleMaterial.depthTest = false;
  const points = new THREE.Points(particleGeometry, particleMaterial);
  const lineGeometry = createFragmentLineGeometry(fragmentCenters);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: '#78dff0',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);

  group.name = 'Gyroscope Processing Fragments';
  points.name = 'Processing Fragment Particles';
  lines.name = 'Processing Fragment Short Lines';
  points.renderOrder = 7;
  lines.renderOrder = 7;
  group.add(lines, points);

  return {
    group,
    update(time, progress, stable) {
      const reveal = smootherstep(0.7, 0.94, progress);
      particleMaterial.uniforms.uOpacity.value = reveal * 0.28;
      particleMaterial.uniforms.uScale.value = 1.18;
      lineMaterial.opacity = reveal * 0.18;
      group.rotation.y = Math.sin(time * 0.021) * 0.012 * stable;
      group.rotation.z = Math.sin(time * 0.017 + 1.3) * 0.008 * stable;
    },
    dispose() {
      particleGeometry.dispose();
      particleMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      group.clear();
    }
  };
}

function createFragmentLineGeometry(centers) {
  const positions = [];

  centers.forEach((center, index) => {
    const count = 2 + (index % 3);
    for (let segment = 0; segment < count; segment += 1) {
      const angle = index * 1.13 + segment * 0.56;
      const length = 0.025 + index * 0.004 + segment * 0.003;
      const offset = (segment - (count - 1) * 0.5) * 0.018;
      positions.push(
        center[0] + Math.cos(angle) * offset,
        center[1] + Math.sin(angle) * offset,
        center[2],
        center[0] + Math.cos(angle) * (offset + length),
        center[1] + Math.sin(angle) * (offset + length),
        center[2] + Math.sin(angle * 1.7) * 0.008
      );
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function createEntryResponses(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ENTRY_RESPONSE_PARTICLES * 3);
  const colors = new Float32Array(ENTRY_RESPONSE_PARTICLES * 3);
  const sizes = new Float32Array(ENTRY_RESPONSE_PARTICLES);
  const entries = new Float32Array(ENTRY_RESPONSE_PARTICLES);
  const pathProgress = new Float32Array(ENTRY_RESPONSE_PARTICLES);
  const random = seededRandom(260047);
  const perEntry = ENTRY_RESPONSE_PARTICLES / 3;

  BAND_DEFINITIONS.forEach((definition, entry) => {
    const base = new THREE.Color(definition.color);
    const accent = new THREE.Color(definition.accent);
    const rotation = new THREE.Euler(...definition.rotation);
    for (let localIndex = 0; localIndex < perEntry; localIndex += 1) {
      const index = entry * perEntry + localIndex;
      const stride = index * 3;
      const t = localIndex / (perEntry - 1);
      const radial = lerp(definition.radius + 0.025, 0.08, smootherstep(0, 1, t));
      const turn = definition.direction * (0.56 + entry * 0.08) * Math.sin(t * Math.PI);
      const angle = definition.entryAngle + turn;
      const point = new THREE.Vector3(
        Math.cos(angle) * radial,
        Math.sin(angle) * radial * 0.7,
        (random() - 0.5) * 0.014
      ).applyEuler(rotation);
      const color = base.clone().lerp(accent, smootherstep(0.62, 1, t) * 0.48);

      positions[stride] = point.x + (random() - 0.5) * 0.012;
      positions[stride + 1] = point.y + (random() - 0.5) * 0.012;
      positions[stride + 2] = point.z + (random() - 0.5) * 0.012;
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      const citationNode = entry === 1 && (localIndex === 22 || localIndex === 37);
      const keywordNode = entry === 2 && (localIndex === 16 || localIndex === 32 || localIndex === 46);
      sizes[index] = citationNode || keywordNode
        ? 1.72
        : localIndex % 13 === 0
          ? 1.28
          : 0.58 + random() * 0.44;
      entries[index] = entry;
      pathProgress[index] = t;
    }
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aEntry', new THREE.BufferAttribute(entries, 1));
  geometry.setAttribute('aPathProgress', new THREE.BufferAttribute(pathProgress, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uAnswer: { value: 0 },
      uCitation: { value: 0 },
      uKeyword: { value: 0 },
      uStable: { value: 0 },
      uTime: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aEntry;
      attribute float aPathProgress;
      varying vec3 vColor;
      varying float vEntry;
      varying float vPath;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vEntry = aEntry;
        vPath = aPathProgress;
        gl_PointSize = aSize * (17.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uAnswer;
      uniform float uCitation;
      uniform float uKeyword;
      uniform float uStable;
      uniform float uTime;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      varying float vEntry;
      varying float vPath;

      void main() {
        float response = vEntry < 0.5 ? uAnswer : vEntry < 1.5 ? uCitation : uKeyword;
        float head = smoothstep(response - 0.22, response - 0.055, vPath)
          * (1.0 - smoothstep(response + 0.02, response + 0.14, vPath));
        float citationScreen = vEntry > 0.5 && vEntry < 1.5
          ? (smoothstep(0.32, 0.38, vPath) * (1.0 - smoothstep(0.43, 0.49, vPath))
            + smoothstep(0.59, 0.65, vPath) * (1.0 - smoothstep(0.7, 0.76, vPath))) * 0.22
          : 0.0;
        float keywordSteps = vEntry > 1.5
          ? 0.76 + step(0.27, vPath) * 0.08 + step(0.54, vPath) * 0.08 + step(0.78, vPath) * 0.08
          : 1.0;
        float trail = smoothstep(0.0, response, vPath) * 0.14;
        float stableFlow = uStable * (0.05 + sin(uTime * (1.02 + vEntry * 0.11) + vPath * 19.0) * 0.018);
        float alpha = texture2D(uPointTexture, gl_PointCoord).a;
        alpha *= keywordSteps * max(head + citationScreen, trail + stableFlow);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vColor, alpha * 0.88);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'Gyroscope Mapped Entry Responses';
  points.renderOrder = 11;
  return {
    points,
    update(time, progress, stable) {
      material.uniforms.uAnswer.value = smootherstep(0.5, 0.7, progress);
      material.uniforms.uCitation.value = smootherstep(0.58, 0.78, progress);
      material.uniforms.uKeyword.value = smootherstep(0.66, 0.86, progress);
      material.uniforms.uStable.value = stable;
      material.uniforms.uTime.value = time;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
