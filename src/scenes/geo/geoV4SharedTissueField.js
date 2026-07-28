import * as THREE from 'three';
import { seededRandom } from './geoSignalCore.js';

export const GEO_V4_SHARED_CORE = Object.freeze([-0.02, -0.14, -0.34]);

export const GEO_V4_BUSINESS_REGIONS = Object.freeze({
  answer: Object.freeze({
    center: Object.freeze([-1.72, 0.52]),
    radius: Object.freeze([1.55, 1.08]),
    colorA: '#4fc8e8',
    colorB: '#e6fbff',
    seed: 8101
  }),
  citation: Object.freeze({
    center: Object.freeze([1.76, 0.72]),
    radius: Object.freeze([1.3, 0.9]),
    colorA: '#b8e4ef',
    colorB: '#9186c8',
    seed: 8201
  }),
  keyword: Object.freeze({
    center: Object.freeze([1.72, -0.66]),
    radius: Object.freeze([1.48, 0.82]),
    colorA: '#1ab7ce',
    colorB: '#70e4ee',
    seed: 8301
  })
});

const REGION_SEEDS = Object.freeze({
  answer: Object.freeze([
    [-3.08, 1.18], [-2.9, 0.62], [-2.78, -0.05], [-2.38, 1.35],
    [-2.24, 0.78], [-2.12, 0.18], [-1.72, 1.08], [-1.58, 0.38],
    [-1.46, -0.22], [-1.08, 0.72], [-0.92, 0.06]
  ]),
  citation: Object.freeze([
    [3.02, 1.24], [2.76, 0.76], [2.64, 0.24], [2.34, 1.38],
    [2.18, 0.88], [2.02, 0.38], [1.66, 1.18], [1.5, 0.58]
  ]),
  keyword: Object.freeze([
    [3.12, -1.32], [2.98, -0.78], [2.9, -0.24], [2.48, -1.38],
    [2.4, -0.84], [2.3, -0.36], [1.9, -1.16], [1.76, -0.62],
    [1.4, -0.98], [1.26, -0.42]
  ])
});

const GLOBAL_FIBER_SEEDS = Object.freeze([
  [-3.3, 1.48], [-2.7, 1.56], [-2.05, 1.48], [-1.35, 1.58],
  [-0.62, 1.44], [0.18, 1.52], [0.92, 1.44], [1.66, 1.54],
  [2.4, 1.46], [3.1, 1.3], [-3.42, 0.88], [-2.82, 0.34],
  [-2.92, -0.46], [-2.62, -1.08], [-2.04, -1.42], [-1.42, -1.26],
  [-0.76, -1.46], [-0.1, -1.28], [0.58, -1.38], [1.18, -1.2],
  [1.84, -1.42], [2.52, -1.22], [3.2, -0.92], [3.34, -0.22],
  [-1.94, 0.02], [-0.98, 1.08], [0.94, 0.98], [1.06, -0.98]
]);

const CONTINUITY_BRIDGES = Object.freeze([
  Object.freeze([
    [-3.35, 1.18], [-2.62, 1.42], [-1.82, 1.3], [-1.04, 1.43],
    [-0.24, 1.28], [0.58, 1.38], [1.42, 1.26], [2.22, 1.38], [3.28, 1.05]
  ]),
  Object.freeze([
    [-3.38, 0.52], [-2.66, 0.26], [-1.92, 0.48], [-1.18, 0.18],
    [-0.54, 0.3], [0.06, 0.42], [0.7, 0.22], [1.42, 0.44], [2.16, 0.2], [3.32, 0.46]
  ]),
  Object.freeze([
    [-3.32, -0.48], [-2.66, -0.72], [-1.94, -0.5], [-1.24, -0.76],
    [-0.58, -0.62], [0.08, -0.72], [0.76, -0.58], [1.52, -0.82], [2.3, -0.58], [3.28, -0.78]
  ]),
  Object.freeze([
    [-3.18, -1.42], [-2.4, -1.24], [-1.58, -1.38], [-0.82, -1.18],
    [-0.06, -1.3], [0.72, -1.14], [1.48, -1.34], [2.3, -1.18], [3.12, -1.36]
  ]),
  Object.freeze([
    [2.82, 1.48], [2.54, 0.94], [2.72, 0.44], [2.5, -0.02],
    [2.68, -0.48], [2.46, -0.98], [2.72, -1.48]
  ]),
  Object.freeze([
    [-2.86, 1.42], [-3.0, 0.94], [-2.78, 0.46], [-2.96, -0.08],
    [-2.72, -0.62], [-2.92, -1.18]
  ])
]);

