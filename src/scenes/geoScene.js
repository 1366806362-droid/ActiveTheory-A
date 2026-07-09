import * as THREE from 'three';

const GEO_NODES = [
  { type: 'answer', position: [-2.8, 1.2, -0.7], scale: 0.82, intensity: 0.72 },
  { type: 'citation', position: [-1.6, -1.1, -0.2], scale: 0.64, intensity: 0.54 },
  { type: 'keyword', position: [0.1, 1.65, -0.5], scale: 0.74, intensity: 0.68 },
  { type: 'answer', position: [1.7, -0.9, -0.1], scale: 0.68, intensity: 0.58 },
  { type: 'citation', position: [3.1, 0.85, -0.8], scale: 0.7, intensity: 0.62 },
  { type: 'keyword', position: [-3.7, -0.35, -1.4], scale: 0.44, intensity: 0.38 },
  { type: 'answer', position: [3.8, -1.7, -1.8], scale: 0.42, intensity: 0.34 },
  { type: 'citation', position: [0.95, 0.15, -1.6], scale: 0.52, intensity: 0.48 },
  { type: 'keyword', position: [-0.55, -2.15, -1.1], scale: 0.48, intensity: 0.42 },
  { type: 'answer', position: [2.35, 2.1, -2.2], scale: 0.46, intensity: 0.4 },
  { type: 'citation', position: [-4.55, 1.95, -2.6], scale: 0.34, intensity: 0.32 },
  { type: 'keyword', position: [4.75, 0.05, -2.9], scale: 0.36, intensity: 0.34 },
  { type: 'brand', position: [0.62, 0.22, 0.16], scale: 1, intensity: 0.92 }
];

const DATA_NODE_STYLE = {
  search: {
    color: new THREE.Color(0x4da3ff),
    size: 0.072,
    flowSpeed: 0.044
  },
  answer: {
    color: new THREE.Color(0x8df7ff),
    size: 0.088,
    flowSpeed: 0.046
  },
  citation: {
    color: new THREE.Color(0x2f86ff),
    size: 0.07,
    flowSpeed: 0.038
  },
  keyword: {
    color: new THREE.Color(0x00d5ff),
    size: 0.076,
    flowSpeed: 0.054
  },
  brand: {
    color: new THREE.Color(0xdafcff),
    size: 0.12,
    flowSpeed: 0.062
  }
};

const GEO_CONNECTIONS = [
  [0, 2],
  [2, 4],
  [0, 1],
  [1, 3],
  [3, 4],
  [5, 0],
  [3, 6],
  [2, 7],
  [7, 3],
  [1, 7],
  [8, 1],
  [8, 3],
  [9, 2],
  [9, 4],
  [10, 0],
  [11, 4],
  [7, 9],
  [2, 12],
  [4, 12],
  [7, 12],
  [9, 12],
  [0, 12],
  [3, 12],
  [1, 12]
];

const BRAND_NODE_INDEX = 12;
const FLOW_PARTICLE_COUNT = 220;
const DATA_EVENT_COUNT = 54;
const STAR_COUNT = 320;
const GEO_BUSINESS_NODES = [
  {
    type: 'search',
    label: 'USER SEARCH',
    metric: 'QUERY INTENT',
    position: [-2.95, -1.0, 0.36],
    scale: 0.72
  },
  {
    type: 'keyword',
    label: 'KEYWORD SIGNAL',
    metric: '6542',
    position: [-1.45, 0.52, -0.14],
    scale: 0.82
  },
  {
    type: 'answer',
    label: 'AI ANSWER',
    metric: '89732',
    position: [0.12, 1.42, 0.08],
    scale: 1
  },
  {
    type: 'citation',
    label: 'AI CITATION',
    metric: '23681',
    position: [1.72, 0.42, -0.24],
    scale: 0.88
  },
  {
    type: 'brand',
    label: 'BRAND SIGNAL',
    metric: 'EXPOSURE',
    position: [2.78, -0.88, 0.24],
    scale: 1.04
  }
];
const GEO_BUSINESS_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 2],
  [1, 3],
  [2, 4]
];

export function createGeoScene() {
  const group = new THREE.Group();
  const backdrop = createGeoBackdrop();
  const starField = createGeoStarField();
  const geoCore = createGeoCore();
  const network = createGeoNetwork();
  const uiLayer = createGeoUiLayer();
  const semanticLayer = createGeoBusinessSemanticLayer();

  group.name = 'GeoScene';
  group.position.set(0, 0, -4.8);
  group.visible = false;
  group.add(backdrop.mesh, starField.points, network.group, geoCore.group, semanticLayer.group, uiLayer.group);

  function update(renderState, delta, time, transitionProgress) {
    const entrance = smoothstep(0.08, 1, transitionProgress);
    const eased = easeOutCubic(entrance);
    const cameraExplore = entrance * entrance;

    group.visible = transitionProgress > 0.01;
    group.position.z = -4.8 + eased * 4.2;
    group.position.y = -0.35 + eased * 0.35;
    group.rotation.y = (1 - eased) * 0.18 + Math.sin(time * 0.025) * 0.025;
    group.rotation.x = Math.sin(time * 0.018) * 0.018;

    renderState.cameraOffset.x += Math.sin(time * 0.045) * 0.16 * cameraExplore;
    renderState.cameraOffset.y += Math.sin(time * 0.032 + 0.8) * 0.06 * cameraExplore;
    renderState.cameraOffset.z -= (0.12 + Math.sin(time * 0.038) * 0.08) * cameraExplore;
    renderState.cameraOffset.targetX += Math.sin(time * 0.036 + 1.2) * 0.12 * cameraExplore;
    renderState.cameraOffset.targetY += Math.sin(time * 0.028) * 0.05 * cameraExplore;

    backdrop.update(time, eased);
    starField.update(delta, time, eased);
    network.update(delta, time, eased);
    geoCore.update(delta, time, eased);
    semanticLayer.update(delta, time, eased);
    uiLayer.update(delta, time, eased);
  }

  function dispose() {
    backdrop.dispose();
    starField.dispose();
    network.dispose();
    geoCore.dispose();
    semanticLayer.dispose();
    uiLayer.dispose();
    group.clear();
  }

  return {
    name: 'GeoScene',
    group,
    update,
    dispose
  };
}

