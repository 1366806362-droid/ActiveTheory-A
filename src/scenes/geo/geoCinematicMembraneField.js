import * as THREE from 'three';
import { seededRandom, smootherstep } from './geoSignalCore.js';

const FOREGROUND_PARTICLE_COUNT = 96;
const REGION_ALL = -1;

const ORGANIC_REGIONS = Object.freeze([
  Object.freeze({
    id: 'answer',
    region: 0,
    center: [-1.66, 0.72, -1.04],
    span: [1.28, 0.95],
    rotation: -0.2,
    depth: -0.14,
    boundaries: 3,
    connections: 16,
    nodes: 36,
    color: '#82e8ff',
    secondary: '#d7fbff',
    seed: 4103
  }),
  Object.freeze({
    id: 'citation',
    region: 1,
    center: [1.63, 0.68, -1.18],
    span: [1.12, 0.78],
    rotation: 0.24,
    depth: -0.22,
    boundaries: 2,
    connections: 13,
    nodes: 28,
    color: '#a6dfff',
    secondary: '#b7afff',
    seed: 4201
  }),
  Object.freeze({
    id: 'foreground',
    region: 2,
    center: [-1.42, -0.72, 0.58],
    span: [1.38, 0.62],
    rotation: 0.09,
    depth: 0.28,
    boundaries: 2,
    connections: 10,
    nodes: 32,
    color: '#62d4e8',
    secondary: '#c7f8ff',
    seed: 4307
  })
]);

export function createGeoCinematicMembraneField(resources) {
  const group = new THREE.Group();
  const membrane = createOrganicMembranes(resources.pointTexture);
  let debugLayer = 'full';

  group.name = 'GEO V3.1 Soft Organic Membrane Field';
  group.add(membrane.surface, membrane.lines, membrane.nodes);

  applyVisibility();

  return {
    group,
    regionCount: ORGANIC_REGIONS.length,
    particleCount: membrane.nodeCount,
    foregroundParticleCount: FOREGROUND_PARTICLE_COUNT,
    segmentCount: membrane.segmentCount,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyVisibility();
    },
    update(time, progress, journey = null) {
      const reveal = smootherstep(0.08, 0.72, progress);
      const stable = smootherstep(0.9, 1, progress);
      const regionReveal = journey
        ? [journey.answer, journey.citation, journey.foreground]
        : [1, 1, 1];
      const regionDepth = journey?.depth ?? [0, 0, 0];

      membrane.lineMaterial.uniforms.uOpacity.value = reveal;
      membrane.lineMaterial.uniforms.uTime.value = time;
      membrane.lineMaterial.uniforms.uStable.value = stable;
      membrane.lineMaterial.uniforms.uRegionReveal.value.fromArray(regionReveal);
      membrane.lineMaterial.uniforms.uRegionDepth.value.fromArray(regionDepth);
      membrane.nodeMaterial.uniforms.uOpacity.value = reveal;
      membrane.nodeMaterial.uniforms.uTime.value = time;
      membrane.nodeMaterial.uniforms.uStable.value = stable;
      membrane.nodeMaterial.uniforms.uScale.value = 0.86;
      membrane.nodeMaterial.uniforms.uRegionReveal.value.fromArray(regionReveal);
      membrane.nodeMaterial.uniforms.uRegionDepth.value.fromArray(regionDepth);
    },
    dispose() {
      membrane.dispose();
      group.clear();
    }
  };

  function applyVisibility() {
    const queryLayer = readMembraneLayer();
    const requestedRegion = resolveRegion(queryLayer);
    const foregroundOnly = debugLayer === 'foreground';
    const membranesOnly = debugLayer === 'membranes';

    membrane.lines.visible = !foregroundOnly;
    membrane.surface.visible = !foregroundOnly;
    membrane.nodes.visible = !foregroundOnly;
    membrane.lineMaterial.uniforms.uRegion.value = requestedRegion;
    membrane.nodeMaterial.uniforms.uRegion.value = requestedRegion;

    if (foregroundOnly || queryLayer === 'foreground') {
      membrane.lines.visible = true;
      membrane.surface.visible = true;
      membrane.nodes.visible = true;
      membrane.lineMaterial.uniforms.uRegion.value = 2;
      membrane.nodeMaterial.uniforms.uRegion.value = 2;
    }
    if (membranesOnly) {
      membrane.lines.visible = true;
      membrane.surface.visible = true;
      membrane.nodes.visible = true;
    }
  }
}

