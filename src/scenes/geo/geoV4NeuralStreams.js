import * as THREE from 'three';
import { seededRandom } from './geoSignalCore.js';
import {
  GEO_V4_TISSUE_FIELD,
  createGeoV4TissueCurve
} from './geoV4OrganicEnvironment.js';

const STREAMS = Object.freeze([
  Object.freeze({
    key: 'answer',
    colorA: '#4fc8e8',
    colorB: '#e2f8ff',
    particles: 390,
    nodes: 24,
    seed: 6101,
    width: 0.052,
    speed: 0.16,
    phase: 0.1,
    branches: GEO_V4_TISSUE_FIELD.answer.branches
  }),
  Object.freeze({
    key: 'citation',
    colorA: '#c5e9f1',
    colorB: '#9183c8',
    particles: 300,
    nodes: 20,
    seed: 6201,
    width: 0.042,
    speed: 0.095,
    phase: 1.8,
    branches: GEO_V4_TISSUE_FIELD.citation.branches
  }),
  Object.freeze({
    key: 'keyword',
    colorA: '#18b6cd',
    colorB: '#69dce9',
    particles: 340,
    nodes: 22,
    seed: 6301,
    width: 0.046,
    speed: 0.12,
    phase: 3.7,
    branches: GEO_V4_TISSUE_FIELD.keyword.branches
  })
]);

export function createGeoV4NeuralStreams(resources) {
  const group = new THREE.Group();
  const field = createTissueEnergyPatches();
  const filaments = createTissueFilaments();
  const particles = createFlowParticles(resources.pointTexture);
  const highlights = createHighlightNodes(resources.pointTexture);

  group.name = 'GEO V4 Signals Inside Living Tissue';
  group.add(field.mesh, filaments.lines, particles.points, highlights.points);
  let debugStream = 'full';
  applyDebugStream();

  return {
    group,
    particleCount: particles.particleCount + highlights.particleCount,
    setDebugStream(stream = 'full') {
      debugStream = stream;
      applyDebugStream();
    },
    update(time, reveal = 1, pointer = null) {
      const opacity = THREE.MathUtils.clamp(reveal, 0, 1);
      field.material.uniforms.uTime.value = time;
      field.material.uniforms.uOpacity.value = opacity * 0.052;
      filaments.material.opacity = opacity * 0.3;
      particles.material.uniforms.uTime.value = time;
      particles.material.uniforms.uOpacity.value = opacity * 0.58;
      highlights.material.uniforms.uTime.value = time;
      highlights.material.uniforms.uOpacity.value = opacity * 0.78;
      const px = pointer?.x ?? 0;
      const py = pointer?.y ?? 0;
      group.position.x += (px * 0.01 - group.position.x) * 0.032;
      group.position.y += (-py * 0.006 - group.position.y) * 0.032;
    },
    dispose() {
      field.dispose();
      filaments.dispose();
      particles.dispose();
      highlights.dispose();
      group.clear();
    }
  };

  function applyDebugStream() {
    const full = debugStream === 'full'
      || debugStream === 'streams'
      || debugStream === 'organism';
    field.mesh.visible = full || debugStream === 'fields';
    filaments.lines.visible = full;
    particles.points.visible = full;
    highlights.points.visible = full;
  }
}

