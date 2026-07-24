import * as THREE from 'three';
import { createGeoDataStreams } from './geoDataStreams.js';
import {
  lerp,
  seededRandom,
  smootherstep
} from './geoSignalCore.js';

const CINEMATIC_BODY_PARTICLES = 656;
const CINEMATIC_HIGHLIGHT_NODES = 64;
const CINEMATIC_FLOW_PARTICLES = CINEMATIC_BODY_PARTICLES + CINEMATIC_HIGHLIGHT_NODES;

const STREAM_STYLES = Object.freeze([
  Object.freeze({
    id: 'answer',
    color: '#8beaff',
    highlight: '#effeff',
    bow: [0.04, -0.1, 0.28],
    width: 0.088,
    speed: 0.041,
    phase: 0.08,
    fieldOpacity: 0.048,
    filamentCount: 3,
    bodyCount: 244,
    nodeCount: 26
  }),
  Object.freeze({
    id: 'citation',
    color: '#d8efff',
    highlight: '#b9acd5',
    bow: [-0.1, 0.2, -0.32],
    width: 0.07,
    speed: 0.022,
    phase: 0.36,
    fieldOpacity: 0.038,
    filamentCount: 3,
    bodyCount: 192,
    nodeCount: 18
  }),
  Object.freeze({
    id: 'keyword',
    color: '#43d8df',
    highlight: '#c9fff9',
    bow: [0.18, -0.08, -0.14],
    width: 0.076,
    speed: 0.029,
    phase: 0.62,
    fieldOpacity: 0.041,
    filamentCount: 2,
    bodyCount: 220,
    nodeCount: 20
  })
]);

export function createGeoCinematicStreams(resources, clusterConfigs, visualProfile) {
  const group = new THREE.Group();
  const base = createGeoDataStreams(resources, clusterConfigs, visualProfile);
  const cinematic = createCinematicLayers(resources.pointTexture, clusterConfigs);
  let debugStream = 'full';
  let externallyVisible = true;

  configureBaseLayer(base.group);
  group.name = 'GEO V3.4 Cinematic Data Streams';
  group.add(cinematic.group, base.group);
  applyDebugVisibility();

  return {
    group,
    streamCount: base.streamCount,
    primaryCount: base.primaryCount,
    crossCount: base.crossCount,
    cinematicParticleCount: CINEMATIC_FLOW_PARTICLES,
    particleCount: base.particleCount + CINEMATIC_FLOW_PARTICLES,
    setDebugVisibility(visible) {
      externallyVisible = visible;
      applyDebugVisibility();
    },
    setDebugStream(stream = 'full') {
      debugStream = ['answer', 'citation', 'keyword', 'fields', 'full'].includes(stream)
        ? stream
        : 'full';
      applyDebugVisibility();
    },
    update(time, progress, journey = null) {
      const baseProgress = journey?.baseTimeline ?? progress;
      const active = base.update(time, baseProgress);
      attenuateBaseParticleLayer(base.group);
      cinematic.update(time, progress, journey);
      return active;
    },
    dispose() {
      base.dispose();
      cinematic.dispose();
      group.clear();
    }
  };

  function applyDebugVisibility() {
    group.visible = externallyVisible;
    if (!externallyVisible) return;
    const isolated = debugStream !== 'full';

    base.setDebugVisibility(!isolated);
    cinematic.setDebugStream(debugStream);
  }
}

function configureBaseLayer(group) {
  group.traverse((object) => {
    if (object.name === 'Broken Semantic Data Lines' && object.material?.isShaderMaterial) {
      object.material.uniforms.uLayerOpacity = { value: 0.42 };
      object.material.fragmentShader = `
        uniform float uLayerOpacity;
      ${object.material.fragmentShader.replace(
    'vAlpha * dash * fade * 0.34',
    'vAlpha * dash * fade * 0.34 * uLayerOpacity'
  )}`;
      object.material.needsUpdate = true;
      object.renderOrder = 1;
    }
    if (object.name === 'GEO Stream Flow Particles') object.renderOrder = 3;
  });
}

function attenuateBaseParticleLayer(group) {
  const points = group.children.find((child) => child.name === 'GEO Stream Flow Particles');
  if (points?.material?.uniforms?.uOpacity) {
    points.material.uniforms.uOpacity.value *= 0.52;
    points.material.uniforms.uScale.value *= 0.88;
  }
}

