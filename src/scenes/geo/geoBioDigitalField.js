import * as THREE from 'three';
import {
  createSignalPointsMaterial,
  seededRandom,
  smootherstep
} from './geoSignalCore.js';

const MEMBRANE_PATCHES = Object.freeze([
  Object.freeze({ center: [-0.48, 0.18, -0.98], radius: [0.56, 0.31], rotation: 0.12, start: 2.66, sweep: 2.28, bands: 3, seed: 17 }),
  Object.freeze({ center: [0.34, 0.16, -1.08], radius: [0.51, 0.29], rotation: -0.18, start: -0.54, sweep: 2.04, bands: 3, seed: 31 }),
  Object.freeze({ center: [-0.96, 0.44, -0.72], radius: [0.49, 0.25], rotation: -0.28, start: 2.92, sweep: 1.92, bands: 2, seed: 47 }),
  Object.freeze({ center: [0.92, 0.46, -0.88], radius: [0.46, 0.26], rotation: 0.24, start: -0.42, sweep: 2.16, bands: 2, seed: 61 }),
  Object.freeze({ center: [1.52, -0.08, -1.22], radius: [0.39, 0.21], rotation: -0.16, start: 2.58, sweep: 1.78, bands: 2, seed: 79 })
]);

const ANSWER_MAIN_PATHS = Object.freeze([
  [[-1.5, 0.64, -0.58], [-1.18, 0.65, -0.52], [-0.86, 0.48, -0.48], [-0.52, 0.28, -0.5], [-0.18, 0.1, -0.56]],
  [[-1.42, 0.4, -0.5], [-1.17, 0.36, -0.47], [-0.91, 0.3, -0.44], [-0.58, 0.21, -0.47], [-0.23, 0.06, -0.53]]
]);

const ANSWER_BRANCH_PATHS = Object.freeze([
  [[-1.27, 0.64, -0.55], [-1.19, 0.8, -0.62], [-1.02, 0.87, -0.67]],
  [[-1.04, 0.56, -0.51], [-0.91, 0.7, -0.58], [-0.75, 0.73, -0.61]],
  [[-1.18, 0.36, -0.47], [-1.15, 0.2, -0.43], [-1.02, 0.12, -0.42]],
  [[-0.88, 0.29, -0.44], [-0.78, 0.15, -0.42], [-0.62, 0.09, -0.44]]
]);

const CITATION_NODES = Object.freeze([
  [0.69, 0.7, -0.98], [0.86, 0.81, -0.94], [1.02, 0.68, -0.99], [0.84, 0.57, -0.92],
  [1.1, 0.49, -0.92], [1.29, 0.58, -0.9], [1.42, 0.43, -0.96], [1.2, 0.34, -0.91],
  [0.62, 0.35, -0.89], [0.79, 0.25, -0.93], [0.95, 0.31, -0.96]
]);

const CITATION_LINKS = Object.freeze([
  [0, 1], [1, 2], [2, 3],
  [4, 5], [5, 6], [6, 7],
  [8, 9], [9, 10]
]);

const SIGNAL_GROUP = Object.freeze({
  citation: 0,
  keyword: 1,
  foreground: 2
});

export function createGeoBioDigitalField(resources) {
  const group = new THREE.Group();
  const membrane = createOrganicSemanticMembrane();
  const answer = createAnswerFilaments(resources.pointTexture);
  const peripheral = createPeripheralSignals(resources.pointTexture);
  let debugLayer = 'full';

  group.name = 'GEO BioDigital Organic Field';
  group.add(membrane.group, answer.group, peripheral.group);

  return {
    group,
    regionCount: 3,
    particleCount: answer.particleCount + peripheral.particleCount,
    foregroundParticleCount: peripheral.foregroundParticleCount,
    segmentCount: membrane.segmentCount + answer.segmentCount + CITATION_LINKS.length,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyVisibility();
    },
    update(time, progress) {
      membrane.update(time, progress);
      answer.update(time, progress);
      peripheral.update(time, progress);
    },
    dispose() {
      membrane.dispose();
      answer.dispose();
      peripheral.dispose();
      group.clear();
    }
  };

  function applyVisibility() {
    const full = debugLayer === 'full' || debugLayer === 'clean';
    membrane.group.visible = full || debugLayer === 'membrane' || debugLayer === 'glow';
    membrane.setDebugLayer(debugLayer);
    answer.group.visible = full || debugLayer === 'answer';
    peripheral.group.visible = full
      || debugLayer === 'citation'
      || debugLayer === 'foreground';
    peripheral.setDebugLayer(debugLayer);
  }
}