function createOrganicMembranes(pointTexture) {
  const lineData = createLineData();
  const surfaceData = createSurfaceData(lineData.regionCurves);
  const nodeData = createNodeData(lineData.regionCurves);
  appendForegroundParticles(nodeData, lineData.regionCurves[2]);

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineData.positions, 3));
  lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineData.colors, 3));
  lineGeometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(lineData.alphas, 1));
  lineGeometry.setAttribute('aRegion', new THREE.Float32BufferAttribute(lineData.regions, 1));
  const lineMaterial = createOrganicLineMaterial();
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);

  const surfaceGeometry = new THREE.BufferGeometry();
  surfaceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(surfaceData.positions, 3));
  surfaceGeometry.setAttribute('color', new THREE.Float32BufferAttribute(surfaceData.colors, 3));
  surfaceGeometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(surfaceData.alphas, 1));
  surfaceGeometry.setAttribute('aRegion', new THREE.Float32BufferAttribute(surfaceData.regions, 1));
  const surface = new THREE.Mesh(surfaceGeometry, lineMaterial);

  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodeData.positions, 3));
  nodeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(nodeData.colors, 3));
  nodeGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(nodeData.sizes, 1));
  nodeGeometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(nodeData.alphas, 1));
  nodeGeometry.setAttribute('aRegion', new THREE.Float32BufferAttribute(nodeData.regions, 1));
  const nodeMaterial = createOrganicNodeMaterial(pointTexture);
  const nodes = new THREE.Points(nodeGeometry, nodeMaterial);

  surface.name = 'Soft Organic Membrane Feathered Veils';
  surface.renderOrder = -9;
  lines.name = 'Soft Organic Membrane Boundaries and Connections';
  lines.renderOrder = -8;
  nodes.name = 'Soft Organic Membrane Nodes and Foreground Micro Particles';
  nodes.renderOrder = 12;

  return {
    surface,
    lines,
    nodes,
    lineMaterial,
    nodeMaterial,
    nodeCount: nodeData.sizes.length,
    segmentCount: lineData.segmentCount,
    dispose() {
      surfaceGeometry.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
    }
  };
}

