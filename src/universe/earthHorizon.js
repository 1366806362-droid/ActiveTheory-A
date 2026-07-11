import * as THREE from 'three';

export function createEarthHorizon() {
  const group = new THREE.Group();
  const surfaceGeometry = new THREE.SphereGeometry(1.24, 64, 40);
  const cloudGeometry = new THREE.SphereGeometry(1.243, 64, 40);
  const atmosphereGeometry = new THREE.SphereGeometry(1.247, 64, 40);
  const sharedTime = { value: 0 };
  const surfaceMaterial = createSurfaceMaterial(sharedTime);
  const cloudMaterial = createCloudMaterial(sharedTime);
  const atmosphereMaterial = createAtmosphereMaterial();
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);

  group.name = 'HeroEarthHorizon';
  group.position.set(-5.45, -3.75, -0.35);
  group.rotation.set(-0.62, -0.5, 0.18);
  surface.name = 'EarthNightSurface';
  clouds.name = 'EarthLowCloudLayer';
  atmosphere.name = 'EarthAtmosphereRim';
  surface.renderOrder = 2;
  clouds.renderOrder = 3;
  atmosphere.renderOrder = 4;
  group.add(surface, clouds, atmosphere);

  function update(delta, time) {
    sharedTime.value = time;
    group.rotation.y -= delta * 0.0012;
    clouds.rotation.y += delta * 0.0024;
  }

  function dispose() {
    surfaceGeometry.dispose();
    cloudGeometry.dispose();
    atmosphereGeometry.dispose();
    surfaceMaterial.dispose();
    cloudMaterial.dispose();
    atmosphereMaterial.dispose();
    group.clear();
  }

  return { group, update, dispose };
}

function createSurfaceMaterial(sharedTime) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;

      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalView;

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
          p = p * 2.03 + vec2(3.7, 7.1);
          amplitude *= 0.49;
        }
        return value;
      }

      void main() {
        vec2 wrappedUv = vec2(fract(vUv.x + 0.08), vUv.y);
        float land = fbm(wrappedUv * vec2(7.5, 4.8) + vec2(2.1, 4.7));
        land = smoothstep(0.48, 0.64, land);
        float terrain = fbm(wrappedUv * vec2(19.0, 11.0) + 8.4);
        vec2 cityGrid = wrappedUv * vec2(164.0, 82.0);
        vec2 cell = floor(cityGrid);
        vec2 pointUv = fract(cityGrid) - 0.5;
        float citySeed = hash(cell);
        float settlement = fbm(wrappedUv * vec2(15.0, 8.0) + vec2(13.4, 2.9));
        float cityDot = smoothstep(0.052, 0.01, length(pointUv));
        float latitudeMask = smoothstep(0.08, 0.26, vUv.y) * smoothstep(0.94, 0.68, vUv.y);
        float cityMask = cityDot
          * smoothstep(0.5, 0.9, citySeed)
          * smoothstep(0.35, 0.65, settlement)
          * land
          * latitudeMask;
        float cityPulse = 0.94 + sin(uTime * 0.45 + citySeed * 15.0) * 0.06;
        float facing = max(vNormalView.z, 0.0);
        float horizon = pow(1.0 - facing, 3.0);
        vec3 ocean = vec3(0.005, 0.016, 0.034) * (0.82 + terrain * 0.14);
        vec3 landColor = vec3(0.018, 0.056, 0.09) * (0.68 + terrain * 0.54);
        vec3 color = mix(ocean, landColor, land);
        float warmWhite = hash(cell + vec2(19.4, 7.8));
        vec3 cityColor = mix(vec3(1.0, 0.43, 0.09), vec3(1.0, 0.78, 0.44), smoothstep(0.82, 0.98, warmWhite));
        color += cityColor * cityMask * cityPulse * 3.85;
        color += vec3(0.025, 0.12, 0.24) * horizon * 0.035;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthWrite: true,
    fog: false,
    toneMapped: true
  });
}

function createCloudMaterial(sharedTime) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;

      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalView;

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
        for (int i = 0; i < 4; i++) {
          value += noise(p) * amplitude;
          p = p * 2.08 + vec2(4.3, 1.7);
          amplitude *= 0.48;
        }
        return value;
      }

      void main() {
        vec2 driftUv = vec2(fract(vUv.x + uTime * 0.00028), vUv.y);
        float cloud = fbm(driftUv * vec2(9.5, 5.4) + vec2(8.2, 3.1));
        cloud = smoothstep(0.57, 0.73, cloud);
        float facing = max(vNormalView.z, 0.0);
        float limbFade = smoothstep(0.02, 0.42, facing);
        vec3 cloudColor = mix(vec3(0.035, 0.09, 0.15), vec3(0.12, 0.22, 0.31), cloud);
        gl_FragColor = vec4(cloudColor, cloud * limbFade * 0.22);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    fog: false,
    toneMapped: true
  });
}

function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormalView;

      void main() {
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormalView;

      void main() {
        float facing = max(vNormalView.z, 0.0);
        float rim = pow(1.0 - facing, 25.0);
        float softRim = pow(1.0 - facing, 16.0);
        vec3 sunriseDirection = normalize(vec3(0.72, 0.56, 0.14));
        float sunrise = pow(max(dot(vNormalView, sunriseDirection), 0.0), 72.0)
          * pow(1.0 - facing, 4.0);
        vec3 color = mix(vec3(0.045, 0.3, 0.72), vec3(0.38, 0.76, 1.0), rim);
        color += vec3(0.72, 0.9, 1.0) * sunrise * 0.75;
        gl_FragColor = vec4(color, rim * 0.1 + softRim * 0.014 + sunrise * 0.12);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: false
  });
}