function createCinematicLayers(pointTexture, clusterConfigs) {
  const group = new THREE.Group();
  const configMap = Object.fromEntries(clusterConfigs.map((config) => [config.key, config]));
  const curves = STREAM_STYLES.map((style) => createMainCurve(configMap[style.id], style));
  const directionField = createDirectionField(curves);
  const filaments = createFineFilaments(curves);
  const particles = createFlowParticles(pointTexture, curves);
  let debugStream = 'full';

  group.name = 'GEO V3.4 Four Layer Data Floods';
  group.add(
    directionField.mesh,
    filaments.lines,
    particles.bodyPoints,
    particles.nodePoints
  );

  return {
    group,
    setDebugStream(stream = 'full') {
      debugStream = stream;
      const debugCode = streamToDebugCode(stream);
      const fieldsOnly = stream === 'fields';

      directionField.mesh.visible = true;
      filaments.lines.visible = !fieldsOnly;
      particles.bodyPoints.visible = !fieldsOnly;
      particles.nodePoints.visible = !fieldsOnly;
      directionField.material.uniforms.uDebugStream.value = debugCode;
      filaments.material.uniforms.uDebugStream.value = debugCode;
      particles.setDebugStream(debugCode);
    },
    update(time, progress, journey = null) {
      const reveal = smootherstep(0.24, 0.86, progress);
      const streamReveal = journey
        ? [journey.answer, journey.citation, journey.keyword]
        : [1, 1, 1];
      const streamHeads = journey ? streamReveal : [1, 1, 1];

      directionField.material.uniforms.uOpacity.value = reveal;
      directionField.material.uniforms.uTime.value = time;
      directionField.material.uniforms.uStreamReveal.value.fromArray(streamReveal);
      filaments.material.uniforms.uOpacity.value = reveal * 0.54;
      filaments.material.uniforms.uStreamReveal.value.fromArray(streamReveal);
      filaments.material.uniforms.uStreamHeads.value.fromArray(streamHeads);
      particles.update(time, progress, journey);
      if (debugStream === 'fields') {
        directionField.material.uniforms.uOpacity.value = reveal * 1.08;
      }
    },
    dispose() {
      directionField.dispose();
      filaments.dispose();
      particles.dispose();
      group.clear();
    }
  };
}

function streamToDebugCode(stream) {
  if (stream === 'answer') return 1;
  if (stream === 'citation') return 2;
  if (stream === 'keyword') return 3;
  return 0;
}

function createMainCurve(config, style) {
  const source = new THREE.Vector3(...config.final);
  const target = new THREE.Vector3(0, 0.015, 0);
  const direction = target.clone().sub(source);
  const bow = new THREE.Vector3(...style.bow);
  const point1 = source.clone()
    .addScaledVector(direction, style.id === 'citation' ? 0.24 : 0.32)
    .add(bow);
  const point2 = source.clone()
    .addScaledVector(direction, style.id === 'citation' ? 0.6 : 0.7)
    .addScaledVector(bow, -0.42);

  return {
    style,
    curve: new THREE.CatmullRomCurve3([
      source,
      point1,
      point2,
      target
    ], false, 'centripetal', 0.45)
  };
}

