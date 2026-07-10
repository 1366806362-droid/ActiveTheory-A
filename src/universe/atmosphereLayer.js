import * as THREE from 'three';

const ATMOSPHERE_PARTICLE_COUNT = 620;

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

export function createAtmosphereLayer() {
  const random = seededRandom(9072026);
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ATMOSPHERE_PARTICLE_COUNT * 3);
  const colors = new Float32Array(ATMOSPHERE_PARTICLE_COUNT * 3);
  const baseColor = new THREE.Color(0x061a3f);
  const hazeColor = new THREE.Color(0x1c6aa8);
  const color = new THREE.Color();
  const atmosphereTexture = createSoftAtmosphereTexture();
  const deepSpaceGradient = createDeepSpaceGradient();
  const distantGalaxyLayers = createDistantGalaxyLayers();
  const nebulaLayers = createNebulaLayers();

  for (let i = 0; i < ATMOSPHERE_PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    const layer = random();
    const width = 22 + layer * 36;
    const height = 11 + layer * 20;

    positions[i3] = (random() - 0.5) * width + Math.sin(layer * Math.PI * 4) * 2.2;
    positions[i3 + 1] = 0.9 + (random() - 0.5) * height;
    positions[i3 + 2] = -4.5 - Math.pow(random(), 0.68) * 42;

    color.copy(baseColor).lerp(hazeColor, random() * 0.68);
    const depthFade = 0.24 + layer * 0.48;
    colors[i3] = color.r * depthFade;
    colors[i3 + 1] = color.g * depthFade;
    colors[i3 + 2] = color.b * depthFade;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 1.65,
    sizeAttenuation: true,
    map: atmosphereTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  group.name = 'ActiveTheoryAtmosphereLayer';
  points.name = 'ActiveTheoryAtmosphereDust';
  points.position.set(0, 0.55, -3.4);
  group.add(deepSpaceGradient.mesh, ...distantGalaxyLayers.meshes, ...nebulaLayers.meshes, points);

  function update(delta, time) {
    deepSpaceGradient.update(time);
    distantGalaxyLayers.update(delta, time);
    points.rotation.y += delta * 0.0045;
    points.rotation.x = Math.sin(time * 0.014) * 0.012;
    points.rotation.z = Math.sin(time * 0.021) * 0.016;
    points.position.x = Math.sin(time * 0.014) * 0.5;
    points.position.z = -3.4 + Math.sin(time * 0.01) * 1;
    material.opacity = 0.145 + Math.sin(time * 0.046) * 0.018;
    nebulaLayers.update(delta, time);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    atmosphereTexture.dispose();
    deepSpaceGradient.dispose();
    distantGalaxyLayers.dispose();
    nebulaLayers.dispose();
    group.clear();
  }

  return {
    points: group,
    update,
    dispose
  };
}

function createDistantGalaxyLayers() {
  const galaxyGeometry = new THREE.PlaneGeometry(10, 5);
  const clusterGeometry = new THREE.PlaneGeometry(7, 4);
  const materialA = createDistantGalaxyMaterial(0x2b6fc0, 0x6548a8, 0.055, 0.4);
  const materialC = createDistantClusterMaterial(0x8bd8ff, 0x5040a0, 0.1, 3.2);
  const galaxyA = new THREE.Mesh(galaxyGeometry, materialA);
  const cluster = new THREE.Mesh(clusterGeometry, materialC);

  galaxyA.name = 'HeroFarSpiralGalaxyA';
  cluster.name = 'HeroFarStarCluster';
  galaxyA.position.set(-7.6, 3.35, -38);
  cluster.position.set(-5.2, -2.2, -28);
  galaxyA.rotation.z = -0.34;
  cluster.rotation.z = 0.12;
  galaxyA.scale.set(2.35, 1.48, 1);
  cluster.scale.set(1.62, 1.02, 1);

  function update(delta, time) {
    materialA.uniforms.uTime.value = time;
    materialC.uniforms.uTime.value = time;
    materialA.uniforms.uOpacity.value = 0.038 + Math.sin(time * 0.014) * 0.006;
    materialC.uniforms.uOpacity.value = 0.08 + Math.sin(time * 0.017 + 2.4) * 0.01;
    galaxyA.rotation.z += delta * 0.0006;
    cluster.rotation.z += delta * 0.001;
  }

  function dispose() {
    galaxyGeometry.dispose();
    clusterGeometry.dispose();
    materialA.dispose();
    materialC.dispose();
  }

  return {
    meshes: [galaxyA, cluster],
    update,
    dispose
  };
}

