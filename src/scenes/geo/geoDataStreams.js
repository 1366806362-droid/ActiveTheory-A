import * as THREE from 'three';
import {
  clamp,
  createSignalPointsMaterial,
  lerp,
  seededRandom,
  smootherstep
} from './geoSignalCore.js';

export function createGeoDataStreams(resources, clusterConfigs, visualProfile = null) {
  const streamProfile = visualProfile?.streams ?? {
    segments: 34,
    flowParticles: 336,
    mainLanes: 1,
    secondaryLanes: 1,
    crossLanes: 1,
    mainLineGain: 1,
    crossGain: 1,
    flowScale: 0.92,
    flowOpacity: 0.72
  };
  const group = new THREE.Group();
  const definitions = createStreamDefinitions(clusterConfigs, visualProfile?.cinematic === true);
  const curves = definitions.map((definition) => createStreamCurves(definition, streamProfile));
  const lineLayer = createStreamLines(definitions, curves, streamProfile);
  const flowLayer = createFlowParticles(resources.pointTexture, definitions, curves, streamProfile);

  group.name = 'GEO Data Streams';
  group.add(lineLayer.lines, flowLayer.points);

  return {
    group,
    streamCount: definitions.length,
    primaryCount: definitions.filter((definition) => definition.tier === 'main').length,
    crossCount: definitions.filter((definition) => definition.tier === 'cross').length,
    particleCount: streamProfile.flowParticles,
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

function createStreamDefinitions(clusterConfigs, cinematic = false) {
  const positions = Object.fromEntries(clusterConfigs.map((config) => [
    config.key,
    new THREE.Vector3(...config.final)
  ]));
  const core = new THREE.Vector3(0, 0, 0);
  const primary = [
    stream('answer-core-a', positions.answer, core, '#d4f8ff', 0.3, cinematic ? 1.5 : 1.3, [0.04, cinematic ? -0.1 : 0.28, 0.28], 'main', cinematic ? 0.062 : 0.048),
    stream('answer-core-b', positions.answer, core, '#62d7ff', 0.35, cinematic ? 0.62 : 0.66, [-0.08, 0.22, 0.22], 'secondary', 0.034),
    stream('citation-core-a', positions.citation, core, '#b8d8ff', 0.36, cinematic ? 1.42 : 1.18, [-0.1, 0.2, -0.32], 'main', cinematic ? 0.034 : 0.041),
    stream('citation-core-b', positions.citation, core, '#667fc2', 0.41, cinematic ? 0.56 : 0.59, [0.14, -0.18, -0.18], 'secondary', 0.031),
    stream('keyword-core-a', positions.keyword, core, '#92fff3', 0.42, cinematic ? 1.34 : 1.2, [0.18, -0.08, -0.14], 'main', cinematic ? 0.045 : 0.053),
    stream('keyword-core-b', positions.keyword, core, '#39cbd0', 0.47, cinematic ? 0.58 : 0.58, [-0.18, 0.14, 0.24], 'secondary', 0.037)
  ];
  const cross = [
    stream('answer-citation', positions.answer, positions.citation, '#5b9dcc', 0.56, cinematic ? 0.16 : 0.25, [0.02, 0.48, -0.2], 'cross', 0.028),
    stream('keyword-answer', positions.keyword, positions.answer, '#45d4da', 0.6, cinematic ? 0.17 : 0.27, [0.34, 0.08, 0.22], 'cross', 0.032),
    stream('citation-keyword', positions.citation, positions.keyword, '#517da9', 0.64, cinematic ? 0.13 : 0.2, [-0.24, 0.42, -0.16], 'cross', 0.025)
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

function createStreamCurves(definition, profile) {
  const laneCount = definition.tier === 'main'
    ? profile.mainLanes
    : definition.tier === 'secondary'
      ? profile.secondaryLanes
      : profile.crossLanes;
  return Array.from({ length: laneCount }, (_, laneIndex) => createStreamCurve(definition, laneIndex, laneCount));
}

function createStreamCurve(definition, laneIndex = 0, laneCount = 1) {
  const citationSourceOffsets = [
    new THREE.Vector3(-0.28, 0.02, 0.08),
    new THREE.Vector3(-0.03, 0.2, -0.15),
    new THREE.Vector3(0.25, -0.11, 0.13)
  ];
  const keywordSourceOffsets = [
    new THREE.Vector3(-0.18, -0.03, 0.05),
    new THREE.Vector3(0.1, 0.08, -0.04),
    new THREE.Vector3(0.24, -0.02, 0.06)
  ];
  const source = definition.from.clone();
  if (definition.name === 'citation-core-a' && laneCount > 1) {
    source.add(citationSourceOffsets[laneIndex % citationSourceOffsets.length]);
  } else if (definition.name === 'keyword-core-a' && laneCount > 1) {
    source.add(keywordSourceOffsets[laneIndex % keywordSourceOffsets.length]);
  }
  const direction = definition.to.clone().sub(source);
  const laneOffset = laneIndex - (laneCount - 1) * 0.5;
  const offset = new THREE.Vector3(0, laneOffset * 0.085, laneOffset * 0.14);
  const point1 = source.clone().addScaledVector(direction, definition.name === 'citation-core-a' ? 0.24 : 0.32).add(definition.bow).add(offset);
  const point2 = source.clone().addScaledVector(direction, definition.name === 'citation-core-a' ? 0.6 : 0.7).addScaledVector(definition.bow, -0.42).addScaledVector(offset, -0.62);

  return new THREE.CatmullRomCurve3([
    source,
    point1,
    point2,
    definition.to
  ], false, 'centripetal', 0.45);
}

function createStreamLines(definitions, curveBundles, profile) {
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

  curveBundles.forEach((curves, streamIndex) => {
    const definition = definitions[streamIndex];
    color.set(definition.color);
    curves.forEach((curve, laneIndex) => {
      for (let segment = 0; segment < profile.segments; segment += 1) {
        const t0 = segment / profile.segments;
        const t1 = (segment + 0.7) / profile.segments;
        curve.getPoint(t0, pointA);
        curve.getPoint(t1, pointB);
        positions.push(pointA.x, pointA.y, pointA.z, pointB.x, pointB.y, pointB.z);
        for (let vertex = 0; vertex < 2; vertex += 1) {
          colors.push(color.r, color.g, color.b);
          tValues.push(vertex === 0 ? t0 : t1);
          starts.push(definition.start);
          strengths.push(definition.strength * (definition.tier === 'main' ? profile.mainLineGain : definition.tier === 'cross' ? profile.crossGain : 1));
          tiers.push(definition.tier === 'main' ? 1 : definition.tier === 'secondary' ? 0.46 : 0.18);
          phases.push(streamIndex * 0.137 + laneIndex * 0.21);
        }
      }
    });
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

function createFlowParticles(texture, definitions, curveBundles, profile) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(profile.flowParticles * 3);
  const colors = new Float32Array(profile.flowParticles * 3);
  const baseColors = new Float32Array(profile.flowParticles * 3);
  const sizes = new Float32Array(profile.flowParticles);
  const baseSizes = new Float32Array(profile.flowParticles);
  const streamIndices = new Uint8Array(profile.flowParticles);
  const laneIndices = new Uint8Array(profile.flowParticles);
  const phases = new Float32Array(profile.flowParticles);
  const depthOffsets = new Float32Array(profile.flowParticles);
  const random = seededRandom(5519);
  const color = new THREE.Color();
  const point = new THREE.Vector3();

  const particleAssignments = buildParticleAssignments(definitions, curveBundles, profile);

  for (let index = 0; index < profile.flowParticles; index += 1) {
    const assignment = particleAssignments[index];
    const streamIndex = assignment.streamIndex;
    const definition = definitions[streamIndex];
    const tierIntensity = definition.tier === 'main' ? 1 : definition.tier === 'secondary' ? 0.72 : 0.56;
    streamIndices[index] = streamIndex;
    laneIndices[index] = assignment.laneIndex;
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
    curveBundles[streamIndex][assignment.laneIndex].getPoint(0, point);
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

      for (let index = 0; index < profile.flowParticles; index += 1) {
        const streamIndex = streamIndices[index];
        const definition = definitions[streamIndex];
        const streamReveal = smootherstep(definition.start, definition.start + 0.3, progress);
        const transitionT = clamp(streamReveal * 1.12 - phases[index] * 0.3, 0, 1);
        const loopT = (phases[index] + time * definition.speed) % 1;
        const t = lerp(transitionT, loopT, stable);
        const stride = index * 3;

        curveBundles[streamIndex][laneIndices[index]].getPoint(t, point);
        position[stride] = point.x;
        position[stride + 1] = point.y;
        position[stride + 2] = point.z
          + depthOffsets[index] * Math.sin(t * Math.PI) * (0.45 + streamReveal * 0.55);
        const coreLift = definition.tier === 'main' ? 0.28 * t : 0.055 * t;
        const keywordNode = definition.name === 'keyword-core-a'
          ? Math.max(0, Math.sin(t * Math.PI * 4)) * 0.16
          : 0;
        colorArray[stride] = lerp(baseColors[stride], 1, coreLift);
        colorArray[stride + 1] = lerp(baseColors[stride + 1], 1, coreLift);
        colorArray[stride + 2] = lerp(baseColors[stride + 2], 1, coreLift);
        sizeArray[index] = baseSizes[index]
          * (definition.tier === 'main' ? 0.9 + t * 0.38 : 0.92)
          * (1 + keywordNode);
        visibleWeight += streamReveal * (definition.tier === 'main' ? 1 : definition.tier === 'secondary' ? 0.68 : 0.52);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      material.uniforms.uOpacity.value = clamp(visibleWeight / profile.flowParticles * 3.35, 0, profile.flowOpacity);
      material.uniforms.uScale.value = profile.flowScale;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function buildParticleAssignments(definitions, curveBundles, profile) {
  const assignments = [];
  const cinematic = profile.flowParticles > 336;
  const cinematicCounts = {
    'answer-core-a': 140,
    'answer-core-b': 32,
    'citation-core-a': 110,
    'citation-core-b': 30,
    'keyword-core-a': 130,
    'keyword-core-b': 34,
    'answer-citation': 22,
    'keyword-answer': 20,
    'citation-keyword': 22
  };

  definitions.forEach((definition, streamIndex) => {
    const count = cinematic
      ? cinematicCounts[definition.name]
      : definition.tier === 'main' ? 72 : 20;
    for (let index = 0; index < count; index += 1) {
      assignments.push({
        streamIndex,
        laneIndex: index % curveBundles[streamIndex].length
      });
    }
  });
  return assignments.slice(0, profile.flowParticles);
}
