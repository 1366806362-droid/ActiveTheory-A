import * as THREE from 'three';
import {
  createSignalPointsMaterial,
  seededRandom
} from './geoSignalCore.js';

export const GEO_V4_TISSUE_FIELD = Object.freeze({
  center: Object.freeze([-0.02, -0.14, -0.34]),
  answer: Object.freeze({
    origin: Object.freeze([-1.58, 0.5, -0.28]),
    branches: Object.freeze([
      Object.freeze([[-2.78, 0.28, -0.62], [-2.38, 0.58, -0.48], [-1.92, 0.54, -0.3], [-1.52, 0.38, -0.22], [-1.16, 0.18, -0.24]]),
      Object.freeze([[-2.62, 1.12, -0.72], [-2.24, 0.9, -0.52], [-1.92, 0.62, -0.3], [-1.58, 0.48, -0.2], [-1.22, 0.3, -0.23]]),
      Object.freeze([[-2.72, -0.28, -0.6], [-2.32, -0.08, -0.42], [-1.96, 0.28, -0.25], [-1.58, 0.46, -0.18], [-1.18, 0.28, -0.22]]),
      Object.freeze([[-2.32, 0.18, -0.54], [-2.02, 0.34, -0.34], [-1.72, 0.5, -0.2], [-1.48, 0.62, -0.22]]),
      Object.freeze([[-2.26, 0.9, -0.58], [-2.08, 0.72, -0.38], [-1.82, 0.56, -0.2]]),
      Object.freeze([[-1.72, 0.5, -0.2], [-1.38, 0.26, -0.2], [-1.02, 0.08, -0.26], [-0.7, -0.03, -0.28], [-0.38, -0.09, -0.31]])
    ])
  }),
  citation: Object.freeze({
    origin: Object.freeze([1.38, 0.62, -0.34]),
    branches: Object.freeze([
      Object.freeze([[2.5, 1.18, -0.74], [2.08, 1.06, -0.54], [1.76, 0.84, -0.34], [1.42, 0.62, -0.24], [1.08, 0.43, -0.28]]),
      Object.freeze([[2.72, 0.7, -0.68], [2.28, 0.72, -0.5], [1.86, 0.62, -0.32], [1.46, 0.52, -0.22], [1.12, 0.36, -0.28]]),
      Object.freeze([[2.42, 0.18, -0.64], [2.04, 0.28, -0.46], [1.72, 0.42, -0.3], [1.38, 0.5, -0.22], [1.08, 0.34, -0.28]]),
      Object.freeze([[1.78, 1.28, -0.62], [1.64, 1.02, -0.44], [1.48, 0.76, -0.27], [1.3, 0.56, -0.22]]),
      Object.freeze([[1.08, 0.4, -0.26], [0.82, 0.23, -0.26], [0.56, 0.08, -0.29], [0.3, -0.03, -0.31], [0.12, -0.1, -0.33]])
    ])
  }),
  keyword: Object.freeze({
    origin: Object.freeze([1.42, -0.65, -0.24]),
    branches: Object.freeze([
      Object.freeze([[2.86, -1.18, -0.62], [2.42, -1.04, -0.48], [2.04, -0.86, -0.32], [1.66, -0.66, -0.2], [1.26, -0.45, -0.22], [0.86, -0.28, -0.26]]),
      Object.freeze([[2.78, -0.42, -0.58], [2.34, -0.5, -0.44], [1.98, -0.58, -0.28], [1.62, -0.58, -0.18], [1.22, -0.42, -0.21], [0.84, -0.26, -0.26]]),
      Object.freeze([[2.34, -1.32, -0.54], [2.12, -1.06, -0.4], [1.84, -0.82, -0.24], [1.56, -0.66, -0.18]]),
      Object.freeze([[2.28, -0.28, -0.52], [2.04, -0.46, -0.36], [1.78, -0.58, -0.2], [1.52, -0.58, -0.17]]),
      Object.freeze([[0.9, -0.29, -0.25], [0.66, -0.22, -0.28], [0.43, -0.17, -0.3], [0.2, -0.13, -0.32]])
    ])
  })
});

export function createGeoV4TissueCurve(points) {
  return new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    'catmullrom',
    0.42
  );
}

const ORGANIC_SHEETS = Object.freeze([
  Object.freeze({
    seed: 4401,
    layer: 'mid',
    width: 0.86,
    depth: -0.54,
    opacity: 0.145,
    color: '#58caed',
    coreAt: 'end',
    points: [[-3.2, 0.18], [-2.78, 0.78], [-2.18, 1.02], [-1.64, 0.76], [-1.08, 0.5], [-0.54, 0.16]]
  }),
  Object.freeze({
    seed: 4402,
    layer: 'mid',
    width: 0.8,
    depth: -0.66,
    opacity: 0.132,
    color: '#8ecde8',
    coreAt: 'start',
    points: [[0.5, 0.2], [0.96, 0.72], [1.48, 1.12], [2.08, 1.18], [2.62, 0.86], [3.16, 0.3]]
  }),
  Object.freeze({
    seed: 4403,
    layer: 'foreground',
    width: 0.86,
    depth: 0.7,
    opacity: 0.072,
    color: '#4babc8',
    coreAt: 'end',
    points: [[-3.48, -1.54], [-2.8, -1.28], [-2.14, -1.02], [-1.5, -1.04], [-0.92, -0.72], [-0.42, -0.3]]
  }),
  Object.freeze({
    seed: 4404,
    layer: 'mid',
    width: 0.76,
    depth: -0.42,
    opacity: 0.137,
    color: '#31b9d2',
    coreAt: 'end',
    points: [[3.3, -1.02], [2.82, -0.58], [2.28, -0.5], [1.72, -0.62], [1.12, -0.46], [0.52, -0.16]]
  }),
  Object.freeze({
    seed: 4405,
    layer: 'rear',
    width: 0.9,
    depth: -1.34,
    opacity: 0.086,
    color: '#2d769b',
    points: [[-3.45, 1.16], [-2.62, 1.48], [-1.66, 1.36], [-0.68, 1.52], [0.42, 1.44], [1.54, 1.34], [2.6, 1.48], [3.42, 1.04]]
  })
]);

