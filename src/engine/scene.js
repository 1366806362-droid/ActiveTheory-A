import * as THREE from 'three';

export function createScene(material) {
  const scene = new THREE.Scene();

  const ground = createGroundPlane();
  const grid = createGroundGrid();
  const background = createBackgroundPlane();
  const environment = createEnvironmentLayer();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const cube = new THREE.Mesh(geometry, material);
  const cubeEdges = createCubeEdges(geometry);

  cube.add(cubeEdges);
  scene.add(background, environment, ground, grid, cube);

  return {
    scene,
    cube,
    ground,
    grid,
    background,
    environment
  };
}

function createGroundPlane() {
  const geometry = new THREE.PlaneGeometry(20, 20);
  const material = new THREE.MeshStandardMaterial({
    color: 0x070f18,
    metalness: 0.05,
    roughness: 0.9
  });
  const ground = new THREE.Mesh(geometry, material);

  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.85, 0);

  return ground;
}

function createGroundGrid() {
  const grid = new THREE.GridHelper(20, 40, 0x00ccff, 0x061522);

  grid.position.y = -0.84;
  setGridMaterialOpacity(grid, 0.14);

  return grid;
}

function createBackgroundPlane() {
  const geometry = new THREE.PlaneGeometry(20, 20);
  const material = new THREE.MeshStandardMaterial({
    color: 0x02050d,
    metalness: 0,
    roughness: 1
  });
  const background = new THREE.Mesh(geometry, material);

  background.position.set(0, 2, -5);
  background.scale.setScalar(1.25);

  return background;
}

function createCubeEdges(geometry) {
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x00ccff,
    opacity: 0.35,
    transparent: true
  });

  return new THREE.LineSegments(edgeGeometry, edgeMaterial);
}

function createEnvironmentLayer() {
  const environment = new THREE.Group();

  createVerticalPillars().forEach((pillar) => {
    environment.add(pillar);
  });
  createFloatingFrames().forEach((frame) => {
    environment.add(frame);
  });
  createVolumePlanes().forEach((plane) => {
    environment.add(plane);
  });

  return environment;
}

function createVerticalPillars() {
  const material = new THREE.MeshStandardMaterial({
    color: 0x0a1626,
    emissive: 0x020b14,
    emissiveIntensity: 0.25,
    metalness: 0.15,
    roughness: 0.85
  });
  const pillarData = [
    { height: 3.2, width: 0.08, position: [-2.2, -1.8] },
    { height: 4.4, width: 0.1, position: [2.1, -2.2] },
    { height: 3.8, width: 0.09, position: [-1.1, -2.7] },
    { height: 5, width: 0.12, position: [1.2, -3.1] }
  ];

  return pillarData.map(({ height, width, position }) => {
    const geometry = new THREE.BoxGeometry(width, height, width);
    const pillar = new THREE.Mesh(geometry, material);

    pillar.position.set(position[0], -0.85 + height / 2, position[1]);

    return pillar;
  });
}

function createFloatingFrames() {
  const frameMaterial = new THREE.LineBasicMaterial({
    color: 0x00ccff,
    opacity: 0.25,
    transparent: true
  });
  const frameData = [
    {
      size: [1.7, 2.4],
      position: [-1.9, 1.15, -1.9],
      rotation: [0.18, 0.45, -0.08]
    },
    {
      size: [1.4, 2],
      position: [1.8, 1.25, -2.3],
      rotation: [-0.12, -0.5, 0.1]
    }
  ];

  return frameData.map(({ size, position, rotation }) => {
    const geometry = new THREE.PlaneGeometry(size[0], size[1]);
    const edges = new THREE.EdgesGeometry(geometry);
    const frame = new THREE.LineSegments(edges, frameMaterial);

    frame.position.set(position[0], position[1], position[2]);
    frame.rotation.set(rotation[0], rotation[1], rotation[2]);

    return frame;
  });
}

function createVolumePlanes() {
  const material = new THREE.MeshStandardMaterial({
    color: 0x08213f,
    opacity: 0.12,
    transparent: true,
    depthWrite: false,
    metalness: 0,
    roughness: 1,
    side: THREE.DoubleSide
  });
  const planeData = [
    {
      size: [2.8, 2.1],
      position: [-1.35, 0.95, -1.35],
      rotation: [0.08, 0.35, 0.06],
      opacity: 0.12
    },
    {
      size: [3.2, 2.4],
      position: [1.25, 0.85, -2.1],
      rotation: [-0.05, -0.28, -0.08],
      opacity: 0.1
    }
  ];

  return planeData.map(({ size, position, rotation, opacity }) => {
    const geometry = new THREE.PlaneGeometry(size[0], size[1]);
    const planeMaterial = material.clone();
    const plane = new THREE.Mesh(geometry, planeMaterial);

    plane.material.opacity = opacity;
    plane.position.set(position[0], position[1], position[2]);
    plane.rotation.set(rotation[0], rotation[1], rotation[2]);

    return plane;
  });
}

function setGridMaterialOpacity(grid, opacity) {
  const materials = Array.isArray(grid.material) ? grid.material : [grid.material];

  materials.forEach((material) => {
    material.transparent = true;
    material.opacity = opacity;
  });
}
