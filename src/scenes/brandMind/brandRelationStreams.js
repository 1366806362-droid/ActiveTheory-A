import * as THREE from 'three';
import {
  clamp,
  createMindPointsMaterial,
  lerp,
  seededRandom,
  smootherstep
} from './brandCognitionCore.js';

const STREAM_SEGMENTS = 32;
const FLOW_PARTICLE_COUNT = 323;

export function createBrandRelationStreams(resources, clusterConfigs) {
  const group = new THREE.Group();
  const definitions = createDefinitions(clusterConfigs);
  const curves = definitions.map((definition) => createCurve(definition));
  const lineLayer = createLineLayer(definitions, curves);
  const flowLayer = createFlowLayer(resources.pointTexture, definitions, curves);

  group.name = 'Cognitive Relation Streams';
  group.add(lineLayer.lines, flowLayer.points);

  return {
    group,
    relationCount: definitions.length,
    mainRelationCount: definitions.filter((definition) => definition.tier === 'main').length,
    crossRelationCount: definitions.filter((definition) => definition.tier === 'cross').length,
    particleCount: FLOW_PARTICLE_COUNT,
    update(time, progress) {
      lineLayer.material.uniforms.uProgress.value = progress;
      lineLayer.material.uniforms.uTime.value = time;
      flowLayer.update(time, progress);
      return definitions.reduce((count, definition) => count + (progress >= definition.start + 0.08 ? 1 : 0), 0);
    },
    dispose() {
      lineLayer.dispose();
      flowLayer.dispose();
      group.clear();
    }
  };
}

function createDefinitions(clusterConfigs) {
  const positions = Object.fromEntries(clusterConfigs.map((config) => [
    config.key,
    new THREE.Vector3(...config.final)
  ]));
  const core = new THREE.Vector3(0, 0, 0);
  const main = [
    relation('awareness-core', positions.awareness, core, '#b69bf2', 0.34, 0.98, [0.2, 0.26, -0.24], 'main', 0.036),
    relation('association-core', positions.association, core, '#b59af1', 0.39, 1, [-0.08, 0.34, 0.2], 'main', 0.042),
    relation('reputation-core', positions.reputation, core, '#a9b1e5', 0.44, 0.9, [-0.18, -0.08, -0.3], 'main', 0.032),
    relation('preference-core', positions.preference, core, '#b390e8', 0.49, 0.98, [0.24, -0.28, 0.34], 'main', 0.046),
    relation('loyalty-core', positions.loyalty, core, '#927dc2', 0.54, 0.86, [-0.12, 0.22, -0.18], 'main', 0.029)
  ];
  const cross = [
    relation('awareness-association', positions.awareness, positions.association, '#685c9e', 0.58, 0.25, [0.02, 0.54, -0.28], 'cross', 0.023),
    relation('association-preference', positions.association, positions.preference, '#7d66ad', 0.62, 0.28, [0.36, -0.12, 0.22], 'cross', 0.027),
    relation('reputation-loyalty', positions.reputation, positions.loyalty, '#5b5b89', 0.66, 0.2, [-0.3, 0.18, -0.34], 'cross', 0.021)
  ];
  return [...main, ...cross];
}