export function createGeoV4SharedTissueField() {
  const core = new THREE.Vector3(...GEO_V4_SHARED_CORE);
  const regionPaths = Object.fromEntries(
    Object.entries(REGION_SEEDS).map(([region, seeds]) => [
      region,
      seeds.map((seed, index) => {
        const coreSeeking = index === 0 || index === 4 || index === 7;
        return createPath(seed, {
          region,
          seed: GEO_V4_BUSINESS_REGIONS[region].seed + index * 37,
          steps: coreSeeking ? 30 + index % 3 : 8 + index % 5,
          stepSize: coreSeeking ? 0.118 : 0.108,
          coreSeeking
        });
      })
    ])
  );
  const fibers = [
    ...CONTINUITY_BRIDGES.map((points, index) => createManualPath(points, 8551 + index)),
    ...GLOBAL_FIBER_SEEDS.map((seed, index) => createPath(seed, {
      region: null,
      seed: 8601 + index * 53,
      steps: 8 + index % 6,
      stepSize: 0.118 + index % 3 * 0.007,
      coreSeeking: index % 7 === 0
    }))
  ];
  const cells = createCells();

  return Object.freeze({
    core,
    regions: GEO_V4_BUSINESS_REGIONS,
    regionPaths,
    fibers,
    cells,
    sample,
    getRegionPaths(region) {
      return regionPaths[region] || [];
    },
    getFibers() {
      return fibers;
    },
    getCells() {
      return cells;
    },
    dispose() {}
  });

  function sample(x, y, layerDepth = -0.52) {
    const localNoise = fieldNoise(x, y);
    const dx = x - core.x;
    const dy = y - core.y;
    const distanceToCore = Math.sqrt(dx * dx + dy * dy * 1.28);
    const attraction = 1 - smootherstep(0.24, 2.35, distanceToCore);
    const cavity = 1 - smootherstep(0.16, 0.5, distanceToCore);
    const answer = regionWeight('answer', x, y);
    const citation = regionWeight('citation', x, y);
    const keyword = regionWeight('keyword', x, y);
    const bridge = sharedBridgeDensity(x, y);
    const businessDensity = Math.max(answer * 1.2, citation * 0.9, keyword);
    const density = THREE.MathUtils.clamp(
      0.14
        + localNoise * 0.12
        + bridge * 0.3
        + businessDensity * 0.5
        + attraction * (0.24 + bridge * 0.22),
      0,
      1
    );

    const safeDistance = Math.max(distanceToCore, 0.0001);
    const toCore = new THREE.Vector2(-dx / safeDistance, -dy / safeDistance);
    const curlAngle = (
      Math.sin(x * 0.72 + y * 1.16) * 0.72
      + Math.cos(x * 1.12 - y * 0.58) * 0.38
      + localNoise * 0.42
    );
    const organic = new THREE.Vector2(
      Math.cos(curlAngle),
      Math.sin(curlAngle) * 0.78
    ).normalize();
    const coreBias = 0.2 + attraction * 0.68 + bridge * 0.12;
    const tangent2 = organic.multiplyScalar(1 - coreBias)
      .addScaledVector(toCore, coreBias)
      .normalize();
    const tangent = new THREE.Vector3(tangent2.x, tangent2.y, -attraction * 0.08)
      .normalize();
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0.18 + localNoise * 0.08)
      .normalize();
    const curvature = THREE.MathUtils.clamp(
      Math.abs(Math.sin(x * 0.86 - y * 1.24 + localNoise * 2.3)) * 0.34
        + attraction * 0.66,
      0,
      1
    );

    const pull = attraction * (1 - cavity) * 0.12;
    const cavityPush = cavity * (0.34 - Math.min(distanceToCore, 0.34)) * 0.14;
    const px = x + toCore.x * pull - toCore.x * cavityPush;
    const py = y + toCore.y * pull - toCore.y * cavityPush;
    const depth = layerDepth
      + Math.sin(x * 0.74 + y * 0.42) * 0.075
      + Math.cos(x * 0.34 - y * 0.88) * 0.045
      - attraction * 0.2
      + localNoise * 0.035;
    const position = new THREE.Vector3(px, py, depth);
    const regionWeights = { answer, citation, keyword };
    const businessRegion = Object.entries(regionWeights)
      .sort((a, b) => b[1] - a[1])[0];

    return Object.freeze({
      position,
      tangent,
      normal,
      curvature,
      depth,
      density,
      attraction,
      businessRegion: businessRegion[1] > 0.16 ? businessRegion[0] : 'shared',
      regionWeights: Object.freeze(regionWeights),
      localNoise,
      distanceToCore,
      cavity
    });
  }

  function createPath(seed, options) {
    if (options.coreSeeking) {
      return createAttractionPath(seed, options);
    }
    const random = seededRandom(options.seed);
    const points = [];
    let x = seed[0];
    let y = seed[1];
    let previousDirection = null;

    for (let index = 0; index < options.steps; index += 1) {
      const field = sample(x, y, -0.46 + (random() - 0.5) * 0.18);
      points.push(field.position.clone());
      if (field.distanceToCore < 0.22) break;
      const tangent = new THREE.Vector2(field.tangent.x, field.tangent.y);
      if (previousDirection && tangent.dot(previousDirection) < 0) tangent.multiplyScalar(-1);
      if (!previousDirection && options.seed % 2 === 0) {
        tangent.multiplyScalar(-1);
      }
      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      const wobble = (random() - 0.5) * 0.062;
      const coreGain = 0.015;
      const towardCore = new THREE.Vector2(core.x - x, core.y - y).normalize();
      tangent.lerp(towardCore, coreGain + field.attraction * 0.25).normalize();
      x += tangent.x * options.stepSize + normal.x * wobble;
      y += tangent.y * options.stepSize + normal.y * wobble;
      previousDirection = tangent;
      if (Math.abs(x) > 3.55 || Math.abs(y) > 1.78) break;
    }

    return Object.freeze({
      region: options.region || 'shared',
      coreSeeking: options.coreSeeking,
      points: Object.freeze(points),
      curve: new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.46)
    });
  }

  function createAttractionPath(seed, options) {
    const random = seededRandom(options.seed);
    const start = new THREE.Vector2(seed[0], seed[1]);
    const endAngle = (options.seed % 11) / 11 * Math.PI * 2;
    const end = new THREE.Vector2(
      core.x + Math.cos(endAngle) * 0.19,
      core.y + Math.sin(endAngle) * 0.14
    );
    const direction = end.clone().sub(start);
    const normal = new THREE.Vector2(-direction.y, direction.x).normalize();
    const sign = options.seed % 2 === 0 ? -1 : 1;
    const sway = (0.22 + random() * 0.26) * sign;
    const controlA = start.clone()
      .lerp(end, 0.3)
      .addScaledVector(normal, sway);
    const controlB = start.clone()
      .lerp(end, 0.7)
      .addScaledVector(normal, -sway * 0.42);
    const points = [];
    const steps = Math.max(options.steps, 26);

    for (let index = 0; index < steps; index += 1) {
      const t = index / (steps - 1);
      const mt = 1 - t;
      const x = mt * mt * mt * start.x
        + 3 * mt * mt * t * controlA.x
        + 3 * mt * t * t * controlB.x
        + t * t * t * end.x;
      const y = mt * mt * mt * start.y
        + 3 * mt * mt * t * controlA.y
        + 3 * mt * t * t * controlB.y
        + t * t * t * end.y;
      const envelope = Math.sin(t * Math.PI);
      const ripple = Math.sin(t * Math.PI * 3 + options.seed * 0.013)
        * 0.025 * envelope;
      const fieldSample = sample(
        x + normal.x * ripple,
        y + normal.y * ripple,
        -0.42 + (random() - 0.5) * 0.08
      );
      points.push(fieldSample.position.clone());
    }

    return Object.freeze({
      region: options.region,
      coreSeeking: true,
      points: Object.freeze(points),
      curve: new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.46)
    });
  }

  function createManualPath(points, seed) {
    const mapped = points.map(([x, y], index) => {
      const fieldSample = sample(x, y, -0.72 + Math.sin(index * 1.7 + seed) * 0.06);
      return fieldSample.position.clone();
    });
    return Object.freeze({
      region: 'shared',
      coreSeeking: false,
      points: Object.freeze(mapped),
      curve: new THREE.CatmullRomCurve3(mapped, false, 'catmullrom', 0.5)
    });
  }

  function createCells() {
    const random = seededRandom(8701);
    const results = [];
    const rows = 10;
    const columns = 20;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = -3.24 + column / (columns - 1) * 6.48 + (random() - 0.5) * 0.2;
        const y = -1.5 + row / (rows - 1) * 3.0 + (random() - 0.5) * 0.16;
        const centerField = sample(x, y, -0.56);
        if (centerField.cavity > 0.96) continue;
        const accept = centerField.density * 0.82 + centerField.localNoise * 0.26;
        if (accept < 0.2 || random() > 0.9) continue;
        const sizeScale = 1 - centerField.attraction * 0.56;
        const radiusX = (0.16 + random() * 0.24) * sizeScale;
        const radiusY = (0.11 + random() * 0.17) * sizeScale;
        const pointCount = 11 + Math.floor(random() * 5);
        const points = [];
        const visibleSegments = [];
        const angleOffset = random() * Math.PI * 2;
        const tangent = new THREE.Vector2(centerField.tangent.x, centerField.tangent.y).normalize();
        const normal = new THREE.Vector2(-tangent.y, tangent.x);

        for (let index = 0; index < pointCount; index += 1) {
          const angle = angleOffset + index / pointCount * Math.PI * 2;
          const irregular = 0.72 + random() * 0.5;
          const ox = tangent.x * Math.cos(angle) * radiusX * irregular
            + normal.x * Math.sin(angle) * radiusY * irregular;
          const oy = tangent.y * Math.cos(angle) * radiusX * irregular
            + normal.y * Math.sin(angle) * radiusY * irregular;
          points.push(sample(x + ox, y + oy, -0.55).position.clone());
          visibleSegments.push(
            ((index + row * 3 + column) % 9) < 6
              && random() > (centerField.attraction > 0.4 ? 0.3 : 0.13)
          );
        }

        results.push(Object.freeze({
          center: centerField.position,
          density: centerField.density,
          attraction: centerField.attraction,
          businessRegion: centerField.businessRegion,
          points: Object.freeze(points),
          visibleSegments: Object.freeze(visibleSegments)
        }));
      }
    }
    return Object.freeze(results);
  }
}