function createGeoCore() {
  const group = new THREE.Group();
  const coreGeometry = new THREE.SphereGeometry(0.52, 32, 16);
  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x041b32,
    emissive: 0x005d86,
    emissiveIntensity: 0.28,
    metalness: 0.08,
    roughness: 0.18,
    envMapIntensity: 0.85,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.42,
    transmission: 0.32,
    thickness: 0.9,
    ior: 1.56,
    depthWrite: false
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const latitudeLines = createGeoLatitudeLines();
  const meridianLines = createGeoMeridianLines();
  const dataTracks = createGeoCoreDataTracks();
  const innerFlow = createGeoCoreInnerFlow();
  const haloGeometry = new THREE.IcosahedronGeometry(0.88, 2);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x00c8ff,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);

  group.name = 'GeoCore';
  group.position.set(0.05, 0.04, -0.45);
  group.add(halo, core, latitudeLines.lines, meridianLines.lines, dataTracks.lines, innerFlow.points);

  function update(delta, time, entrance) {
    const pulse = 0.5 + Math.sin(time * 0.52) * 0.5;

    group.scale.setScalar(0.36 + entrance * 0.22);
    group.rotation.y += delta * 0.07;
    group.rotation.x = Math.sin(time * 0.08) * 0.06;
    core.rotation.z -= delta * 0.035;
    coreMaterial.emissiveIntensity = 0.2 + pulse * 0.18 + entrance * 0.1;
    coreMaterial.opacity = 0.16 + entrance * 0.22;
    latitudeLines.update(delta, time, entrance);
    meridianLines.update(delta, time, entrance);
    dataTracks.update(delta, time, entrance);
    innerFlow.update(delta, time, entrance);
    halo.rotation.y -= delta * 0.06;
    halo.scale.setScalar(1 + pulse * 0.04);
    haloMaterial.opacity = 0.02 + entrance * 0.045 + pulse * 0.018;
  }

  function dispose() {
    coreGeometry.dispose();
    coreMaterial.dispose();
    latitudeLines.dispose();
    meridianLines.dispose();
    dataTracks.dispose();
    innerFlow.dispose();
    haloGeometry.dispose();
    haloMaterial.dispose();
  }

  return {
    group,
    update,
    dispose
  };
}

function createGeoLatitudeLines() {
  const groupGeometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const color = new THREE.Color(0x00c8ff);
  const latitudes = [-0.46, -0.24, 0, 0.24, 0.46];
  const segments = 80;

  latitudes.forEach((y, latIndex) => {
    const radius = Math.sqrt(Math.max(0.58 * 0.58 - y * y, 0));

    for (let i = 0; i < segments; i += 1) {
      const gap = Math.sin(i * 0.7 + latIndex * 1.9);

      if (gap < -0.42 || i % 11 === 0) {
        continue;
      }

      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;

      positions.push(
        Math.cos(a0) * radius,
        y,
        Math.sin(a0) * radius,
        Math.cos(a1) * radius,
        y,
        Math.sin(a1) * radius
      );

      for (let c = 0; c < 2; c += 1) {
        colors.push(color.r * 0.42, color.g * 0.58, color.b);
      }
    }
  });

  groupGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  groupGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(groupGeometry, material);

  function update(delta, time, entrance) {
    lines.rotation.y += delta * 0.045;
    material.opacity = 0.08 + entrance * 0.2 + Math.sin(time * 0.32) * 0.02;
  }

  function dispose() {
    groupGeometry.dispose();
    material.dispose();
  }

  return { lines, update, dispose };
}