const ORGANIC_BRIDGES = Object.freeze([
  Object.freeze({
    seed: 4511,
    layer: 'rear',
    width: 0.72,
    depth: -1.48,
    opacity: 0.068,
    color: '#245d7e',
    nodeCount: 0,
    tissueBridge: true,
    points: [[-2.2, 1.02], [-1.38, 1.18], [-0.48, 1.08], [0.38, 1.16], [1.28, 1.05], [2.08, 0.9]]
  }),
  Object.freeze({
    seed: 4512,
    layer: 'mid',
    width: 0.68,
    depth: -0.82,
    opacity: 0.128,
    color: '#397f9e',
    nodeCount: 0,
    tissueBridge: true,
    points: [[-1.7, 0.54], [-1.14, 0.45], [-0.58, 0.28], [-0.04, 0.16], [0.54, 0.3], [1.18, 0.52]]
  }),
  Object.freeze({
    seed: 4513,
    layer: 'mid',
    width: 0.62,
    depth: -0.76,
    opacity: 0.122,
    color: '#28758e',
    nodeCount: 0,
    tissueBridge: true,
    points: [[-1.62, -0.7], [-1.06, -0.5], [-0.54, -0.32], [-0.04, -0.23], [0.54, -0.38], [1.22, -0.64], [1.84, -0.7]]
  }),
  Object.freeze({
    seed: 4514,
    layer: 'foreground',
    width: 0.78,
    depth: 0.82,
    opacity: 0.052,
    color: '#2e748b',
    nodeCount: 0,
    tissueBridge: true,
    points: [[-2.84, -1.34], [-2.08, -1.16], [-1.26, -1.02], [-0.42, -0.88], [0.38, -0.94]]
  }),
  Object.freeze({
    seed: 4515,
    layer: 'rear',
    width: 0.64,
    depth: -1.38,
    opacity: 0.074,
    color: '#23546f',
    nodeCount: 0,
    tissueBridge: true,
    points: [[1.38, 0.78], [1.72, 0.42], [1.9, 0.02], [1.96, -0.42], [1.78, -0.82]]
  })
]);

export function createGeoV4OrganicEnvironment(resources) {
  const group = new THREE.Group();
  const deepSpace = createDeepSpace();
  const farSignals = createFarSignals(resources.pointTexture, 286);
  const spatialGlows = createSpatialGlowFields(resources.hazeTexture);
  const sheets = createOrganicSheets(resources.pointTexture);

  group.name = 'GEO V4 Organic Neural Environment';
  deepSpace.mesh.renderOrder = -30;
  farSignals.points.renderOrder = -20;
  group.add(
    deepSpace.mesh,
    farSignals.points,
    spatialGlows.group,
    sheets.group
  );

  let debugLayer = 'full';
  applyDebugLayer();

  return {
    group,
    particleCount: farSignals.particleCount
      + sheets.particleCount,
    segmentCount: sheets.segmentCount,
    foregroundParticleCount: sheets.foregroundParticleCount,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyDebugLayer();
    },
    update(time, reveal, pointer = null) {
      const opacity = Math.max(0, Math.min(1, reveal));
      deepSpace.update(time, opacity);
      farSignals.material.uniforms.uOpacity.value = opacity * 0.23;
      farSignals.points.rotation.y = time * 0.0017;
      spatialGlows.update(opacity);
      sheets.update(time, opacity, pointer);
    },
    dispose() {
      deepSpace.dispose();
      farSignals.dispose();
      spatialGlows.dispose();
      sheets.dispose();
      group.clear();
    }
  };

  function applyDebugLayer() {
    const full = debugLayer === 'full';
    const organism = debugLayer === 'organism';
    deepSpace.mesh.visible = full
      || organism
      || debugLayer === 'environment'
      || debugLayer === 'rear'
      || debugLayer === 'mid'
      || debugLayer === 'foreground'
      || debugLayer === 'cavity'
      || debugLayer === 'surface'
      || debugLayer === 'cells'
      || debugLayer === 'fibers';
    farSignals.points.visible = full || organism || debugLayer === 'environment';
    spatialGlows.group.visible = full || organism || debugLayer === 'environment';
    sheets.group.visible = full
      || organism
      || debugLayer === 'environment'
      || debugLayer === 'rear'
      || debugLayer === 'mid'
      || debugLayer === 'foreground'
      || debugLayer === 'cavity'
      || debugLayer === 'surface'
      || debugLayer === 'cells'
      || debugLayer === 'fibers';
    sheets.setDebugLayer(debugLayer);
  }
}

function createSpatialGlowFields(texture) {
  const group = new THREE.Group();
  const cyanMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: '#147ca4',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const violetMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: '#5c69a8',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const definitions = [
    { position: [-1.55, 0.42, -0.82], scale: [2.9, 1.85], material: cyanMaterial },
    { position: [-0.08, -0.08, -0.96], scale: [2.15, 1.3], material: cyanMaterial },
    { position: [1.48, -0.52, -0.78], scale: [2.25, 1.35], material: cyanMaterial },
    { position: [1.43, 0.62, -0.92], scale: [2.45, 1.55], material: violetMaterial }
  ];
  definitions.forEach((definition, index) => {
    const sprite = new THREE.Sprite(definition.material);
    sprite.name = `GEO V4 Local Organic Light Field ${index + 1}`;
    sprite.position.set(...definition.position);
    sprite.scale.set(definition.scale[0], definition.scale[1], 1);
    sprite.renderOrder = -7;
    group.add(sprite);
  });
  return {
    group,
    update(reveal) {
      cyanMaterial.opacity = reveal * 0.105;
      violetMaterial.opacity = reveal * 0.058;
    },
    dispose() {
      cyanMaterial.dispose();
      violetMaterial.dispose();
      group.clear();
    }
  };
}