function createOrganicSemanticMembrane() {
  const group = new THREE.Group();
  const linePositions = [];
  const lineColors = [];
  const ice = new THREE.Color('#9aefff');
  const cyan = new THREE.Color('#55cedd');
  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();
  const curvePairs = [];

  MEMBRANE_PATCHES.forEach((patch, patchIndex) => {
    const curves = [];
    for (let band = 0; band < patch.bands; band += 1) {
      const offset = (band - (patch.bands - 1) * 0.5) * 0.045;
      const controls = createMembraneControls(patch, patchIndex, offset);
      const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal', 0.42);
      curves.push(curve);
      appendCurveSegments({
        curve,
        steps: 28,
        gapModulo: 9 + (patchIndex % 3),
        gapRemainder: 5 + (band % 2),
        positions: linePositions,
        colors: lineColors,
        color: band === 0 ? ice : cyan,
        intensity: band === 0 ? 1.28 : 0.72
      });
    }
    curvePairs.push(curves);

    const connectorCount = patch.bands === 3 ? 2 : 1;
    for (let connector = 0; connector < connectorCount; connector += 1) {
      const t = 0.34 + connector * 0.31 + patchIndex * 0.012;
      curves[0].getPoint(t, pointA);
      curves[curves.length - 1].getPoint(Math.min(0.96, t + 0.035), pointB);
      appendColoredSegment(
        linePositions,
        lineColors,
        pointA,
        pointB,
        cyan,
        0.4
      );
    }
  });

  const lineLayer = createColoredLineLayer(linePositions, lineColors, 1.18);
  group.name = 'Organic Semantic Membrane';
  group.position.set(0, 0.02, 0);
  lineLayer.lines.renderOrder = -7;
  group.add(lineLayer.lines);

  return {
    group,
    particleCount: 0,
    segmentCount: linePositions.length / 6,
    setDebugLayer(layer = 'full') {
      lineLayer.lines.visible = layer !== 'glow';
    },
    update(time, progress) {
      const reveal = smootherstep(0.08, 0.6, progress);
      const stable = smootherstep(0.88, 1, progress);
      lineLayer.material.opacity = reveal * 0.16;
      group.position.y = 0.02 + Math.sin(time * 0.008) * 0.004 * stable;
      group.rotation.z = Math.sin(time * 0.005) * 0.0025 * stable;
    },
    dispose() {
      lineLayer.dispose();
      group.clear();
    }
  };
}

function createMembraneControls(patch, patchIndex, offset) {
  const controls = [];
  const [cx, cy, cz] = patch.center;
  const [radiusX, radiusY] = patch.radius;
  const cosR = Math.cos(patch.rotation);
  const sinR = Math.sin(patch.rotation);
  const random = seededRandom(patch.seed + patchIndex * 101);
  const controlCount = 8;

  for (let index = 0; index < controlCount; index += 1) {
    const t = index / (controlCount - 1);
    const angle = patch.start + patch.sweep * t;
    const lowFrequency = 1
      + Math.sin(t * Math.PI * 2 + patchIndex * 0.71) * 0.08
      + (random() - 0.5) * 0.035;
    const localX = Math.cos(angle) * (radiusX + offset) * lowFrequency;
    const localY = Math.sin(angle) * (radiusY + offset * 0.58) * lowFrequency;
    const x = cx + localX * cosR - localY * sinR;
    const y = cy + localX * sinR + localY * cosR;
    const z = cz
      + Math.sin(angle * 1.34 + patchIndex * 0.83) * 0.055
      + offset * 1.6;
    controls.push(new THREE.Vector3(x, y, z));
  }
  return controls;
}