function createGeoMeridianLines() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const color = new THREE.Color(0x35ddff);
  const meridians = 7;
  const segments = 54;

  for (let m = 0; m < meridians; m += 1) {
    const angle = (m / meridians) * Math.PI;

    for (let i = 0; i < segments; i += 1) {
      if ((i + m) % 8 === 0) {
        continue;
      }

      const p0 = -Math.PI / 2 + (i / segments) * Math.PI;
      const p1 = -Math.PI / 2 + ((i + 1) / segments) * Math.PI;
      const r0 = Math.cos(p0) * 0.6;
      const r1 = Math.cos(p1) * 0.6;

      positions.push(
        Math.cos(angle) * r0,
        Math.sin(p0) * 0.6,
        Math.sin(angle) * r0,
        Math.cos(angle) * r1,
        Math.sin(p1) * 0.6,
        Math.sin(angle) * r1
      );

      for (let c = 0; c < 2; c += 1) {
        colors.push(color.r * 0.36, color.g * 0.52, color.b);
      }
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  function update(delta, time, entrance) {
    lines.rotation.y -= delta * 0.03;
    lines.rotation.z = Math.sin(time * 0.12) * 0.08;
    material.opacity = 0.06 + entrance * 0.16;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { lines, update, dispose };
}

function createGeoCoreDataTracks() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const color = new THREE.Color(0x8ff7ff);
  const tracks = [
    [0.76, 0.22, 0.1],
    [0.92, -0.14, 0.56],
    [1.08, 0.38, -0.36]
  ];
  const segments = 90;

  tracks.forEach(([radius, tilt, phase], trackIndex) => {
    for (let i = 0; i < segments; i += 1) {
      const breakPattern = Math.sin(i * 0.37 + phase * 4);

      if (breakPattern < -0.34 || i % 10 === 0) {
        continue;
      }

      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;

      positions.push(
        Math.cos(a0) * radius,
        Math.sin(a0 * 2 + phase) * 0.08 + tilt,
        Math.sin(a0) * radius * 0.32,
        Math.cos(a1) * radius,
        Math.sin(a1 * 2 + phase) * 0.08 + tilt,
        Math.sin(a1) * radius * 0.32
      );

      for (let c = 0; c < 2; c += 1) {
        const intensity = 0.42 + trackIndex * 0.12;

        colors.push(color.r * intensity, color.g * intensity, color.b);
      }
    }
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.rotation.set(0.34, -0.2, 0.18);

  function update(delta, time, entrance) {
    lines.rotation.y += delta * 0.055;
    lines.rotation.z = 0.18 + Math.sin(time * 0.11) * 0.04;
    material.opacity = 0.08 + entrance * 0.22 + Math.sin(time * 0.36) * 0.02;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { lines, update, dispose };
}

function createGeoCoreInnerFlow() {
  const count = 80;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const color = new THREE.Color(0xc8fbff);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const angle = (i / count) * Math.PI * 2;
    const radius = 0.18 + (i % 9) * 0.025;

    phases[i] = angle;
    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = Math.sin(angle * 2) * 0.12;
    positions[i3 + 2] = Math.sin(angle) * radius;
    colors[i3] = color.r * 0.78;
    colors[i3 + 1] = color.g * 0.9;
    colors[i3 + 2] = color.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.028,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  function update(delta, time, entrance) {
    const positionArray = positionAttribute.array;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const angle = phases[i] + time * (0.24 + (i % 5) * 0.018);
      const radius = 0.16 + (i % 9) * 0.024 + Math.sin(time * 0.4 + i) * 0.012;

      positionArray[i3] = Math.cos(angle) * radius;
      positionArray[i3 + 1] = Math.sin(angle * 1.7 + i) * 0.16;
      positionArray[i3 + 2] = Math.sin(angle) * radius;
    }

    positionAttribute.needsUpdate = true;
    material.opacity = 0.1 + entrance * 0.4;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createGeoNetwork() {
  const group = new THREE.Group();
  const nodes = createNetworkNodes();
  const connections = createNetworkConnections();
  const flows = createNetworkFlows();
  const events = createDataEvents();
  const brandSignal = createBrandSignalNode();

  group.name = 'GeoInformationNetwork';
  group.add(connections.lines, flows.points, events.points, nodes.points, brandSignal.group);

  function update(delta, time, entrance) {
    group.rotation.y = Math.sin(time * 0.018) * 0.075;
    group.rotation.z = Math.sin(time * 0.012) * 0.026;
    group.position.z = Math.sin(time * 0.015) * 0.12;
    nodes.update(time, entrance);
    connections.update(time, entrance);
    flows.update(delta, time, entrance);
    events.update(delta, time, entrance);
    brandSignal.update(delta, time, entrance);
  }

  function dispose() {
    nodes.dispose();
    connections.dispose();
    flows.dispose();
    events.dispose();
    brandSignal.dispose();
    group.clear();
  }

  return {
    group,
    update,
    dispose
  };
}

function createGeoBusinessSemanticLayer() {
  const group = new THREE.Group();
  const nodes = createGeoBusinessNodes();
  const connections = createGeoBusinessConnections();
  const flows = createGeoBusinessFlows();
  const particles = createGeoBusinessNodeParticles();
  const coreLabel = createGeoUiLabel('GEO SIGNAL CORE', [-0.78, -1.05, 0.14], 0.58);

  group.name = 'GeoBusinessSemanticLayer';
  group.add(connections.lines, flows.points, particles.points, nodes.points, coreLabel.group);

  function update(delta, time, entrance) {
    group.rotation.y = Math.sin(time * 0.02 + 0.5) * 0.035;
    group.position.y = Math.sin(time * 0.045) * 0.025;
    nodes.update(time, entrance);
    connections.update(time, entrance);
    flows.update(delta, time, entrance);
    particles.update(delta, time, entrance);
    coreLabel.update(delta, time, entrance, 3);
  }

  function dispose() {
    nodes.dispose();
    connections.dispose();
    flows.dispose();
    particles.dispose();
    coreLabel.dispose();
    group.clear();
  }

  return {
    group,
    update,
    dispose
  };
}

function createGeoBusinessNodes() {
  const group = new THREE.Group();
  const pointGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(GEO_BUSINESS_NODES.length * 3);
  const basePositions = new Float32Array(GEO_BUSINESS_NODES.length * 3);
  const colors = new Float32Array(GEO_BUSINESS_NODES.length * 3);
  const color = new THREE.Color(0xffffff);
  const labels = [];
  const nodeVisuals = [];

  GEO_BUSINESS_NODES.forEach((node, index) => {
    const i3 = index * 3;
    const style = DATA_NODE_STYLE[node.type];
    const nodeVisual = createGeoBusinessNodeVisual(node);
    const label = createGeoSemanticLabel(node.label, node.metric, [
      node.position[0] + 0.2,
      node.position[1] - 0.28,
      node.position[2] + 0.02
    ], node.scale);

    positions[i3] = node.position[0];
    positions[i3 + 1] = node.position[1];
    positions[i3 + 2] = node.position[2];
    basePositions[i3] = node.position[0];
    basePositions[i3 + 1] = node.position[1];
    basePositions[i3 + 2] = node.position[2];
    color.copy(style.color).lerp(new THREE.Color(0xffffff), node.type === 'brand' ? 0.38 : 0.14);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
    nodeVisuals.push(nodeVisual);
    labels.push(label);
    group.add(nodeVisual.group);
    group.add(label.group);
  });

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  pointGeometry.setAttribute('position', positionAttribute);
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.13,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.66,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(pointGeometry, material);

  points.name = 'GeoBusinessSemanticNodes';
  group.add(points);

  function update(time, entrance) {
    const positionArray = positionAttribute.array;

    GEO_BUSINESS_NODES.forEach((node, index) => {
      const i3 = index * 3;
      const phase = index * 0.95;

      positionArray[i3] = basePositions[i3] + Math.sin(time * 0.1 + phase) * 0.025 * node.scale;
      positionArray[i3 + 1] = basePositions[i3 + 1] + Math.cos(time * 0.13 + phase) * 0.035 * node.scale;
      positionArray[i3 + 2] = basePositions[i3 + 2] + Math.sin(time * 0.08 + phase) * 0.045;
      nodeVisuals[index].update(time, entrance, index);
      labels[index].update(time, entrance, index);
    });

    positionAttribute.needsUpdate = true;
    material.opacity = 0.24 + entrance * 0.68 + Math.sin(time * 0.42) * 0.045;
  }

  function dispose() {
    pointGeometry.dispose();
    material.dispose();
    labels.forEach((label) => {
      label.dispose();
    });
    nodeVisuals.forEach((nodeVisual) => {
      nodeVisual.dispose();
    });
    group.clear();
  }

  return {
    points: group,
    update,
    dispose
  };
}

function createGeoBusinessNodeVisual(node) {
  const group = new THREE.Group();
  const style = DATA_NODE_STYLE[node.type];
  const coreGeometry = new THREE.IcosahedronGeometry(0.08 * node.scale, 1);
  const haloGeometry = new THREE.RingGeometry(0.18 * node.scale, 0.19 * node.scale, 48);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: style.color,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true,
    fog: false
  });
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: style.color,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const haloA = new THREE.Mesh(haloGeometry, haloMaterial);
  const haloB = new THREE.Mesh(haloGeometry, haloMaterial.clone());

  group.name = `GeoBusiness${node.label.replace(/\s+/g, '')}Visual`;
  group.position.set(node.position[0], node.position[1], node.position[2]);
  haloA.rotation.x = Math.PI * 0.5;
  haloB.rotation.y = Math.PI * 0.5;
  group.add(core, haloA, haloB);

  function update(time, entrance, index) {
    const pulse = 0.5 + Math.sin(time * (0.62 + index * 0.06) + index * 0.8) * 0.5;

    group.position.x = node.position[0] + Math.sin(time * 0.1 + index) * 0.025 * node.scale;
    group.position.y = node.position[1] + Math.cos(time * 0.13 + index) * 0.035 * node.scale;
    group.position.z = node.position[2] + Math.sin(time * 0.08 + index) * 0.045;
    group.rotation.y += 0.006 + index * 0.0008;
    group.rotation.z -= 0.003;
    group.scale.setScalar(1 + pulse * 0.08 * entrance);
    coreMaterial.opacity = 0.2 + entrance * 0.62 + pulse * 0.16;
    haloMaterial.opacity = 0.04 + entrance * 0.18 + pulse * 0.1;
    haloB.material.opacity = 0.03 + entrance * 0.14 + pulse * 0.08;
  }

  function dispose() {
    coreGeometry.dispose();
    haloGeometry.dispose();
    coreMaterial.dispose();
    haloMaterial.dispose();
    haloB.material.dispose();
  }

  return {
    group,
    update,
    dispose
  };
}

function createGeoBusinessNodeParticles() {
  const particlesPerNode = 18;
  const count = GEO_BUSINESS_NODES.length * particlesPerNode;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const nodeIndex = new Uint8Array(count);
  const color = new THREE.Color(0xffffff);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const sourceIndex = Math.floor(i / particlesPerNode);
    const node = GEO_BUSINESS_NODES[sourceIndex];

    nodeIndex[i] = sourceIndex;
    phases[i] = (i % particlesPerNode) / particlesPerNode;
    color.copy(DATA_NODE_STYLE[node.type].color).lerp(new THREE.Color(0xffffff), i % 9 === 0 ? 0.4 : 0.08);
    colors[i3] = color.r * 0.7;
    colors[i3 + 1] = color.g * 0.78;
    colors[i3 + 2] = color.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.026,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GeoBusinessNodeLocalDataParticles';

  function update(delta, time, entrance) {
    const positionArray = positionAttribute.array;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const node = GEO_BUSINESS_NODES[nodeIndex[i]];
      const angle = phases[i] * Math.PI * 2 + time * (0.18 + node.scale * 0.035);
      const layer = (i % particlesPerNode) / particlesPerNode;
      const radius = (0.14 + layer * 0.18) * node.scale;
      const drift = Math.sin(time * 0.42 + i * 0.7) * 0.018;

      positionArray[i3] = node.position[0] + Math.cos(angle) * radius;
      positionArray[i3 + 1] = node.position[1] + Math.sin(angle * 1.4) * radius * 0.38 + drift;
      positionArray[i3 + 2] = node.position[2] + Math.sin(angle) * radius * 0.5;
    }

    positionAttribute.needsUpdate = true;
    points.rotation.y += delta * 0.006;
    material.opacity = 0.06 + entrance * 0.36 + Math.sin(time * 0.3) * 0.025;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose
  };
}

function createGeoBusinessConnections() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(GEO_BUSINESS_CONNECTIONS.length * 2 * 3);
  const colors = new Float32Array(GEO_BUSINESS_CONNECTIONS.length * 2 * 3);
  const baseColors = new Float32Array(GEO_BUSINESS_CONNECTIONS.length * 2 * 3);
  const color = new THREE.Color(0x7ff5ff);

  GEO_BUSINESS_CONNECTIONS.forEach(([from, to], index) => {
    const fromNode = GEO_BUSINESS_NODES[from];
    const toNode = GEO_BUSINESS_NODES[to];
    const i6 = index * 6;

    positions[i6] = fromNode.position[0];
    positions[i6 + 1] = fromNode.position[1];
    positions[i6 + 2] = fromNode.position[2];
    positions[i6 + 3] = toNode.position[0];
    positions[i6 + 4] = toNode.position[1];
    positions[i6 + 5] = toNode.position[2];

    for (let i = 0; i < 2; i += 1) {
      const c3 = index * 6 + i * 3;
      const mixAmount = i === 0 ? 0.18 : 0.52;

      color.copy(DATA_NODE_STYLE[fromNode.type].color).lerp(DATA_NODE_STYLE[toNode.type].color, mixAmount);
      colors[c3] = color.r * 0.54;
      colors[c3 + 1] = color.g * 0.58;
      colors[c3 + 2] = color.b * 0.66;
      baseColors[c3] = colors[c3];
      baseColors[c3 + 1] = colors[c3 + 1];
      baseColors[c3 + 2] = colors[c3 + 2];
    }
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const colorAttribute = new THREE.BufferAttribute(colors, 3);

  colorAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('color', colorAttribute);

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = 'GeoBusinessSemanticConnections';

  function update(time, entrance) {
    const colorArray = colorAttribute.array;

    GEO_BUSINESS_CONNECTIONS.forEach(([from, to], index) => {
      const isBrandPath = GEO_BUSINESS_NODES[to].type === 'brand';
      const signalPulse = Math.max(0, Math.sin(time * (0.72 + index * 0.04) + index * 0.85));
      const boost = signalPulse * signalPulse * (isBrandPath ? 1.15 : 0.72);

      for (let i = 0; i < 2; i += 1) {
        const c3 = index * 6 + i * 3;

        colorArray[c3] = baseColors[c3] * (1 + boost);
        colorArray[c3 + 1] = baseColors[c3 + 1] * (1 + boost * 0.95);
        colorArray[c3 + 2] = baseColors[c3 + 2] * (1 + boost * 0.82);
      }
    });

    colorAttribute.needsUpdate = true;
    material.opacity = 0.06 + entrance * 0.34 + Math.sin(time * 0.22) * 0.025;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    lines,
    update,
    dispose
  };
}

function createGeoBusinessFlows() {
  const count = 72;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const connectionIndex = new Uint8Array(count);
  const color = new THREE.Color(0xffffff);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const [from, to] = GEO_BUSINESS_CONNECTIONS[i % GEO_BUSINESS_CONNECTIONS.length];

    phases[i] = (i * 0.037 + (i % 5) * 0.1) % 1;
    connectionIndex[i] = i % GEO_BUSINESS_CONNECTIONS.length;
    color.copy(DATA_NODE_STYLE[GEO_BUSINESS_NODES[from].type].color).lerp(
      DATA_NODE_STYLE[GEO_BUSINESS_NODES[to].type].color,
      0.58
    );
    colors[i3] = color.r * 0.72;
    colors[i3 + 1] = color.g * 0.76;
    colors[i3 + 2] = color.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.04,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GeoBusinessSignalFlow';

  function update(delta, time, entrance) {
    const positionArray = positionAttribute.array;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const [from, to] = GEO_BUSINESS_CONNECTIONS[connectionIndex[i]];
      const fromNode = GEO_BUSINESS_NODES[from];
      const toNode = GEO_BUSINESS_NODES[to];
      const speed = DATA_NODE_STYLE[fromNode.type].flowSpeed + (toNode.type === 'brand' ? 0.018 : 0.006);
      const t = (phases[i] + time * speed) % 1;
      const easedT = smoothstep(0, 1, t);
      const arc = Math.sin(easedT * Math.PI) * (0.08 + fromNode.scale * 0.035);

      positionArray[i3] = lerp(fromNode.position[0], toNode.position[0], easedT);
      positionArray[i3 + 1] = lerp(fromNode.position[1], toNode.position[1], easedT) + arc;
      positionArray[i3 + 2] = lerp(fromNode.position[2], toNode.position[2], easedT) + Math.sin(time * 0.6 + i) * 0.018;
    }

    positionAttribute.needsUpdate = true;
    points.rotation.y += delta * 0.01;
    material.opacity = 0.08 + entrance * 0.48 + Math.sin(time * 0.28) * 0.03;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose
  };
}

function createGeoSemanticLabel(label, metric, position, scale) {
  const group = new THREE.Group();
  const texture = createTextTexture(`${label}  ${metric}`);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);

  group.name = `GeoSemantic${label.replace(/\s+/g, '')}`;
  group.position.set(position[0], position[1], position[2]);
  sprite.scale.set(0.66 * scale, 0.13 * scale, 1);
  group.add(sprite);

  function update(time, entrance, index) {
    const pulse = 0.5 + Math.sin(time * (0.36 + index * 0.04) + index) * 0.5;

    group.position.y = position[1] + Math.sin(time * 0.12 + index) * 0.025;
    material.opacity = 0.04 + entrance * 0.44 + pulse * 0.035;
  }

  function dispose() {
    texture.dispose();
    material.dispose();
  }

  return {
    group,
    update,
    dispose
  };
}

function createNetworkNodes() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(GEO_NODES.length * 3);
  const basePositions = new Float32Array(GEO_NODES.length * 3);
  const colors = new Float32Array(GEO_NODES.length * 3);
  const sizes = new Float32Array(GEO_NODES.length);
  const color = new THREE.Color(0x00d8ff);
  const white = new THREE.Color(0xe6fbff);

  GEO_NODES.forEach((node, index) => {
    const i3 = index * 3;

    positions[i3] = node.position[0];
    positions[i3 + 1] = node.position[1];
    positions[i3 + 2] = node.position[2];
    basePositions[i3] = node.position[0];
    basePositions[i3 + 1] = node.position[1];
    basePositions[i3 + 2] = node.position[2];
    color.copy(DATA_NODE_STYLE[node.type].color).lerp(white, node.intensity * 0.22);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
    sizes[index] = DATA_NODE_STYLE[node.type].size * (0.7 + node.scale * 0.45);
  });

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('nodeSize', new THREE.BufferAttribute(sizes, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.082,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.74,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GeoNetworkNodes';

  function update(time, entrance) {
    const positionArray = positionAttribute.array;

    GEO_NODES.forEach((node, index) => {
      const i3 = index * 3;
      const phase = index * 0.73;

      positionArray[i3] = basePositions[i3] + Math.sin(time * 0.12 + phase) * 0.035 * node.scale;
      positionArray[i3 + 1] = basePositions[i3 + 1] + Math.cos(time * 0.16 + phase) * 0.05 * node.scale;
      positionArray[i3 + 2] = basePositions[i3 + 2] + Math.sin(time * 0.1 + phase) * 0.12 * node.scale;
    });

    positionAttribute.needsUpdate = true;
    material.opacity = 0.28 + entrance * 0.5 + Math.sin(time * 0.38) * 0.035;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose
  };
}

function createNetworkConnections() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(GEO_CONNECTIONS.length * 2 * 3);
  const colors = new Float32Array(GEO_CONNECTIONS.length * 2 * 3);
  const baseColors = new Float32Array(GEO_CONNECTIONS.length * 2 * 3);
  const color = new THREE.Color(0x0aa9ff);
  const white = new THREE.Color(0xe8fbff);

  GEO_CONNECTIONS.forEach(([from, to], index) => {
    const fromNode = GEO_NODES[from];
    const toNode = GEO_NODES[to];
    const i6 = index * 6;

    positions[i6] = fromNode.position[0];
    positions[i6 + 1] = fromNode.position[1];
    positions[i6 + 2] = fromNode.position[2];
    positions[i6 + 3] = toNode.position[0];
    positions[i6 + 4] = toNode.position[1];
    positions[i6 + 5] = toNode.position[2];

    for (let i = 0; i < 2; i += 1) {
      const c3 = index * 6 + i * 3;
      const typeMix = fromNode.type === toNode.type ? 0.12 : 0.24;
      const brandBoost = fromNode.type === 'brand' || toNode.type === 'brand' ? 0.18 : 0;
      const intensity = 0.16 + brandBoost + (fromNode.intensity + toNode.intensity) * 0.12;

      color.copy(DATA_NODE_STYLE[fromNode.type].color).lerp(DATA_NODE_STYLE[toNode.type].color, 0.5).lerp(white, typeMix);
      colors[c3] = color.r * intensity;
      colors[c3 + 1] = color.g * intensity;
      colors[c3 + 2] = color.b * intensity;
      baseColors[c3] = colors[c3];
      baseColors[c3 + 1] = colors[c3 + 1];
      baseColors[c3 + 2] = colors[c3 + 2];
    }
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const colorAttribute = new THREE.BufferAttribute(colors, 3);

  colorAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('color', colorAttribute);
  geometry.computeBoundingSphere();

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = 'GeoNetworkConnections';

  function update(time, entrance) {
    const colorArray = colorAttribute.array;

    GEO_CONNECTIONS.forEach((connection, index) => {
      const [from, to] = connection;
      const isBrandSignal = from === BRAND_NODE_INDEX || to === BRAND_NODE_INDEX;
      const pulse = Math.max(0, Math.sin(time * (0.62 + (index % 4) * 0.08) + index * 0.71));
      const brandPulse = isBrandSignal ? Math.max(0, Math.sin(time * 1.08 + index * 0.43)) : 0;
      const eventBoost = pulse * pulse * (isBrandSignal ? 1.15 : 0.7) + brandPulse * brandPulse * 0.55;

      for (let i = 0; i < 2; i += 1) {
        const c3 = index * 6 + i * 3;

        colorArray[c3] = baseColors[c3] * (1 + eventBoost);
        colorArray[c3 + 1] = baseColors[c3 + 1] * (1 + eventBoost * 0.9);
        colorArray[c3 + 2] = baseColors[c3 + 2] * (1 + eventBoost * 0.7);
      }
    });

    colorAttribute.needsUpdate = true;
    material.opacity = 0.1 + entrance * 0.38 + Math.sin(time * 0.2) * 0.025;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    lines,
    update,
    dispose
  };
}

function createNetworkFlows() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(FLOW_PARTICLE_COUNT * 3);
  const colors = new Float32Array(FLOW_PARTICLE_COUNT * 3);
  const phases = new Float32Array(FLOW_PARTICLE_COUNT);
  const offsets = new Float32Array(FLOW_PARTICLE_COUNT);
  const connectionIndex = new Uint8Array(FLOW_PARTICLE_COUNT);
  const color = new THREE.Color(0x7ff5ff);
  const white = new THREE.Color(0xffffff);

  for (let i = 0; i < FLOW_PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    const [from, to] = GEO_CONNECTIONS[i % GEO_CONNECTIONS.length];
    const fromNode = GEO_NODES[from];

    phases[i] = (i / FLOW_PARTICLE_COUNT + (i % 7) * 0.071) % 1;
    offsets[i] = Math.sin(i * 12.9898) * 0.08;
    connectionIndex[i] = i % GEO_CONNECTIONS.length;
    color.copy(DATA_NODE_STYLE[fromNode.type].color).lerp(white, i % 11 === 0 ? 0.42 : 0.08);
    colors[i3] = color.r * (0.5 + (i % 5) * 0.08);
    colors[i3 + 1] = color.g * (0.58 + (i % 3) * 0.07);
    colors[i3 + 2] = color.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.03,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.56,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GeoDataFlowParticles';

  function update(delta, time, entrance) {
    const positionArray = positionAttribute.array;

    for (let i = 0; i < FLOW_PARTICLE_COUNT; i += 1) {
      const i3 = i * 3;
      const [from, to] = GEO_CONNECTIONS[connectionIndex[i]];
      const fromNode = GEO_NODES[from];
      const toNode = GEO_NODES[to];
      const isBrandSignal = to === BRAND_NODE_INDEX || from === BRAND_NODE_INDEX;
      const speed = DATA_NODE_STYLE[fromNode.type].flowSpeed + (i % 4) * 0.006 + (isBrandSignal ? 0.012 : 0);
      const t = (phases[i] + time * speed) % 1;
      const easedT = smoothstep(0, 1, t);
      const eventPulse = Math.max(0, Math.sin(time * 1.5 + connectionIndex[i] * 0.83));
      const brandPull = isBrandSignal ? Math.pow(easedT, 2) * 0.08 : 0;
      const arc = Math.sin(easedT * Math.PI) * (0.1 + eventPulse * 0.08 + brandPull);
      const shimmer = Math.sin(time * 0.8 + i * 0.41) * 0.025;

      positionArray[i3] = lerp(fromNode.position[0], toNode.position[0], easedT) + offsets[i] * arc;
      positionArray[i3 + 1] = lerp(fromNode.position[1], toNode.position[1], easedT) + shimmer + arc * 0.42;
      positionArray[i3 + 2] = lerp(fromNode.position[2], toNode.position[2], easedT) - arc * 0.25;
    }

    positionAttribute.needsUpdate = true;
    material.opacity = 0.12 + entrance * 0.58 + Math.sin(time * 0.34) * 0.035;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose
  };
}

function createBrandSignalNode() {
  const group = new THREE.Group();
  const brandNode = GEO_NODES[BRAND_NODE_INDEX];
  const coreGeometry = new THREE.IcosahedronGeometry(0.1, 1);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xdafcff,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true,
    fog: false
  });
  const haloGeometry = new THREE.RingGeometry(0.18, 0.19, 48);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x78f4ff,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const haloA = new THREE.Mesh(haloGeometry, haloMaterial);
  const haloB = new THREE.Mesh(haloGeometry, haloMaterial.clone());

  group.name = 'GeoBrandSignalNode';
  group.position.set(brandNode.position[0], brandNode.position[1], brandNode.position[2]);
  haloA.rotation.x = Math.PI * 0.5;
  haloB.rotation.y = Math.PI * 0.5;
  group.add(core, haloA, haloB);

  function update(delta, time, entrance) {
    const pulse = 0.5 + Math.sin(time * 0.72) * 0.5;

    group.position.y = brandNode.position[1] + Math.sin(time * 0.18) * 0.04;
    group.rotation.y += delta * 0.18;
    group.rotation.z -= delta * 0.08;
    group.scale.setScalar(0.82 + entrance * 0.38 + pulse * 0.06);
    coreMaterial.opacity = 0.18 + entrance * 0.54 + pulse * 0.12;
    haloMaterial.opacity = 0.08 + entrance * 0.24 + pulse * 0.08;
    haloB.material.opacity = 0.06 + entrance * 0.18 + pulse * 0.06;
  }

  function dispose() {
    coreGeometry.dispose();
    coreMaterial.dispose();
    haloGeometry.dispose();
    haloMaterial.dispose();
    haloB.material.dispose();
  }

  return {
    group,
    update,
    dispose
  };
}

function createDataEvents() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(DATA_EVENT_COUNT * 3);
  const colors = new Float32Array(DATA_EVENT_COUNT * 3);
  const nodeIndex = new Uint8Array(DATA_EVENT_COUNT);
  const phases = new Float32Array(DATA_EVENT_COUNT);
  const radii = new Float32Array(DATA_EVENT_COUNT);
  const color = new THREE.Color(0xffffff);

  for (let i = 0; i < DATA_EVENT_COUNT; i += 1) {
    const i3 = i * 3;
    const sourceIndex = (i * 5 + Math.floor(i / 3)) % GEO_NODES.length;
    const sourceNode = GEO_NODES[sourceIndex];
    const typeColor = DATA_NODE_STYLE[sourceNode.type].color;
    const whiteMix = i % 6 === 0 ? 0.52 : 0.18;

    nodeIndex[i] = sourceIndex;
    phases[i] = (i * 0.137) % 1;
    radii[i] = 0.05 + (i % 7) * 0.018;
    color.copy(typeColor).lerp(new THREE.Color(0xffffff), whiteMix);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.068,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GeoRandomDataEvents';

  function update(delta, time, entrance) {
    const positionArray = positionAttribute.array;
    let strongestPulse = 0;

    for (let i = 0; i < DATA_EVENT_COUNT; i += 1) {
      const i3 = i * 3;
      const sourceNode = GEO_NODES[nodeIndex[i]];
      const localTime = (time * (0.18 + (i % 5) * 0.018) + phases[i]) % 1;
      const burst = Math.pow(Math.max(0, Math.sin(localTime * Math.PI)), 5);
      const angle = time * (0.48 + (i % 4) * 0.08) + i * 1.77;
      const radius = radii[i] + burst * (0.2 + sourceNode.intensity * 0.18);

      positionArray[i3] = sourceNode.position[0] + Math.cos(angle) * radius;
      positionArray[i3 + 1] = sourceNode.position[1] + Math.sin(angle * 1.3) * radius * 0.72;
      positionArray[i3 + 2] = sourceNode.position[2] + Math.sin(angle) * radius * 0.54 - burst * 0.08;
      strongestPulse = Math.max(strongestPulse, burst);
    }

    positionAttribute.needsUpdate = true;
    points.rotation.y += delta * 0.018;
    material.opacity = (0.04 + entrance * 0.26) + strongestPulse * entrance * 0.14;
    material.size = 0.045 + strongestPulse * 0.036;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose
  };
}

function createGeoStarField() {
  const random = seededRandom(4129);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const color = new THREE.Color(0x0b4d80);
  const cyan = new THREE.Color(0x3fdcff);

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const i3 = i * 3;
    const depth = random();

    positions[i3] = (random() - 0.5) * (12 + depth * 12);
    positions[i3 + 1] = (random() - 0.5) * (7 + depth * 8);
    positions[i3 + 2] = -2 - random() * 18;
    color.set(0x0b4d80).lerp(cyan, random() * 0.26);
    colors[i3] = color.r * (0.22 + depth * 0.26);
    colors[i3 + 1] = color.g * (0.22 + depth * 0.26);
    colors[i3 + 2] = color.b * (0.22 + depth * 0.26);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.05,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GeoDeepSpaceDust';

  function update(delta, time, entrance) {
    points.rotation.y += delta * 0.006;
    points.rotation.z = Math.sin(time * 0.018) * 0.025;
    material.opacity = 0.08 + entrance * 0.22;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose
  };
}

function createGeoUiLayer() {
  const group = new THREE.Group();
  const labels = [
    createGeoUiLabel('AI ANSWER', [-3.05, 2.15, -0.6], 0.9),
    createGeoUiLabel('AI CITATION', [2.35, 1.85, -0.75], 0.78),
    createGeoUiLabel('KEYWORD SIGNAL', [-2.25, -2.05, -0.55], 0.72),
    createGeoUiLabel('BRAND SIGNAL', [0.88, 0.88, 0.08], 0.66)
  ];

  group.name = 'GeoFutureUiLayer';

  labels.forEach((label) => {
    group.add(label.group);
  });

  function update(delta, time, entrance) {
    labels.forEach((label, index) => {
      label.update(delta, time, entrance, index);
    });
  }

  function dispose() {
    labels.forEach((label) => {
      label.dispose();
    });
    group.clear();
  }

  return { group, update, dispose };
}

function createGeoUiLabel(text, position, intensity) {
  const group = new THREE.Group();
  const anchorGeometry = new THREE.BufferGeometry();
  const anchorPositions = new Float32Array([
    0, 0, 0,
    0.34, 0, 0,
    0.42, -0.08, 0
  ]);
  const anchorColors = new Float32Array([
    0.1, 0.9, 1,
    0.05, 0.55, 0.82,
    0.05, 0.42, 0.62
  ]);
  const nodeGeometry = new THREE.BufferGeometry();
  const nodePositions = new Float32Array([0, 0, 0]);
  const nodeColors = new Float32Array([0.75, 0.98, 1]);
  const labelTexture = createTextTexture(text);
  const labelMaterial = new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  anchorGeometry.setAttribute('position', new THREE.BufferAttribute(anchorPositions, 3));
  anchorGeometry.setAttribute('color', new THREE.BufferAttribute(anchorColors, 3));
  nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
  nodeGeometry.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));

  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const pointMaterial = new THREE.PointsMaterial({
    size: 0.052,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const line = new THREE.Line(anchorGeometry, lineMaterial);
  const point = new THREE.Points(nodeGeometry, pointMaterial);
  const sprite = new THREE.Sprite(labelMaterial);

  group.name = `GeoUi${text.replace(/\s+/g, '')}`;
  group.position.set(position[0], position[1], position[2]);
  sprite.position.set(0.88, -0.02, 0);
  sprite.scale.set(0.92, 0.18, 1);
  group.add(line, point, sprite);

  function update(delta, time, entrance, index) {
    const pulse = 0.5 + Math.sin(time * (0.48 + index * 0.08)) * 0.5;

    group.position.y = position[1] + Math.sin(time * 0.16 + index) * 0.035;
    group.rotation.z = Math.sin(time * 0.08 + index) * 0.018;
    lineMaterial.opacity = (0.08 + entrance * 0.28 + pulse * 0.04) * intensity;
    pointMaterial.opacity = (0.12 + entrance * 0.44 + pulse * 0.08) * intensity;
    labelMaterial.opacity = (0.05 + entrance * 0.5 + pulse * 0.06) * intensity;
  }

  function dispose() {
    anchorGeometry.dispose();
    nodeGeometry.dispose();
    lineMaterial.dispose();
    pointMaterial.dispose();
    labelTexture.dispose();
    labelMaterial.dispose();
  }

  return { group, update, dispose };
}

function createTextTexture(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 512;
  canvas.height = 128;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(120, 236, 255, 0.92)';
  context.font = '700 42px Inter, Arial, sans-serif';
  context.letterSpacing = '2px';
  context.fillText(text, 22, 74);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

function createGeoBackdrop() {
  const geometry = new THREE.PlaneGeometry(16, 10, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x031123,
    transparent: true,
    opacity: 0.04,
    depthWrite: false,
    fog: false
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'GeoSceneBackdrop';
  mesh.position.set(0, 0.2, -2.2);

  function update(time, entrance) {
    material.opacity = 0.04 + entrance * 0.22;
    mesh.scale.setScalar(1 + Math.sin(time * 0.08) * 0.015);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    mesh,
    update,
    dispose
  };
}

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return x * x * (3 - 2 * x);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

export const geoSceneManager = {
  createGeoScene
};