function createOrganicSheets(texture) {
  const group = new THREE.Group();
  const layerOrder = ['rear', 'mid', 'foreground'];
  const builders = Object.fromEntries(layerOrder.map((layer) => [layer, createMembraneBuilder()]));
  const layerGroups = Object.fromEntries(layerOrder.map((layer) => [layer, new THREE.Group()]));
  const layerObjects = {};
  const surfaceMaterials = Object.fromEntries(
    layerOrder.map((layer) => [layer, createOrganicSurfaceMaterial(layer)])
  );
  const cellMaterials = Object.fromEntries(
    layerOrder.map((layer) => [layer, createOrganicCellMaterial(layer)])
  );
  const fiberMaterial = createOrganicLineMaterial();
  const nodeMaterial = createOrganicPointMaterial(texture);
  const geometries = [];
  const ice = new THREE.Color('#b8f4ff');
  let segmentCount = 0;

  [...ORGANIC_SHEETS, ...ORGANIC_BRIDGES].forEach((definition, sheetIndex) => {
    const builder = builders[definition.layer];
    const random = seededRandom(definition.seed);
    const baseColor = new THREE.Color(definition.color);
    const curve = new THREE.CatmullRomCurve3(
      definition.points.map(([x, y], index) => new THREE.Vector3(
        x,
        y,
        definition.depth + Math.sin(index * 1.53 + sheetIndex * 0.8) * 0.1
      )),
      false,
      'catmullrom',
      0.42
    );
    appendSoftVeil(builder.surface, curve, definition, sheetIndex, random, baseColor, ice);
    const fibers = appendNeuralFibers(
      builder.fibers,
      curve,
      definition,
      sheetIndex,
      random,
      baseColor,
      ice
    );
    segmentCount += fibers.segmentCount;
    if (definition.nodeCount !== 0) {
      appendMembraneNodes(
        builder.nodes,
        fibers.curves,
        definition,
        sheetIndex,
        random,
        baseColor,
        ice
      );
    }
  });

  segmentCount += appendUnifiedTissueField(builders.mid, ice);
  segmentCount += appendOrganismCellularLace(builders.mid, ice);
  segmentCount += appendCoreCavityResponse(builders.mid, ice);

  layerOrder.forEach((layer, layerIndex) => {
    const builder = builders[layer];
    const surfaceGeometry = buildSurfaceGeometry(builder.surface);
    const fiberGeometry = buildFiberGeometry(builder.fibers);
    const nodeGeometry = buildNodeGeometry(builder.nodes);
    const surfaces = new THREE.Mesh(surfaceGeometry, surfaceMaterials[layer]);
    const cells = new THREE.Mesh(surfaceGeometry, cellMaterials[layer]);
    const fibers = new THREE.LineSegments(fiberGeometry, fiberMaterial);
    const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
    const renderBase = layer === 'rear' ? -12 : layer === 'mid' ? -4 : 16;

    surfaces.name = `GEO V4 ${layer} Soft Veil Surfaces`;
    cells.name = `GEO V4 ${layer} Cellular Web Boundaries`;
    fibers.name = `GEO V4 ${layer} Internal Neural Fibers`;
    nodes.name = `GEO V4 ${layer} Membrane Nodes`;
    surfaces.renderOrder = renderBase;
    cells.renderOrder = renderBase + 1;
    fibers.renderOrder = renderBase + 2;
    nodes.renderOrder = renderBase + 3;
    layerGroups[layer].name = `GEO V4 ${layer} Organic Membrane Depth Layer`;
    layerGroups[layer].add(surfaces, cells, fibers, nodes);
    layerObjects[layer] = { surfaces, cells, fibers, nodes };
    group.add(layerGroups[layer]);
    geometries.push(surfaceGeometry, fiberGeometry, nodeGeometry);
  });

  group.name = 'GEO V4 Soft Organic Membrane Depth Field';
  let debugLayer = 'full';
  let foregroundParticleCount = builders.foreground.nodes.positions.length / 3;

  return {
    group,
    particleCount: layerOrder.reduce(
      (total, layer) => total + builders[layer].nodes.positions.length / 3,
      0
    ),
    segmentCount,
    foregroundParticleCount,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyDebugLayer();
    },
    update(time, reveal, pointer) {
      layerOrder.forEach((layer) => {
        surfaceMaterials[layer].uniforms.uTime.value = time;
        surfaceMaterials[layer].uniforms.uOpacity.value = reveal;
        cellMaterials[layer].uniforms.uTime.value = time;
        cellMaterials[layer].uniforms.uOpacity.value = reveal;
      });
      fiberMaterial.uniforms.uTime.value = time;
      fiberMaterial.uniforms.uOpacity.value = reveal;
      nodeMaterial.uniforms.uTime.value = time;
      nodeMaterial.uniforms.uOpacity.value = reveal;
      const px = pointer?.x ?? 0;
      const py = pointer?.y ?? 0;
      const parallax = { rear: 0.012, mid: 0.03, foreground: 0.062 };
      layerOrder.forEach((layer) => {
        const layerGroup = layerGroups[layer];
        layerGroup.position.x += (px * parallax[layer] - layerGroup.position.x) * 0.028;
        layerGroup.position.y += (-py * parallax[layer] * 0.68 - layerGroup.position.y) * 0.028;
      });
    },
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      Object.values(surfaceMaterials).forEach((material) => material.dispose());
      Object.values(cellMaterials).forEach((material) => material.dispose());
      fiberMaterial.dispose();
      nodeMaterial.dispose();
      group.clear();
    }
  };

  function applyDebugLayer() {
    const showAll = debugLayer === 'full'
      || debugLayer === 'environment'
      || debugLayer === 'organism';
    const componentLayer = ['surface', 'cells', 'fibers'].includes(debugLayer);
    layerOrder.forEach((layer) => {
      const layerSelected = debugLayer === layer
        || (debugLayer === 'cavity' && layer === 'mid');
      layerGroups[layer].visible = showAll || componentLayer || layerSelected;
      const objects = layerObjects[layer];
      objects.surfaces.visible = showAll
        || layerSelected
        || debugLayer === 'surface';
      objects.cells.visible = showAll
        || layerSelected
        || debugLayer === 'cells';
      objects.fibers.visible = showAll
        || layerSelected
        || debugLayer === 'fibers';
      objects.nodes.visible = showAll
        || layerSelected
        || debugLayer === 'fibers';
    });
  }
}