function createSurfaceData(regionCurves) {
  const positions = [];
  const colors = [];
  const alphas = [];
  const regions = [];

  ORGANIC_REGIONS.forEach((definition, regionIndex) => {
    const curves = regionCurves[regionIndex];
    const outerA = curves[0];
    const outerB = curves[curves.length - 1];
    const color = new THREE.Color(definition.color).lerp(
      new THREE.Color(definition.secondary),
      definition.id === 'citation' ? 0.22 : 0.12
    );
    const steps = definition.id === 'answer' ? 44 : 38;
    const edgeA0 = new THREE.Vector3();
    const edgeA1 = new THREE.Vector3();
    const edgeB0 = new THREE.Vector3();
    const edgeB1 = new THREE.Vector3();
    const center0 = new THREE.Vector3();
    const center1 = new THREE.Vector3();
    const baseAlpha = definition.id === 'foreground'
      ? 0.034
      : definition.id === 'answer'
        ? 0.072
        : 0.056;

    for (let index = 0; index < steps; index += 1) {
      const t0 = index / steps;
      const t1 = (index + 1) / steps;
      const envelope0 = Math.pow(Math.sin(Math.PI * t0), 1.45);
      const envelope1 = Math.pow(Math.sin(Math.PI * t1), 1.45);
      if (envelope0 < 0.09 && envelope1 < 0.09) continue;

      outerA.getPoint(t0, edgeA0);
      outerA.getPoint(t1, edgeA1);
      outerB.getPoint(t0, edgeB0);
      outerB.getPoint(t1, edgeB1);
      center0.copy(edgeA0).lerp(edgeB0, 0.5);
      center1.copy(edgeA1).lerp(edgeB1, 0.5);
      center0.z += Math.sin(t0 * Math.PI * 2.4 + regionIndex) * 0.025;
      center1.z += Math.sin(t1 * Math.PI * 2.4 + regionIndex) * 0.025;

      appendSurfaceTriangle(
        positions,
        colors,
        alphas,
        regions,
        edgeA0,
        center0,
        edgeA1,
        color,
        [0, baseAlpha * envelope0, 0],
        definition.region
      );
      appendSurfaceTriangle(
        positions,
        colors,
        alphas,
        regions,
        edgeA1,
        center0,
        center1,
        color,
        [0, baseAlpha * envelope0, baseAlpha * envelope1],
        definition.region
      );
      appendSurfaceTriangle(
        positions,
        colors,
        alphas,
        regions,
        center0,
        edgeB0,
        center1,
        color,
        [baseAlpha * envelope0, 0, baseAlpha * envelope1],
        definition.region
      );
      appendSurfaceTriangle(
        positions,
        colors,
        alphas,
        regions,
        center1,
        edgeB0,
        edgeB1,
        color,
        [baseAlpha * envelope1, 0, 0],
        definition.region
      );
    }
  });

  return { positions, colors, alphas, regions };
}

function appendSurfaceTriangle(
  positions,
  colors,
  alphas,
  regions,
  pointA,
  pointB,
  pointC,
  color,
  alphaValues,
  region
) {
  [pointA, pointB, pointC].forEach((point, index) => {
    positions.push(point.x, point.y, point.z);
    colors.push(color.r, color.g, color.b);
    alphas.push(alphaValues[index]);
    regions.push(region);
  });
}

function createLineData() {
  const positions = [];
  const colors = [];
  const alphas = [];
  const regions = [];
  const regionCurves = [];
  let segmentCount = 0;

  ORGANIC_REGIONS.forEach((definition) => {
    const curves = [];
    const baseColor = new THREE.Color(definition.color);
    const secondaryColor = new THREE.Color(definition.secondary);

    for (let boundary = 0; boundary < definition.boundaries; boundary += 1) {
      const curve = createOrganicBoundary(definition, boundary);
      const boundaryColor = baseColor.clone().lerp(
        secondaryColor,
        boundary === 0 ? 0.32 : 0.08
      );
      const alpha = boundary === 0
        ? (definition.id === 'foreground' ? 0.082 : 0.128)
        : (definition.id === 'foreground' ? 0.048 : 0.072);

      curves.push(curve);
      segmentCount += appendSoftBrokenCurve({
        curve,
        positions,
        colors,
        alphas,
        regions,
        color: boundaryColor,
        alpha,
        region: definition.region,
        steps: definition.id === 'answer' ? 48 : 42,
        seed: definition.seed + boundary * 37
      });
    }

    segmentCount += appendSoftConnections(
      definition,
      curves,
      positions,
      colors,
      alphas,
      regions,
      baseColor
    );
    regionCurves.push(curves);
  });

  return {
    positions,
    colors,
    alphas,
    regions,
    regionCurves,
    segmentCount
  };
}

