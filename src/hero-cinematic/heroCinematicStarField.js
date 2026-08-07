import * as THREE from 'three';

const QUALITY_COUNTS = Object.freeze({
  company: Object.freeze({ far: 2800, mid: 980, near: 150, streaks: 26 }),
  default: Object.freeze({ far: 3300, mid: 1250, near: 190, streaks: 34 })
});

const COOL_PALETTE = Object.freeze([
  new THREE.Color(0xddeeff),
  new THREE.Color(0xbadfff),
  new THREE.Color(0xa8e8ef),
  new THREE.Color(0xf0f6ff)
]);
const WARM_STAR = new THREE.Color(0xffe4c7);

export function createHeroCinematicStarField({ quality = 'default', viewportHeight = 1080 } = {}) {
  const counts = QUALITY_COUNTS[quality] ?? QUALITY_COUNTS.default;
  const random = createSeededRandom(0x41c1f5);
  const group = new THREE.Group();
  const far = createLayer({
    name: 'HeroStarFieldFar',
    count: counts.far,
    random,
    createPosition: createFarPosition,
    sizeRange: [0.16, 0.42],
    alphaRange: [0.12, 0.42],
    viewportHeight
  });
  const mid = createLayer({
    name: 'HeroStarFieldMid',
    count: counts.mid,
    random,
    createPosition: createMidPosition,
    sizeRange: [0.28, 0.72],
    alphaRange: [0.2, 0.68],
    viewportHeight
  });
  const near = createLayer({
    name: 'HeroStarFieldNear',
    count: counts.near,
    random,
    createPosition: createNearPosition,
    sizeRange: [0.42, 1.15],
    alphaRange: [0.34, 0.9],
    viewportHeight
  });
  const streaks = createNearStreaks(near.positions, counts.streaks);

  group.name = 'HeroCinematicThreeLayerStarField';
  group.add(far.points, mid.points, near.points, streaks.lines);

  function update(timeline) {
    far.material.uniforms.uGlobalOpacity.value = timeline.farOpacity;
    mid.material.uniforms.uGlobalOpacity.value = timeline.midOpacity;
    near.material.uniforms.uGlobalOpacity.value = timeline.nearOpacity;
    streaks.material.opacity = timeline.streakIntensity;
    streaks.lines.visible = timeline.streakIntensity > 0.004;
  }

  function resize(height) {
    const scale = Math.max(360, height) * 0.52;
    far.material.uniforms.uPointScale.value = scale;
    mid.material.uniforms.uPointScale.value = scale;
    near.material.uniforms.uPointScale.value = scale;
  }

  function dispose() {
    [far, mid, near].forEach((layer) => {
      layer.geometry.dispose();
      layer.material.dispose();
    });
    streaks.geometry.dispose();
    streaks.material.dispose();
    group.clear();
  }

  return Object.freeze({
    group,
    counts: Object.freeze({ far: counts.far, mid: counts.mid, near: counts.near }),
    streakCount: counts.streaks,
    update,
    resize,
    dispose
  });
}

function createLayer({
  name,
  count,
  random,
  createPosition,
  sizeRange,
  alphaRange,
  viewportHeight
}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const position = createPosition(random, index);
    const color = random() < 0.055
      ? WARM_STAR
      : COOL_PALETTE[Math.floor(random() * COOL_PALETTE.length)];
    const colorScale = lerp(0.68, 1, random());

    positions.set(position, index * 3);
    colors[index * 3] = color.r * colorScale;
    colors[index * 3 + 1] = color.g * colorScale;
    colors[index * 3 + 2] = color.b * colorScale;
    sizes[index] = lerp(sizeRange[0], sizeRange[1], Math.pow(random(), 2.1));
    alphas[index] = lerp(alphaRange[0], alphaRange[1], Math.pow(random(), 1.7));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uGlobalOpacity: { value: 0 },
      uPointScale: { value: viewportHeight * 0.52 }
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float depth = max(2.0, -viewPosition.z);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * uPointScale / depth, 0.45, 6.5);
        vColor = aColor;
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uGlobalOpacity;

      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float distanceToCenter = length(point);
        float core = 1.0 - smoothstep(0.04, 0.18, distanceToCenter);
        float halo = 1.0 - smoothstep(0.08, 0.5, distanceToCenter);
        float alpha = (core * 0.7 + halo * 0.3) * vAlpha * uGlobalOpacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `
  });
  const points = new THREE.Points(geometry, material);
  points.name = name;
  points.frustumCulled = false;

  return { points, geometry, material, positions };
}

function createNearStreaks(nearPositions, count) {
  const positions = new Float32Array(count * 6);

  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.floor(index * nearPositions.length / 3 / count) * 3;
    const x = nearPositions[sourceIndex];
    const y = nearPositions[sourceIndex + 1];
    const z = nearPositions[sourceIndex + 2];
    const target = index * 6;
    positions.set([x, y, z, x - 0.035, y - 0.018, z + 0.52], target);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xaedff1,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'HeroNearStarStreaks';
  lines.frustumCulled = false;
  lines.visible = false;

  return { lines, geometry, material };
}

function createFarPosition(random) {
  const distance = lerp(95, 265, Math.pow(random(), 0.72));
  const horizontal = distance * 0.9;
  const vertical = distance * 0.46;
  const sparseBand = random() < 0.26;
  const x = sparseBand
    ? lerp(-0.95, 0.95, random()) * horizontal
    : signedPower(random, 0.72) * horizontal;
  const y = signedPower(random, 1.35) * vertical;
  return [x, y, 24 - distance];
}

function createMidPosition(random) {
  const clusters = [
    [-34, 13, -82],
    [18, -10, -104],
    [43, 17, -139],
    [-58, -18, -166]
  ];

  if (random() < 0.67) {
    const cluster = clusters[Math.floor(random() * clusters.length)];
    const spread = lerp(7, 22, random());
    return [
      cluster[0] + gaussian(random) * spread,
      cluster[1] + gaussian(random) * spread * 0.48,
      cluster[2] + gaussian(random) * spread * 1.2
    ];
  }

  const depth = lerp(45, 185, random());
  return [
    signedPower(random, 0.84) * depth * 0.66,
    signedPower(random, 1.45) * depth * 0.3,
    20 - depth
  ];
}

function createNearPosition(random) {
  const depth = lerp(10, 105, random());
  const corridorX = lerp(-3, 10, depth / 105);
  const corridorY = lerp(1.2, 4.2, depth / 105);
  const radius = lerp(4.5, 25, Math.pow(random(), 0.72));
  const angle = random() * Math.PI * 2;
  return [
    corridorX + Math.cos(angle) * radius,
    corridorY + Math.sin(angle) * radius * 0.55,
    34 - depth
  ];
}

function signedPower(random, power) {
  const value = random() * 2 - 1;
  return Math.sign(value) * Math.pow(Math.abs(value), power);
}

function gaussian(random) {
  const u = Math.max(1e-6, random());
  const v = Math.max(1e-6, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}
