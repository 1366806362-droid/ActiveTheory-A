import * as THREE from 'three';
import { seededRandom } from './geoSignalCore.js';

const STREAMS = Object.freeze([
  Object.freeze({
    key: 'answer',
    colorA: '#4fc8e8',
    colorB: '#e2f8ff',
    particles: 390,
    nodes: 24,
    seed: 10101,
    spread: 0.052,
    speed: 0.16,
    phase: 0.1
  }),
  Object.freeze({
    key: 'citation',
    colorA: '#c5e9f1',
    colorB: '#9183c8',
    particles: 300,
    nodes: 20,
    seed: 10201,
    spread: 0.044,
    speed: 0.095,
    phase: 1.8
  }),
  Object.freeze({
    key: 'keyword',
    colorA: '#18b6cd',
    colorB: '#69dce9',
    particles: 340,
    nodes: 22,
    seed: 10301,
    spread: 0.048,
    speed: 0.12,
    phase: 3.7
  })
]);

export function createGeoV4NeuralStreams(resources, sharedField) {
  const group = new THREE.Group();
  const filaments = createSignalFilaments(sharedField);
  const particles = createFlowParticles(sharedField, resources.pointTexture);
  const highlights = createHighlightNodes(sharedField, resources.pointTexture);

  group.name = 'GEO V4 Signals Migrating Inside Shared Tissue';
  group.add(filaments.lines, particles.points, highlights.points);
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
      filaments.material.uniforms.uTime.value = time;
      filaments.material.uniforms.uOpacity.value = opacity * 0.2;
      particles.material.uniforms.uTime.value = time;
      particles.material.uniforms.uOpacity.value = opacity * 0.46;
      highlights.material.uniforms.uTime.value = time;
      highlights.material.uniforms.uOpacity.value = opacity * 0.7;
      const px = pointer?.x ?? 0;
      const py = pointer?.y ?? 0;
      const targetX = px * 0.0065;
      const targetY = -py * 0.0038;
      group.position.x += (targetX - group.position.x) * 0.03;
      group.position.y += (targetY - group.position.y) * 0.03;
    },
    dispose() {
      filaments.dispose();
      particles.dispose();
      highlights.dispose();
      group.clear();
    }
  };

  function applyDebugStream() {
    const visible = debugStream === 'full'
      || debugStream === 'streams'
      || debugStream === 'organism'
      || debugStream === 'fields';
    filaments.lines.visible = visible;
    particles.points.visible = visible && debugStream !== 'fields';
    highlights.points.visible = visible && debugStream !== 'fields';
  }
}

