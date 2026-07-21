import * as THREE from 'three';
import {
  createLabelSprite,
  createSignalPointsMaterial,
  lerp,
  seededRandom,
  smootherstep
} from './geoSignalCore.js';

export const GEO_CLUSTER_CONFIGS = Object.freeze([
  Object.freeze({
    key: 'answer',
    name: 'AI ANSWER',
    subtitle: 'AI \u56de\u7b54',
    count: 420,
    style: 'radial-streams',
    opacity: 0.84,
    colorA: '#e2fbff',
    colorB: '#65d5ff',
    final: [1.16, -0.22, 0.32],
    start: [2.18, -1.08, 0.94],
    control: [1.72, 0.08, 0.72],
    shape: [0.46, 0.35, 0.41],
    label: [0, -0.39, 0.08],
    labelWidth: 0.86,
    progress: [0.1, 0.48],
    subClusters: [[-0.16, 0.08, -0.04], [0.13, 0.12, 0.09], [0.18, -0.12, -0.08]],
    seed: 2203,
    drift: [0.012, 0.009, 0.014]
  }),
  Object.freeze({
    key: 'citation',
    name: 'AI CITATION',
    subtitle: 'AI \u5f15\u7528',
    count: 360,
    style: 'source-clusters',
    opacity: 0.76,
    colorA: '#d9eaff',
    colorB: '#789bc8',
    final: [-1.02, 0.25, -0.48],
    start: [-2.2, 0.88, -1.06],
    control: [-1.5, 0.9, -0.82],
    shape: [0.57, 0.33, 0.45],
    label: [-0.08, 0.38, 0.06],
    labelWidth: 0.89,
    progress: [0.16, 0.54],
    subClusters: [[-0.28, 0.03, 0.06], [0.02, 0.19, -0.14], [0.26, -0.1, 0.12], [0.34, 0.14, -0.05]],
    seed: 3301,
    drift: [0.01, 0.012, 0.009]
  }),
  Object.freeze({
    key: 'keyword',
    name: 'GEO KEYWORD',
    subtitle: 'GEO \u5173\u952e\u8bcd',
    count: 390,
    style: 'keyword-chain',
    opacity: 0.82,
    colorA: '#d8fffc',
    colorB: '#27c9c5',
    final: [0.58, 0.7, -0.12],
    start: [1.18, 1.78, 0.45],
    control: [1.12, 1.16, -0.24],
    shape: [0.66, 0.23, 0.35],
    label: [0.02, 0.31, 0.06],
    labelWidth: 0.95,
    progress: [0.22, 0.6],
    subClusters: [[-0.28, -0.02, 0.04], [0.03, 0.04, -0.06], [0.3, 0.06, 0.08]],
    seed: 4409,
    drift: [0.014, 0.008, 0.011]
  })
]);

export function createGeoBusinessClusters(resources) {
  const group = new THREE.Group();
  const clusters = GEO_CLUSTER_CONFIGS.map((config) => createBusinessCluster(config, resources));

  group.name = 'GEO Business Clusters';
  clusters.forEach((cluster) => group.add(cluster.group));

  return {
    group,
    clusters,
    particleCount: clusters.reduce((total, cluster) => total + cluster.particleCount, 0),
    setDebugVisibility(showVisuals, showLabels) {
      clusters.forEach((cluster) => cluster.setDebugVisibility(showVisuals, showLabels));
    },
    update(time, progress) {
      const result = {};
      clusters.forEach((cluster) => {
        result[cluster.key] = cluster.update(time, progress);
      });
      return result;
    },
    dispose() {
      clusters.forEach((cluster) => cluster.dispose());
      group.clear();
    }
  };
}