function createOrganicBoundary(definition, boundaryIndex) {
  const controls = [];
  const random = seededRandom(definition.seed + boundaryIndex * 131);
  const controlCount = definition.id === 'answer' ? 13 : 11;
  const cosR = Math.cos(definition.rotation);
  const sinR = Math.sin(definition.rotation);
  const bandShift = boundaryIndex - (definition.boundaries - 1) * 0.5;

  for (let index = 0; index < controlCount; index += 1) {
    const t = index / (controlCount - 1);
    const length = (t - 0.5) * definition.span[0] * 2;
    const lowFrequency =
      Math.sin(
        t * Math.PI * (1.42 + boundaryIndex * 0.17)
        + definition.region * 0.81
        + boundaryIndex * 1.23
      ) * (1 + boundaryIndex * 0.1)
      + Math.sin(
        t * Math.PI * 3.05
        + definition.region * 1.17
        + boundaryIndex * 0.58
      ) * 0.34;
    const asymmetricEnvelope = Math.sin(Math.PI * t) * (0.72 + t * 0.38);
    const localX =
      length
      + Math.sin(t * Math.PI * 2.3 + boundaryIndex * 1.2) * definition.span[0] * 0.08
      + (random() - 0.5) * definition.span[0] * 0.045;
    const localY =
      lowFrequency * definition.span[1] * 0.34 * asymmetricEnvelope
      + bandShift * definition.span[1] * (
        0.52
        + Math.sin(t * Math.PI * 2.15 + boundaryIndex * 0.83) * 0.21
      )
      + (random() - 0.5) * definition.span[1] * 0.05;
    const x = definition.center[0] + localX * cosR - localY * sinR;
    const y = definition.center[1] + localX * sinR + localY * cosR;
    const z =
      definition.center[2]
      + definition.depth
      + Math.sin(t * Math.PI * 2.05 + boundaryIndex * 0.92) * 0.13
      + bandShift * 0.09
      + (random() - 0.5) * 0.045;

    controls.push(new THREE.Vector3(x, y, z));
  }

  return new THREE.CatmullRomCurve3(controls, false, 'centripetal', 0.38);
}

function appendSoftBrokenCurve({
  curve,
  positions,
  colors,
  alphas,
  regions,
  color,
  alpha,
  region,
  steps,
  seed
}) {
  const random = seededRandom(seed);
  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();
  let segmentCount = 0;

  for (let index = 0; index < steps; index += 1) {
    const edgeFade = Math.sin(Math.PI * (index + 0.5) / steps);
    const keep = random() > 0.31 && edgeFade > 0.18;
    if (!keep) continue;

    const t0 = index / steps;
    const t1 = Math.min(1, (index + 0.58 + random() * 0.18) / steps);
    curve.getPoint(t0, pointA);
    curve.getPoint(t1, pointB);
    appendSegment(
      positions,
      colors,
      alphas,
      regions,
      pointA,
      pointB,
      color,
      alpha * (0.72 + random() * 0.28) * edgeFade,
      region
    );
    segmentCount += 1;
  }

  return segmentCount;
}

function appendSoftConnections(
  definition,
  curves,
  positions,
  colors,
  alphas,
  regions,
  color
) {
  const random = seededRandom(definition.seed + 701);
  let segmentCount = 0;

  for (let connection = 0; connection < definition.connections; connection += 1) {
    const t = 0.1 + random() * 0.8;
    const sourceCurve = curves[connection % curves.length];
    const targetCurve = curves[(connection + 1) % curves.length];
    const start = sourceCurve.getPoint(t);
    const targetT = THREE.MathUtils.clamp(
      t + (random() - 0.5) * 0.42,
      0.06,
      0.94
    );
    const end = targetCurve.getPoint(targetT);
    const middleA = start.clone().lerp(end, 0.34);
    const middleB = start.clone().lerp(end, 0.68);
    const bendDirection = connection % 2 === 0 ? 1 : -1;
    middleA.x += (random() - 0.5) * 0.16;
    middleA.y += bendDirection * (0.035 + random() * 0.095);
    middleA.z += (random() - 0.5) * 0.18;
    middleB.x += (random() - 0.5) * 0.16;
    middleB.y -= bendDirection * (0.025 + random() * 0.08);
    middleB.z += (random() - 0.5) * 0.18;
    const connector = new THREE.CatmullRomCurve3(
      [start, middleA, middleB, end],
      false,
      'centripetal',
      0.35
    );
    const steps = 4 + Math.floor(random() * 3);
    const connectorAlpha = definition.id === 'foreground'
      ? 0.027 + random() * 0.016
      : 0.034 + random() * 0.018;
    const pointA = new THREE.Vector3();
    const pointB = new THREE.Vector3();

    for (let step = 0; step < steps; step += 1) {
      if ((step + connection) % 5 === 3) continue;
      connector.getPoint(step / steps, pointA);
      connector.getPoint((step + 0.72) / steps, pointB);
      appendSegment(
        positions,
        colors,
        alphas,
        regions,
        pointA,
        pointB,
        color,
        connectorAlpha,
        definition.region
      );
      segmentCount += 1;
    }
  }

  return segmentCount;
}

