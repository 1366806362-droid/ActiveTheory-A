import * as THREE from 'three';

export function createNebulaVolume() {
  const backgroundGroup = new THREE.Group();
  const galaxyDustGroup = new THREE.Group();
  const sharedTime = { value: 0 };
  const backgroundLayers = [
    createNebulaSlice({
      role: 'milkyWay',
      width: 14.5,
      height: 4.4,
      position: [2.8, 1.75, -18],
      rotation: [-0.05, 0.08, -0.27],
      colorA: 0x275488,
      colorB: 0x31265a,
      opacity: 0.105,
      seed: 1.7,
      parallax: 0.0042,
      shapeScale: [1.15, 1.35],
      sharedTime,
      blending: THREE.NormalBlending
    }),
    createNebulaSlice({
      role: 'nebula',
      width: 5.8,
      height: 3.8,
      position: [-4.6, -3.0, -16.5],
      rotation: [0.04, -0.1, -0.18],
      colorA: 0x204878,
      colorB: 0x2b2052,
      opacity: 0.065,
      seed: 4.6,
      parallax: 0.009,
      shapeScale: [1.2, 1.22],
      sharedTime,
      blending: THREE.NormalBlending
    }),
    createNebulaSlice({
      role: 'nebula',
      width: 5.2,
      height: 3.4,
      position: [6.5, -6.2, -16.8],
      rotation: [-0.04, 0.08, 0.22],
      colorA: 0x1b5d77,
      colorB: 0x292054,
      opacity: 0.058,
      seed: 9.2,
      parallax: 0.013,
      shapeScale: [1.12, 1.3],
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
  let layerMode = 'combined';
  let debugIsolated = false;

  function update(delta, time, interaction, journeyProgress = 0) {
    sharedTime.value = time;
    const parallaxX = interaction?.parallaxX ?? 0;
    const parallaxY = interaction?.parallaxY ?? 0;

    backgroundLayers.forEach((layer, index) => {
      const depthFactor = layer.parallax;
      layer.mesh.position.x = layer.baseX + parallaxX * depthFactor;
      layer.mesh.position.y = layer.baseY + parallaxY * depthFactor;
      layer.mesh.rotation.z = layer.baseRotation + Math.sin(time * (0.004 + index * 0.0017)) * 0.008;
      layer.material.uniforms.uJourney.value = journeyProgress;
      const isolatedBoost = debugIsolated
        ? layer.role === 'milkyWay' && layerMode === 'milkyWayOnly'
          ? 2.7
          : layer.role === 'nebula' && layerMode === 'nebulaOnly'
            ? 4.2
            : 1
        : 1;
      layer.material.uniforms.uOpacity.value = layer.baseOpacity
        * (1 + journeyProgress * 0.24)
        * isolatedBoost;
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

  function setLayerMode(mode = 'combined', debugEnabled = false) {
    layerMode = mode;
    debugIsolated = debugEnabled;
    backgroundLayers.forEach((layer) => {
      const isSelectedLayer = (mode === 'milkyWayOnly' && layer.role === 'milkyWay')
        || (mode === 'nebulaOnly' && layer.role === 'nebula');
      layer.mesh.visible = mode === 'combined'
        || (mode === 'milkyWayOnly' && layer.role === 'milkyWay')
        || (mode === 'nebulaOnly' && layer.role === 'nebula');
      layer.material.uniforms.uDebugIsolated.value = debugEnabled && isSelectedLayer ? 1 : 0;
    });
  }

  return { backgroundGroup, galaxyDustGroup, update, setLayerMode, dispose };
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
    role: config.role,
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
      uDebugIsolated: { value: 0 },
      uSeed: { value: config.seed },
      uShapeScale: { value: new THREE.Vector2(...config.shapeScale) },
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
      uniform float uDebugIsolated;
      uniform float uSeed;
      uniform vec2 uShapeScale;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uGeoColor;
      varying vec2 vUv;

      float hash31(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }

      float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(i);
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
        return mix(
          mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
          mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
          u.z
        );
      }

      float fbm3(vec3 p) {
        float value = 0.0;
        float amplitude = 0.52;
        for (int i = 0; i < 5; i++) {
          value += noise3(p) * amplitude;
          p = p * 2.03 + vec3(7.1, 3.7, 5.3);
          amplitude *= 0.49;
        }
        return value;
      }

      void main() {
        vec2 localUv = vUv - 0.5;
        vec2 uv = localUv * uShapeScale;
        float drift = uTime * 0.0018;
        vec3 basePosition = vec3(uv * 1.55, uSeed * 0.37 + drift);
        vec2 warp = vec2(
          fbm3(basePosition + vec3(uSeed, 1.7, 2.4)),
          fbm3(basePosition * 1.11 + vec3(4.2, -uSeed, -1.8))
        ) - 0.5;
        vec2 warpedUv = uv + warp * 0.22;
        float low = fbm3(vec3(warpedUv * 2.05, uSeed + drift));
        float detail = fbm3(vec3(warpedUv * 4.9 - warp * 0.42, uSeed * 1.7 - drift));
        float filament = 1.0 - abs(
          fbm3(vec3(warpedUv * vec2(3.2, 4.0), uSeed * 2.3)) * 2.0 - 1.0
        );
        float broken = smoothstep(0.29, 0.58, low * 0.67 + detail * 0.18 + filament * 0.15);
        float edgeX = 1.0 - smoothstep(0.3, 0.5, abs(localUv.x + warp.x * 0.045));
        float edgeY = 1.0 - smoothstep(0.2, 0.5, abs(localUv.y + warp.y * 0.065));
        float breakup = smoothstep(
          0.22,
          0.62,
          fbm3(vec3(warpedUv * 3.15, uSeed * 2.05 + drift))
        );
        float density = broken * edgeX * edgeY * mix(0.26, 1.0, breakup) * 1.12;
        float isolatedDensity = edgeX * edgeY * mix(0.12, 0.52, breakup);
        density = max(density, isolatedDensity * uDebugIsolated);
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
    fog: false,
    toneMapped: true
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