function createOrganicSurfaceMaterial(layer) {
  const layerSettings = {
    rear: { intensity: 1.02, motion: 0.34, cellDetail: 0.44 },
    mid: { intensity: 1.34, motion: 0.68, cellDetail: 0.82 },
    foreground: { intensity: 0.9, motion: 0.94, cellDetail: 0.24 }
  }[layer];
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uLayerIntensity: { value: layerSettings.intensity },
      uMotionScale: { value: layerSettings.motion },
      uCellDetail: { value: layerSettings.cellDetail }
    },
    vertexShader: `
      attribute float aAcross;
      attribute float aAlong;
      attribute float aPhase;
      attribute float aAlpha;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying float vAcross;
      varying float vAlong;
      varying float vPhase;
      varying float vAlpha;
      varying vec3 vLocalPosition;
      uniform float uTime;
      uniform float uMotionScale;
      void main() {
        vec3 displaced = position;
        float lowWave = sin(uTime * 0.016 * uMotionScale + aPhase + position.x * 0.31)
          + cos(uTime * 0.012 * uMotionScale + aPhase * 0.7 + position.y * 0.39);
        displaced.z += lowWave * 0.0065 * uMotionScale;
        displaced.xy += normal.xy * lowWave * 0.0018 * uMotionScale;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vColor = color;
        vNormal = normalize(normalMatrix * normal);
        vViewPosition = viewPosition.xyz;
        vAcross = aAcross;
        vAlong = aAlong;
        vPhase = aPhase;
        vAlpha = aAlpha;
        vLocalPosition = displaced;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uLayerIntensity;
      uniform float uCellDetail;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying float vAcross;
      varying float vAlong;
      varying float vPhase;
      varying float vAlpha;
      varying vec3 vLocalPosition;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      vec2 hash22(vec2 p) {
        float n = sin(dot(p, vec2(41.0, 289.0)));
        return fract(vec2(262144.0, 32768.0) * n);
      }
      vec3 cellular(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float nearest = 8.0;
        float second = 8.0;
        float cellId = 0.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 feature = offset + hash22(cell + offset);
            feature += 0.16 * sin(vec2(1.7, 2.1) * vPhase + feature.yx * 4.6);
            float distanceToFeature = length(feature - local);
            if (distanceToFeature < nearest) {
              second = nearest;
              nearest = distanceToFeature;
              cellId = hash(cell + offset);
            } else if (distanceToFeature < second) {
              second = distanceToFeature;
            }
          }
        }
        return vec3(nearest, second, cellId);
      }
      void main() {
        float sideFeather = 1.0 - smoothstep(0.76, 1.0, abs(vAcross));
        float endFeather = smoothstep(0.0, 0.09, vAlong)
          * (1.0 - smoothstep(0.9, 1.0, vAlong));
        float broadNoise = noise(vec2(vAlong * 2.05 + vPhase, vAcross * 1.02 - vPhase * 0.23));
        float warpedNoise = noise(vec2(
          vAlong * 4.1 - vAcross * 0.68 + vPhase * 0.61,
          vAcross * 1.78 + vAlong * 0.8 - vPhase
        ));
        float detailNoise = noise(vec2(
          vAlong * 8.1 + warpedNoise * 1.55,
          vAcross * 3.2 - broadNoise * 1.2 + vPhase * 0.18
        ));
        float attraction = 1.0 - smoothstep(
          0.28,
          2.15,
          distance(vLocalPosition.xy, vec2(-0.02, -0.14))
        );
        float cellFrequency = mix(1.0, 1.28, attraction);
        vec2 cellUv = vec2(
          vAlong * 12.2 * cellFrequency,
          (vAcross + warpedNoise * 0.12) * 4.5 * cellFrequency
        );
        vec2 cellWarp = vec2(
          noise(cellUv * 0.31 + vec2(vPhase, -vPhase * 0.4)),
          noise(cellUv.yx * 0.37 + vec2(-vPhase * 0.5, vPhase))
        ) - 0.5;
        vec2 organicCellUv = cellUv + vec2(
          sin(cellUv.y * 0.72 + vPhase) * 0.52,
          sin(cellUv.x * 0.48 - vPhase * 0.8) * 0.4
        ) + cellWarp * 1.32;
        vec3 cellData = cellular(
          organicCellUv + vec2(vPhase * 0.37, -vPhase * 0.19)
        );
        float cellDistance = cellData.y - cellData.x;
        float cellEdge = 1.0 - smoothstep(0.035, 0.15, cellDistance);
        float clusterA = 1.0 - smoothstep(
          0.24,
          0.5,
          length(vec2(vAlong - (0.29 + 0.055 * sin(vPhase)), (vAcross + 0.26) * 0.56))
        );
        float clusterB = 1.0 - smoothstep(
          0.22,
          0.46,
          length(vec2(vAlong - (0.62 + 0.045 * cos(vPhase)), (vAcross - 0.14) * 0.62))
        );
        float clusterC = 1.0 - smoothstep(
          0.17,
          0.36,
          length(vec2(vAlong - 0.82, (vAcross + 0.38 * sin(vPhase * 0.7)) * 0.72))
        );
        float cellRegion = max(max(clusterA, clusterB), clusterC)
          * smoothstep(0.34, 0.56, broadNoise * 0.55 + warpedNoise * 0.45)
          * uCellDetail;
        float porousField = broadNoise * 0.58 + warpedNoise * 0.42;
        float largeOpening = smoothstep(0.56, 0.7, porousField)
          * smoothstep(0.3, 0.72, cellData.x);
        float smallOpening = smoothstep(0.67, 0.8, detailNoise)
          * smoothstep(0.34, 0.68, cellData.x)
          * cellRegion;
        float holeMask = clamp(max(largeOpening * 0.88, smallOpening * 0.72), 0.0, 0.94);
        float softHoleMask = 1.0 - holeMask;
        float openingRim = (1.0 - smoothstep(0.035, 0.13, abs(porousField - 0.625)))
          * smoothstep(0.28, 0.76, detailNoise)
          * (0.32 + cellRegion * 0.68);
        float membraneVariation = 0.42
          + smoothstep(0.2, 0.82, detailNoise) * 0.28
          + smoothstep(0.36, 0.76, broadNoise) * 0.3;
        float viewEdge = pow(
          1.0 - abs(dot(normalize(vNormal), normalize(-vViewPosition))),
          2.25
        );
        float geometricEdge = smoothstep(0.58, 0.84, abs(vAcross))
          * (1.0 - smoothstep(0.9, 1.0, abs(vAcross)));
        float edgeNoise = noise(vec2(vAlong * 9.6 + vPhase * 1.7, vAcross * 2.4));
        float brokenEdge = geometricEdge * smoothstep(0.66, 0.82, edgeNoise);
        float curvatureLight = viewEdge
          * smoothstep(0.58, 0.8, noise(vec2(vAlong * 5.7 - vPhase, vAcross * 2.2)));
        float localCell = cellEdge * cellRegion
          * smoothstep(0.1, 0.88, vAlong)
          * (1.0 - smoothstep(0.9, 1.0, vAlong));
        float alpha = uOpacity
          * vAlpha
          * uLayerIntensity
          * sideFeather
          * endFeather
          * softHoleMask
          * membraneVariation;
        alpha *= 0.62
          + localCell * 1.05
          + openingRim * 0.22
          + curvatureLight * 0.18
          + brokenEdge * 0.11;
        if (alpha < 0.002) discard;
        vec3 color = mix(
          vColor,
          vec3(0.62, 0.92, 1.0),
          min(
            0.58,
            curvatureLight * 0.12
              + localCell * 0.26
              + openingRim * 0.13
              + brokenEdge * 0.035
          )
        );
        color *= 0.82 + membraneVariation * 0.2 + curvatureLight * 0.11;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createMembraneBuilder() {
  return {
    surface: {
      positions: [],
      colors: [],
      across: [],
      along: [],
      phases: [],
      alphas: [],
      indices: []
    },
    fibers: {
      positions: [],
      colors: [],
      phases: [],
      strengths: []
    },
    nodes: {
      positions: [],
      colors: [],
      sizes: [],
      phases: [],
      strengths: []
    }
  };
}

function appendSoftVeil(surface, curve, definition, sheetIndex, random, baseColor, ice) {
  const columns = 44;
  const rows = 8;
  const baseIndex = surface.positions.length / 3;
  const color = new THREE.Color();

  for (let column = 0; column <= columns; column += 1) {
    const t = column / columns;
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const lateralAxis = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const taper = Math.pow(Math.sin(Math.PI * t), 0.62);
    const width = definition.width
      * (0.18 + taper * 0.82)
      * (0.9 + Math.sin(t * 7.2 + sheetIndex * 0.9) * 0.1);

    for (let row = 0; row <= rows; row += 1) {
      const across = row / rows * 2 - 1;
      const organicOffset = Math.sin(t * 10.1 + across * 2.4 + sheetIndex) * 0.055
        + Math.sin(t * 4.7 - across * 3.1 + sheetIndex * 0.7) * 0.035;
      const point = center.clone().addScaledVector(
        lateralAxis,
        across * width + organicOffset
      );
      point.z += Math.sin(across * Math.PI) * 0.055
        + Math.cos(t * 8.4 + across + sheetIndex) * 0.025
        + (random() - 0.5) * 0.012;
      color.copy(baseColor).lerp(ice, 0.08 + (1 - Math.abs(across)) * 0.22);
      surface.positions.push(point.x, point.y, point.z);
      surface.colors.push(color.r, color.g, color.b);
      surface.across.push(across);
      surface.along.push(t);
      surface.phases.push(sheetIndex * 1.37);
      surface.alphas.push(definition.opacity * (0.84 + random() * 0.16));
    }
  }

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const a = baseIndex + column * (rows + 1) + row;
      const b = a + rows + 1;
      const c = a + 1;
      const d = b + 1;
      surface.indices.push(a, b, c, b, d, c);
    }
  }
}

function appendNeuralFibers(fibers, curve, definition, sheetIndex, random, baseColor, ice) {
  const mainCount = definition.tissueBridge
    ? 1
    : definition.layer === 'mid'
      ? 3
      : 1;
  const layerStrength = definition.layer === 'rear'
    ? 0.5
    : definition.layer === 'foreground'
      ? 0.34
      : 1;
  const bridgeStrength = definition.tissueBridge ? 0.48 : 1;
  const curves = [];
  let segmentCount = 0;

  const pointOnMembrane = (t, across, zLift = 0) => {
    const center = curve.getPoint(THREE.MathUtils.clamp(t, 0.02, 0.98));
    const tangent = curve.getTangent(THREE.MathUtils.clamp(t, 0.02, 0.98));
    const lateralAxis = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const taper = Math.pow(Math.sin(Math.PI * t), 0.68);
    const width = definition.width * (0.17 + taper * 0.83);
    return center
      .clone()
      .addScaledVector(lateralAxis, THREE.MathUtils.clamp(across, -0.84, 0.84) * width)
      .add(new THREE.Vector3(0, 0, zLift));
  };

  const appendCurve = (fiberCurve, tier, index, strengthScale = 1) => {
    curves.push(fiberCurve);
    const samples = tier === 'main' ? 34 : tier === 'branch' ? 16 : 8;
    const baseStrength = tier === 'main' ? 0.21 : tier === 'branch' ? 0.083 : 0.024;
    const color = baseColor.clone().lerp(
      ice,
      tier === 'main' ? 0.48 : tier === 'branch' ? 0.24 : 0.1
    );
    for (let sample = 0; sample < samples; sample += 1) {
      const gapPeriod = tier === 'main' ? 15 : tier === 'branch' ? 8 : 5;
      if ((sample + index * 3 + sheetIndex * 2) % gapPeriod === gapPeriod - 2) continue;
      if (tier === 'micro' && (sample + index) % 3 === 1) continue;
      appendFiberSegment(
        fibers,
        fiberCurve.getPoint(sample / samples),
        fiberCurve.getPoint(Math.min(1, (sample + (tier === 'micro' ? 0.66 : 0.9)) / samples)),
        color,
        sheetIndex * 1.87 + index * 0.43 + sample * 0.037,
        baseStrength
          * layerStrength
          * bridgeStrength
          * strengthScale
          * (0.86 + random() * 0.2)
      );
      segmentCount += 1;
    }
  };

  for (let mainIndex = 0; mainIndex < mainCount; mainIndex += 1) {
    const tStart = 0.035 + random() * 0.055;
    const tEnd = 0.91 + random() * 0.045;
    const sourceAcross = mainCount === 1
      ? -0.16 + random() * 0.32
      : -0.48 + mainIndex * (0.96 / Math.max(1, mainCount - 1)) + (random() - 0.5) * 0.1;
    const targetAcross = definition.coreAt === 'start' || definition.coreAt === 'end'
      ? sourceAcross * 0.16
      : sourceAcross * 0.58;
    const mainPoints = [];

    for (let controlIndex = 0; controlIndex < 10; controlIndex += 1) {
      const localT = controlIndex / 9;
      const t = tStart + (tEnd - tStart) * localT;
      const convergence = THREE.MathUtils.smoothstep(localT, 0.42, 1);
      const across = THREE.MathUtils.lerp(sourceAcross, targetAcross, convergence)
        + Math.sin(localT * 4.6 + mainIndex * 1.7 + sheetIndex) * 0.1
        + Math.sin(localT * 9.2 + sheetIndex * 0.6) * 0.025;
      const point = pointOnMembrane(t, across, 0.008);
      point.z += Math.sin(localT * 5.2 + mainIndex) * 0.025;
      mainPoints.push(point);
    }

    const mainCurve = new THREE.CatmullRomCurve3(mainPoints, false, 'catmullrom', 0.38);
    appendCurve(mainCurve, 'main', mainIndex);

    const branchCount = definition.tissueBridge ? 1 : definition.layer === 'mid' ? 2 : 1;
    for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
      const branchOrigin = 0.24 + branchIndex * 0.25 + random() * 0.1;
      const origin = mainCurve.getPoint(branchOrigin);
      const direction = (branchIndex + mainIndex + sheetIndex) % 2 === 0 ? 1 : -1;
      const branchSpan = 0.16 + random() * 0.14;
      const branchAcross = sourceAcross + direction * (0.28 + random() * 0.24);
      const branchT = THREE.MathUtils.clamp(
        tStart + (tEnd - tStart) * (branchOrigin + branchSpan),
        0.08,
        0.94
      );
      const end = pointOnMembrane(branchT, branchAcross, 0.01);
      const middleA = origin.clone().lerp(end, 0.36);
      const middleB = origin.clone().lerp(end, 0.72);
      middleA.y += direction * (0.055 + random() * 0.04);
      middleA.z += 0.025;
      middleB.x += direction * (0.035 + random() * 0.04);
      middleB.z += 0.016;
      const branchCurve = new THREE.CatmullRomCurve3(
        [origin, middleA, middleB, end],
        false,
        'catmullrom',
        0.36
      );
      appendCurve(branchCurve, 'branch', mainCount + mainIndex * 3 + branchIndex);

      if (!definition.tissueBridge && definition.layer === 'mid') {
        const twigOrigin = branchCurve.getPoint(0.58);
        const twigEnd = pointOnMembrane(
          Math.min(0.96, branchT + 0.08 + random() * 0.07),
          branchAcross + direction * (0.12 + random() * 0.13),
          0.006
        );
        const twigMiddle = twigOrigin.clone().lerp(twigEnd, 0.54);
        twigMiddle.y -= direction * 0.035;
        twigMiddle.z += 0.012;
        appendCurve(
          new THREE.CatmullRomCurve3(
            [twigOrigin, twigMiddle, twigEnd],
            false,
            'catmullrom',
            0.34
          ),
          'micro',
          mainCount * 4 + mainIndex * 3 + branchIndex,
          0.9
        );
      }
    }
  }

  return { curves, segmentCount };
}

function appendMembraneNodes(nodes, curves, definition, sheetIndex, random, baseColor, ice) {
  const count = definition.layer === 'rear' ? 18 : definition.layer === 'foreground' ? 14 : 27;
  for (let index = 0; index < count; index += 1) {
    const curve = curves[Math.floor(random() * curves.length)];
    const cluster = index % 3 === 0 ? 0.28 : index % 3 === 1 ? 0.56 : 0.78;
    const t = Math.max(0.06, Math.min(0.94, cluster + (random() - 0.5) * 0.22));
    const point = curve.getPoint(t);
    point.z += (random() - 0.5) * 0.028;
    const highlight = index % 19 === 0;
    const color = baseColor.clone().lerp(ice, highlight ? 0.64 : 0.16 + random() * 0.24);
    const layerStrength = definition.layer === 'rear'
      ? 0.54
      : definition.layer === 'foreground'
        ? 0.42
        : 1;
    nodes.positions.push(point.x, point.y, point.z);
    nodes.colors.push(color.r, color.g, color.b);
    nodes.sizes.push((highlight ? 1.62 : 0.68 + random() * 0.62) * layerStrength);
    nodes.phases.push(sheetIndex * 1.7 + random() * Math.PI * 2);
    nodes.strengths.push(
      (highlight ? 0.3 : 0.12 + random() * 0.078) * layerStrength
    );
  }
}

function appendCoreCavityResponse(builder, ice) {
  const colorA = new THREE.Color('#2aa9ca');
  const center = new THREE.Vector3(-0.02, -0.14, -0.38);
  const random = seededRandom(4477);
  const sources = [
    [-1.62, 0.66, -0.5],
    [-1.24, 0.18, -0.44],
    [-0.86, -0.58, -0.48],
    [0.72, 0.66, -0.5],
    [1.32, 0.3, -0.55],
    [1.28, -0.66, -0.42],
    [0.72, -0.82, -0.36],
    [-0.56, 0.78, -0.62],
    [0.44, 0.9, -0.64]
  ];
  let segmentCount = 0;

  sources.forEach((source, sourceIndex) => {
    const start = new THREE.Vector3(...source);
    const endAngle = sourceIndex * 1.91 + 0.4;
    const end = center.clone().add(new THREE.Vector3(
      Math.cos(endAngle) * (0.18 + random() * 0.1),
      Math.sin(endAngle) * (0.12 + random() * 0.08),
      (random() - 0.5) * 0.1
    ));
    const middleA = start.clone().lerp(center, 0.42);
    const middleB = start.clone().lerp(center, 0.72);
    const bend = sourceIndex % 2 === 0 ? 1 : -1;
    middleA.y += bend * (0.12 + random() * 0.08);
    middleB.x += bend * (0.08 + random() * 0.06);
    middleB.z += 0.06;
    const curve = new THREE.CatmullRomCurve3(
      [start, middleA, middleB, end],
      false,
      'catmullrom',
      0.38
    );
    const color = colorA.clone().lerp(ice, 0.32 + random() * 0.3);
    const samples = 18;
    for (let sample = 0; sample < samples; sample += 1) {
      if ((sample + sourceIndex * 3) % 13 === 7) continue;
      appendFiberSegment(
        builder.fibers,
        curve.getPoint(sample / samples),
        curve.getPoint((sample + 0.72) / samples),
        color,
        sourceIndex * 0.72 + sample * 0.08,
        sample > 10 ? 0.17 : 0.075 + sample * 0.005
      );
      segmentCount += 1;
    }
    if (sourceIndex % 2 === 0) {
      const node = curve.getPoint(0.78 + random() * 0.12);
      builder.nodes.positions.push(node.x, node.y, node.z);
      builder.nodes.colors.push(color.r, color.g, color.b);
      builder.nodes.sizes.push(0.72 + random() * 0.4);
      builder.nodes.phases.push(sourceIndex * 0.8);
      builder.nodes.strengths.push(0.1 + random() * 0.04);
    }
  });

  return segmentCount;
}

function appendUnifiedTissueField(builder, ice) {
  const regionColors = {
    answer: new THREE.Color('#4cbfe0'),
    citation: new THREE.Color('#7faecf'),
    keyword: new THREE.Color('#21a8c2')
  };
  const random = seededRandom(4589);
  let segmentCount = 0;

  ['answer', 'citation', 'keyword'].forEach((key, regionIndex) => {
    GEO_V4_TISSUE_FIELD[key].branches.forEach((points, branchIndex) => {
      const curve = createGeoV4TissueCurve(points);
      const samples = branchIndex === GEO_V4_TISSUE_FIELD[key].branches.length - 1 ? 22 : 16;
      const color = regionColors[key].clone().lerp(
        ice,
        branchIndex === GEO_V4_TISSUE_FIELD[key].branches.length - 1 ? 0.38 : 0.16
      );
      for (let sample = 0; sample < samples; sample += 1) {
        if ((sample + branchIndex * 3 + regionIndex * 5) % 11 === 7) continue;
        const t0 = sample / samples;
        const t1 = Math.min(1, (sample + 0.76) / samples);
        const a = curve.getPoint(t0);
        const b = curve.getPoint(t1);
        const convergence = 1 - Math.min(1, a.distanceTo(
          new THREE.Vector3(...GEO_V4_TISSUE_FIELD.center)
        ) / 2.4);
        appendFiberSegment(
          builder.fibers,
          a,
          b,
          color,
          8.3 + regionIndex * 2.1 + branchIndex * 0.37 + sample * 0.04,
          (0.028 + convergence * 0.035) * (0.88 + random() * 0.24)
        );
        segmentCount += 1;
      }

      const nodeCount = branchIndex < 3 ? 4 : 2;
      for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
        const t = 0.16 + (nodeIndex + 0.5) / nodeCount * 0.68 + (random() - 0.5) * 0.07;
        const point = curve.getPoint(THREE.MathUtils.clamp(t, 0.08, 0.94));
        builder.nodes.positions.push(point.x, point.y, point.z + 0.006);
        builder.nodes.colors.push(color.r, color.g, color.b);
        builder.nodes.sizes.push(0.48 + random() * 0.42);
        builder.nodes.phases.push(regionIndex * 2.4 + branchIndex * 0.51 + nodeIndex);
        builder.nodes.strengths.push(0.055 + random() * 0.04);
      }
    });
  });

  return segmentCount;
}

function appendOrganismCellularLace(builder, ice) {
  const random = seededRandom(4627);
  const regions = [
    {
      color: new THREE.Color('#4db9d7'),
      centers: [
        [-2.34, 0.68, -0.5], [-2.08, 0.86, -0.46], [-1.84, 0.76, -0.36],
        [-2.42, 0.34, -0.46], [-2.12, 0.42, -0.34], [-1.82, 0.48, -0.26],
        [-2.22, 0.12, -0.4], [-1.94, 0.2, -0.31], [-1.66, 0.34, -0.24],
        [-1.5, 0.58, -0.29], [-1.38, 0.16, -0.3]
      ],
      scale: 1.08,
      phase: 0.4
    },
    {
      color: new THREE.Color('#7398c0'),
      centers: [
        [2.34, 0.98, -0.51], [2.06, 1.04, -0.46], [1.78, 0.9, -0.36],
        [2.4, 0.64, -0.48], [2.12, 0.62, -0.4], [1.84, 0.62, -0.31],
        [2.1, 0.3, -0.4], [1.82, 0.34, -0.32], [1.56, 0.48, -0.27]
      ],
      scale: 0.92,
      phase: 2.1
    },
    {
      color: new THREE.Color('#238fa9'),
      centers: [
        [2.42, -0.92, -0.48], [2.12, -0.86, -0.39], [1.82, -0.72, -0.29],
        [2.44, -0.52, -0.46], [2.12, -0.54, -0.35], [1.78, -0.54, -0.25],
        [1.52, -0.48, -0.23], [1.28, -0.34, -0.27], [1.02, -0.3, -0.3]
      ],
      scale: 0.96,
      phase: 4.2
    },
    {
      color: new THREE.Color('#2b7994'),
      centers: [
        [-0.92, 0.2, -0.38], [-0.68, 0.08, -0.35], [-0.46, 0.02, -0.34],
        [0.88, 0.24, -0.38], [0.64, 0.1, -0.35], [0.42, 0.01, -0.34],
        [0.78, -0.36, -0.36], [0.54, -0.25, -0.34], [0.34, -0.18, -0.33]
      ],
      scale: 0.7,
      phase: 6.4
    }
  ];
  let segmentCount = 0;

  regions.forEach((region, regionIndex) => {
    region.centers.forEach((coords, cellIndex) => {
      const center = new THREE.Vector3(...coords);
      const radiusX = (0.11 + random() * 0.11) * region.scale;
      const radiusY = (0.075 + random() * 0.09) * region.scale;
      const rotation = (random() - 0.5) * 1.4;
      const controlPoints = [];
      const controlCount = 9;
      for (let controlIndex = 0; controlIndex < controlCount; controlIndex += 1) {
        const angle = controlIndex / controlCount * Math.PI * 2;
        const irregularity = 0.74 + random() * 0.46;
        const x = Math.cos(angle) * radiusX * irregularity;
        const y = Math.sin(angle) * radiusY * (0.78 + random() * 0.42);
        controlPoints.push(new THREE.Vector3(
          center.x + x * Math.cos(rotation) - y * Math.sin(rotation),
          center.y + x * Math.sin(rotation) + y * Math.cos(rotation),
          center.z + Math.sin(angle * 2.3 + region.phase) * 0.025
        ));
      }
      const curve = new THREE.CatmullRomCurve3(
        controlPoints,
        true,
        'catmullrom',
        0.34
      );
      const samples = 18;
      const color = region.color.clone().lerp(ice, 0.08 + random() * 0.24);
      for (let sample = 0; sample < samples; sample += 1) {
        const gapSeed = (sample + cellIndex * 5 + regionIndex * 7) % 17;
        if (gapSeed >= 11 || (sample + cellIndex) % 9 === 4) continue;
        appendFiberSegment(
          builder.fibers,
          curve.getPoint(sample / samples),
          curve.getPoint((sample + 0.74) / samples),
          color,
          11.4 + region.phase + cellIndex * 0.29 + sample * 0.031,
          (0.075 + random() * 0.085) * (regionIndex === 3 ? 0.72 : 1)
        );
        segmentCount += 1;
      }

      if ((cellIndex + regionIndex) % 3 === 0) {
        const point = curve.getPoint(0.16 + random() * 0.68);
        builder.nodes.positions.push(point.x, point.y, point.z);
        builder.nodes.colors.push(color.r, color.g, color.b);
        builder.nodes.sizes.push(0.42 + random() * 0.5);
        builder.nodes.phases.push(region.phase + cellIndex * 0.4);
        builder.nodes.strengths.push(0.08 + random() * 0.055);
      }
    });
  });

  return segmentCount;
}

function appendFiberSegment(target, a, b, color, phase, strength) {
  target.positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  target.colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  target.phases.push(phase, phase + 0.09);
  target.strengths.push(strength, strength);
}

function buildSurfaceGeometry(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setAttribute('aAcross', new THREE.Float32BufferAttribute(data.across, 1));
  geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(data.along, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(data.phases, 1));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(data.alphas, 1));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildFiberGeometry(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(data.phases, 1));
  geometry.setAttribute('aStrength', new THREE.Float32BufferAttribute(data.strengths, 1));
  return geometry;
}

function buildNodeGeometry(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(data.sizes, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(data.phases, 1));
  geometry.setAttribute('aStrength', new THREE.Float32BufferAttribute(data.strengths, 1));
  return geometry;
}

function createDeepSpace() {
  const geometry = new THREE.SphereGeometry(18, 30, 20);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uDeep: { value: new THREE.Color('#010914') },
      uNavy: { value: new THREE.Color('#03203a') },
      uBlue: { value: new THREE.Color('#063f60') }
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uDeep;
      uniform vec3 uNavy;
      uniform vec3 uBlue;
      varying vec3 vDirection;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.13);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }
      void main() {
        vec3 direction = normalize(vDirection);
        float broad = noise(direction * 2.1 + vec3(uTime * 0.001, 0.0, -uTime * 0.0007));
        float detail = noise(direction * 5.2 - vec3(0.0, uTime * 0.0014, 0.0));
        float field = smoothstep(0.4, 0.83, broad * 0.78 + detail * 0.22);
        float centralAir = smoothstep(0.08, 0.88, length(direction.xy));
        vec3 color = mix(uDeep, uNavy, field * 0.62);
        color = mix(color, uBlue, field * field * 0.17);
        color *= 0.76 + centralAir * 0.24;
        gl_FragColor = vec4(color, uOpacity);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'GEO V4 Deep Navy Organic Space';
  return {
    mesh,
    update(time, opacity) {
      material.uniforms.uTime.value = time;
      material.uniforms.uOpacity.value = opacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createFarSignals(texture, count) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const random = seededRandom(4499);
  const colorA = new THREE.Color('#214f78');
  const colorB = new THREE.Color('#86dcff');
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    positions[stride] = (random() - 0.5) * 9.4;
    positions[stride + 1] = (random() - 0.5) * 5.2;
    positions[stride + 2] = -2.2 - random() * 6.8;
    color.copy(colorA).lerp(colorB, random() * 0.38);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 53 === 0 ? 1.65 : 0.42 + random() * 0.68;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0.23);
  const points = new THREE.Points(geometry, material);

  points.name = 'GEO V4 Sparse Deep Neural Signals';
  return {
    points,
    material,
    particleCount: count,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createOrganicLineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aStrength;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      void main() {
        float drift = sin(uTime * 0.038 + aPhase + position.x * 0.31) * 0.007;
        vec3 displaced = position + vec3(drift * 0.22, drift * 0.4, drift);
        vColor = color;
        vAlpha = aStrength * (0.86 + sin(aPhase * 1.7 + uTime * 0.075) * 0.14);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(vColor, uOpacity * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createOrganicCellMaterial(layer) {
  const layerSettings = {
    rear: { intensity: 0.82, motion: 0.34, detail: 0.42 },
    mid: { intensity: 1.5, motion: 0.68, detail: 0.92 },
    foreground: { intensity: 0.28, motion: 0.94, detail: 0.25 }
  }[layer];
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uLayerIntensity: { value: layerSettings.intensity },
      uMotionScale: { value: layerSettings.motion },
      uCellDetail: { value: layerSettings.detail }
    },
    vertexShader: `
      attribute float aAcross;
      attribute float aAlong;
      attribute float aPhase;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAcross;
      varying float vAlong;
      varying float vPhase;
      varying float vAlpha;
      varying vec3 vLocalPosition;
      uniform float uTime;
      uniform float uMotionScale;
      void main() {
        vec3 displaced = position;
        float lowWave = sin(uTime * 0.016 * uMotionScale + aPhase + position.x * 0.31)
          + cos(uTime * 0.012 * uMotionScale + aPhase * 0.7 + position.y * 0.39);
        displaced.z += lowWave * 0.0065 * uMotionScale;
        displaced.xy += normal.xy * lowWave * 0.0018 * uMotionScale;
        vColor = color;
        vAcross = aAcross;
        vAlong = aAlong;
        vPhase = aPhase;
        vAlpha = aAlpha;
        vLocalPosition = displaced;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uLayerIntensity;
      uniform float uCellDetail;
      varying vec3 vColor;
      varying float vAcross;
      varying float vAlong;
      varying float vPhase;
      varying float vAlpha;
      varying vec3 vLocalPosition;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      vec2 hash22(vec2 p) {
        float n = sin(dot(p, vec2(41.0, 289.0)));
        return fract(vec2(262144.0, 32768.0) * n);
      }
      vec3 cellular(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float nearest = 8.0;
        float second = 8.0;
        float cellId = 0.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 feature = offset + hash22(cell + offset);
            feature += 0.14 * sin(vec2(1.7, 2.1) * vPhase + feature.yx * 4.6);
            float distanceToFeature = length(feature - local);
            if (distanceToFeature < nearest) {
              second = nearest;
              nearest = distanceToFeature;
              cellId = hash(cell + offset);
            } else if (distanceToFeature < second) {
              second = distanceToFeature;
            }
          }
        }
        return vec3(nearest, second, cellId);
      }
      void main() {
        float sideFeather = 1.0 - smoothstep(0.72, 0.98, abs(vAcross));
        float endFeather = smoothstep(0.04, 0.13, vAlong)
          * (1.0 - smoothstep(0.87, 0.97, vAlong));
        float broadNoise = noise(vec2(vAlong * 2.05 + vPhase, vAcross * 1.02 - vPhase * 0.23));
        float warpedNoise = noise(vec2(
          vAlong * 4.1 - vAcross * 0.68 + vPhase * 0.61,
          vAcross * 1.78 + vAlong * 0.8 - vPhase
        ));
        float attraction = 1.0 - smoothstep(
          0.28,
          2.15,
          distance(vLocalPosition.xy, vec2(-0.02, -0.14))
        );
        float frequency = mix(1.0, 1.26, attraction);
        vec2 cellUv = vec2(
          vAlong * 13.2 * frequency,
          (vAcross + warpedNoise * 0.12) * 4.85 * frequency
        );
        vec2 cellWarp = vec2(
          noise(cellUv * 0.31 + vec2(vPhase, -vPhase * 0.4)),
          noise(cellUv.yx * 0.37 + vec2(-vPhase * 0.5, vPhase))
        ) - 0.5;
        vec2 organicCellUv = cellUv + vec2(
          sin(cellUv.y * 0.72 + vPhase) * 0.58,
          sin(cellUv.x * 0.48 - vPhase * 0.8) * 0.44
        ) + cellWarp * 1.42;
        vec3 cellData = cellular(
          organicCellUv + vec2(vPhase * 0.37, -vPhase * 0.19)
        );
        float cellEdge = 1.0 - smoothstep(0.018, 0.062, cellData.y - cellData.x);
        float clusterA = 1.0 - smoothstep(
          0.22,
          0.49,
          length(vec2(vAlong - (0.29 + 0.055 * sin(vPhase)), (vAcross + 0.26) * 0.56))
        );
        float clusterB = 1.0 - smoothstep(
          0.2,
          0.45,
          length(vec2(vAlong - (0.62 + 0.045 * cos(vPhase)), (vAcross - 0.14) * 0.62))
        );
        float clusterC = 1.0 - smoothstep(
          0.16,
          0.35,
          length(vec2(vAlong - 0.82, (vAcross + 0.38 * sin(vPhase * 0.7)) * 0.72))
        );
        float tissueCluster = max(max(clusterA, clusterB), clusterC) * uCellDetail;
        float localContinuity = smoothstep(
          0.28,
          0.58,
          broadNoise * 0.52 + warpedNoise * 0.48
        );
        float edgeBreakup = smoothstep(
          0.54,
          0.76,
          noise(vec2(vAlong * 12.2 + vPhase * 1.8, vAcross * 4.2 - vPhase))
        );
        float partialBoundary = mix(0.01, 1.0, edgeBreakup);
        float membraneBody = 0.34 + localContinuity * 0.66;
        float alpha = uOpacity
          * vAlpha
          * uLayerIntensity
          * sideFeather
          * endFeather
          * tissueCluster
          * membraneBody
          * cellEdge
          * partialBoundary
          * 1.65;
        if (alpha < 0.003) discard;
        float coreTint = attraction * 0.2;
        vec3 cellColor = mix(vColor, vec3(0.7, 0.94, 1.0), 0.26 + coreTint);
        gl_FragColor = vec4(cellColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createOrganicPointMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute float aStrength;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      void main() {
        float drift = sin(uTime * 0.032 + aPhase + position.y * 0.28) * 0.006;
        vec3 displaced = position + vec3(drift * 0.18, drift * 0.36, drift);
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vColor = color;
        vAlpha = aStrength * (0.88 + sin(uTime * 0.12 + aPhase * 2.1) * 0.12);
        gl_PointSize = aSize * (13.2 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a * uOpacity * vAlpha;
        if (alpha < 0.01) discard;
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
