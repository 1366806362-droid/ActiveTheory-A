import * as THREE from 'three';

const INNER_PARTICLE_COUNT = 620;
const SHELL_PARTICLE_COUNT = 280;
const MICRO_PARTICLE_COUNT = 260;
const INTERNAL_DISK_PARTICLE_COUNT = 180;

export function createGeoVisualResources() {
  const pointTexture = createRadialTexture(96, [
    [0, 'rgba(255,255,255,1)'],
    [0.18, 'rgba(222,250,255,0.96)'],
    [0.5, 'rgba(92,206,255,0.42)'],
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

export function createGeoSignalCore(resources) {
  const group = new THREE.Group();
  const inner = createInnerSignalCore(resources.pointTexture);
  const internalDisk = createInternalSignalDisk(resources.pointTexture);
  const shell = createSignalShell(resources.pointTexture);
  const pulses = createSemanticPulses();
  const micro = createCoreMicroParticles(resources.pointTexture);
  const label = createLabelSprite(
    'GEO SIGNAL CORE',
    'GEO \u4fe1\u53f7\u6838\u5fc3',
    '#8fe9ff',
    1.2
  );
  const glowMaterial = new THREE.SpriteMaterial({
    map: resources.pointTexture,
    color: '#47cfff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const glow = new THREE.Sprite(glowMaterial);

  group.name = 'GEO SIGNAL CORE';
  glow.name = 'GEO Core Restrained Glow';
  glow.scale.set(1.38, 1.38, 1);
  glow.renderOrder = -1;
  label.sprite.position.set(0, -0.62, 0.08);
  group.add(glow, shell.points, pulses.lines, internalDisk.points, inner.points, micro.points, label.sprite);

  return {
    group,
    particleCount: INNER_PARTICLE_COUNT
      + SHELL_PARTICLE_COUNT
      + MICRO_PARTICLE_COUNT
      + INTERNAL_DISK_PARTICLE_COUNT,
    setDebugVisibility(showVisuals, showLabel) {
      inner.points.visible = showVisuals;
      internalDisk.points.visible = showVisuals;
      shell.points.visible = showVisuals;
      pulses.lines.visible = showVisuals;
      micro.points.visible = showVisuals;
      glow.visible = showVisuals;
      label.sprite.visible = showLabel;
    },
    update(time, progress) {
      const wake = smootherstep(0, 0.16, progress);
      const shellReveal = smootherstep(0.12, 0.62, progress);
      const pulseReveal = smootherstep(0.08, 0.7, progress);
      const stable = smootherstep(0.62, 0.9, progress);
      const labelReveal = smootherstep(0.74, 0.96, progress);
      const microMotion = smootherstep(0.08, 0.86, progress);
      const signalDriven = smootherstep(0.42, 0.9, progress);
      const volumeComplete = smootherstep(0.52, 0.9, progress);
      const restrainedFlicker = stable * (0.97 + Math.sin(time * 0.71) * 0.03);

      group.scale.setScalar(lerp(0.62, 0.86, wake) + volumeComplete * 0.14);
      inner.material.uniforms.uOpacity.value = wake * (0.54 + signalDriven * 0.13 + restrainedFlicker * 0.025);
      shell.material.uniforms.uOpacity.value = shellReveal * 0.225;
      shell.points.rotation.y = time * 0.021 * stable;
      shell.points.rotation.z = -time * 0.013 * stable;
      pulses.material.opacity = pulseReveal * 0.18;
      pulses.lines.rotation.y = time * 0.012 * stable;
      pulses.lines.scale.setScalar(lerp(0.78, 1, pulseReveal));
      internalDisk.material.uniforms.uOpacity.value = volumeComplete * 0.22;
      internalDisk.points.rotation.y = time * 0.045 * stable;
      internalDisk.points.rotation.z = -0.14 + Math.sin(time * 0.018) * 0.025 * stable;
      micro.material.uniforms.uProgress.value = microMotion;
      micro.material.uniforms.uTime.value = time;
      micro.material.uniforms.uOpacity.value = wake * (0.34 + signalDriven * 0.105);
      glowMaterial.opacity = stable * 0.042;
      glow.scale.setScalar(1.34 + stable * 0.06);
      label.material.opacity = labelReveal * 0.72;

      return wake * (0.72 + stable * 0.28);
    },
    dispose() {
      inner.dispose();
      internalDisk.dispose();
      shell.dispose();
      pulses.dispose();
      micro.dispose();
      label.dispose();
      glowMaterial.dispose();
      group.clear();
    }
  };
}

export function createSignalPointsMaterial(texture, opacity = 1) {
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

export function createLabelSprite(title, subtitle, color, width = 1.2) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 1024;
  canvas.height = 256;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = color;
  context.shadowBlur = 5;
  context.globalAlpha = 0.94;
  context.fillStyle = '#d8f5ff';
  context.font = '600 56px Arial, sans-serif';
  context.fillText(title, 512, subtitle ? 86 : 124);
  if (subtitle) {
    context.shadowBlur = 2;
    context.globalAlpha = 0.68;
    context.fillStyle = color;
    context.font = '400 36px Arial, sans-serif';
    context.fillText(subtitle, 512, 174);
  }
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

  sprite.scale.set(width, width * 0.25, 1);
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

function createInnerSignalCore(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(INNER_PARTICLE_COUNT * 3);
  const colors = new Float32Array(INNER_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(INNER_PARTICLE_COUNT);
  const random = seededRandom(104729);
  const centerColor = new THREE.Color('#dcf9ff');
  const edgeColor = new THREE.Color('#62d9ff');
  const color = new THREE.Color();

  for (let index = 0; index < INNER_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const radiusRatio = Math.pow(random(), 2.35);
    const radius = 0.5 * radiusRatio;
    const azimuth = random() * Math.PI * 2;
    const cosine = random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);

    positions[stride] = Math.cos(azimuth) * sine * radius;
    positions[stride + 1] = cosine * radius * 0.84;
    positions[stride + 2] = Math.sin(azimuth) * sine * radius;
    color.copy(centerColor).lerp(edgeColor, radiusRatio * 0.88);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 37 === 0 ? 2.78 : index % 7 === 0 ? 1.68 : 0.9;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = 'Inner Signal Core';
  points.renderOrder = 5;
  return disposablePoints(points, geometry, material);
}

function createInternalSignalDisk(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(INTERNAL_DISK_PARTICLE_COUNT * 3);
  const colors = new Float32Array(INTERNAL_DISK_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(INTERNAL_DISK_PARTICLE_COUNT);
  const random = seededRandom(118147);
  const ice = new THREE.Color('#baf9ff');
  const blue = new THREE.Color('#299fc8');
  const color = new THREE.Color();

  for (let index = 0; index < INTERNAL_DISK_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const angle = random() * Math.PI * 2;
    const radius = 0.12 + Math.pow(random(), 0.72) * 0.48;
    const thickness = (random() - 0.5) * (0.08 + radius * 0.12);

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = thickness + Math.sin(angle * 2.1) * 0.025;
    positions[stride + 2] = Math.sin(angle) * radius * 0.62 + thickness * 0.5;
    color.copy(ice).lerp(blue, 0.28 + random() * 0.62);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 31 === 0 ? 1.55 : 0.5 + random() * 0.62;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = 'Internal Rotating Signal Disk';
  points.rotation.x = 0.46;
  points.renderOrder = 4;
  return disposablePoints(points, geometry, material);
}

function createSignalShell(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SHELL_PARTICLE_COUNT * 3);
  const colors = new Float32Array(SHELL_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(SHELL_PARTICLE_COUNT);
  const random = seededRandom(130363);
  const cyan = new THREE.Color('#62d8ef');
  const blue = new THREE.Color('#2d88ca');
  const color = new THREE.Color();
  const fragments = [
    { azimuth: -0.42, elevation: 0.12, spread: 0.58 },
    { azimuth: 1.3, elevation: -0.24, spread: 0.44 },
    { azimuth: 3.08, elevation: 0.3, spread: 0.52 },
    { azimuth: 4.7, elevation: -0.08, spread: 0.4 }
  ];

  for (let written = 0; written < SHELL_PARTICLE_COUNT; written += 1) {
    const fragment = fragments[written % fragments.length];
    const azimuth = fragment.azimuth + (random() - 0.5) * fragment.spread;
    const elevation = fragment.elevation + (random() - 0.5) * fragment.spread * 0.72;
    const radius = 0.6 + random() * 0.075;
    const stride = written * 3;
    positions[stride] = Math.cos(elevation) * Math.cos(azimuth) * radius;
    positions[stride + 1] = Math.sin(elevation) * radius * 0.9;
    positions[stride + 2] = Math.cos(elevation) * Math.sin(azimuth) * radius;
    color.copy(cyan).lerp(blue, random() * 0.68);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[written] = 0.7 + random() * 0.8;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = 'Incomplete Signal Shell';
  points.renderOrder = 3;
  return disposablePoints(points, geometry, material);
}

function createSemanticPulses() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const definitions = [
    { radius: 0.68, start: -0.18, length: 1.92, tilt: 0.1 },
    { radius: 0.78, start: 2.18, length: 1.28, tilt: -0.22 },
    { radius: 0.9, start: 4.18, length: 0.94, tilt: 0.28 }
  ];

  definitions.forEach((definition, layerIndex) => {
    const segments = 34 - layerIndex * 5;
    for (let index = 0; index < segments; index += 1) {
      if ((index + layerIndex) % 7 === 4 || index % 11 === 8) continue;
      const t0 = index / segments;
      const t1 = (index + 0.72) / segments;
      appendPulseVertex(positions, definition, t0);
      appendPulseVertex(positions, definition, t1);
    }
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: '#76dcff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = 'Broken Semantic Pulses';
  lines.rotation.x = 0.34;
  lines.rotation.z = -0.18;
  return {
    lines,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createCoreMicroParticles(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MICRO_PARTICLE_COUNT * 3);
  const colors = new Float32Array(MICRO_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(MICRO_PARTICLE_COUNT);
  const phases = new Float32Array(MICRO_PARTICLE_COUNT);
  const random = seededRandom(155921);
  const cold = new THREE.Color('#c8f8ff');
  const blue = new THREE.Color('#3ebfe8');
  const color = new THREE.Color();

  for (let index = 0; index < MICRO_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const angle = random() * Math.PI * 2;
    const radius = 0.12 + random() * 0.68;
    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = (random() - 0.5) * 0.42;
    positions[stride + 2] = Math.sin(angle) * radius;
    color.copy(cold).lerp(blue, random() * 0.72);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 23 === 0 ? 1.98 : 0.7 + random() * 0.48;
    phases[index] = random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      uniform float uProgress;
      uniform float uTime;
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;

      void main() {
        float gather = mix(0.22, 1.0, uProgress);
        vec3 animated = position * gather;
        float stable = smoothstep(0.88, 1.0, uProgress);
        float orbit = uTime * 0.22 * stable + aPhase;
        animated.x += sin(orbit) * 0.018 * stable;
        animated.y += cos(orbit * 1.31) * 0.012 * stable;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        vColor = color;
        gl_PointSize = aSize * (12.5 / max(-viewPosition.z, 1.0));
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
  const points = new THREE.Points(geometry, material);

  points.name = 'Core Micro Particles';
  points.renderOrder = 6;
  return disposablePoints(points, geometry, material);
}

function appendPulseVertex(positions, definition, t) {
  const angle = definition.start + definition.length * t;
  const radius = definition.radius * (1 + Math.sin(t * Math.PI * 3) * 0.025);
  positions.push(
    Math.cos(angle) * radius,
    Math.sin(angle * 1.7) * 0.035 + definition.tilt * Math.cos(angle),
    Math.sin(angle) * radius
  );
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
    [128, 125, 118, 'rgba(42,168,220,0.18)'],
    [92, 142, 72, 'rgba(31,104,178,0.13)'],
    [166, 102, 58, 'rgba(93,189,225,0.09)']
  ];
  lobes.forEach(([x, y, radius, color]) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.45, color.replace(/0\.\d+\)/, '0.06)'));
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
