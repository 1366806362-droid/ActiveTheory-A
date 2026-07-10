import * as THREE from 'three';

const TAU = Math.PI * 2;

export function createGalaxyCoreCluster(options = {}) {
  const config = {
    starCount: 240,
    highlightCount: 7,
    radius: 0.24,
    depthRange: 0.22,
    coreColor: 0xeefcff,
    secondaryColors: [0xbcecff, 0x74d8ff, 0xa89cff, 0xffefd5],
    bloomIntensity: 1,
    pulseSpeed: 0.32,
    starOpacity: 0.52,
    highlightOpacity: 0.7,
    hazeOpacity: 0.1,
    seed: 314159,
    ...options
  };
  const group = new THREE.Group();
  const texture = createStarTexture();
  const starField = createStarField(config, texture);
  const highlights = createHighlightStars(config, texture);
  const haze = createCoreHaze(config);

  group.name = options.name || 'GalaxyCoreCluster';
  group.add(haze.group, starField.points, highlights.points);

  function update(delta, time, pulse = 0.5, visibility = 1, focus = 0, boost = 1) {
    const intensity = visibility * boost;
    const restrainedPulse = 1 + Math.sin(time * config.pulseSpeed) * 0.025;

    group.scale.setScalar(restrainedPulse * (1 + focus * 0.035));
    group.rotation.z -= delta * 0.004;
    starField.points.rotation.z += delta * 0.003;
    starField.points.rotation.y = Math.sin(time * 0.025) * 0.035;
    starField.material.opacity = intensity * (config.starOpacity + pulse * 0.08);
    highlights.material.uniforms.uOpacity.value = intensity * (config.highlightOpacity + pulse * 0.12) * config.bloomIntensity;
    highlights.material.uniforms.uPulse.value = restrainedPulse;
    haze.update(time, intensity, focus);
  }

  function dispose() {
    texture.dispose();
    starField.dispose();
    highlights.dispose();
    haze.dispose();
    group.clear();
  }

  return {
    group,
    update,
    dispose,
    planetCount: 0,
    starCount: config.starCount,
    highlightCount: config.highlightCount
  };
}

function createStarField(config, texture) {
  const random = seededRandom(config.seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(config.starCount * 3);
  const colors = new Float32Array(config.starCount * 3);
  const palette = [config.coreColor, ...config.secondaryColors];
  const color = new THREE.Color();

  for (let index = 0; index < config.starCount; index += 1) {
    const stride = index * 3;
    const radialRatio = Math.pow(random(), 2.35);
    const radius = radialRatio * config.radius;
    const angle = random() * TAU;
    const verticalSpread = (1 - radialRatio * 0.7) * config.depthRange;

    positions[stride] = Math.cos(angle) * radius * (0.72 + random() * 0.38);
    positions[stride + 1] = Math.sin(angle) * radius * (0.55 + random() * 0.25);
    positions[stride + 2] = (random() - 0.5) * verticalSpread;
    color.set(palette[random() < 0.72 ? 0 : 1 + Math.floor(random() * (palette.length - 1))]);
    color.multiplyScalar(0.52 + (1 - radialRatio) * 0.5);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: texture,
    color: 0xffffff,
    vertexColors: true,
    size: config.radius * 0.075,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.56,
    alphaTest: 0.012,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: true,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GalaxyCoreMicroStars';

  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createHighlightStars(config, texture) {
  const count = config.highlightCount;
  const random = seededRandom(config.seed + 7129);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const palette = [config.coreColor, ...config.secondaryColors];
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const tier = index === 0 ? 0 : index < 3 ? 1 : 2;
    const radius = tier === 0 ? 0 : config.radius * (tier === 1 ? 0.22 + random() * 0.18 : 0.4 + random() * 0.32);
    const angle = index * 2.399963 + random() * 0.5;

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = Math.sin(angle) * radius * 0.65;
    positions[stride + 2] = (random() - 0.5) * config.depthRange * (tier === 0 ? 0.12 : 0.7);
    color.set(palette[index % palette.length]);
    color.multiplyScalar(tier === 0 ? 1 : tier === 1 ? 0.76 : 0.5);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = config.radius * (tier === 0 ? 2.2 : tier === 1 ? 1.3 : 0.85);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: 0.8 },
      uPulse: { value: 1 }
    },
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      uniform float uPulse;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        gl_PointSize = aSize * uPulse * (48.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec3 vColor;

      void main() {
        float alpha = texture2D(uTexture, gl_PointCoord).a;
        gl_FragColor = vec4(vColor, alpha * uOpacity);
      }
    `,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'GalaxyCoreHighlightStars';

  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createCoreHaze(config) {
  const texture = createHazeTexture();
  const materials = [
    new THREE.SpriteMaterial({
      map: texture,
      color: config.coreColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: true
    }),
    new THREE.SpriteMaterial({
      map: texture,
      color: config.secondaryColors.at(-1) || config.coreColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      toneMapped: true
    })
  ];
  const sprites = materials.map((material) => new THREE.Sprite(material));
  const group = new THREE.Group();

  sprites[0].scale.set(config.radius * 2.25, config.radius * 1.22, 1);
  sprites[0].rotation.z = -0.28;
  sprites[1].scale.set(config.radius * 1.65, config.radius * 0.9, 1);
  sprites[1].position.set(config.radius * 0.15, -config.radius * 0.05, -0.02);
  sprites[1].rotation.z = 0.34;
  group.name = 'GalaxyCoreSoftNebula';
  group.add(...sprites);

  return {
    group,
    update(time, visibility, focus) {
      materials[0].opacity = visibility * (config.hazeOpacity + focus * 0.025);
      materials[1].opacity = visibility * config.hazeOpacity * 0.45;
      sprites[0].material.rotation = -0.28 + Math.sin(time * 0.012) * 0.015;
      sprites[1].material.rotation = 0.34 - Math.sin(time * 0.009) * 0.012;
    },
    dispose() {
      materials.forEach((material) => material.dispose());
      texture.dispose();
      group.clear();
    }
  };
}

function createStarTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 64;
  const center = size * 0.5;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);

  canvas.width = size;
  canvas.height = size;
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.16, 'rgba(225,248,255,0.92)');
  gradient.addColorStop(0.42, 'rgba(110,198,255,0.34)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHazeTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 128);

  canvas.width = 256;
  canvas.height = 256;
  gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(0.26, 'rgba(175,225,255,0.16)');
  gradient.addColorStop(0.62, 'rgba(80,115,200,0.055)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export const galaxyCoreClusterFactory = {
  createGalaxyCoreCluster
};