function relation(name, from, to, color, start, strength, bow, tier, speed) {
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

function createCurve(definition) {
  const direction = definition.to.clone().sub(definition.from);
  const point1 = definition.from.clone().addScaledVector(direction, 0.3).add(definition.bow);
  const point2 = definition.from.clone().addScaledVector(direction, 0.72).addScaledVector(definition.bow, -0.38);
  return new THREE.CatmullRomCurve3([
    definition.from,
    point1,
    point2,
    definition.to
  ], false, 'centripetal', 0.45);
}

function createLineLayer(definitions, curves) {
  const positions = [];
  const colors = [];
  const tValues = [];
  const starts = [];
  const strengths = [];
  const tiers = [];
  const phases = [];
  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();
  const color = new THREE.Color();

  curves.forEach((curve, streamIndex) => {
    const definition = definitions[streamIndex];
    color.set(definition.color);
    for (let segment = 0; segment < STREAM_SEGMENTS; segment += 1) {
      if ((segment + streamIndex) % 8 === 5 || segment % 13 === 9) continue;
      const t0 = segment / STREAM_SEGMENTS;
      const t1 = (segment + 0.68) / STREAM_SEGMENTS;
      curve.getPoint(t0, pointA);
      curve.getPoint(t1, pointB);
      positions.push(pointA.x, pointA.y, pointA.z, pointB.x, pointB.y, pointB.z);
      for (let vertex = 0; vertex < 2; vertex += 1) {
        colors.push(color.r, color.g, color.b);
        tValues.push(vertex === 0 ? t0 : t1);
        starts.push(definition.start);
        strengths.push(definition.strength);
        tiers.push(definition.tier === 'main' ? 1 : 0);
        phases.push(streamIndex * 0.173);
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
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `
      uniform float uProgress;
      uniform float uTime;
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
        float reveal = smoothstep(aStart, aStart + 0.3, uProgress);
        float head = clamp((uProgress - aStart) / 0.38, 0.0, 1.0);
        float drawn = 1.0 - step(head, aT);
        vColor = color;
        vAlpha = reveal * drawn * aStrength * mix(0.34, 1.0, aTier);
        vT = aT;
        vPhase = aPhase + uTime * 0.018;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vT;
      varying float vPhase;
      void main() {
        float dash = smoothstep(0.22, 0.45, fract(vT * 9.0 + vPhase));
        float fade = smoothstep(0.0, 0.1, vT) * (1.0 - smoothstep(0.9, 1.0, vT));
        float coreLift = mix(0.82, 1.12, smoothstep(0.55, 1.0, vT));
        float alpha = vAlpha * dash * fade * coreLift * 0.55;
        if (alpha < 0.007) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'Broken Cognitive Relations';
  lines.renderOrder = 3;
  return {
    lines,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createFlowLayer(texture, definitions, curves) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(FLOW_PARTICLE_COUNT * 3);
  const colors = new Float32Array(FLOW_PARTICLE_COUNT * 3);
  const baseColors = new Float32Array(FLOW_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(FLOW_PARTICLE_COUNT);
  const streamIndices = new Uint8Array(FLOW_PARTICLE_COUNT);
  const phases = new Float32Array(FLOW_PARTICLE_COUNT);
  const depthOffsets = new Float32Array(FLOW_PARTICLE_COUNT);
  const random = seededRandom(12289);
  const point = new THREE.Vector3();
  const color = new THREE.Color();
  const assignments = [];

  definitions.forEach((definition, streamIndex) => {
    const count = definition.tier === 'main' ? 58 : 11;
    for (let index = 0; index < count; index += 1) assignments.push(streamIndex);
  });
  for (let index = 0; index < FLOW_PARTICLE_COUNT; index += 1) {
    const streamIndex = assignments[index];
    const definition = definitions[streamIndex];
    const stride = index * 3;
    streamIndices[index] = streamIndex;
    phases[index] = random();
    depthOffsets[index] = (random() - 0.5) * (definition.tier === 'main' ? 0.2 : 0.1);
    color.set(definition.color);
    baseColors[stride] = color.r;
    baseColors[stride + 1] = color.g;
    baseColors[stride + 2] = color.b;
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 31 === 0 ? 2.5 : index % 7 === 0 ? 1.62 : definition.tier === 'main' ? 0.92 : 0.48;
    curves[streamIndex].getPoint(0, point);
    positions[stride] = point.x;
    positions[stride + 1] = point.y;
    positions[stride + 2] = point.z;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createMindPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);
  points.name = 'Relation Flow Particles';
  points.renderOrder = 8;

  return {
    points,
    update(time, progress) {
      const stable = smootherstep(0.9, 1, progress);
      const positionArray = geometry.attributes.position.array;
      const colorArray = geometry.attributes.color.array;
      let visibility = 0;

      for (let index = 0; index < FLOW_PARTICLE_COUNT; index += 1) {
        const streamIndex = streamIndices[index];
        const definition = definitions[streamIndex];
        const reveal = smootherstep(definition.start, definition.start + 0.32, progress);
        const deterministicT = clamp(reveal * 1.12 - phases[index] * 0.28, 0, 1);
        const loopT = (phases[index] + time * definition.speed) % 1;
        const t = lerp(deterministicT, loopT, stable);
        const stride = index * 3;
        curves[streamIndex].getPoint(t, point);
        positionArray[stride] = point.x;
        positionArray[stride + 1] = point.y;
        positionArray[stride + 2] = point.z + depthOffsets[index] * Math.sin(t * Math.PI);
        const coreLift = definition.tier === 'main' ? t * 0.22 : t * 0.04;
        colorArray[stride] = lerp(baseColors[stride], 1, coreLift);
        colorArray[stride + 1] = lerp(baseColors[stride + 1], 1, coreLift);
        colorArray[stride + 2] = lerp(baseColors[stride + 2], 1, coreLift);
        visibility += reveal * (definition.tier === 'main' ? 1 : 0.42);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      material.uniforms.uOpacity.value = clamp(visibility / FLOW_PARTICLE_COUNT * 2.25, 0, 0.66);
      material.uniforms.uScale.value = 1.08;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
