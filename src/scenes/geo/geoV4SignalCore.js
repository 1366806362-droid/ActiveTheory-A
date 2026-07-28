import * as THREE from 'three';
import {
  createLabelSprite,
  seededRandom
} from './geoSignalCore.js';

const SEED_COUNT = 540;

export function createGeoV4SignalCore(resources) {
  const group = new THREE.Group();
  const influence = createInfluenceCavity(resources.pointTexture);
  const chamber = createOrganicChamber();
  const bands = createBrokenBands(resources.pointTexture);
  const seed = createDataSeed(resources.pointTexture);
  const glow = createCoreGlow(resources.hazeTexture);
  const label = createLabelSprite(
    'GEO SIGNAL CORE',
    'GEO 信号核心',
    '#78def8',
    1.16,
    true,
    { glowBlur: 3, titleAlpha: 0.84, subtitleAlpha: 0.54 }
  );

  group.name = 'GEO V4 Organic Signal Core';
  group.position.set(0, -0.13, 0.14);
  group.scale.setScalar(1.18);
  label.sprite.name = 'GEO V4 Signal Core Title';
  label.sprite.position.set(0, -0.56, 0.12);
  label.sprite.scale.multiplyScalar(0.73);
  glow.sprite.renderOrder = 1;
  influence.lines.renderOrder = 3;
  influence.nodes.renderOrder = 4;
  chamber.mesh.renderOrder = 6;
  chamber.edges.renderOrder = 7;
  bands.lines.renderOrder = 8;
  bands.points.renderOrder = 9;
  seed.points.renderOrder = 10;
  group.add(
    glow.sprite,
    influence.lines,
    influence.nodes,
    chamber.mesh,
    chamber.edges,
    bands.lines,
    bands.points,
    seed.points,
    label.sprite
  );

  let debugLayer = 'full';
  applyDebugLayer();

  return {
    group,
    particleCount: SEED_COUNT + influence.particleCount + bands.particleCount,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyDebugLayer();
    },
    update(time, reveal = 1, pointer = null) {
      const opacity = THREE.MathUtils.clamp(reveal, 0, 1);
      influence.lineMaterial.uniforms.uTime.value = time;
      influence.lineMaterial.uniforms.uOpacity.value = opacity * 0.28;
      influence.nodeMaterial.uniforms.uTime.value = time;
      influence.nodeMaterial.uniforms.uOpacity.value = opacity * 0.42;
      chamber.material.uniforms.uTime.value = time;
      chamber.material.uniforms.uOpacity.value = opacity * 0.13;
      chamber.edgeMaterial.opacity = opacity * 0.28;
      bands.lineMaterial.opacity = opacity * 0.76;
      bands.pointMaterial.uniforms.uTime.value = time;
      bands.pointMaterial.uniforms.uOpacity.value = opacity * 0.84;
      seed.material.uniforms.uTime.value = time;
      seed.material.uniforms.uOpacity.value = opacity * 0.46;
      glow.material.opacity = opacity * 0.17;
      label.material.opacity = opacity * 0.48;
      bands.group.rotation.y = Math.sin(time * 0.055) * 0.018;
      const px = pointer?.x ?? 0;
      const py = pointer?.y ?? 0;
      group.rotation.y += (px * 0.035 - group.rotation.y) * 0.035;
      group.rotation.x += (-py * 0.022 - group.rotation.x) * 0.035;
    },
    dispose() {
      influence.dispose();
      chamber.dispose();
      bands.dispose();
      seed.dispose();
      glow.dispose();
      label.dispose();
      group.clear();
    }
  };

  function applyDebugLayer() {
    const full = debugLayer === 'full';
    const core = debugLayer === 'core';
    influence.lines.visible = full || core;
    influence.nodes.visible = full || core;
    chamber.mesh.visible = full || core || debugLayer === 'chamber';
    chamber.edges.visible = full || core || debugLayer === 'chamber';
    bands.lines.visible = full || core || debugLayer === 'bands';
    bands.points.visible = full || core || debugLayer === 'bands';
    seed.points.visible = full || core || debugLayer === 'seed';
    glow.sprite.visible = full || core || debugLayer === 'seed';
    label.sprite.visible = full || core;
  }
}

function createDataSeed(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SEED_COUNT * 3);
  const colors = new Float32Array(SEED_COUNT * 3);
  const sizes = new Float32Array(SEED_COUNT);
  const phases = new Float32Array(SEED_COUNT);
  const random = seededRandom(7101);
  const coldWhite = new THREE.Color('#c9f5ff');
  const ice = new THREE.Color('#4ecce9');

  for (let index = 0; index < SEED_COUNT; index += 1) {
    const radius = Math.pow(random(), 1.16) * 0.2;
    const angle = random() * Math.PI * 2;
    const cosine = random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);
    const stride = index * 3;
    positions[stride] = Math.cos(angle) * sine * radius;
    positions[stride + 1] = cosine * radius * 0.78;
    positions[stride + 2] = Math.sin(angle) * sine * radius;
    const color = coldWhite.clone().lerp(ice, radius / 0.2 * 0.78);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 29 === 0 ? 1.55 : 0.46 + random() * 0.72;
    phases[index] = random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const material = createCorePointMaterial(texture, 0.46, 0.004, 16);
  const points = new THREE.Points(geometry, material);
  points.name = 'GEO V4 Dense Data Seed';
  return { points, material, dispose() { geometry.dispose(); material.dispose(); } };
}