function createAnswerFilaments(texture) {
  const group = new THREE.Group();
  const mainCurves = ANSWER_MAIN_PATHS.map(createCurve);
  const branchCurves = ANSWER_BRANCH_PATHS.map(createCurve);
  const curves = [...mainCurves, ...branchCurves];
  const linePositions = [];
  const lineColors = [];
  const mainColor = new THREE.Color('#78dcf0');
  const branchColor = new THREE.Color('#4aaec8');

  mainCurves.forEach((curve, index) => {
    appendCurveSegments({
      curve,
      steps: 28,
      gapModulo: 10,
      gapRemainder: 6 + index,
      positions: linePositions,
      colors: lineColors,
      color: mainColor,
      intensity: 1
    });
  });
  branchCurves.forEach((curve, index) => {
    appendCurveSegments({
      curve,
      steps: 12,
      gapModulo: 7,
      gapRemainder: 4 + index % 2,
      positions: linePositions,
      colors: lineColors,
      color: branchColor,
      intensity: 0.62
    });
  });

  const lineLayer = createColoredLineLayer(linePositions, lineColors, 1.14);
  const pulseCount = 38;
  const positions = new Float32Array(pulseCount * 3);
  const colors = new Float32Array(pulseCount * 3);
  const sizes = new Float32Array(pulseCount);
  const colorA = new THREE.Color('#ddfbff');
  const colorB = new THREE.Color('#55cce9');
  const point = new THREE.Vector3();

  for (let index = 0; index < pulseCount; index += 1) {
    const color = colorA.clone().lerp(colorB, (index % 5) / 6);
    const stride = index * 3;
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 13 === 0 ? 1.42 : 0.64;
  }
  const pointLayer = createPointLayer(texture, positions, colors, sizes);
  group.name = 'Answer Organic Neural Filaments';
  lineLayer.lines.renderOrder = -4;
  pointLayer.points.renderOrder = -3;
  group.add(lineLayer.lines, pointLayer.points);

  return {
    group,
    particleCount: pulseCount,
    segmentCount: linePositions.length / 6,
    update(time, progress) {
      const reveal = smootherstep(0.16, 0.68, progress);
      const stable = smootherstep(0.88, 1, progress);
      const data = pointLayer.geometry.attributes.position.array;
      for (let index = 0; index < pulseCount; index += 1) {
        const curve = index < 28
          ? mainCurves[index % mainCurves.length]
          : branchCurves[index % branchCurves.length];
        const transition = Math.min(1, reveal * 1.08 - (index % 8) * 0.016);
        const loop = (
          index / pulseCount
          + time * (0.008 + (index % 4) * 0.0008)
        ) % 1;
        const t = transition * (1 - stable) + loop * stable;
        curve.getPoint(Math.max(0, t), point);
        const stride = index * 3;
        data[stride] = point.x;
        data[stride + 1] = point.y;
        data[stride + 2] = point.z;
      }
      pointLayer.geometry.attributes.position.needsUpdate = true;
      lineLayer.material.opacity = reveal * 0.19;
      pointLayer.material.uniforms.uOpacity.value = reveal * 0.32;
      pointLayer.material.uniforms.uScale.value = 0.88;
    },
    dispose() {
      lineLayer.dispose();
      pointLayer.dispose();
      group.clear();
    }
  };

  function createCurve(path) {
    return new THREE.CatmullRomCurve3(
      path.map((pointValue) => new THREE.Vector3(...pointValue)),
      false,
      'centripetal',
      0.42
    );
  }
}

