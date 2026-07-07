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

  createVolumePlanes().forEach((plane) => {
    environment.add(plane);
  });
  createVerticalPillars().forEach((pillar) => {
    environment.add(pillar);
  });
  createFloatingFrames().forEach((frame) => {
    environment.add(frame);
  });

  return environment;
}

function createVerticalPillars() {
  const material = new THREE.MeshStandardMaterial({
    color: 0x0a1626,
    emissive: 0x0f3c66,
    emissiveIntensity: 0.45,
    fog: false,
    metalness: 0.15,
    roughness: 0.85
  });
  const pillarData = [
    { height: 5.8, width: 0.14, position: [-3.1, -4.5] },
    { height: 6.6, width: 0.18, position: [3.1, -4.8] },
    { height: 5.2, width: 0.12, position: [-1.35, -5.5] },
    { height: 7, width: 0.16, position: [1.5, -6.1] }
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
    opacity: 0.35,
    transparent: true,
    fog: false
  });
  const frameData = [
    {
      size: [3, 4.2],
      position: [-2.7, 1.15, -3.8],
      rotation: [0.16, 0.52, -0.08]
    },
    {
      size: [2.7, 3.8],
      position: [2.7, 1.25, -4.2],
      rotation: [-0.1, -0.58, 0.1]
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
    opacity: 0.18,
    transparent: true,
    depthWrite: false,
    fog: false,
    metalness: 0,
    roughness: 1,
    side: THREE.DoubleSide
  });
  const planeData = [
    {
      size: [4, 3],
      position: [-1.9, 0.78, -3.5],
      rotation: [0.06, 0.38, 0.05],
      opacity: 0.18
    },
    {
      size: [4.4, 3.2],
      position: [1.85, 0.72, -4.8],
      rotation: [-0.04, -0.34, -0.07],
      opacity: 0.18
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