function createInfluenceCavity(texture) {
  const linePositions = [];
  const lineColors = [];
  const nodePositions = [];
  const nodeColors = [];
  const nodeSizes = [];
  const nodePhases = [];
  const random = seededRandom(7201);
  const cyan = new THREE.Color('#3bbdd9');
  const ice = new THREE.Color('#bfefff');

  for (let filament = 0; filament < 18; filament += 1) {
    const angle = filament / 18 * Math.PI * 2 + (random() - 0.5) * 0.22;
    const radial = 0.48 + random() * 0.32;
    const start = new THREE.Vector3(
      Math.cos(angle) * radial,
      Math.sin(angle) * radial * 0.72,
      -0.18 + random() * 0.32
    );
    const middle = new THREE.Vector3(
      Math.cos(angle + 0.3) * radial * 0.57,
      Math.sin(angle - 0.2) * radial * 0.34,
      0.04 + (random() - 0.5) * 0.12
    );
    const end = new THREE.Vector3(
      Math.cos(angle + 0.62) * 0.22,
      Math.sin(angle + 0.62) * 0.14,
      0.06
    );
    const curve = new THREE.CatmullRomCurve3([start, middle, end], false, 'catmullrom', 0.55);
    const segments = 10;
    for (let index = 0; index < segments; index += 1) {
      if ((index + filament) % 9 === 6) continue;
      const p0 = curve.getPoint(index / segments);
      const p1 = curve.getPoint((index + 0.76) / segments);
      linePositions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      const color = cyan.clone().lerp(ice, index / segments * 0.72);
      lineColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      if (index % 3 === filament % 3) {
        nodePositions.push(p0.x, p0.y, p0.z);
        nodeColors.push(color.r, color.g, color.b);
        nodeSizes.push(0.72 + random() * 1.2);
        nodePhases.push(random() * Math.PI * 2);
      }
    }
  }

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  const lineMaterial = createCavityLineMaterial();
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.name = 'GEO V4 Curved Signal Cavity';

  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
  nodeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(nodeColors, 3));
  nodeGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(nodeSizes, 1));
  nodeGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(nodePhases, 1));
  const nodeMaterial = createCorePointMaterial(texture, 0.42, 0.006, 18);
  const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
  nodes.name = 'GEO V4 Signal Cavity Nodes';

  return {
    lines,
    nodes,
    lineMaterial,
    nodeMaterial,
    particleCount: nodePositions.length / 3,
    dispose() {
      lineGeometry.dispose();
      lineMaterial.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
    }
  };
}