function createPeripheralSignals(texture) {
  const group = new THREE.Group();
  const positions = [];
  const colors = [];
  const sizes = [];
  const groups = [];
  const white = new THREE.Color('#d9f4ff');
  const purple = new THREE.Color('#8b83a5');
  const cyan = new THREE.Color('#45d5dc');
  const ice = new THREE.Color('#a9f7f4');
  const randomKeyword = seededRandom(9029);
  const randomForeground = seededRandom(10037);

  CITATION_NODES.forEach((node, index) => {
    const color = white.clone().lerp(purple, index === 5 ? 0.11 : 0.012);
    appendSignal(positions, colors, sizes, groups, node, color, index % 4 === 0 ? 1.48 : 0.82, SIGNAL_GROUP.citation);
  });
  CITATION_LINKS.forEach(([from, to], linkIndex) => {
    const fromPoint = CITATION_NODES[from];
    const toPoint = CITATION_NODES[to];
    for (let step = 1; step < 7; step += 1) {
      if ((step + linkIndex) % 4 === 0) continue;
      const t = step / 7;
      appendSignal(
        positions,
        colors,
        sizes,
        groups,
        [
          THREE.MathUtils.lerp(fromPoint[0], toPoint[0], t),
          THREE.MathUtils.lerp(fromPoint[1], toPoint[1], t),
          THREE.MathUtils.lerp(fromPoint[2], toPoint[2], t)
        ],
        white,
        0.34,
        SIGNAL_GROUP.citation
      );
    }
  });

  const keywordCount = 44;
  for (let index = 0; index < keywordCount; index += 1) {
    const t = index / (keywordCount - 1);
    const color = cyan.clone().lerp(ice, (1 - t) * 0.22);
    appendSignal(
      positions,
      colors,
      sizes,
      groups,
      [
        0.64 + t * 1.1 + (randomKeyword() - 0.5) * 0.08,
        -0.66 - t * 0.18 + Math.sin(t * Math.PI * 2.2) * 0.07,
        -0.58 - t * 0.32 + (randomKeyword() - 0.5) * 0.08
      ],
      color,
      0.42 + randomKeyword() * 0.48,
      SIGNAL_GROUP.keyword
    );
  }

  const foregroundCount = 110;
  for (let index = 0; index < foregroundCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const color = cyan.clone().lerp(white, randomForeground() * 0.28);
    appendSignal(
      positions,
      colors,
      sizes,
      groups,
      [
        side * (1.75 + randomForeground() * 1.5),
        (randomForeground() - 0.5) * 2.4,
        0.18 + randomForeground() * 0.46
      ],
      color,
      index % 17 === 0 ? 1.14 : 0.48 + randomForeground() * 0.34,
      SIGNAL_GROUP.foreground
    );
  }

  const basePositions = Float32Array.from(positions);
  const baseColors = Float32Array.from(colors);
  const groupIds = Uint8Array.from(groups);
  const pointLayer = createPointLayer(
    texture,
    basePositions.slice(),
    baseColors.slice(),
    Float32Array.from(sizes)
  );
  let debugLayer = 'full';

  group.name = 'Citation Keyword And Foreground Signals';
  pointLayer.points.renderOrder = -3;
  group.add(pointLayer.points);

  return {
    group,
    particleCount: sizes.length,
    foregroundParticleCount: foregroundCount,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
    },
    update(time, progress) {
      const citationReveal = smootherstep(0.24, 0.72, progress);
      const keywordReveal = smootherstep(0.36, 0.82, progress);
      const foregroundReveal = smootherstep(0.58, 0.94, progress);
      const stable = smootherstep(0.88, 1, progress);
      const colorData = pointLayer.geometry.attributes.color.array;
      const positionData = pointLayer.geometry.attributes.position.array;
      const full = debugLayer === 'full' || debugLayer === 'clean';

      for (let index = 0; index < groupIds.length; index += 1) {
        const stride = index * 3;
        const groupId = groupIds[index];
        let gain = 0;
        if (groupId === SIGNAL_GROUP.citation && (full || debugLayer === 'citation')) {
          gain = citationReveal * 0.31;
        } else if (groupId === SIGNAL_GROUP.keyword && full) {
          gain = keywordReveal * 0.12;
        } else if (
          groupId === SIGNAL_GROUP.foreground
          && (full || debugLayer === 'foreground')
        ) {
          gain = foregroundReveal * 0.09;
        }
        colorData[stride] = baseColors[stride] * gain;
        colorData[stride + 1] = baseColors[stride + 1] * gain;
        colorData[stride + 2] = baseColors[stride + 2] * gain;
        positionData[stride] = basePositions[stride];
        positionData[stride + 1] = basePositions[stride + 1]
          + (groupId === SIGNAL_GROUP.foreground
            ? Math.sin(time * 0.006 + index * 0.11) * 0.005 * stable
            : 0);
        positionData[stride + 2] = basePositions[stride + 2];
      }
      pointLayer.geometry.attributes.color.needsUpdate = true;
      pointLayer.geometry.attributes.position.needsUpdate = stable > 0;
      pointLayer.material.uniforms.uOpacity.value = 1;
      pointLayer.material.uniforms.uScale.value = 0.82;
    },
    dispose() {
      pointLayer.dispose();
      group.clear();
    }
  };
}

function appendCurveSegments({
  curve,
  steps,
  gapModulo,
  gapRemainder,
  positions,
  colors,
  color,
  intensity
}) {
  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();
  for (let segment = 0; segment < steps; segment += 1) {
    if (segment % gapModulo === gapRemainder % gapModulo) continue;
    curve.getPoint(segment / steps, pointA);
    curve.getPoint((segment + 0.78) / steps, pointB);
    appendColoredSegment(
      positions,
      colors,
      pointA,
      pointB,
      color,
      intensity
    );
  }
}

function appendColoredSegment(positions, colors, from, to, color, intensity) {
  positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
  colors.push(
    color.r * intensity,
    color.g * intensity,
    color.b * intensity,
    color.r * intensity,
    color.g * intensity,
    color.b * intensity
  );
}

function appendSignal(positions, colors, sizes, groups, position, color, size, group) {
  positions.push(...position);
  colors.push(color.r, color.g, color.b);
  sizes.push(size);
  groups.push(group);
}

function createColoredLineLayer(positions, colors, lineWidth = 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  );
  const material = new THREE.LineBasicMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: 0,
    linewidth: lineWidth,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);
  return {
    lines,
    geometry,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createPointLayer(texture, positions, colors, sizes) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      positions instanceof Float32Array
        ? positions
        : Float32Array.from(positions),
      3
    )
  );
  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(
      colors instanceof Float32Array
        ? colors
        : Float32Array.from(colors),
      3
    )
  );
  geometry.setAttribute(
    'aSize',
    new THREE.BufferAttribute(
      sizes instanceof Float32Array
        ? sizes
        : Float32Array.from(sizes),
      1
    )
  );
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);
  return {
    points,
    geometry,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
