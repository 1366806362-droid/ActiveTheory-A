import * as THREE from 'three';
import {
  createMindLabelSprite,
  createMindPointsMaterial,
  lerp,
  seededRandom,
  smootherstep
} from './brandCognitionCore.js';

export const BRAND_MIND_CLUSTER_CONFIGS = Object.freeze([
  Object.freeze({
    key: 'awareness',
    name: 'BRAND AWARENESS',
    subtitle: '\u54c1\u724c\u8ba4\u77e5',
    keywords: '\u77e5\u9053  \u00b7  \u719f\u6089',
    count: 330,
    final: [-1.52, 0.68, -0.42],
    start: [-2.48, 1.42, -1.16],
    control: [-2.04, 0.16, -0.92],
    shape: [0.55, 0.4, 0.34],
    visualScale: 1.17,
    opacity: 0.78,
    colorA: '#e2dcff',
    colorB: '#7659ba',
    labelColor: '#9a82db',
    label: [-0.08, -0.48, 0.12],
    labelWidth: 1.1,
    progress: [0.1, 0.43],
    style: 'awareness-cloud',
    subClusters: [[-0.2, 0.1, -0.04], [0.15, 0.15, 0.08], [0.23, -0.12, -0.06]],
    seed: 2047,
    phase: 0.4
  }),
  Object.freeze({
    key: 'association',
    name: 'BRAND ASSOCIATION',
    subtitle: '\u54c1\u724c\u8054\u60f3',
    keywords: '\u4fbf\u5b9c  \u00b7  \u4e30\u5bcc',
    count: 500,
    final: [1.68, 0.02, 0.08],
    start: [2.8, -0.6, 0.94],
    control: [2.14, 0.82, 0.58],
    shape: [0.78, 0.54, 0.52],
    visualScale: 1.18,
    opacity: 0.82,
    colorA: '#eeeaff',
    colorB: '#8e6ee0',
    labelColor: '#b09aef',
    label: [0.02, -0.62, 0.12],
    labelWidth: 1.2,
    progress: [0.15, 0.5],
    style: 'association-web',
    subClusters: [[-0.3, 0.08, -0.08], [0.08, 0.22, 0.12], [0.34, -0.08, -0.04], [0.2, -0.26, 0.14]],
    seed: 4093,
    phase: 1.3
  }),
  Object.freeze({
    key: 'reputation',
    name: 'BRAND REPUTATION',
    subtitle: '\u54c1\u724c\u7f8e\u8a89',
    keywords: '\u53ef\u9760  \u00b7  \u54c1\u8d28',
    count: 260,
    final: [0.76, 1.04, -0.72],
    start: [0.16, 1.92, -1.5],
    control: [1.42, 1.48, -1.14],
    shape: [0.43, 0.33, 0.3],
    visualScale: 1.14,
    opacity: 0.72,
    colorA: '#e9e5ff',
    colorB: '#6f76b7',
    labelColor: '#9ca1d8',
    label: [0.02, 0.26, 0.1],
    labelWidth: 1,
    progress: [0.2, 0.54],
    style: 'reputation-sources',
    subClusters: [[-0.18, 0.04, 0.04], [0.04, 0.16, -0.1], [0.2, -0.08, 0.08]],
    seed: 6151,
    phase: 2.1
  }),
  Object.freeze({
    key: 'preference',
    name: 'BRAND PREFERENCE',
    subtitle: '\u54c1\u724c\u504f\u7231',
    keywords: '\u9996\u9009  \u00b7  \u56de\u8d2d',
    count: 430,
    final: [1.06, -1.02, 0.5],
    start: [2.42, -1.48, 1.34],
    control: [0.48, -1.68, 1.12],
    shape: [0.66, 0.49, 0.46],
    visualScale: 1.2,
    opacity: 0.8,
    colorA: '#f1eaff',
    colorB: '#8d66d1',
    labelColor: '#b497e8',
    label: [0.02, 0.12, 0.08],
    labelWidth: 1.12,
    progress: [0.26, 0.58],
    style: 'preference-surge',
    subClusters: [[-0.24, 0.06, -0.08], [0.08, 0.2, 0.08], [0.27, -0.13, 0.12]],
    seed: 8209,
    phase: 3.2
  }),
  Object.freeze({
    key: 'loyalty',
    name: 'LOYALTY / ADVOCACY',
    subtitle: '\u54c1\u724c\u5fe0\u8bda / \u63a8\u8350',
    keywords: '\u957f\u671f\u8d2d\u4e70  \u00b7  \u4e3b\u52a8\u5206\u4eab',
    count: 250,
    final: [-1.44, -0.88, -0.16],
    start: [-2.64, -1.52, -0.94],
    control: [-0.94, -1.62, -0.72],
    shape: [0.6, 0.27, 0.32],
    visualScale: 1.18,
    opacity: 0.72,
    colorA: '#d9d3ef',
    colorB: '#5b4b8d',
    labelColor: '#8975b7',
    label: [-0.04, -0.38, 0.1],
    labelWidth: 1.16,
    progress: [0.32, 0.62],
    style: 'loyalty-chain',
    subClusters: [[-0.25, 0.02, 0.04], [0.08, 0.1, -0.08], [0.28, -0.06, 0.08]],
    seed: 10243,
    phase: 4.4
  })
]);