function createSignalFilaments(field) {
  const positions = [];
  const colors = [];
  const alphas = [];

  STREAMS.forEach((config, streamIndex) => {
    const colorA = new THREE.Color(config.colorA);
    const colorB = new THREE.Color(config.colorB);
    getSignalPaths(field, config.key, streamIndex).forEach((path, pathIndex) => {
      for (let index = 0; index < path.points.length - 1; index += 1) {
        const cadence = path.coreSeeking ? 11 : 13;
        const phase = (index * 3 + pathIndex * 5 + streamIndex * 2) % cadence;
        if (phase > (path.coreSeeking ? 1 : 2)) continue;
        const a = path.points[index];
        const b = path.points[index + 1];
        const sample = field.sample(a.x, a.y, a.z);
        const color = colorA.clone().lerp(
          colorB,
          0.12 + sample.attraction * 0.42 + (pathIndex % 3) * 0.07
        );
        positions.push(a.x, a.y, a.z + 0.045, b.x, b.y, b.z + 0.045);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        const alpha = THREE.MathUtils.clamp(
          0.24 + sample.density * 0.36 + sample.attraction * 0.22,
          0.2,
          0.82
        ) * (1 - THREE.MathUtils.smoothstep(sample.attraction, 0.68, 0.95));
        alphas.push(alpha, alpha * 0.82);
      }
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  const material = createSignalLineMaterial();
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'GEO V4 Short Tissue Signal Filaments';
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

function createFlowParticles(field, texture) {
  const total = STREAMS.reduce((sum, stream) => sum + stream.particles, 0);
  const positions = new Float32Array(total * 3);
  const tangents = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const speeds = new Float32Array(total);
  const attractions = new Float32Array(total);
  let cursor = 0;

  STREAMS.forEach((config, streamIndex) => {
    const paths = getSignalPaths(field, config.key, streamIndex);
    const random = seededRandom(config.seed);
    const colorA = new THREE.Color(config.colorA);
    const colorB = new THREE.Color(config.colorB);
    for (let index = 0; index < config.particles; index += 1) {
      const path = paths[Math.floor(random() * paths.length)];
      const t = THREE.MathUtils.clamp(random(), 0.02, 0.96);
      const point = path.curve.getPoint(t);
      const tangent = path.curve.getTangent(t);
      const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
      const sample = field.sample(point.x, point.y, point.z);
      const spread = config.spread * (
        0.42
        + Math.sin(t * Math.PI) * 0.86
        - sample.attraction * 0.24
      );
      point.addScaledVector(normal, (random() - 0.5) * spread);
      point.z += (random() - 0.5) * spread * 0.9 + 0.052;
      const stride = cursor * 3;
      positions[stride] = point.x;
      positions[stride + 1] = point.y;
      positions[stride + 2] = point.z;
      tangents[stride] = tangent.x;
      tangents[stride + 1] = tangent.y;
      tangents[stride + 2] = tangent.z;
      const color = colorA.clone().lerp(
        colorB,
        0.08 + sample.attraction * 0.48 + random() * 0.18
      );
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      const innerScale = 1 - THREE.MathUtils.smoothstep(sample.attraction, 0.94, 0.999);
      sizes[cursor] = (index % 31 === 0 ? 1.14 : 0.34 + random() * 0.58)
        * (0.42 + innerScale * 0.58);
      phases[cursor] = config.phase + random() * Math.PI * 2;
      speeds[cursor] = config.speed * (0.72 + random() * 0.56);
      attractions[cursor] = sample.attraction;
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
  geometry.setAttribute('aAttraction', new THREE.BufferAttribute(attractions, 1));
  const material = createFlowMaterial(texture);
  const points = new THREE.Points(geometry, material);
  points.name = 'GEO V4 Signals Moving Across Local Tissue Branches';
  points.renderOrder = 5;
  return {
    points,
    material,
    particleCount: total,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createHighlightNodes(field, texture) {
  const total = STREAMS.reduce((sum, stream) => sum + stream.nodes, 0);
  const positions = new Float32Array(total * 3);
  const tangents = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const speeds = new Float32Array(total);
  const attractions = new Float32Array(total);
  let cursor = 0;

  STREAMS.forEach((config, streamIndex) => {
    const paths = getSignalPaths(field, config.key, streamIndex);
    const random = seededRandom(config.seed + 41);
    const colorA = new THREE.Color(config.colorA);
    const colorB = new THREE.Color(config.colorB);
    for (let index = 0; index < config.nodes; index += 1) {
      const path = paths[(index * 3) % paths.length];
      const t = 0.1 + ((index * 0.173 + random() * 0.08) % 0.78);
      const point = path.curve.getPoint(t);
      const tangent = path.curve.getTangent(t);
      const sample = field.sample(point.x, point.y, point.z);
      const stride = cursor * 3;
      positions[stride] = point.x;
      positions[stride + 1] = point.y;
      positions[stride + 2] = point.z + 0.065;
      tangents[stride] = tangent.x;
      tangents[stride + 1] = tangent.y;
      tangents[stride + 2] = tangent.z;
      const color = colorA.clone().lerp(
        colorB,
        0.48 + sample.attraction * 0.34 + random() * 0.16
      );
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      const innerScale = 1 - THREE.MathUtils.smoothstep(sample.attraction, 0.94, 0.999);
      sizes[cursor] = (1.02 + random() * 0.96) * (0.46 + innerScale * 0.54);
      phases[cursor] = config.phase + random() * Math.PI * 2;
      speeds[cursor] = config.speed * (0.78 + random() * 0.42);
      attractions[cursor] = sample.attraction;
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
  geometry.setAttribute('aAttraction', new THREE.BufferAttribute(attractions, 1));
  const material = createFlowMaterial(texture);
  const points = new THREE.Points(geometry, material);
  points.name = 'GEO V4 Sequential Tissue Response Nodes';
  points.renderOrder = 6;
  return {
    points,
    material,
    particleCount: total,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function getSignalPaths(field, region, streamIndex) {
  const regional = field.getRegionPaths(region);
  const shared = field.getFibers().filter((_, index) => index % 3 === streamIndex);
  return [...regional, ...shared];
}

function createSignalLineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float packet = 0.72 + smoothstep(0.35, 1.0, sin(uTime * 0.12 + vAlpha * 11.0)) * 0.28;
        float alpha = uOpacity * vAlpha * packet;
        if (alpha < 0.008) discard;
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
      attribute float aAttraction;
      varying vec3 vColor;
      varying float vPulse;
      uniform float uTime;
      void main() {
        float packet = sin(uTime * aSpeed + aPhase);
        vec3 displaced = position + aTangent * packet * (0.008 + aAttraction * 0.012);
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vColor = color;
        vPulse = 0.58 + aAttraction * 0.22 + smoothstep(0.42, 1.0, packet) * 0.2;
        gl_PointSize = aSize * (17.0 / max(-viewPosition.z, 1.0));
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