function createDirectionField(curves) {
  const positions = [];
  const colors = [];
  const alphas = [];
  const streamIndices = [];

  curves.forEach(({ curve, style }, streamIndex) => {
    const color = new THREE.Color(style.color);
    const steps = 42;
    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    const pointA = new THREE.Vector3();
    const pointB = new THREE.Vector3();
    const pointC = new THREE.Vector3();
    const pointD = new THREE.Vector3();
    const centerA = new THREE.Vector3();
    const centerB = new THREE.Vector3();

    for (let index = 0; index < steps; index += 1) {
      const t0 = index / steps;
      const t1 = (index + 1) / steps;
      const width0 = getFieldWidth(style, t0);
      const width1 = getFieldWidth(style, t1);

      curve.getPoint(t0, point);
      centerA.copy(point);
      curve.getTangent(t0, tangent);
      side.set(-tangent.y, tangent.x, 0.16).normalize().multiplyScalar(width0);
      pointA.copy(point).add(side);
      pointB.copy(point).sub(side);
      curve.getPoint(t1, point);
      centerB.copy(point);
      curve.getTangent(t1, tangent);
      side.set(-tangent.y, tangent.x, 0.16).normalize().multiplyScalar(width1);
      pointC.copy(point).add(side);
      pointD.copy(point).sub(side);
      appendRibbonTriangle(
        positions,
        colors,
        alphas,
        streamIndices,
        pointA,
        centerA,
        pointC,
        color,
        t0,
        streamIndex,
        style.fieldOpacity,
        [0.04, 1, 0.04]
      );
      appendRibbonTriangle(
        positions,
        colors,
        alphas,
        streamIndices,
        pointC,
        centerA,
        centerB,
        color,
        t1,
        streamIndex,
        style.fieldOpacity,
        [0.04, 1, 1]
      );
      appendRibbonTriangle(
        positions,
        colors,
        alphas,
        streamIndices,
        centerA,
        pointB,
        centerB,
        color,
        t0,
        streamIndex,
        style.fieldOpacity,
        [1, 0.04, 1]
      );
      appendRibbonTriangle(
        positions,
        colors,
        alphas,
        streamIndices,
        centerB,
        pointB,
        pointD,
        color,
        t1,
        streamIndex,
        style.fieldOpacity,
        [1, 0.04, 0.04]
      );
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setAttribute('aStream', new THREE.Float32BufferAttribute(streamIndices, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uDebugStream: { value: 0 },
      uTime: { value: 0 },
      uStreamReveal: { value: new THREE.Vector3(1, 1, 1) }
    },
    vertexShader: `
      attribute vec3 color;
      attribute float aAlpha;
      attribute float aStream;
      uniform float uDebugStream;
      uniform float uTime;
      uniform vec3 uStreamReveal;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float streamVisible = uDebugStream < 0.5
          || abs(aStream - (uDebugStream - 1.0)) < 0.25
          ? 1.0
          : 0.0;
        vec3 animated = position;
        animated.z += sin(uTime * 0.035 + aStream * 1.7) * 0.004;
        float journeyReveal = aStream < 0.5
          ? uStreamReveal.x
          : aStream < 1.5
            ? uStreamReveal.y
            : uStreamReveal.z;
        vColor = color;
        vAlpha = aAlpha * streamVisible * journeyReveal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(animated, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float alpha = uOpacity * vAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'V3.4 Directional Energy Fields';
  mesh.renderOrder = 0;
  return {
    mesh,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function getFieldWidth(style, t) {
  if (style.id === 'answer') {
    return style.width * (1.15 - smootherstep(0.58, 0.94, t) * 0.42);
  }
  if (style.id === 'citation') {
    return style.width * (1.1 - smootherstep(0.46, 0.88, t) * 0.52);
  }
  return style.width * (0.82 + smootherstep(0.52, 0.86, t) * 0.18);
}

function appendRibbonTriangle(
  positions,
  colors,
  alphas,
  streamIndices,
  a,
  b,
  c,
  color,
  t,
  streamIndex,
  opacity,
  alphaWeights
) {
  const endFade = smootherstep(0, 0.09, t) * (1 - smootherstep(0.91, 1, t));

  [a, b, c].forEach((point, index) => {
    positions.push(point.x, point.y, point.z);
    colors.push(color.r, color.g, color.b);
    alphas.push(endFade * opacity * alphaWeights[index]);
    streamIndices.push(streamIndex);
  });
}

function createFineFilaments(curves) {
  const positions = [];
  const colors = [];
  const alphas = [];
  const streamIndices = [];
  const tValues = [];

  curves.forEach(({ curve, style }, streamIndex) => {
    const color = new THREE.Color(style.color);
    const pointA = new THREE.Vector3();
    const pointB = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    const segmentCount = 56;

    for (let lane = 0; lane < style.filamentCount; lane += 1) {
      const laneOffset = (lane - (style.filamentCount - 1) * 0.5)
        * style.width
        * (style.id === 'citation' ? 0.76 : 0.64);
      const laneAlpha = lane === Math.floor(style.filamentCount / 2) ? 0.95 : 0.6;

      for (let segment = 0; segment < segmentCount; segment += 1) {
        if ((segment + lane + streamIndex * 3) % 19 === 13) continue;
        const t0 = segment / segmentCount;
        const t1 = Math.min(1, (segment + 0.9) / segmentCount);
        const convergence = 1 - smootherstep(
          style.id === 'keyword' ? 0.64 : 0.72,
          0.94,
          t0
        );

        curve.getPoint(t0, pointA);
        curve.getTangent(t0, tangent);
        side.set(-tangent.y, tangent.x, 0.12)
          .normalize()
          .multiplyScalar(laneOffset * convergence);
        pointA.add(side);
        curve.getPoint(t1, pointB);
        curve.getTangent(t1, tangent);
        side.set(-tangent.y, tangent.x, 0.12)
          .normalize()
          .multiplyScalar(laneOffset * convergence);
        pointB.add(side);
        positions.push(pointA.x, pointA.y, pointA.z, pointB.x, pointB.y, pointB.z);
        for (let vertex = 0; vertex < 2; vertex += 1) {
          colors.push(color.r, color.g, color.b);
          alphas.push(laneAlpha);
          streamIndices.push(streamIndex);
          tValues.push(vertex === 0 ? t0 : t1);
        }
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setAttribute('aStream', new THREE.Float32BufferAttribute(streamIndices, 1));
  geometry.setAttribute('aT', new THREE.Float32BufferAttribute(tValues, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uDebugStream: { value: 0 },
      uStreamReveal: { value: new THREE.Vector3(1, 1, 1) },
      uStreamHeads: { value: new THREE.Vector3(1, 1, 1) }
    },
    vertexShader: `
      attribute vec3 color;
      attribute float aAlpha;
      attribute float aStream;
      attribute float aT;
      uniform float uDebugStream;
      uniform vec3 uStreamReveal;
      uniform vec3 uStreamHeads;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vT;

      void main() {
        float streamVisible = uDebugStream < 0.5
          || abs(aStream - (uDebugStream - 1.0)) < 0.25
          ? 1.0
          : 0.0;
        float journeyReveal = aStream < 0.5
          ? uStreamReveal.x
          : aStream < 1.5
            ? uStreamReveal.y
            : uStreamReveal.z;
        float journeyHead = aStream < 0.5
          ? uStreamHeads.x
          : aStream < 1.5
            ? uStreamHeads.y
            : uStreamHeads.z;
        float pathReveal = 1.0 - smoothstep(journeyHead - 0.035, journeyHead + 0.015, aT);
        pathReveal = mix(pathReveal, 1.0, step(0.999, journeyHead));
        vColor = color;
        vAlpha = aAlpha * streamVisible * journeyReveal * pathReveal;
        vT = aT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vT;

      void main() {
        float endFade = smoothstep(0.0, 0.08, vT)
          * (1.0 - smoothstep(0.94, 1.0, vT));
        float alpha = uOpacity * vAlpha * endFade;
        if (alpha < 0.006) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = 'V3.4 Continuous Signal Filaments';
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

function createFlowParticles(pointTexture, curves) {
  const body = createParticleLayer(pointTexture, curves, false);
  const nodes = createParticleLayer(pointTexture, curves, true);

  body.points.name = 'V3.4 Data Particle Bodies';
  nodes.points.name = 'V3.4 Highlight Signal Nodes';
  body.points.renderOrder = 4;
  nodes.points.renderOrder = 5;

  return {
    bodyPoints: body.points,
    nodePoints: nodes.points,
    setDebugStream(debugCode) {
      body.material.uniforms.uDebugStream.value = debugCode;
      nodes.material.uniforms.uDebugStream.value = debugCode;
    },
    update(time, progress, journey = null) {
      body.update(time, progress, journey);
      nodes.update(time, progress, journey);
    },
    dispose() {
      body.dispose();
      nodes.dispose();
    }
  };
}

function createParticleLayer(pointTexture, curves, highlightLayer) {
  const totalCount = curves.reduce((sum, { style }) => (
    sum + (highlightLayer ? style.nodeCount : style.bodyCount)
  ), 0);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(totalCount * 3);
  const colors = new Float32Array(totalCount * 3);
  const sizes = new Float32Array(totalCount);
  const opacities = new Float32Array(totalCount);
  const streamIndices = new Float32Array(totalCount);
  const phases = new Float32Array(totalCount);
  const lateralOffsets = new Float32Array(totalCount);
  const depthOffsets = new Float32Array(totalCount);
  const branchIndices = new Int8Array(totalCount);
  const baseSizes = new Float32Array(totalCount);
  const baseOpacities = new Float32Array(totalCount);
  const random = seededRandom(highlightLayer ? 34129 : 3907);
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  let cursor = 0;

  curves.forEach(({ style }, curveIndex) => {
    const count = highlightLayer ? style.nodeCount : style.bodyCount;
    const colorA = new THREE.Color(style.color);
    const colorB = new THREE.Color(style.highlight);

    for (let localIndex = 0; localIndex < count; localIndex += 1) {
      const stride = cursor * 3;
      const distribution = localIndex / Math.max(1, count - 1);
      const color = colorA.clone().lerp(
        colorB,
        highlightLayer ? 0.42 + random() * 0.44 : Math.pow(random(), 2.2) * 0.62
      );
      const branch = style.id === 'citation'
        ? localIndex % 3 - 1
        : style.id === 'keyword'
          ? (localIndex % 2 === 0 ? -1 : 1)
          : localIndex % 5 - 2;

      streamIndices[cursor] = curveIndex;
      branchIndices[cursor] = branch;
      phases[cursor] = createParticlePhase(style.id, distribution, random);
      lateralOffsets[cursor] = (random() - 0.5)
        * style.width
        * (style.id === 'answer' ? 1.34 : style.id === 'citation' ? 1.5 : 1.16);
      depthOffsets[cursor] = (random() - 0.5)
        * style.width
        * (style.id === 'citation' ? 2.15 : 1.9);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;

      if (highlightLayer) {
        baseSizes[cursor] = 1.36 + random() * 0.92;
        baseOpacities[cursor] = 0.58 + random() * 0.28;
      } else {
        const tier = localIndex % 20;
        baseSizes[cursor] = tier < 15
          ? 0.46 + random() * 0.22
          : tier < 19
            ? 0.86 + random() * 0.28
            : 1.08 + random() * 0.18;
        baseOpacities[cursor] = tier < 15
          ? 0.46 + random() * 0.18
          : 0.62 + random() * 0.18;
      }
      sizes[cursor] = baseSizes[cursor];
      opacities[cursor] = baseOpacities[cursor];
      cursor += 1;
    }
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('aStream', new THREE.BufferAttribute(streamIndices, 1));
  const material = createCinematicPointMaterial(pointTexture, highlightLayer);
  const points = new THREE.Points(geometry, material);

  return {
    points,
    material,
    update(time, progress, journey = null) {
      const reveal = smootherstep(0.28, 0.84, progress);
      const effectiveTime = journey
        ? lerp(journey.deterministicTime, time, journey.liveMotionMix)
        : time;
      const streamReveal = journey
        ? [journey.answer, journey.citation, journey.keyword]
        : [1, 1, 1];
      const positionAttribute = geometry.getAttribute('position');
      const sizeAttribute = geometry.getAttribute('aSize');
      const opacityAttribute = geometry.getAttribute('aOpacity');

      for (let index = 0; index < totalCount; index += 1) {
        const curveIndex = streamIndices[index];
        const { curve, style } = curves[curveIndex];
        const rawT = (
          phases[index]
          + effectiveTime * style.speed * (highlightLayer ? 0.72 : 1)
        ) % 1;
        const t = applyDensityWarp(style.id, rawT);
        const journeyReveal = streamReveal[curveIndex];
        const pathMask = journey && journeyReveal < 0.999
          ? 1 - smootherstep(
            Math.max(0, journeyReveal - 0.075),
            Math.min(1, journeyReveal + 0.015),
            t
          )
          : 1;
        const stride = index * 3;
        const spread = getSpreadEnvelope(style.id, t, branchIndices[index]);
        const coreShield = smootherstep(0.75, 0.91, t)
          * (1 - smootherstep(0.94, 1, t));
        const entryLift = smootherstep(0.94, 1, t);

        curve.getPointAt(t, point);
        curve.getTangentAt(t, tangent);
        side.set(-tangent.y, tangent.x, 0.1).normalize();
        point.addScaledVector(
          side,
          lateralOffsets[index] * spread + getBranchOffset(style.id, branchIndices[index], t)
        );
        point.z += depthOffsets[index] * spread;
        point.z -= smootherstep(0.72, 0.91, t) * 0.075;
        point.z += entryLift * 0.052;

        positionAttribute.array[stride] = point.x;
        positionAttribute.array[stride + 1] = point.y;
        positionAttribute.array[stride + 2] = point.z;
        sizeAttribute.array[index] = baseSizes[index]
          * (1 - coreShield * 0.1)
          * (1 + entryLift * (highlightLayer ? 0.14 : 0.07));
        opacityAttribute.array[index] = baseOpacities[index]
          * reveal
          * journeyReveal
          * pathMask
          * (1 - coreShield * 0.14)
          * (1 + entryLift * (highlightLayer ? 0.18 : 0.1));
      }

      positionAttribute.needsUpdate = true;
      sizeAttribute.needsUpdate = true;
      opacityAttribute.needsUpdate = true;
      material.uniforms.uGlobalOpacity.value = highlightLayer ? 0.9 : 0.86;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createParticlePhase(streamId, distribution, random) {
  if (streamId === 'answer') {
    return (Math.pow(distribution, 1.08) + random() * 0.035) % 1;
  }
  if (streamId === 'citation') {
    const sourceGroup = Math.floor(distribution * 3) % 3;
    return (distribution + sourceGroup * 0.047 + random() * 0.025) % 1;
  }
  const chainOffset = Math.floor(distribution * 2) % 2;
  return (distribution + chainOffset * 0.036 + random() * 0.024) % 1;
}

function applyDensityWarp(streamId, t) {
  if (streamId === 'answer') {
    return (t + Math.sin(t * Math.PI * 6) * 0.018 + 1) % 1;
  }
  if (streamId === 'citation') {
    return (t + Math.sin(t * Math.PI * 4) * 0.012 + 1) % 1;
  }
  return (t + Math.sin(t * Math.PI * 5) * 0.014 + 1) % 1;
}

function getSpreadEnvelope(streamId, t, branchIndex) {
  if (streamId === 'answer') {
    const branchPulse = Math.sin(Math.PI * smootherstep(0.18, 0.62, t));
    return 0.74 + branchPulse * 0.54 - smootherstep(0.66, 0.94, t) * 0.56;
  }
  if (streamId === 'citation') {
    return 1.12 - smootherstep(0.38, 0.88, t) * 0.86
      + Math.abs(branchIndex) * (1 - smootherstep(0.45, 0.72, t)) * 0.12;
  }
  return 0.92 - smootherstep(0.58, 0.9, t) * 0.74;
}

function getBranchOffset(streamId, branchIndex, t) {
  if (streamId === 'answer') {
    const branchEnvelope = smootherstep(0.12, 0.28, t)
      * (1 - smootherstep(0.5, 0.72, t));
    return branchIndex * 0.008 * branchEnvelope;
  }
  if (streamId === 'citation') {
    const sourceSeparation = 1 - smootherstep(0.36, 0.7, t);
    return branchIndex * 0.018 * sourceSeparation;
  }
  const openChains = 1 - smootherstep(0.58, 0.78, t);
  return branchIndex * 0.014 * openChains;
}

function createCinematicPointMaterial(pointTexture, highlightLayer) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPointTexture: { value: pointTexture },
      uGlobalOpacity: { value: 0 },
      uDebugStream: { value: 0 }
    },
    vertexShader: `
      attribute vec3 color;
      attribute float aSize;
      attribute float aOpacity;
      attribute float aStream;
      uniform float uDebugStream;
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        float streamVisible = uDebugStream < 0.5
          || abs(aStream - (uDebugStream - 1.0)) < 0.25
          ? 1.0
          : 0.0;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vOpacity = aOpacity * streamVisible;
        gl_PointSize = aSize * ${highlightLayer ? '18.0' : '15.0'} / max(-viewPosition.z, 1.0);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uPointTexture;
      uniform float uGlobalOpacity;
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a
          * vOpacity
          * uGlobalOpacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}
