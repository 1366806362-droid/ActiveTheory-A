import * as THREE from 'three';

const INNER_PARTICLE_COUNT = 640;
const MEMORY_PARTICLE_COUNT = 480;
const MEMORY_DISC_PARTICLE_COUNT = 220;
const KEYWORD_PARTICLE_COUNT = 180;

export function createBrandMindResources() {
  const pointTexture = createRadialTexture(96, [
    [0, 'rgba(255,255,255,1)'],
    [0.18, 'rgba(244,239,255,0.98)'],
    [0.5, 'rgba(151,116,255,0.46)'],
    [1, 'rgba(0,0,0,0)']
  ]);
  const hazeTexture = createHazeTexture();

  return {
    pointTexture,
    hazeTexture,
    dispose() {
      pointTexture.dispose();
      hazeTexture.dispose();
    }
  };
}

export function createBrandCognitionCore(resources) {
  const group = new THREE.Group();
  const inner = createInnerCore(resources.pointTexture);
  const memory = createMemoryField(resources.pointTexture);
  const keywords = createKeywordParticles(resources.pointTexture);
  const pulses = createCognitionPulses();
  const glowMaterial = new THREE.SpriteMaterial({
    map: resources.pointTexture,
    color: '#8968dc',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const glow = new THREE.Sprite(glowMaterial);

  group.name = 'BRAND COGNITION CORE';
  glow.name = 'Restrained Cognition Core Glow';
  glow.scale.set(1.14, 1.14, 1);
  glow.renderOrder = -1;
  group.add(glow, memory.points, pulses.lines, inner.points, keywords.points);

  return {
    group,
    particleCount: INNER_PARTICLE_COUNT + MEMORY_PARTICLE_COUNT + KEYWORD_PARTICLE_COUNT,
    update(time, progress) {
      const wake = smootherstep(0, 0.16, progress);
      const relationSync = smootherstep(0.62, 0.92, progress);
      const stable = smootherstep(0.86, 1, progress);
      const restrainedShimmer = 0.985 + Math.sin(time * 0.62) * 0.015 * stable;

      group.scale.setScalar(lerp(0.54, 1.2, wake));
      inner.material.uniforms.uOpacity.value = wake * (0.48 + relationSync * 0.24) * restrainedShimmer;
      inner.points.rotation.y = time * 0.014 * stable;
      memory.material.uniforms.uOpacity.value = smootherstep(0.08, 0.68, progress) * 0.34;
      memory.points.rotation.y = time * 0.018 * stable;
      memory.points.rotation.z = -time * 0.011 * stable;
      keywords.material.uniforms.uOpacity.value = smootherstep(0.18, 0.82, progress) * 0.6;
      keywords.points.rotation.y = -time * 0.025 * stable;
      pulses.material.uniforms.uProgress.value = progress;
      pulses.material.uniforms.uTime.value = time;
      glowMaterial.opacity = relationSync * 0.057;

      return wake * (0.72 + relationSync * 0.28);
    },
    dispose() {
      inner.dispose();
      memory.dispose();
      keywords.dispose();
      pulses.dispose();
      glowMaterial.dispose();
      group.clear();
    }
  };
}

export function createMindPointsMaterial(texture, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uPointTexture: { value: texture },
      uScale: { value: 1 }
    },
    vertexShader: `
      uniform float uScale;
      attribute float aSize;
      varying vec3 vColor;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        gl_PointSize = aSize * uScale * (13.5 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;

      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vColor, alpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

export function createMindLabelSprite(title, subtitle, keywords, color, width = 1.2) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 1536;
  canvas.height = 480;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = color;
  context.shadowBlur = 4;
  context.fillStyle = '#eeeaff';
  context.font = '600 72px Arial, sans-serif';
  context.fillText(title, 768, 118);
  context.shadowBlur = 1.5;
  context.globalAlpha = 0.56;
  context.fillStyle = color;
  context.font = '400 45px Arial, sans-serif';
  context.fillText(subtitle, 768, 230);
  context.globalAlpha = 0.46;
  context.fillStyle = '#c8baf2';
  context.font = '400 36px Arial, sans-serif';
  context.fillText(keywords, 768, 346);
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);

  const visualWidth = width * 0.92;
  sprite.scale.set(visualWidth, visualWidth * 0.3125, 1);
  sprite.renderOrder = 20;

  return {
    sprite,
    material,
    texture,
    dispose() {
      texture.dispose();
      material.dispose();
    }
  };
}

export function createSceneTitleSprite() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 1536;
  canvas.height = 384;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = '#735aa8';
  context.shadowBlur = 2;
  context.fillStyle = '#dcd5f1';
  context.font = '500 66px Arial, sans-serif';
  context.fillText('BRAND MIND', 768, 138);
  context.shadowBlur = 1;
  context.globalAlpha = 0.46;
  context.fillStyle = '#9b86c9';
  context.font = '400 42px Arial, sans-serif';
  context.fillText('\u54c1\u724c\u5fc3\u667a', 768, 252);
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);

  sprite.name = 'BRAND MIND Scene Title';
  sprite.position.set(0.08, -1.38, 0.22);
  sprite.scale.set(1.5, 0.375, 1);
  sprite.renderOrder = 24;
  return {
    sprite,
    material,
    dispose() {
      texture.dispose();
      material.dispose();
    }
  };
}

function createInnerCore(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(INNER_PARTICLE_COUNT * 3);
  const colors = new Float32Array(INNER_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(INNER_PARTICLE_COUNT);
  const random = seededRandom(17389);
  const center = new THREE.Color('#f0eaff');
  const edge = new THREE.Color('#8562d6');
  const color = new THREE.Color();

  for (let index = 0; index < INNER_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const radiusRatio = Math.pow(random(), 2.22);
    const radius = 0.48 * radiusRatio;
    const angle = random() * Math.PI * 2;
    const cosine = random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);
    positions[stride] = Math.cos(angle) * sine * radius;
    positions[stride + 1] = cosine * radius * 0.84;
    positions[stride + 2] = Math.sin(angle) * sine * radius;
    color.copy(center).lerp(edge, radiusRatio * 0.88);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 43 === 0 ? 2.42 : index % 9 === 0 ? 1.48 : 0.72 + random() * 0.36;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createMindPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);
  points.name = 'Inner Cognition Core';
  points.renderOrder = 7;
  return disposablePoints(points, geometry, material);
}

function createMemoryField(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MEMORY_PARTICLE_COUNT * 3);
  const colors = new Float32Array(MEMORY_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(MEMORY_PARTICLE_COUNT);
  const random = seededRandom(24593);
  const fragments = [
    [-0.52, 0.16, -0.08, 0.5],
    [0.24, 0.48, -0.18, 0.34],
    [0.5, -0.18, 0.08, 0.4],
    [-0.2, -0.5, 0.16, 0.3]
  ];
  const violet = new THREE.Color('#7650c7');
  const ice = new THREE.Color('#c8b8ff');
  const color = new THREE.Color();

  for (let index = 0; index < MEMORY_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    if (index < MEMORY_DISC_PARTICLE_COUNT) {
      const angle = random() * Math.PI * 2;
      const radius = 0.16 + Math.sqrt(random()) * 0.58;
      positions[stride] = Math.cos(angle) * radius;
      positions[stride + 1] = (random() - 0.5) * 0.11;
      positions[stride + 2] = Math.sin(angle) * radius * 0.72;
    } else {
      const fragment = fragments[(index - MEMORY_DISC_PARTICLE_COUNT) % fragments.length];
      const angle = random() * Math.PI * 2;
      const radius = Math.pow(random(), 1.55) * fragment[3];
      positions[stride] = fragment[0] + Math.cos(angle) * radius;
      positions[stride + 1] = fragment[1] + Math.sin(angle) * radius * 0.62;
      positions[stride + 2] = fragment[2] + (random() - 0.5) * radius;
    }
    color.copy(violet).lerp(ice, random() * 0.55);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = 0.45 + random() * 0.8;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createMindPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);
  points.name = 'Fragmented Semantic Memory Field';
  points.renderOrder = 4;
  return disposablePoints(points, geometry, material);
}

function createKeywordParticles(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(KEYWORD_PARTICLE_COUNT * 3);
  const colors = new Float32Array(KEYWORD_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(KEYWORD_PARTICLE_COUNT);
  const random = seededRandom(35731);
  const purple = new THREE.Color('#ab8cf2');
  const white = new THREE.Color('#eeeaff');
  const color = new THREE.Color();

  for (let index = 0; index < KEYWORD_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const angle = random() * Math.PI * 2;
    const radius = 0.12 + Math.pow(random(), 1.24) * 0.64;
    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = (random() - 0.5) * 0.34 + Math.sin(angle * 2.1) * 0.04;
    positions[stride + 2] = Math.sin(angle) * radius * 0.74;
    color.copy(purple).lerp(white, random() * 0.52);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 31 === 0 ? 1.8 : 0.54 + random() * 0.56;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createMindPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);
  points.name = 'Internal Keyword Particles';
  points.renderOrder = 8;
  return disposablePoints(points, geometry, material);
}

function createCognitionPulses() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const progress = [];
  const arcs = [
    { radius: 0.69, start: -0.28, length: 1.74, tilt: 0.12 },
    { radius: 0.8, start: 2.12, length: 1.2, tilt: -0.2 },
    { radius: 0.91, start: 4.14, length: 0.88, tilt: 0.26 },
    { radius: 1.02, start: 5.18, length: 0.72, tilt: -0.14 }
  ];

  arcs.forEach((arc, arcIndex) => {
    const segments = 32 - arcIndex * 4;
    for (let index = 0; index < segments; index += 1) {
      if ((index + arcIndex) % 7 === 3 || index % 11 === 7) continue;
      appendArcVertex(positions, progress, arc, index / segments);
      appendArcVertex(positions, progress, arc, (index + 0.68) / segments);
    }
  });
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aT', new THREE.Float32BufferAttribute(progress, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `
      attribute float aT;
      varying float vAlpha;
      uniform float uProgress;
      uniform float uTime;
      void main() {
        float reveal = smoothstep(0.12, 0.72, uProgress);
        float flow = 0.82 + 0.18 * sin(aT * 21.0 - uTime * 0.24);
        vAlpha = reveal * flow;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float alpha = vAlpha * 0.16;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(0.59, 0.43, 0.9, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'Broken Cognition Pulses';
  lines.rotation.x = 0.3;
  lines.rotation.z = -0.15;
  lines.renderOrder = 3;
  return {
    lines,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function appendArcVertex(positions, progress, arc, t) {
  const angle = arc.start + arc.length * t;
  const radius = arc.radius * (1 + Math.sin(t * Math.PI * 3) * 0.025);
  positions.push(
    Math.cos(angle) * radius,
    Math.sin(angle * 1.7) * 0.035 + arc.tilt * Math.cos(angle),
    Math.sin(angle) * radius
  );
  progress.push(t);
}

function disposablePoints(points, geometry, material) {
  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createRadialTexture(size, stops) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const center = size * 0.5;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  canvas.width = size;
  canvas.height = size;
  stops.forEach(([position, color]) => gradient.addColorStop(position, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHazeTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);
  const lobes = [
    [128, 126, 116, 'rgba(104,72,190,0.2)'],
    [92, 146, 74, 'rgba(58,64,158,0.13)'],
    [166, 104, 62, 'rgba(132,105,214,0.1)']
  ];
  lobes.forEach(([x, y, radius, color]) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.48, color.replace(/0\.\d+\)/, '0.055)'));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function seededRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function smootherstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / Math.max(edge1 - edge0, 0.0001), 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start, end, value) {
  return start + (end - start) * value;
}