export function createBrandMindClusters(resources) {
  const group = new THREE.Group();
  const clusters = BRAND_MIND_CLUSTER_CONFIGS.map((config) => createCluster(config, resources));
  const internalLinks = createInternalConnections();

  group.name = 'Five Brand Mind Nebula Clusters';
  clusters.forEach((cluster) => group.add(cluster.group));
  group.add(internalLinks.lines);

  return {
    group,
    particleCount: BRAND_MIND_CLUSTER_CONFIGS.reduce((total, config) => total + config.count, 0),
    keywordNodeCount: BRAND_MIND_CLUSTER_CONFIGS.length * 9,
    update(time, progress) {
      const values = {};
      clusters.forEach((cluster) => {
        values[cluster.config.key] = cluster.update(time, progress);
      });
      internalLinks.material.uniforms.uProgress.value = progress;
      internalLinks.material.uniforms.uTime.value = time;
      return values;
    },
    dispose() {
      clusters.forEach((cluster) => cluster.dispose());
      internalLinks.dispose();
      group.clear();
    }
  };
}

function createCluster(config, resources) {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(config.count * 3);
  const colors = new Float32Array(config.count * 3);
  const sizes = new Float32Array(config.count);
  const random = seededRandom(config.seed);
  const colorA = new THREE.Color(config.colorA);
  const colorB = new THREE.Color(config.colorB);
  const color = new THREE.Color();

  for (let index = 0; index < config.count; index += 1) {
    const stride = index * 3;
    const position = createClusterPosition(config, index, random);
    positions[stride] = position[0];
    positions[stride + 1] = position[1];
    positions[stride + 2] = position[2];
    color.copy(colorA).lerp(colorB, 0.18 + random() * 0.78);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index < 9
      ? index < 2 ? 3.4 - index * 0.6 : 1.9 + random() * 0.72
      : index % 37 === 0 ? 2.15 : 0.54 + random() * 0.72;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createMindPointsMaterial(resources.pointTexture, 0);
  const points = new THREE.Points(geometry, material);
  const label = createMindLabelSprite(
    config.name,
    config.subtitle,
    config.keywords,
    config.labelColor,
    config.labelWidth
  );

  group.name = config.name;
  points.name = `${config.name} Semantic Stars`;
  points.renderOrder = config.key === 'preference' ? 9 : 6;
  label.sprite.position.set(...config.label);
  group.position.set(...config.start);
  group.add(points, label.sprite);

  return {
    group,
    config,
    update(time, progress) {
      const localProgress = smootherstep(config.progress[0], config.progress[1], progress);
      const stable = smootherstep(0.88, 1, progress);
      const inverse = 1 - localProgress;
      group.position.set(
        inverse * inverse * config.start[0] + 2 * inverse * localProgress * config.control[0] + localProgress * localProgress * config.final[0],
        inverse * inverse * config.start[1] + 2 * inverse * localProgress * config.control[1] + localProgress * localProgress * config.final[1],
        inverse * inverse * config.start[2] + 2 * inverse * localProgress * config.control[2] + localProgress * localProgress * config.final[2]
      );
      group.scale.setScalar(lerp(0.36, 1, localProgress));
      points.scale.setScalar(lerp(0.9, config.visualScale, localProgress));
      points.rotation.y = Math.sin(time * (0.014 + config.phase * 0.001) + config.phase) * 0.026 * stable;
      points.rotation.z = Math.cos(time * 0.012 + config.phase) * 0.018 * stable;
      material.uniforms.uOpacity.value = localProgress * config.opacity;
      material.uniforms.uScale.value = config.key === 'preference' ? 1.12 : config.key === 'association' ? 1.04 : config.key === 'loyalty' ? 0.92 : 1;
      label.material.opacity = smootherstep(config.progress[0] + 0.15, config.progress[1] + 0.18, progress) * 0.54;
      if (inverse < 0.0001) group.position.set(...config.final);
      return localProgress;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      label.dispose();
      group.clear();
    }
  };
}

function createClusterPosition(config, index, random) {
  if (config.style === 'loyalty-chain' && index > config.count * 0.34) {
    const t = random() * 2 - 1;
    return [
      t * config.shape[0],
      Math.sin(t * 3.1) * config.shape[1] * 0.34 + (random() - 0.5) * 0.07,
      Math.cos(t * 2.2) * config.shape[2] * 0.34 + (random() - 0.5) * 0.06
    ];
  }
  if (config.style === 'preference-surge' && index > config.count * 0.66) {
    const ray = index % 4;
    const angle = -1.2 + ray * 0.72;
    const distance = 0.22 + Math.pow(random(), 0.74) * 0.82;
    return [
      Math.cos(angle) * config.shape[0] * distance,
      Math.sin(angle * 1.4) * config.shape[1] * distance * 0.5,
      Math.sin(angle) * config.shape[2] * distance + (random() - 0.5) * 0.05
    ];
  }
  const useSubCluster = index > config.count * (config.style === 'association-web' ? 0.3 : 0.58);
  const subCluster = useSubCluster ? config.subClusters[index % config.subClusters.length] : [0, 0, 0];
  const radial = Math.pow(random(), useSubCluster ? 1.82 : 1.26);
  const angle = random() * Math.PI * 2;
  const elevation = random() * 2 - 1;
  const thickness = Math.sqrt(Math.max(0, 1 - elevation * elevation));
  const density = useSubCluster ? 0.5 : config.style === 'awareness-cloud' ? 0.86 : 0.96;
  return [
    subCluster[0] + Math.cos(angle) * thickness * config.shape[0] * radial * density,
    subCluster[1] + elevation * config.shape[1] * radial * density,
    subCluster[2] + Math.sin(angle) * thickness * config.shape[2] * radial * density
  ];
}

function createInternalConnections() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const starts = [];
  const phases = [];

  BRAND_MIND_CLUSTER_CONFIGS.forEach((config, configIndex) => {
    const pairs = config.subClusters.length > 3 ? [[0, 1], [1, 2], [2, 3], [0, 2]] : [[0, 1], [1, 2], [0, 2]];
    const color = new THREE.Color(config.colorB);
    pairs.forEach(([fromIndex, toIndex], pairIndex) => {
      const from = config.subClusters[fromIndex];
      const to = config.subClusters[toIndex];
      appendBrokenSegment(positions, colors, starts, phases, config, from, to, 0.08, 0.38, color, configIndex, pairIndex);
      appendBrokenSegment(positions, colors, starts, phases, config, from, to, 0.58, 0.84, color, configIndex, pairIndex);
    });
  });
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `
      attribute float aStart;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uProgress;
      uniform float uTime;
      void main() {
        vColor = color;
        vAlpha = smoothstep(aStart, aStart + 0.24, uProgress) * (0.8 + 0.2 * sin(uTime * 0.22 + aPhase));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float alpha = vAlpha * 0.095;
        if (alpha < 0.008) discard;
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
  lines.name = 'Sparse Intra Cluster Relations';
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

function appendBrokenSegment(positions, colors, starts, phases, config, from, to, start, end, color, configIndex, pairIndex) {
  for (const t of [start, end]) {
    positions.push(
      config.final[0] + lerp(from[0], to[0], t),
      config.final[1] + lerp(from[1], to[1], t),
      config.final[2] + lerp(from[2], to[2], t)
    );
    colors.push(color.r, color.g, color.b);
    starts.push(config.progress[1] - 0.04);
    phases.push(configIndex * 0.7 + pairIndex * 0.41);
  }
}
