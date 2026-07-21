import * as THREE from 'three';
import {
  clamp,
  createSignalPointsMaterial,
  lerp,
  seededRandom,
  smootherstep
} from './geoSignalCore.js';

const STREAM_SEGMENTS = 34;
const FLOW_PARTICLE_COUNT = 336;

export function createGeoDataStreams(resources, clusterConfigs) {
  const group = new THREE.Group();
  const definitions = createStreamDefinitions(clusterConfigs);
  const curves = definitions.map((definition) => createStreamCurve(definition));
  const lineLayer = createStreamLines(definitions, curves);
  const flowLayer = createFlowParticles(resources.pointTexture, definitions, curves);

  group.name = 'GEO Data Streams';
  group.add(lineLayer.lines, flowLayer.points);

  return {
    group,
    streamCount: definitions.length,
    primaryCount: definitions.filter((definition) => definition.tier === 'main').length,
    crossCount: definitions.filter((definition) => definition.tier === 'cross').length,
    particleCount: FLOW_PARTICLE_COUNT,
    setDebugVisibility(visible) {
      group.visible = visible;
    },
    update(time, progress) {
      lineLayer.material.uniforms.uProgress.value = progress;
      flowLayer.update(time, progress);
      return definitions.reduce((total, definition) => (
        total + (progress >= definition.start + 0.06 ? 1 : 0)
      ), 0);
    },
    dispose() {
      lineLayer.dispose();
      flowLayer.dispose();
      group.clear();
    }
  };
}

function createStreamDefinitions(clusterConfigs) {
  const positions = Object.fromEntries(clusterConfigs.map((config) => [
    config.key,
    new THREE.Vector3(...config.final)
  ]));
  const core = new THREE.Vector3(0, 0, 0);
  const primary = [
    stream('answer-core-a', positions.answer, core, '#d4f8ff', 0.32, 1.3, [0.2, 0.28, 0.34], 'main', 0.048),
    stream('answer-core-b', positions.answer, core, '#62d7ff', 0.37, 0.66, [-0.08, -0.22, 0.22], 'secondary', 0.034),
    stream('citation-core-a', positions.citation, core, '#a7cdf1', 0.39, 1.18, [-0.12, 0.32, -0.3], 'main', 0.041),
    stream('citation-core-b', positions.citation, core, '#628fd0', 0.44, 0.59, [0.18, -0.18, -0.18], 'secondary', 0.031),
    stream('keyword-core-a', positions.keyword, core, '#92fff3', 0.46, 1.2, [0.26, 0.12, -0.12], 'main', 0.053),
    stream('keyword-core-b', positions.keyword, core, '#39bfc4', 0.51, 0.58, [-0.22, 0.16, 0.24], 'secondary', 0.037)
  ];
  const cross = [
    stream('answer-citation', positions.answer, positions.citation, '#5b9dcc', 0.52, 0.25, [0.02, 0.48, -0.2], 'cross', 0.028),
    stream('keyword-answer', positions.keyword, positions.answer, '#45d4da', 0.56, 0.27, [0.34, 0.08, 0.22], 'cross', 0.032),
    stream('citation-keyword', positions.citation, positions.keyword, '#517da9', 0.6, 0.2, [-0.24, 0.42, -0.16], 'cross', 0.025)
  ];

  return [...primary, ...cross];
}

function stream(name, from, to, color, start, strength, bow, tier = 'main', speed = 0.04) {
  return {
    name,
    from: from.clone(),
    to: to.clone(),
    color,
    start,
    strength,
    bow: new THREE.Vector3(...bow),
    tier,
    speed
  };
}

function createStreamCurve(definition) {
  const direction = definition.to.clone().sub(definition.from);
  const point1 = definition.from.clone().addScaledVector(direction, 0.32).add(definition.bow);
  const point2 = definition.from.clone().addScaledVector(direction, 0.7).addScaledVector(definition.bow, -0.42);

  return new THREE.CatmullRomCurve3([
    definition.from,
    point1,
    point2,
    definition.to
  ], false, 'centripetal', 0.45);
}