function regionWeight(region, x, y) {
  const definition = GEO_V4_BUSINESS_REGIONS[region];
  const dx = (x - definition.center[0]) / definition.radius[0];
  const dy = (y - definition.center[1]) / definition.radius[1];
  const radial = Math.exp(-(dx * dx + dy * dy) * 1.45);
  if (region !== 'keyword') return radial;
  const upperVein = Math.exp(-(
    Math.pow((y + 0.42 + (x - 1.5) * 0.08) / 0.28, 2)
    + Math.pow((x - 1.8) / 1.52, 2)
  ));
  const lowerVein = Math.exp(-(
    Math.pow((y + 0.92 - (x - 1.7) * 0.13) / 0.32, 2)
    + Math.pow((x - 1.9) / 1.62, 2)
  ));
  return Math.max(radial * 0.52, upperVein * 0.82, lowerVein * 0.78);
}

function sharedBridgeDensity(x, y) {
  const central = Math.exp(-(
    Math.pow((y - 0.02 + x * 0.08) / 0.42, 2)
    + Math.pow(x / 2.65, 4)
  ));
  const upper = Math.exp(-(
    Math.pow((y - 0.98 + Math.abs(x) * 0.12) / 0.48, 2)
    + Math.pow(x / 3.15, 6)
  ));
  const lower = Math.exp(-(
    Math.pow((y + 0.94 - x * 0.05) / 0.44, 2)
    + Math.pow(x / 3.0, 6)
  ));
  const rightBridge = Math.exp(-(
    Math.pow((x - 1.72) / 0.58, 2)
    + Math.pow((y + 0.02) / 1.28, 4)
  ));
  return THREE.MathUtils.clamp(
    central * 0.78 + upper * 0.4 + lower * 0.48 + rightBridge * 0.44,
    0,
    1
  );
}

function fieldNoise(x, y) {
  const low = Math.sin(x * 0.72 + y * 1.13) * 0.5 + 0.5;
  const middle = Math.sin(x * 1.86 - y * 1.37 + 1.7) * 0.5 + 0.5;
  const high = Math.cos(x * 3.1 + y * 2.42 - 0.8) * 0.5 + 0.5;
  return THREE.MathUtils.clamp(low * 0.52 + middle * 0.32 + high * 0.16, 0, 1);
}

function smootherstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}
