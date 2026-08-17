import * as THREE from 'three';

const TAU = Math.PI * 2;
const CORE_LAYERS = Object.freeze([
  Object.freeze({
    name: 'BrandCoreInnerCurrent',
    count: 820,
    arms: 3,
    innerRadius: 0.055,
    outerRadius: 0.48,
    verticalScale: 0.46,
    depth: 0.1,
    turns: 0.94,
    size: 0.008,
    opacity: 0.34,
    spin: -0.011,
    phase: 0.18,
    colorA: 0xffe2b8,
    colorB: 0xb9e7ff
  }),
  Object.freeze({
    name: 'BrandCoreMiddleCurrent',
    count: 540,
    arms: 3,
    innerRadius: 0.14,
    outerRadius: 0.66,
    verticalScale: 0.54,
    depth: 0.16,
    turns: 0.76,
    size: 0.0065,
    opacity: 0.2,
    spin: 0.0065,
    phase: 1.42,
    colorA: 0xd8ecf8,
    colorB: 0x709bb5
  }),
  Object.freeze({
    name: 'BrandCoreOuterDrift',
    count: 280,
    arms: 4,
    innerRadius: 0.28,
    outerRadius: 0.84,
    verticalScale: 0.64,
    depth: 0.24,
    turns: 0.58,
    size: 0.005,
    opacity: 0.11,
    spin: -0.0035,
    phase: 3.08,
    colorA: 0xaac9d9,
    colorB: 0x746f82
  })
]);

export function createBrandGalaxyCore(texture) {
  const group = new THREE.Group();
  const layers = CORE_LAYERS.map((config, index) => (
    createCoreLayer(config, texture, 17041 + index * 7919)
  ));

  group.name = 'BrandGrowthGalaxyCore';
  layers.forEach((layer) => group.add(layer.points));

  function update(delta, time, pulse = 0.5, journeyProgress = 0) {
    const journeyFade = 1 - smoothstep(0.24, 0.72, journeyProgress) * 0.76;
    const breathing = 1 + Math.sin(time * 0.13 + 0.4) * 0.006;

    group.scale.setScalar(breathing);
    layers.forEach((layer, index) => {
      layer.update(delta, time, pulse, journeyFade, index);
    });
  }

  function dispose() {
    layers.forEach((layer) => layer.dispose());
    group.clear();
  }

  return {
    group,
    update,
    dispose,
    pointCount: CORE_LAYERS.reduce((total, layer) => total + layer.count, 0),
    layerCount: CORE_LAYERS.length
  };
}

function createCoreLayer(config, texture, seed) {
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(config.count * 3);
  const colors = new Float32Array(config.count * 3);
  const colorA = new THREE.Color(config.colorA);
  const colorB = new THREE.Color(config.colorB);
  const color = new THREE.Color();

  for (let index = 0; index < config.count; index += 1) {
    const stride = index * 3;
    const arm = index % config.arms;
    const progress = Math.pow((index + random()) / config.count, 0.86);
    const radius = THREE.MathUtils.lerp(config.innerRadius, config.outerRadius, progress);
    const clump = 0.5 + Math.sin(progress * TAU * 6.4 + arm * 1.7 + seed) * 0.5;
    const dropout = clump < 0.24 && random() < 0.68;
    const angle = config.phase
      + arm / config.arms * TAU
      + progress * TAU * config.turns
      + (random() - 0.5) * (0.14 + progress * 0.2);
    const width = (0.012 + progress * 0.045) * (0.45 + clump * 0.75);
    const lateral = clampGaussian(gaussianRandom(random)) * width;
    const noisyRadius = radius + (random() - 0.5) * width * 0.7;

    positions[stride] = Math.cos(angle) * noisyRadius - Math.sin(angle) * lateral;
    positions[stride + 1] = (
      Math.sin(angle) * noisyRadius + Math.cos(angle) * lateral
    ) * config.verticalScale;
    positions[stride + 2] = clampGaussian(gaussianRandom(random))
      * config.depth
      * (0.12 + progress * 0.16);
    color.copy(colorA).lerp(colorB, progress * 0.88 + random() * 0.08);
    color.multiplyScalar((dropout ? 0.08 : 0.46 + clump * 0.38) * (1 - progress * 0.26));
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.PointsMaterial({
    map: texture,
    size: config.size,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    alphaTest: 0.008,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = config.name;
  points.rotation.z = config.phase * 0.08;

  return {
    points,
    update(delta, time, pulse, visibility, index) {
      points.rotation.z += delta * config.spin;
      points.rotation.x = Math.sin(time * (0.021 + index * 0.004) + config.phase) * 0.012;
      material.opacity = config.opacity * visibility * (0.92 + pulse * 0.08);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function gaussianRandom(random) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function clampGaussian(value) {
  return Math.max(-2.25, Math.min(2.25, value));
}

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * (3 - 2 * x);
}

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export const brandGalaxyCoreFactory = { createBrandGalaxyCore };