function createTissueEnergyPatches() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const colors = [];

  STREAMS.forEach((config, streamIndex) => {
    const curves = config.branches.map(createGeoV4TissueCurve);
    const colorA = new THREE.Color(config.colorA);
    const colorB = new THREE.Color(config.colorB);
    curves.forEach((curve, branchIndex) => {
      const feeder = branchIndex === curves.length - 1;
      const segments = feeder ? 18 : 10;
      for (let index = 0; index < segments; index += 1) {
        if ((index + branchIndex * 2 + streamIndex) % 4 !== 0) continue;
        const t0 = index / segments;
        if (feeder && t0 < 0.46) continue;
        const t1 = Math.min(1, (index + 1.4) / segments);
        const p0 = curve.getPoint(t0);
        const p1 = curve.getPoint(t1);
        const tangent0 = curve.getTangent(t0);
        const tangent1 = curve.getTangent(t1);
        const width = config.width * (feeder ? 0.72 : 1);
        const normal0 = new THREE.Vector3(-tangent0.y, tangent0.x, 0).normalize().multiplyScalar(width);
        const normal1 = new THREE.Vector3(-tangent1.y, tangent1.x, 0).normalize().multiplyScalar(width * 0.82);
        const a = p0.clone().add(normal0);
        const b = p0.clone().sub(normal0);
        const c = p1.clone().add(normal1);
        const d = p1.clone().sub(normal1);
        positions.push(
          a.x, a.y, a.z - 0.015, b.x, b.y, b.z - 0.015, c.x, c.y, c.z - 0.015,
          c.x, c.y, c.z - 0.015, b.x, b.y, b.z - 0.015, d.x, d.y, d.z - 0.015
        );
        uvs.push(0, t0, 1, t0, 0, t1, 0, t1, 1, t0, 1, t1);
        const color = colorA.clone().lerp(colorB, 0.12 + t0 * 0.38);
        for (let vertex = 0; vertex < 6; vertex += 1) {
          colors.push(color.r, color.g, color.b);
        }
      }
    });
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vUv = uv;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        float feather = pow(1.0 - abs(vUv.x * 2.0 - 1.0), 2.7);
        float longitudinal = smoothstep(0.0, 0.22, fract(vUv.y * 3.0 - uTime * 0.018));
        float alpha = uOpacity * feather * (0.62 + longitudinal * 0.22);
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'GEO V4 Local Tissue Energy Patches';
  mesh.renderOrder = 0;
  return { mesh, material, dispose() { geometry.dispose(); material.dispose(); } };
}

function createTissueFilaments() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  STREAMS.forEach((config, streamIndex) => {
    const colorA = new THREE.Color(config.colorA);
    const colorB = new THREE.Color(config.colorB);
    config.branches.forEach((points, branchIndex) => {
      const curve = createGeoV4TissueCurve(points);
      const feeder = branchIndex === config.branches.length - 1;
      const segments = feeder ? 42 : 28;
      for (let index = 0; index < segments; index += 1) {
        const breakPhase = (index + branchIndex * 5 + streamIndex * 3) % (feeder ? 12 : 10);
        if (breakPhase >= (feeder ? 8 : 7)) continue;
        const t0 = index / segments;
        if (feeder && t0 < 0.43) continue;
        const t1 = Math.min(1, (index + (feeder ? 0.56 : 0.72)) / segments);
        const p0 = curve.getPoint(t0);
        const p1 = curve.getPoint(t1);
        positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        const color = colorA.clone().lerp(
          colorB,
          (feeder ? 0.16 : 0.28) + t0 * 0.38
        );
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    });
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'GEO V4 Tissue Signal Filaments';
  lines.renderOrder = 1;
  return { lines, material, dispose() { geometry.dispose(); material.dispose(); } };
}

function createFlowParticles(texture) {
  const total = STREAMS.reduce((sum, stream) => sum + stream.particles, 0);
  const positions = new Float32Array(total * 3);
  const tangents = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const speeds = new Float32Array(total);
  let cursor = 0;

  STREAMS.forEach((config) => {
    const curves = config.branches.map(createGeoV4TissueCurve);
    const random = seededRandom(config.seed);
    const colorA = new THREE.Color(config.colorA);
    const colorB = new THREE.Color(config.colorB);
    const localCurveCount = Math.max(1, curves.length - 1);
    for (let index = 0; index < config.particles; index += 1) {
      const feeder = random() > 0.9;
      const curveIndex = feeder
        ? curves.length - 1
        : Math.floor(random() * localCurveCount);
      const curve = curves[curveIndex];
      const t = random();
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
      const spread = config.width * (feeder ? 0.55 : 0.9 + Math.sin(t * Math.PI) * 0.7);
      point.addScaledVector(normal, (random() - 0.5) * spread);
      point.z += (random() - 0.5) * spread * 1.25;
      const stride = cursor * 3;
      positions[stride] = point.x;
      positions[stride + 1] = point.y;
      positions[stride + 2] = point.z;
      tangents[stride] = tangent.x;
      tangents[stride + 1] = tangent.y;
      tangents[stride + 2] = tangent.z;
      const color = colorA.clone().lerp(
        colorB,
        (feeder ? 0.18 : 0.08) + t * 0.42 + random() * 0.13
      );
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      sizes[cursor] = index % 29 === 0 ? 1.28 : 0.38 + random() * 0.62;
      phases[cursor] = random() * Math.PI * 2;
      speeds[cursor] = config.speed * (0.72 + random() * 0.56);
      cursor += 1;
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aTangent', new THREE.BufferAttribute(tangents, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  const material = createFlowMaterial(texture);
  const points = new THREE.Points(geometry, material);
  points.name = 'GEO V4 Signals Migrating Through Tissue';
  points.renderOrder = 3;
  return { points, material, particleCount: total, dispose() { geometry.dispose(); material.dispose(); } };
}

function createHighlightNodes(texture) {
  const total = STREAMS.reduce((sum, stream) => sum + stream.nodes, 0);
  const positions = new Float32Array(total * 3);
  const tangents = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const speeds = new Float32Array(total);
  let cursor = 0;

  STREAMS.forEach((config) => {
    const curves = config.branches.map(createGeoV4TissueCurve);
    const random = seededRandom(config.seed + 31);
    const colorA = new THREE.Color(config.colorA);
    const colorB = new THREE.Color(config.colorB);
    for (let index = 0; index < config.nodes; index += 1) {
      const curveIndex = index % curves.length;
      const curve = curves[curveIndex];
      const t = 0.12 + ((index * 0.173 + random() * 0.08) % 0.78);
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const stride = cursor * 3;
      positions[stride] = point.x;
      positions[stride + 1] = point.y;
      positions[stride + 2] = point.z + 0.01;
      tangents[stride] = tangent.x;
      tangents[stride + 1] = tangent.y;
      tangents[stride + 2] = tangent.z;
      const color = colorA.clone().lerp(colorB, 0.54 + random() * 0.36);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      sizes[cursor] = 1.18 + random() * 1.08;
      phases[cursor] = random() * Math.PI * 2;
      speeds[cursor] = config.speed * (0.8 + random() * 0.4);
      cursor += 1;
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aTangent', new THREE.BufferAttribute(tangents, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  const material = createFlowMaterial(texture);
  const points = new THREE.Points(geometry, material);
  points.name = 'GEO V4 Tissue Response Nodes';
  points.renderOrder = 4;
  return { points, material, particleCount: total, dispose() { geometry.dispose(); material.dispose(); } };
}

function createFlowMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute vec3 aTangent;
      attribute float aSize;
      attribute float aPhase;
      attribute float aSpeed;
      varying vec3 vColor;
      varying float vPulse;
      uniform float uTime;
      void main() {
        float packet = sin(uTime * aSpeed + aPhase);
        vec3 displaced = position + aTangent * packet * 0.018;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vColor = color;
        vPulse = 0.66 + smoothstep(0.35, 1.0, packet) * 0.34;
        gl_PointSize = aSize * (18.0 / max(-viewPosition.z, 1.0));
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
