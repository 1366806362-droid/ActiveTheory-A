import * as THREE from 'three';

export function createNebulaVolume() {
  const backgroundGroup = new THREE.Group();
  const galaxyDustGroup = new THREE.Group();
  const sharedTime = { value: 0 };
  const backgroundLayers = [
    createNebulaSlice({
      width: 16,
      height: 2.45,
      position: [2.2, 2.35, -18],
      rotation: [-0.05, 0.08, -0.27],
      colorA: 0x17365f,
      colorB: 0x21183d,
      opacity: 0.075,
      seed: 1.7,
      parallax: 0.007,
      sharedTime,
      blending: THREE.NormalBlending
    }),
    createNebulaSlice({
      width: 5.6,
      height: 2.15,
      position: [-0.65, -1.72, -16.5],
      rotation: [0.04, -0.1, -0.18],
      colorA: 0x17305a,
      colorB: 0x1d1538,
      opacity: 0.055,
      seed: 4.6,
      parallax: 0.015,
      sharedTime,
      blending: THREE.NormalBlending
    }),
    createNebulaSlice({
      width: 5.0,
      height: 1.8,
      position: [4.75, -1.62, -16.8],
      rotation: [-0.04, 0.08, 0.22],
      colorA: 0x123b53,
      colorB: 0x1b1638,
      opacity: 0.048,
      seed: 9.2,
      parallax: 0.021,
      sharedTime,
      blending: THREE.NormalBlending
    })
  ];
  const dustLayers = [
    createDustBand({
      width: 3.3,
      height: 1.5,
      colorA: 0x071124,
      colorB: 0x17102d,
      opacity: 0.2,
      seed: 3.2,
      sharedTime,
      rotation: -0.16
    }),
    createDustBand({
      width: 2.75,
      height: 1.2,
      colorA: 0x061a24,
      colorB: 0x120d26,
      opacity: 0.13,
      seed: 8.9,
      sharedTime,
      rotation: 0.2
    })
  ];

  backgroundGroup.name = 'HeroNebulaVolume';
  galaxyDustGroup.name = 'BrandGalaxyDustBands';
  backgroundLayers.forEach((layer) => backgroundGroup.add(layer.mesh));
  dustLayers.forEach((layer) => galaxyDustGroup.add(layer.mesh));
  galaxyDustGroup.rotation.set(-0.48, 0.1, -0.12);

  function update(delta, time, interaction, journeyProgress = 0) {
    sharedTime.value = time;
    const parallaxX = interaction?.parallaxX ?? 0;
    const parallaxY = interaction?.parallaxY ?? 0;

    backgroundLayers.forEach((layer, index) => {
      const depthFactor = layer.parallax;
      const geoTint = journeyProgress * 0.08;

      layer.mesh.position.x = layer.baseX + parallaxX * depthFactor;
      layer.mesh.position.y = layer.baseY + parallaxY * depthFactor;
      layer.mesh.rotation.z = layer.baseRotation + Math.sin(time * (0.004 + index * 0.0017)) * 0.008;
      layer.material.uniforms.uJourney.value = journeyProgress;
      layer.material.uniforms.uOpacity.value = layer.baseOpacity + geoTint;
    });

    dustLayers.forEach((layer, index) => {
      layer.mesh.rotation.z = layer.baseRotation + time * (index === 0 ? 0.0022 : -0.0016);
      layer.material.uniforms.uJourney.value = journeyProgress;
      layer.material.uniforms.uOpacity.value = layer.baseOpacity * (1 - journeyProgress * 0.35);
    });
  }

  function dispose() {
    backgroundLayers.forEach((layer) => layer.dispose());
    dustLayers.forEach((layer) => layer.dispose());
    backgroundGroup.clear();
    galaxyDustGroup.clear();
  }

  return { backgroundGroup, galaxyDustGroup, update, dispose };
}

function createNebulaSlice(config) {
  const geometry = new THREE.PlaneGeometry(config.width, config.height, 1, 1);
  const material = createNebulaMaterial(config);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(...config.position);
  mesh.rotation.set(...config.rotation);
  mesh.renderOrder = -18;

  return {
    mesh,
    material,
    baseX: config.position[0],
    baseY: config.position[1],
    baseRotation: config.rotation[2],
    baseOpacity: config.opacity,
    parallax: config.parallax,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createDustBand(config) {
  const geometry = new THREE.PlaneGeometry(config.width, config.height, 1, 1);
  const material = createDustMaterial(config);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.z = -0.035;
  mesh.rotation.z = config.rotation;
  mesh.renderOrder = 4;

  return {
    mesh,
    material,
    baseRotation: config.rotation,
    baseOpacity: config.opacity,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createNebulaMaterial(config) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: config.sharedTime,
      uOpacity: { value: config.opacity },
      uJourney: { value: 0 },
      uSeed: { value: config.seed },
      uColorA: { value: new THREE.Color(config.colorA) },
      uColorB: { value: new THREE.Color(config.colorB) },
      uGeoColor: { value: new THREE.Color(0x087f99) }
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
      uniform float uJourney;
      uniform float uSeed;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uGeoColor;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        for (int i = 0; i < 5; i++) {
          value += noise(p) * amplitude;
          p = p * 2.03 + vec2(7.1, 3.7);
          amplitude *= 0.49;
        }
        return value;
      }

      void main() {
        vec2 uv = vUv - 0.5;
        uv.x *= 1.65;
        float drift = uTime * 0.004;
        vec2 warp = vec2(
          fbm(uv * 1.3 + vec2(uSeed, drift)),
          fbm(uv * 1.45 + vec2(-drift, uSeed + 4.2))
        ) - 0.5;
        float low = fbm(uv * 2.1 + warp * 0.62 + uSeed);
        float detail = fbm(uv * 5.2 - warp * 0.38 - uSeed);
        float broken = smoothstep(0.4, 0.78, low * 0.74 + detail * 0.26);
        vec2 warpedEdgeUv = uv + warp * 0.12;
        float softEdge = smoothstep(0.76, 0.18, length(warpedEdgeUv * vec2(0.7, 1.25)));
        float edgeNoise = smoothstep(0.18, 0.72, fbm(uv * 3.4 + warp * 0.5 + uSeed * 2.1));
        float density = broken * softEdge * mix(0.52, 1.0, edgeNoise);
        vec3 baseColor = mix(uColorB, uColorA, density);
        vec3 color = mix(baseColor, uGeoColor, uJourney * density * 0.34);
        gl_FragColor = vec4(color, density * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: config.blending,
    fog: false
  });
}

function createDustMaterial(config) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: config.sharedTime,
      uOpacity: { value: config.opacity },
      uJourney: { value: 0 },
      uSeed: { value: config.seed },
      uColorA: { value: new THREE.Color(config.colorA) },
      uColorB: { value: new THREE.Color(config.colorB) }
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
      uniform float uSeed;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(91.7, 241.3))) * 28751.531);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }

      void main() {
        vec2 uv = vUv - 0.5;
        uv.x *= 1.5;
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        float arm = sin(angle * 2.0 + radius * 11.0 + uSeed + uTime * 0.005) * 0.5 + 0.5;
        float breakup = noise(uv * 8.0 + uSeed);
        float mask = smoothstep(0.48, 0.78, arm * 0.7 + breakup * 0.3);
        mask *= smoothstep(0.78, 0.12, radius);
        vec3 color = mix(uColorB, uColorA, breakup);
        gl_FragColor = vec4(color, mask * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    fog: false
  });
}

export const nebulaVolumeFactory = {
  createNebulaVolume
};