function createDeepSpaceGradient() {
  const geometry = new THREE.SphereGeometry(55, 32, 18);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeepBlack: { value: new THREE.Color(0x020612) },
      uDeepBlue: { value: new THREE.Color(0x0a2a5a) },
      uIndigo: { value: new THREE.Color(0x211a66) },
      uViolet: { value: new THREE.Color(0x32154f) }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeepBlack;
      uniform vec3 uDeepBlue;
      uniform vec3 uIndigo;
      uniform vec3 uViolet;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(41.13, 289.97))) * 31243.653);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 uv = vUv - 0.5;
        uv.x *= 1.65;
        float coreGlow = 1.0 - smoothstep(0.04, 0.88, length(uv - vec2(0.18, -0.03)));
        float upperBlue = smoothstep(-0.5, 0.55, uv.y);
        float sideViolet = 1.0 - smoothstep(0.04, 1.05, length(uv - vec2(0.78, 0.08)));
        float driftingNoise = noise(uv * 4.2 + vec2(uTime * 0.01, -uTime * 0.006));
        vec3 color = mix(uDeepBlack, uDeepBlue, coreGlow * 0.68 + upperBlue * 0.22);
        color = mix(color, uIndigo, sideViolet * 0.34);
        color = mix(color, uViolet, driftingNoise * sideViolet * 0.2);
        float alpha = 0.58 + coreGlow * 0.18 + sideViolet * 0.16;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.BackSide,
    fog: false
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'HeroDeepSpaceGradient';
  mesh.position.set(0, 0, 0);
  mesh.rotation.z = -0.04;
  mesh.renderOrder = -100;

  function update(time) {
    material.uniforms.uTime.value = time;
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

function createDistantGalaxyMaterial(colorA, colorB, opacity, seed) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uSeed: { value: seed }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uSeed;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(91.7, 241.3))) * 28751.531);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 uv = (vUv - 0.5) * vec2(1.8, 1.0);
        float r = length(uv);
        float angle = atan(uv.y, uv.x);
        float arms = sin(angle * 3.0 + r * 13.0 - uTime * 0.025 + uSeed) * 0.5 + 0.5;
        float dust = noise(uv * 7.0 + vec2(uSeed, uTime * 0.008));
        float disk = exp(-r * 3.35);
        float spiral = smoothstep(0.45, 0.88, arms * 0.68 + dust * 0.32) * disk;
        float core = exp(-r * 14.0) * 0.38;
        float alpha = (spiral + core) * uOpacity;
        vec3 color = mix(uColorB, uColorA, spiral + core);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false
  });
}

function createDistantClusterMaterial(colorA, colorB, opacity, seed) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uSeed: { value: seed }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uSeed;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec2 uv = (vUv - 0.5) * vec2(1.5, 1.0);
        float r = length(uv);
        float cluster = exp(-r * 3.15);
        float stars = 0.0;
        vec2 cell = floor((uv + 0.5) * 24.0);
        float sparkle = hash(cell + uSeed);
        if (sparkle > 0.955) {
          vec2 local = fract((uv + 0.5) * 24.0) - 0.5;
          stars = exp(-dot(local, local) * 90.0) * cluster;
        }
        float haze = cluster * 0.34;
        float alpha = (haze + stars) * uOpacity;
        vec3 color = mix(uColorB, uColorA, stars + haze);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false
  });
}

function createNebulaLayers() {
  const geometry = new THREE.PlaneGeometry(14, 8);
  const wideGeometry = new THREE.PlaneGeometry(26, 7);
  const materialA = createProceduralNebulaMaterial(0x176fb8, 0x03142d, 0.22, 0.9);
  const materialC = createProceduralNebulaMaterial(0x54339a, 0x030817, 0.24, 2.4);
  const meshA = new THREE.Mesh(geometry, materialA);
  const meshC = new THREE.Mesh(wideGeometry, materialC);

  meshA.name = 'HeroDeepBlueNebulaA';
  meshC.name = 'HeroDistantGalaxyMist';
  meshA.position.set(2.4, -0.3, -16);
  meshC.position.set(1.2, -0.35, -21);
  meshA.rotation.z = -0.18;
  meshC.rotation.z = -0.08;
  meshA.scale.set(1.75, 1.36, 1);
  meshC.scale.set(1.16, 1.05, 1);

  function update(delta, time) {
    meshA.rotation.z = -0.18 + Math.sin(time * 0.018) * 0.012;
    meshC.rotation.z = -0.08 + Math.sin(time * 0.01 + 0.4) * 0.012;
    materialA.uniforms.uTime.value = time;
    materialC.uniforms.uTime.value = time;
    materialA.uniforms.uOpacity.value = 0.18 + Math.sin(time * 0.035) * 0.012;
    materialC.uniforms.uOpacity.value = 0.2 + Math.sin(time * 0.018 + 0.8) * 0.014;
  }

  function dispose() {
    geometry.dispose();
    wideGeometry.dispose();
    materialA.dispose();
    materialC.dispose();
  }

  return {
    meshes: [meshA, meshC],
    update,
    dispose
  };
}

function createSoftAtmosphereTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 128;
  const center = size * 0.5;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);

  canvas.width = size;
  canvas.height = size;
  gradient.addColorStop(0, 'rgba(120,220,255,0.5)');
  gradient.addColorStop(0.42, 'rgba(32,104,180,0.16)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);

  texture.needsUpdate = true;

  return texture;
}

function createProceduralNebulaMaterial(colorA, colorB, opacity, seed) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uSeed: { value: seed }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uSeed;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += noise(p) * amplitude;
          p = p * 2.03 + vec2(8.7 + uSeed, 3.1);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = vUv - 0.5;
        uv.x *= 1.8;
        float radial = 1.0 - smoothstep(0.08, 0.9, length(uv));
        float drift = uTime * 0.018;
        float cloud = fbm(uv * 2.6 + vec2(drift + uSeed, -drift * 0.6));
        float filament = fbm(uv * 6.2 + vec2(-drift * 0.8, drift + uSeed));
        float density = smoothstep(0.25, 0.86, cloud * 0.72 + filament * 0.28) * radial;
        vec3 color = mix(uColorB, uColorA, density);
        float alpha = density * uOpacity;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false
  });
}

export const atmosphereLayerManager = {
  createAtmosphereLayer
};