function createBusinessCluster(config, resources) {
  const group = new THREE.Group();
  const visualGroup = new THREE.Group();
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
    const particle = createClusterParticle(config, index, random);

    positions[stride] = particle[0];
    positions[stride + 1] = particle[1];
    positions[stride + 2] = particle[2];
    color.copy(colorA).lerp(colorB, random() * 0.78);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 61 === 0
      ? config.style === 'keyword-chain' ? 3.1 : config.style === 'source-clusters' ? 3.25 : 3.4
      : index % 13 === 0
        ? config.style === 'keyword-chain' ? 1.75 : config.style === 'source-clusters' ? 1.95 : 2.05
        : 0.64 + random() * (config.style === 'keyword-chain' ? 0.61 : 0.69);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(resources.pointTexture, 0);
  const points = new THREE.Points(geometry, material);
  const sourceConnections = config.style === 'source-clusters'
    ? createSourceConnections(config)
    : null;
  const label = createLabelSprite(
    config.name,
    config.subtitle,
    config.colorA,
    config.labelWidth
  );

  group.name = config.name;
  visualGroup.name = `${config.name} Data Cluster`;
  points.name = `${config.name} Particles`;
  points.renderOrder = 6;
  label.sprite.position.set(...config.label);
  visualGroup.add(points);
  if (sourceConnections) visualGroup.add(sourceConnections.lines);
  group.add(visualGroup, label.sprite);

  return {
    key: config.key,
    group,
    particleCount: config.count,
    setDebugVisibility(showVisuals, showLabel) {
      visualGroup.visible = showVisuals;
      label.sprite.visible = showLabel;
    },
    update(time, progress) {
      const localProgress = smootherstep(config.progress[0], config.progress[1], progress);
      const reveal = smootherstep(config.progress[0] + 0.035, config.progress[1], progress);
      const labelReveal = smootherstep(config.progress[0] + 0.18, config.progress[1] + 0.16, progress);
      const settled = smootherstep(0.88, 1, progress);
      const inverse = 1 - localProgress;

      group.position.set(
        quadraticBezier(config.start[0], config.control[0], config.final[0], localProgress),
        quadraticBezier(config.start[1], config.control[1], config.final[1], localProgress),
        quadraticBezier(config.start[2], config.control[2], config.final[2], localProgress)
      );
      group.scale.setScalar(lerp(0.16, 1, reveal));
      visualGroup.position.set(
        Math.sin(time * (0.11 + config.seed % 5 * 0.006)) * config.drift[0] * settled,
        Math.cos(time * (0.09 + config.seed % 7 * 0.005)) * config.drift[1] * settled,
        Math.sin(time * (0.08 + config.seed % 3 * 0.008) + 1.4) * config.drift[2] * settled
      );
      visualGroup.rotation.y = Math.sin(time * 0.045 + config.seed) * 0.025 * settled;
      material.uniforms.uOpacity.value = reveal * config.opacity;
      material.uniforms.uScale.value = 0.86 + reveal * 0.14;
      label.material.opacity = labelReveal * 0.82;
      if (sourceConnections) sourceConnections.material.opacity = reveal * 0.115;

      // Keep the final anchor exact while only the visual particles drift inside it.
      if (inverse < 0.0001) group.position.set(...config.final);
      return localProgress;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      sourceConnections?.dispose();
      label.dispose();
      group.clear();
    }
  };
}

function createClusterParticle(config, index, random) {
  if (config.style === 'keyword-chain') {
    const branch = index % 2;
    const t = random();
    const along = t * 2 - 1;
    const angle = lerp(-1.18, 1.3, t) + branch * 0.54;
    const taper = 1 - Math.abs(along) * 0.55;
    const jitter = (random() - 0.5) * 0.055 * taper;

    return [
      along * config.shape[0] + jitter,
      Math.sin(angle) * config.shape[1] * (0.64 + branch * 0.14) + (random() - 0.5) * 0.035 * taper,
      Math.cos(angle) * config.shape[2] * 0.66 + (branch ? 0.055 : -0.04) + (random() - 0.5) * 0.04 * taper
    ];
  }

  if (config.style === 'radial-streams' && index > config.count * 0.68) {
    const ray = index % 5;
    const angle = -1.05 + ray * 0.53;
    const distance = 0.22 + Math.pow(random(), 0.78) * 0.78;
    const jitter = (random() - 0.5) * 0.04;

    return [
      Math.cos(angle) * config.shape[0] * distance + jitter,
      Math.sin(angle * 1.55) * config.shape[1] * distance * 0.48 + jitter * 0.6,
      Math.sin(angle) * config.shape[2] * distance + (random() - 0.5) * 0.035
    ];
  }

  const useSubCluster = config.style === 'source-clusters'
    ? index > config.count * 0.28
    : index > config.count * 0.76;
  const subCluster = useSubCluster
    ? config.subClusters[index % config.subClusters.length]
    : [0, 0, 0];
  const density = useSubCluster ? 0.46 : config.style === 'radial-streams' ? 0.74 : 0.92;
  const radial = Math.pow(random(), useSubCluster ? 1.9 : 1.34);
  const angle = random() * Math.PI * 2;
  const elevation = (random() - 0.5) * 2;
  const thickness = Math.sqrt(Math.max(0, 1 - elevation * elevation));

  return [
    subCluster[0] + Math.cos(angle) * thickness * config.shape[0] * radial * density,
    subCluster[1] + elevation * config.shape[1] * radial * density,
    subCluster[2] + Math.sin(angle) * thickness * config.shape[2] * radial * density
  ];
}

function createSourceConnections(config) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const pairs = [[0, 1], [1, 2], [2, 3], [0, 2]];

  pairs.forEach(([fromIndex, toIndex]) => {
    const from = config.subClusters[fromIndex];
    const to = config.subClusters[toIndex];
    appendConnectionSegment(positions, from, to, 0.12, 0.4);
    appendConnectionSegment(positions, from, to, 0.58, 0.86);
  });
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: '#9dc8e8',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = 'AI CITATION Broken Source Links';
  lines.renderOrder = 4;
  return {
    lines,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function appendConnectionSegment(positions, from, to, start, end) {
  positions.push(
    lerp(from[0], to[0], start),
    lerp(from[1], to[1], start),
    lerp(from[2], to[2], start),
    lerp(from[0], to[0], end),
    lerp(from[1], to[1], end),
    lerp(from[2], to[2], end)
  );
}

function quadraticBezier(start, control, end, t) {
  const inverse = 1 - t;
  return inverse * inverse * start + 2 * inverse * t * control + t * t * end;
}