function createOrganicChamber() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const indices = [];
  const edgePositions = [];
  const fragments = [
    { center: [-0.28, 0.23, 0.02], size: [0.42, 0.25], tilt: 0.36, depth: 0.05 },
    { center: [0.29, 0.22, -0.01], size: [0.38, 0.23], tilt: -0.48, depth: -0.02 },
    { center: [0.32, -0.2, 0.04], size: [0.3, 0.2], tilt: 0.68, depth: 0.08 },
    { center: [-0.18, -0.25, -0.03], size: [0.34, 0.2], tilt: -0.72, depth: -0.06 },
    { center: [0.02, 0.04, -0.28], size: [0.5, 0.32], tilt: 0.14, depth: -0.18 }
  ];
  let vertexOffset = 0;

  fragments.forEach((fragment, fragmentIndex) => {
    const cols = 7;
    const rows = 4;
    for (let row = 0; row <= rows; row += 1) {
      for (let col = 0; col <= cols; col += 1) {
        const u = col / cols;
        const v = row / rows;
        const x0 = (u - 0.5) * fragment.size[0];
        const y0 = (v - 0.5) * fragment.size[1];
        const curve = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * (0.035 + fragmentIndex * 0.004);
        const cos = Math.cos(fragment.tilt);
        const sin = Math.sin(fragment.tilt);
        positions.push(
          fragment.center[0] + x0 * cos - y0 * sin,
          fragment.center[1] + x0 * sin + y0 * cos,
          fragment.depth + curve
        );
        normals.push(0, 0, 1);
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if ((row * cols + col + fragmentIndex) % 7 === 4) continue;
        const a = vertexOffset + row * (cols + 1) + col;
        const b = a + 1;
        const c = a + cols + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const corners = [
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0),
      new THREE.Vector3(0.5, 0.5, 0),
      new THREE.Vector3(-0.5, 0.5, 0)
    ].map((point) => {
      point.x *= fragment.size[0];
      point.y *= fragment.size[1];
      const cos = Math.cos(fragment.tilt);
      const sin = Math.sin(fragment.tilt);
      return new THREE.Vector3(
        fragment.center[0] + point.x * cos - point.y * sin,
        fragment.center[1] + point.x * sin + point.y * cos,
        fragment.depth
      );
    });
    for (let index = 0; index < 4; index += 1) {
      if (index === fragmentIndex % 4) continue;
      const a = corners[index];
      const b = corners[(index + 1) % 4];
      edgePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    vertexOffset += (cols + 1) * (rows + 1);
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#71dfff') }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      uniform float uTime;
      void main() {
        vec3 displaced = position;
        displaced.z += sin(position.x * 9.0 + position.y * 7.0 + uTime * 0.08) * 0.004;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
        float alpha = uOpacity * (0.13 + fresnel * 0.87);
        gl_FragColor = vec4(uColor * (0.45 + fresnel * 0.55), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'GEO V4 Open Organic Processing Chamber';

  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: '#a9efff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.name = 'GEO V4 Chamber Broken Fresnel Edges';

  return {
    mesh,
    edges,
    material,
    edgeMaterial,
    dispose() {
      geometry.dispose();
      material.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
    }
  };
}

function createBrokenBands(texture) {
  const group = new THREE.Group();
  const linePositions = [];
  const lineColors = [];
  const pointPositions = [];
  const pointColors = [];
  const pointSizes = [];
  const pointPhases = [];
  const random = seededRandom(7401);
  const bands = [
    { radius: 0.27, tilt: [0.42, 0.18, -0.22], color: '#75dcff', starts: [0.1, 2.2, 4.4] },
    { radius: 0.37, tilt: [-0.34, 0.48, 0.16], color: '#d9f7ff', starts: [0.7, 3.05, 5.1] },
    { radius: 0.47, tilt: [0.15, -0.52, 0.52], color: '#27d3e9', starts: [1.2, 3.45, 5.45] }
  ];

  bands.forEach((band, bandIndex) => {
    const rotation = new THREE.Euler(...band.tilt);
    const color = new THREE.Color(band.color);
    band.starts.forEach((start, fragmentIndex) => {
      const span = 0.66 + fragmentIndex * 0.09 - bandIndex * 0.035;
      const segments = 15;
      for (let index = 0; index < segments; index += 1) {
        const a0 = start + span * index / segments;
        const a1 = start + span * (index + 0.72) / segments;
        const p0 = new THREE.Vector3(Math.cos(a0) * band.radius, Math.sin(a0) * band.radius * 0.76, 0).applyEuler(rotation);
        const p1 = new THREE.Vector3(Math.cos(a1) * band.radius, Math.sin(a1) * band.radius * 0.76, 0).applyEuler(rotation);
        linePositions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        lineColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        if (index % 2 === 0) {
          pointPositions.push(p0.x, p0.y, p0.z);
          pointColors.push(color.r, color.g, color.b);
          pointSizes.push(index % 6 === 0 ? 1.45 : 0.68 + random() * 0.52);
          pointPhases.push(random() * Math.PI * 2);
        }
      }
    });
  });

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.name = 'GEO V4 Broken Organic Processing Bands';

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
  pointGeometry.setAttribute('color', new THREE.Float32BufferAttribute(pointColors, 3));
  pointGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(pointSizes, 1));
  pointGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(pointPhases, 1));
  const pointMaterial = createCorePointMaterial(texture, 0.84, 0.004, 18);
  const points = new THREE.Points(pointGeometry, pointMaterial);
  points.name = 'GEO V4 Broken Band Signal Nodes';
  group.add(lines, points);

  return {
    group,
    lines,
    points,
    lineMaterial,
    pointMaterial,
    particleCount: pointPositions.length / 3,
    dispose() {
      lineGeometry.dispose();
      lineMaterial.dispose();
      pointGeometry.dispose();
      pointMaterial.dispose();
      group.clear();
    }
  };
}

function createCoreGlow(texture) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: '#1f9fc4',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = 'GEO V4 Local Core Attraction Field';
  sprite.scale.set(1.28, 0.9, 1);
  return { sprite, material, dispose() { material.dispose(); } };
}

function createCorePointMaterial(texture, opacity, drift, sizeScale = 20) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uDrift: { value: drift },
      uSizeScale: { value: sizeScale },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vPulse;
      uniform float uTime;
      uniform float uDrift;
      uniform float uSizeScale;
      void main() {
        vec3 displaced = position;
        displaced += normalize(position + vec3(0.0001)) * sin(uTime * 0.12 + aPhase) * uDrift;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vColor = color;
        vPulse = 0.74 + sin(uTime * 0.48 + aPhase * 2.0) * 0.26;
        gl_PointSize = aSize * (uSizeScale / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      varying float vPulse;
      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a * uOpacity * vPulse;
        if (alpha < 0.012) discard;
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

function createCavityLineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      varying vec3 vColor;
      uniform float uTime;
      void main() {
        vec3 displaced = position;
        displaced.z += sin(position.x * 8.0 + position.y * 5.0 + uTime * 0.08) * 0.006;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(vColor, uOpacity);
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