function createStreamLines(definitions, curves) {
  const positions = [];
  const colors = [];
  const tValues = [];
  const starts = [];
  const strengths = [];
  const tiers = [];
  const phases = [];
  const color = new THREE.Color();
  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();

  curves.forEach((curve, streamIndex) => {
    const definition = definitions[streamIndex];
    color.set(definition.color);
    for (let segment = 0; segment < STREAM_SEGMENTS; segment += 1) {
      const t0 = segment / STREAM_SEGMENTS;
      const t1 = (segment + 0.72) / STREAM_SEGMENTS;
      curve.getPoint(t0, pointA);
      curve.getPoint(t1, pointB);
      positions.push(pointA.x, pointA.y, pointA.z, pointB.x, pointB.y, pointB.z);
      for (let vertex = 0; vertex < 2; vertex += 1) {
        colors.push(color.r, color.g, color.b);
        tValues.push(vertex === 0 ? t0 : t1);
        starts.push(definition.start);
        strengths.push(definition.strength);
        tiers.push(definition.tier === 'main' ? 1 : definition.tier === 'secondary' ? 0.52 : 0.28);
        phases.push(streamIndex * 0.137);
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aT', new THREE.Float32BufferAttribute(tValues, 1));
  geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 1));
  geometry.setAttribute('aStrength', new THREE.Float32BufferAttribute(strengths, 1));
  geometry.setAttribute('aTier', new THREE.Float32BufferAttribute(tiers, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 }
    },
    vertexShader: `
      uniform float uProgress;
      attribute vec3 color;
      attribute float aT;
      attribute float aStart;
      attribute float aStrength;
      attribute float aTier;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vT;
      varying float vPhase;

      void main() {
        float reveal = smoothstep(aStart, aStart + 0.24, uProgress);
        float head = clamp((uProgress - aStart) / 0.34, 0.0, 1.0);
        float drawn = 1.0 - step(head, aT);
        vColor = color;
        vAlpha = reveal * drawn * aStrength * mix(0.82, 1.08, aTier);
        vT = aT;
        vPhase = aPhase;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vT;
      varying float vPhase;

      void main() {
        float dash = smoothstep(0.24, 0.42, fract(vT * 10.0 + vPhase));
        float fade = smoothstep(0.0, 0.1, vT) * (1.0 - smoothstep(0.9, 1.0, vT));
        float alpha = vAlpha * dash * fade * 0.34;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = 'Broken Semantic Data Lines';
  lines.renderOrder = 2;
  return {
    lines,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createFlowParticles(texture, definitions, curves) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(FLOW_PARTICLE_COUNT * 3);
  const colors = new Float32Array(FLOW_PARTICLE_COUNT * 3);
  const baseColors = new Float32Array(FLOW_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(FLOW_PARTICLE_COUNT);
  const baseSizes = new Float32Array(FLOW_PARTICLE_COUNT);
  const streamIndices = new Uint8Array(FLOW_PARTICLE_COUNT);
  const phases = new Float32Array(FLOW_PARTICLE_COUNT);
  const depthOffsets = new Float32Array(FLOW_PARTICLE_COUNT);
  const random = seededRandom(5519);
  const color = new THREE.Color();
  const point = new THREE.Vector3();

  const particleStreamIndices = buildParticleStreamIndices(definitions);

  for (let index = 0; index < FLOW_PARTICLE_COUNT; index += 1) {
    const streamIndex = particleStreamIndices[index];
    const definition = definitions[streamIndex];
    const tierIntensity = definition.tier === 'main' ? 1 : definition.tier === 'secondary' ? 0.72 : 0.56;
    streamIndices[index] = streamIndex;
    phases[index] = random();
    depthOffsets[index] = (random() - 0.5) * (definition.tier === 'main' ? 0.18 : 0.1);
    color.set(definition.color);
    const stride = index * 3;
    baseColors[stride] = color.r * tierIntensity;
    baseColors[stride + 1] = color.g * tierIntensity;
    baseColors[stride + 2] = color.b * tierIntensity;
    colors[stride] = baseColors[stride];
    colors[stride + 1] = baseColors[stride + 1];
    colors[stride + 2] = baseColors[stride + 2];
    baseSizes[index] = index % 29 === 0
      ? definition.tier === 'main' ? 3.15 : 2.35
      : index % 7 === 0
        ? definition.tier === 'main' ? 1.95 : 1.45
        : definition.tier === 'main' ? 0.9 : 0.66;
    sizes[index] = baseSizes[index];
    curves[streamIndex].getPoint(0, point);
    positions[stride] = point.x;
    positions[stride + 1] = point.y;
    positions[stride + 2] = point.z;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = 'GEO Stream Flow Particles';
  points.renderOrder = 7;

  return {
    points,
    update(time, progress) {
      const stable = smootherstep(0.88, 1, progress);
      const position = geometry.attributes.position.array;
      const colorArray = geometry.attributes.color.array;
      const sizeArray = geometry.attributes.aSize.array;
      let visibleWeight = 0;

      for (let index = 0; index < FLOW_PARTICLE_COUNT; index += 1) {
        const streamIndex = streamIndices[index];
        const definition = definitions[streamIndex];
        const streamReveal = smootherstep(definition.start, definition.start + 0.3, progress);
        const transitionT = clamp(streamReveal * 1.12 - phases[index] * 0.3, 0, 1);
        const loopT = (phases[index] + time * definition.speed) % 1;
        const t = lerp(transitionT, loopT, stable);
        const stride = index * 3;

        curves[streamIndex].getPoint(t, point);
        position[stride] = point.x;
        position[stride + 1] = point.y;
        position[stride + 2] = point.z
          + depthOffsets[index] * Math.sin(t * Math.PI) * (0.45 + streamReveal * 0.55);
        const coreLift = definition.tier === 'main' ? 0.28 * t : 0.055 * t;
        colorArray[stride] = lerp(baseColors[stride], 1, coreLift);
        colorArray[stride + 1] = lerp(baseColors[stride + 1], 1, coreLift);
        colorArray[stride + 2] = lerp(baseColors[stride + 2], 1, coreLift);
        sizeArray[index] = baseSizes[index] * (definition.tier === 'main' ? 0.9 + t * 0.38 : 0.92);
        visibleWeight += streamReveal * (definition.tier === 'main' ? 1 : definition.tier === 'secondary' ? 0.68 : 0.52);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      material.uniforms.uOpacity.value = clamp(visibleWeight / FLOW_PARTICLE_COUNT * 3.05, 0, 0.72);
      material.uniforms.uScale.value = 0.92;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function buildParticleStreamIndices(definitions) {
  const indices = [];

  definitions.forEach((definition, streamIndex) => {
    const count = definition.tier === 'main' ? 72 : 20;
    for (let index = 0; index < count; index += 1) indices.push(streamIndex);
  });
  return indices;
}
