import * as THREE from 'three';

const NODE_DEFINITIONS = [
  { type: 'GEO', position: [-3.6, 1.4, -4.8], scale: 0.72, intensity: 0.5 },
  { type: 'GEO', position: [3.2, -0.8, -5.6], scale: 0.56, intensity: 0.38 },
  { type: 'GEO', position: [-4.8, -1.7, -7.2], scale: 0.48, intensity: 0.34 },
  { type: 'GEO', position: [4.6, 1.9, -8.4], scale: 0.42, intensity: 0.3 },
  { type: '5A', position: [-2.1, -1.2, -3.5], scale: 0.62, intensity: 0.46 },
  { type: '5A', position: [2.4, 1.2, -4.2], scale: 0.58, intensity: 0.42 },
  { type: '5A', position: [-3.2, 2.6, -6.6], scale: 0.44, intensity: 0.34 },
  { type: '5A', position: [3.8, -2.4, -7.8], scale: 0.4, intensity: 0.3 },
  { type: 'Brand', position: [-1.35, 1.95, -2.7], scale: 0.76, intensity: 0.5 },
  { type: 'Brand', position: [1.55, -1.6, -3.1], scale: 0.68, intensity: 0.46 },
  { type: 'Brand', position: [-5.4, 0.2, -9.4], scale: 0.38, intensity: 0.28 },
  { type: 'Brand', position: [5.1, 0.55, -9.9], scale: 0.36, intensity: 0.26 }
];

const NODE_STYLE = {
  GEO: {
    color: new THREE.Color(0x1b7dff),
    size: 0.065,
    opacity: 0.46
  },
  '5A': {
    color: new THREE.Color(0x00d5ff),
    size: 0.055,
    opacity: 0.42
  },
  Brand: {
    color: new THREE.Color(0x8df7ff),
    size: 0.07,
    opacity: 0.5
  }
};

export function createNodeSystem() {
  const group = new THREE.Group();
  const nodes = NODE_DEFINITIONS.map((node, index) => ({
    type: node.type,
    position: new THREE.Vector3(node.position[0], node.position[1], node.position[2]),
    scale: node.scale,
    intensity: node.intensity,
    phase: index * 0.73
  }));
  const layers = Object.keys(NODE_STYLE).map((type) => createNodeLayer(type, nodes));

  group.name = 'ActiveTheoryNodeSystem';
  group.position.set(0, 0.15, 0);

  layers.forEach((layer) => {
    group.add(layer.points);
  });

  function update(delta, time) {
    group.rotation.y = Math.sin(time * 0.018) * 0.018;

    layers.forEach((layer) => {
      layer.update(delta, time);
    });
  }

  function dispose() {
    layers.forEach((layer) => {
      layer.dispose();
    });
    group.clear();
  }

  return {
    group,
    nodes,
    update,
    dispose
  };
}

function createNodeLayer(type, allNodes) {
  const layerNodes = allNodes.filter((node) => node.type === type);
  const style = NODE_STYLE[type];
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(layerNodes.length * 3);
  const colors = new Float32Array(layerNodes.length * 3);
  const basePositions = new Float32Array(layerNodes.length * 3);
  const color = new THREE.Color();

  layerNodes.forEach((node, index) => {
    const i3 = index * 3;

    positions[i3] = node.position.x;
    positions[i3 + 1] = node.position.y;
    positions[i3 + 2] = node.position.z;
    basePositions[i3] = node.position.x;
    basePositions[i3 + 1] = node.position.y;
    basePositions[i3 + 2] = node.position.z;

    color.copy(style.color).multiplyScalar(0.58 + node.intensity * 0.42);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  });

  const positionAttribute = new THREE.BufferAttribute(positions, 3);

  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: style.size,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: style.opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = `ActiveTheory${type}Nodes`;

  function update(delta, time) {
    const positionArray = positionAttribute.array;
    let layerPulse = 0;

    layerNodes.forEach((node, index) => {
      const i3 = index * 3;
      const drift = Math.sin(time * (0.18 + node.scale * 0.05) + node.phase) * 0.055 * node.scale;
      const sideDrift = Math.cos(time * (0.12 + node.intensity * 0.04) + node.phase) * 0.035 * node.scale;
      const depthDrift = Math.sin(time * 0.09 + node.phase) * 0.08 * node.scale;
      const pulse = 0.5 + Math.sin(time * 0.42 + node.phase) * 0.5;

      positionArray[i3] = basePositions[i3] + sideDrift;
      positionArray[i3 + 1] = basePositions[i3 + 1] + drift;
      positionArray[i3 + 2] = basePositions[i3 + 2] + depthDrift;
      layerPulse += pulse * node.intensity;
    });

    positionAttribute.needsUpdate = true;
    material.opacity = style.opacity * (0.72 + layerPulse / Math.max(layerNodes.length, 1) * 0.32);
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

export const nodeSystemManager = {
  createNodeSystem
};