function appendSegment(
  positions,
  colors,
  alphas,
  regions,
  pointA,
  pointB,
  color,
  alpha,
  region
) {
  positions.push(pointA.x, pointA.y, pointA.z, pointB.x, pointB.y, pointB.z);
  for (let vertex = 0; vertex < 2; vertex += 1) {
    colors.push(color.r, color.g, color.b);
    alphas.push(alpha);
    regions.push(region);
  }
}

function createNodeData(regionCurves) {
  const positions = [];
  const colors = [];
  const sizes = [];
  const alphas = [];
  const regions = [];

  ORGANIC_REGIONS.forEach((definition, regionIndex) => {
    const random = seededRandom(definition.seed + 997);
    const curves = regionCurves[regionIndex];
    const baseColor = new THREE.Color(definition.color);
    const secondaryColor = new THREE.Color(definition.secondary);
    const point = new THREE.Vector3();
    const interiorA = new THREE.Vector3();
    const interiorB = new THREE.Vector3();

    for (let index = 0; index < definition.nodes; index += 1) {
      const curve = curves[Math.floor(random() * curves.length)];
      const t = 0.04 + random() * 0.92;
      if (index % 3 === 0) {
        curves[0].getPoint(t, interiorA);
        curves[curves.length - 1].getPoint(
          THREE.MathUtils.clamp(t + (random() - 0.5) * 0.18, 0.03, 0.97),
          interiorB
        );
        point.copy(interiorA).lerp(interiorB, 0.2 + random() * 0.6);
      } else {
        curve.getPoint(t, point);
      }
      positions.push(
        point.x + (random() - 0.5) * 0.028,
        point.y + (random() - 0.5) * 0.028,
        point.z + (random() - 0.5) * 0.055
      );
      const color = baseColor.clone().lerp(secondaryColor, random() * 0.46);
      colors.push(color.r, color.g, color.b);
      sizes.push(
        definition.id === 'foreground'
          ? 0.9 + random() * 0.58
          : 1.28 + random() * 0.84
      );
      alphas.push(
        definition.id === 'foreground'
          ? 0.09 + random() * 0.045
          : 0.12 + random() * 0.04
      );
      regions.push(definition.region);
    }
  });

  return { positions, colors, sizes, alphas, regions };
}

function appendForegroundParticles(nodeData, foregroundCurves) {
  const random = seededRandom(4411);
  const cold = new THREE.Color('#c7f8ff');
  const blue = new THREE.Color('#4ac7df');
  const point = new THREE.Vector3();

  for (let index = 0; index < FOREGROUND_PARTICLE_COUNT; index += 1) {
    const curve = foregroundCurves[index % foregroundCurves.length];
    curve.getPoint(0.08 + random() * 0.84, point);
    const color = cold.clone().lerp(blue, random() * 0.72);
    nodeData.positions.push(
      point.x + (random() - 0.5) * 0.26,
      point.y + (random() - 0.5) * 0.16,
      0.46 + random() * 0.42
    );
    nodeData.colors.push(color.r, color.g, color.b);
    nodeData.sizes.push(0.72 + random() * 0.52);
    nodeData.alphas.push(0.04 + random() * 0.045);
    nodeData.regions.push(2);
  }
}

function createOrganicLineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uStable: { value: 0 },
      uRegion: { value: REGION_ALL },
      uRegionReveal: { value: new THREE.Vector3(1, 1, 1) },
      uRegionDepth: { value: new THREE.Vector3() }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uStable;
      uniform float uRegion;
      uniform vec3 uRegionReveal;
      uniform vec3 uRegionDepth;
      attribute float aAlpha;
      attribute float aRegion;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float regionMask = uRegion < -0.5
          ? 1.0
          : 1.0 - step(0.25, abs(aRegion - uRegion));
        float journeyReveal = aRegion < 0.5
          ? uRegionReveal.x
          : aRegion < 1.5
            ? uRegionReveal.y
            : uRegionReveal.z;
        float journeyDepth = aRegion < 0.5
          ? uRegionDepth.x
          : aRegion < 1.5
            ? uRegionDepth.y
            : uRegionDepth.z;
        float phase = position.x * 1.37 + position.y * 1.91 + aRegion * 2.43;
        float drift = sin(uTime * 0.12 + phase) * 0.006
          + sin(uTime * 0.071 + phase * 0.63) * 0.003;
        vec3 organicPosition = position;
        organicPosition.x += drift * uStable;
        organicPosition.y += cos(uTime * 0.093 + phase * 0.71) * 0.004 * uStable;
        organicPosition.z += sin(uTime * 0.064 + phase * 0.82) * 0.008 * uStable;
        organicPosition.z += journeyDepth;
        vColor = color;
        vAlpha = aAlpha * regionMask * journeyReveal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(organicPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float alpha = uOpacity * vAlpha;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

function createOrganicNodeMaterial(pointTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uPointTexture: { value: pointTexture },
      uScale: { value: 1 },
      uTime: { value: 0 },
      uStable: { value: 0 },
      uRegion: { value: REGION_ALL },
      uRegionReveal: { value: new THREE.Vector3(1, 1, 1) },
      uRegionDepth: { value: new THREE.Vector3() }
    },
    vertexShader: `
      uniform float uScale;
      uniform float uTime;
      uniform float uStable;
      uniform float uRegion;
      uniform vec3 uRegionReveal;
      uniform vec3 uRegionDepth;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aRegion;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float regionMask = uRegion < -0.5
          ? 1.0
          : 1.0 - step(0.25, abs(aRegion - uRegion));
        float journeyReveal = aRegion < 0.5
          ? uRegionReveal.x
          : aRegion < 1.5
            ? uRegionReveal.y
            : uRegionReveal.z;
        float journeyDepth = aRegion < 0.5
          ? uRegionDepth.x
          : aRegion < 1.5
            ? uRegionDepth.y
            : uRegionDepth.z;
        float phase = position.x * 1.63 + position.y * 1.19 + aRegion * 2.71;
        vec3 organicPosition = position;
        organicPosition.x += sin(uTime * 0.1 + phase) * 0.005 * uStable;
        organicPosition.y += cos(uTime * 0.078 + phase * 0.67) * 0.004 * uStable;
        organicPosition.z += sin(uTime * 0.061 + phase * 0.89) * 0.009 * uStable;
        organicPosition.z += journeyDepth;
        vec4 viewPosition = modelViewMatrix * vec4(organicPosition, 1.0);
        vColor = color;
        vAlpha = aAlpha * regionMask * journeyReveal;
        gl_PointSize = aSize * uScale * (13.5 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float spriteAlpha = texture2D(uPointTexture, gl_PointCoord).a;
        float alpha = spriteAlpha * vAlpha * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

function readMembraneLayer() {
  if (!import.meta.env.DEV) return 'full';
  const layer = new URLSearchParams(window.location.search).get('geoMembraneLayer');
  return ['answer', 'citation', 'foreground'].includes(layer) ? layer : 'full';
}

function resolveRegion(layer) {
  if (layer === 'answer') return 0;
  if (layer === 'citation') return 1;
  if (layer === 'foreground') return 2;
  return REGION_ALL;
}
