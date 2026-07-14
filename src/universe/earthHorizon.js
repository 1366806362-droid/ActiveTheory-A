import * as THREE from 'three';
import {
  createEarthTextureLayers,
  EARTH_TEXTURE_V2_QUALITY
} from './earthTextureMaterial.js';
import { createEarthTextureLoader } from './earthTextureLoader.js';

const EARTH_SURFACE_PERIOD = 210;
const EARTH_CLOUD_SPEED_MULTIPLIER = 1.11;
const EARTH_SURFACE_ANGULAR_SPEED = Math.PI * 2 / EARTH_SURFACE_PERIOD;
const EARTH_CLOUD_ANGULAR_SPEED = EARTH_SURFACE_ANGULAR_SPEED * EARTH_CLOUD_SPEED_MULTIPLIER;
const EARTH_SUN_DIRECTION = new THREE.Vector3(-0.75, 0.55, -0.36).normalize();
const EARTH_Y_AXIS = new THREE.Vector3(0, 1, 0);

const EARTH_LAYER_MODES = Object.freeze({
  surfaceOnly: 0,
  landOnly: 1,
  cityOnly: 2,
  cloudOnly: 3,
  atmosphereOnly: 4,
  combined: 5
});
const EARTH_HYBRID_MODES = new Set([
  'proceduralOnly',
  'surfaceTextureOnly',
  'cityTextureOnly',
  'cloudTextureOnly',
  'combined'
]);

export function createEarthHorizon() {
  const group = new THREE.Group();
  const surfaceGroup = new THREE.Group();
  const cityLightsGroup = new THREE.Group();
  const cloudGroup = new THREE.Group();
  const atmosphereGroup = new THREE.Group();
  const sunriseGlow = new THREE.Group();
  const surfaceGeometry = new THREE.SphereGeometry(1.85, 64, 40);
  const cityLightsGeometry = new THREE.SphereGeometry(1.859, 64, 40);
  const cloudGeometry = new THREE.SphereGeometry(1.86, 64, 40);
  const atmosphereGeometry = new THREE.SphereGeometry(1.864, 64, 40);
  const sharedTime = { value: 0 };
  const seamDebug = createEarthSeamDebug();
  const hybridDebug = createEarthHybridDebug();
  const layerModeOverride = readEarthLayerModeOverride();
  const cityOnlyDebug = readCityOnlyDebugState();
  const surfaceMaterial = createSurfaceMaterial(sharedTime, seamDebug.enabled);
  const cityLightsMaterial = createCityLightsMaterial(sharedTime);
  const cloudMaterial = createCloudMaterial(sharedTime, seamDebug.enabled);
  const atmosphereMaterial = createAtmosphereMaterial();
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  const cityLights = new THREE.Mesh(cityLightsGeometry, cityLightsMaterial);
  const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  const textureLoader = createEarthTextureLoader({ anisotropy: 6 });
  const textureLayers = createEarthTextureLayers({
    surfaceGeometry,
    cityGeometry: cityLightsGeometry,
    cloudGeometry,
    sunDirection: EARTH_SUN_DIRECTION
  });
  const rotationDebug = createEarthRotationDebug();
  const inverseSurfaceRotation = new THREE.Quaternion();
  const surfaceInitialPhase = -1.7;
  let surfaceAngle = surfaceInitialPhase;
  let cloudAngle = 0;
  let visualTime = 0;
  let debugWallTime = performance.now();
  let textureStatus = 'idle';
  let unsubscribeTextureLoader = null;

  group.name = 'EarthRoot';
  group.position.set(-19.3, -14, -0.35);
  group.scale.setScalar(5.55);
  group.rotation.set(-0.62, -0.5, 0.18);
  surfaceGroup.name = 'SurfaceGroup';
  cityLightsGroup.name = 'CityLightsGroup';
  cloudGroup.name = 'CloudGroup';
  atmosphereGroup.name = 'AtmosphereGroup';
  sunriseGlow.name = 'SunriseGlow';
  surface.name = 'EarthNightSurface';
  cityLights.name = 'EarthCityLights';
  clouds.name = 'EarthLowCloudLayer';
  atmosphere.name = 'EarthAtmosphereRim';
  surface.renderOrder = 2;
  cityLights.renderOrder = 3;
  clouds.renderOrder = 4;
  atmosphere.renderOrder = 5;
  cityLightsGroup.add(cityLights, textureLayers.city);
  surfaceGroup.add(surface, textureLayers.surface, cityLightsGroup);
  cloudGroup.add(clouds, textureLayers.clouds);
  atmosphereGroup.add(atmosphere);
  if (rotationDebug.guide) surfaceGroup.add(rotationDebug.guide);
  group.add(surfaceGroup, cloudGroup, atmosphereGroup, sunriseGlow);
  setLayerMode(seamDebug.enabled ? seamDebug.mode : layerModeOverride || 'combined');
  unsubscribeTextureLoader = textureLoader.subscribe(({ status, textures }) => {
    textureStatus = status;
    textureLayers.setTextures(status === 'ready' ? textures : null);
    applyHybridMode();
  });
  void textureLoader.loadEarthTextures();
  if (seamDebug.enabled) {
    window.__ACTIVE_THEORY_EARTH_SEAM_TEST__ = {
      step: (delta = 0.1) => update(delta, visualTime + delta, true),
      setLayerMode,
      getState: () => ({ surfaceAngle, cloudAngle, visualTime })
    };
  }

  function update(delta, time, active = true) {
    const now = performance.now();
    const requestedDelta = cityOnlyDebug && delta <= 0
      ? (now - debugWallTime) / 1000
      : delta;
    const safeDelta = active ? Math.min(Math.max(requestedDelta, 0), 0.1) : 0;
    const debugRotationActive = seamDebug.enabled || cityOnlyDebug || hybridDebug.enabled;
    const surfaceAngularSpeed = debugRotationActive
      ? Math.PI * 2 / 12
      : EARTH_SURFACE_ANGULAR_SPEED;
    const cloudAngularSpeed = debugRotationActive
      ? Math.PI * 2 / 12 * EARTH_CLOUD_SPEED_MULTIPLIER
      : EARTH_CLOUD_ANGULAR_SPEED;

    debugWallTime = now;
    visualTime += safeDelta;
    sharedTime.value = visualTime;
    surfaceAngle = wrapAngle(surfaceAngle - safeDelta * surfaceAngularSpeed);
    cloudAngle = wrapAngle(cloudAngle - safeDelta * cloudAngularSpeed);
    surfaceGroup.rotation.y = surfaceAngle;
    cloudGroup.rotation.y = cloudAngle;
    inverseSurfaceRotation.setFromAxisAngle(EARTH_Y_AXIS, -surfaceAngle);
    surfaceMaterial.uniforms.uSunDirectionObject.value
      .copy(EARTH_SUN_DIRECTION)
      .applyQuaternion(inverseSurfaceRotation);
    cityLightsMaterial.uniforms.uSunDirectionObject.value
      .copy(EARTH_SUN_DIRECTION)
      .applyQuaternion(inverseSurfaceRotation);
    textureLayers.setSunDirection(
      surfaceMaterial.uniforms.uSunDirectionObject.value
    );
    group.userData.earthRotation = {
      surfaceAngle,
      cloudAngle,
      surfacePeriod: EARTH_SURFACE_PERIOD,
      cloudPeriod: EARTH_SURFACE_PERIOD / EARTH_CLOUD_SPEED_MULTIPLIER,
      active
    };
    rotationDebug.update({ surfaceAngle, cloudAngle, active });
    seamDebug.update({ group, surfaceAngle, cloudAngle, active });
    hybridDebug.update({
      group,
      mode: hybridDebug.mode,
      status: textureStatus,
      qualityApproved: EARTH_TEXTURE_V2_QUALITY.combinedApproved,
      surfaceAngle,
      cloudAngle
    });
    if (seamDebug.enabled) setLayerMode(seamDebug.mode);
  }

  function dispose() {
    surfaceGeometry.dispose();
    cityLightsGeometry.dispose();
    cloudGeometry.dispose();
    atmosphereGeometry.dispose();
    surfaceMaterial.dispose();
    cityLightsMaterial.dispose();
    cloudMaterial.dispose();
    atmosphereMaterial.dispose();
    unsubscribeTextureLoader?.();
    textureLayers.dispose();
    textureLoader.dispose();
    rotationDebug.dispose();
    seamDebug.dispose();
    hybridDebug.dispose();
    delete window.__ACTIVE_THEORY_EARTH_SEAM_TEST__;
    group.clear();
  }

  function setLayerMode(mode = 'combined') {
    if (hybridDebug.enabled || textureLayers.isReady()) {
      applyHybridMode();
      return;
    }

    applyProceduralLayerMode(mode);
    textureLayers.setVisibility({ surface: false, city: false, clouds: false });
  }

  function applyProceduralLayerMode(mode = 'combined') {
    const requestedMode = layerModeOverride || mode;
    const normalizedMode = Object.hasOwn(EARTH_LAYER_MODES, requestedMode)
      ? requestedMode
      : 'combined';
    const layerValue = EARTH_LAYER_MODES[normalizedMode];

    surfaceMaterial.uniforms.uLayerMode.value = layerValue;
    cityLightsMaterial.uniforms.uLayerMode.value = layerValue;
    cloudMaterial.uniforms.uLayerMode.value = layerValue;
    atmosphereMaterial.uniforms.uLayerMode.value = layerValue;
    surface.visible = true;
    cityLights.visible = normalizedMode === 'cityOnly' || normalizedMode === 'combined';
    clouds.visible = normalizedMode === 'cloudOnly' || normalizedMode === 'combined';
    atmosphere.visible = normalizedMode === 'atmosphereOnly' || normalizedMode === 'combined';
  }

  function applyHybridMode() {
    const mode = hybridDebug.enabled ? hybridDebug.mode : 'combined';
    const textureReady = textureLayers.isReady();
    const approved = EARTH_TEXTURE_V2_QUALITY.combinedApproved;
    const showFallback = mode === 'proceduralOnly'
      || (mode === 'combined' && (!textureReady || !approved));

    if (showFallback) {
      applyProceduralLayerMode('combined');
      textureLayers.setVisibility({ surface: false, city: false, clouds: false });
      return;
    }

    surface.visible = false;
    cityLights.visible = false;
    clouds.visible = false;
    atmosphere.visible = mode === 'combined';
    textureLayers.setWeights({ surface: 0.96, city: 0.84, clouds: 0.24 });
    textureLayers.setSurfaceMode(
      mode === 'cityTextureOnly' || mode === 'cloudTextureOnly'
        ? 'reference'
        : 'surface'
    );

    if (mode === 'surfaceTextureOnly') {
      textureLayers.setVisibility({ surface: textureReady, city: false, clouds: false });
    } else if (mode === 'cityTextureOnly') {
      textureLayers.setVisibility({ surface: textureReady, city: textureReady, clouds: false });
    } else if (mode === 'cloudTextureOnly') {
      textureLayers.setVisibility({ surface: textureReady, city: false, clouds: textureReady });
    } else if (mode === 'combined' && approved) {
      textureLayers.setVisibility({ surface: textureReady, city: textureReady, clouds: textureReady });
    }
  }

  return {
    group,
    surfaceGroup,
    cityLightsGroup,
    cloudGroup,
    atmosphereGroup,
    sunriseGlow,
    update,
    setLayerMode,
    applyHybridMode,
    getTextureStatus: () => textureStatus,
    dispose
  };
}

function createSurfaceMaterial(sharedTime, debugSeam = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime,
      uLayerMode: { value: EARTH_LAYER_MODES.combined },
      uDebugSeam: { value: debugSeam ? 1 : 0 },
      uSunDirectionObject: { value: EARTH_SUN_DIRECTION.clone() }
    },
    vertexShader: `
      varying vec3 vPositionObject;
      varying vec3 vNormalView;
      varying vec3 vNormalObject;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vPositionObject = position;
        vNormalView = normalize(normalMatrix * normal);
        vNormalObject = normalize(normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLayerMode;
      uniform float uDebugSeam;
      uniform vec3 uSunDirectionObject;
      varying vec3 vPositionObject;
      varying vec3 vNormalView;
      varying vec3 vNormalObject;
      varying vec3 vViewDirection;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;

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
          p = p * 2.03 + vec3(3.7, 7.1, 5.3);
          amplitude *= 0.49;
        }
        return value;
      }

      vec3 sphereDirection(vec2 uv) {
        float longitude = uv.x * TAU;
        float latitude = (0.5 - uv.y) * PI;
        float latitudeRadius = cos(latitude);
        return normalize(vec3(
          -cos(longitude) * latitudeRadius,
          sin(latitude),
          sin(longitude) * latitudeRadius
        ));
      }

      void tangentFrame(vec3 center, out vec3 east, out vec3 north) {
        east = normalize(vec3(center.z, 0.0, -center.x));
        north = normalize(cross(center, east));
      }

      vec2 tangentUv(vec3 point, vec3 center) {
        vec3 east;
        vec3 north;
        tangentFrame(center, east, north);
        return vec2(dot(point, east) / TAU, -dot(point, north) / PI);
      }

      float sphericalArea(vec3 point, vec2 centerUv, vec2 radius, float strength) {
        vec3 center = sphereDirection(centerUv);
        vec2 delta = tangentUv(point, center) / radius;
        float localHemisphere = smoothstep(0.08, 0.4, dot(point, center));
        return exp(-dot(delta, delta) * 2.35) * strength * localHemisphere;
      }

      float networkSegment2d(vec2 uv, vec2 start, vec2 end, float width, float bend) {
        vec2 segment = end - start;
        vec2 point = uv - start;
        float projection = clamp(
          dot(point, segment) / max(dot(segment, segment), 0.0001),
          0.0,
          1.0
        );
        vec2 normal = normalize(vec2(-segment.y, segment.x));
        vec2 curvedPoint = start + segment * projection
          + normal * bend * sin(projection * 3.14159265);
        float distanceToSegment = length(uv - curvedPoint);
        float endpointFade = smoothstep(0.0, 0.12, projection)
          * (1.0 - smoothstep(0.88, 1.0, projection));
        return (1.0 - smoothstep(width, width * 2.8, distanceToSegment))
          * (0.35 + endpointFade * 0.65);
      }

      float sphericalNetworkSegment(
        vec3 point,
        vec2 startUv,
        vec2 endUv,
        float width,
        float bend
      ) {
        vec3 startDirection = sphereDirection(startUv);
        vec3 endDirection = sphereDirection(endUv);
        vec3 center = normalize(startDirection + endDirection);
        vec2 pointUv = tangentUv(point, center);
        vec2 start = tangentUv(startDirection, center);
        vec2 end = tangentUv(endDirection, center);
        float localHemisphere = smoothstep(0.18, 0.52, dot(point, center));
        return networkSegment2d(pointUv, start, end, width, bend) * localHemisphere;
      }

      void main() {
        vec3 spherePosition = normalize(vPositionObject);
        vec3 continentalWarp = vec3(
          fbm3(spherePosition * vec3(2.8, 1.9, 2.45) + vec3(2.1, 4.7, 1.3)),
          fbm3(spherePosition * vec3(3.2, 2.1, 2.75) + vec3(11.4, 1.9, 6.8)),
          fbm3(spherePosition * vec3(2.55, 2.35, 3.05) + vec3(4.6, 8.2, 13.7))
        ) - 0.5;
        vec3 continentPosition = normalize(spherePosition + continentalWarp * 0.024);
        float continentalLow = fbm3(
          continentPosition * vec3(3.4, 2.15, 3.05) + vec3(2.1, 4.7, 7.8)
        );
        float coastalBreakup = fbm3(
          continentPosition * vec3(13.5, 7.4, 11.8)
            - continentalWarp * 0.38
            + vec3(8.4, 3.2, 12.7)
        );
        float continentalMass = 0.0;
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.58, 0.74), vec2(0.095, 0.065), 1.0));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.68, 0.73), vec2(0.085, 0.06), 0.94));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.735, 0.815), vec2(0.075, 0.055), 0.86));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.59, 0.85), vec2(0.07, 0.045), 0.82));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.79, 0.74), vec2(0.065, 0.055), 0.76));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.45, 0.79), vec2(0.09, 0.06), 0.8));
        float coastalCuts = 0.0;
        coastalCuts = max(coastalCuts, sphericalArea(continentPosition, vec2(0.63, 0.745), vec2(0.03, 0.04), 0.86));
        coastalCuts = max(coastalCuts, sphericalArea(continentPosition, vec2(0.71, 0.77), vec2(0.03, 0.04), 0.74));
        coastalCuts = max(coastalCuts, sphericalArea(continentPosition, vec2(0.66, 0.84), vec2(0.032, 0.03), 0.7));
        coastalCuts = max(coastalCuts, sphericalArea(continentPosition, vec2(0.52, 0.8), vec2(0.034, 0.034), 0.66));
        float coastalErosion = smoothstep(
          0.5,
          0.74,
          fbm3(
            continentPosition * vec3(19.0, 10.5, 16.8)
              + continentalWarp * 0.85
              + vec3(27.6, 11.8, 5.4)
          )
        );
        float exposedCoast = 1.0 - smoothstep(0.58, 0.9, continentalMass);
        float landSignal = continentalMass
          * (
            0.74
            + (continentalLow - 0.5) * 0.3
            + (coastalBreakup - 0.5) * 0.48
          )
          - coastalCuts * 0.42
          - coastalErosion * exposedCoast * 0.16;
        float land = smoothstep(0.36, 0.56, landSignal);
        float terrain = fbm3(spherePosition * vec3(21.0, 12.0, 18.0) + vec3(8.4, 2.7, 15.2));
        float sunFacing = dot(normalize(vNormalObject), normalize(uSunDirectionObject));
        float nightMask = 1.0 - smoothstep(0.38, 0.68, sunFacing);
        float viewFacing = clamp(
          dot(normalize(vNormalView), normalize(vViewDirection)),
          0.0,
          1.0
        );
        float facing = viewFacing;
        float horizon = pow(1.0 - facing, 3.0);
        float oceanCurrent = fbm3(
          spherePosition * vec3(13.0, 6.0, 11.0)
            + vec3(uTime * 0.00008, 18.1, 4.7)
        );
        float oceanBasin = fbm3(
          spherePosition * vec3(4.2, 2.35, 3.8)
            + continentalWarp * 0.42
            + vec3(5.8, 2.6, 9.3)
        );
        float oceanDetail = fbm3(
          spherePosition * vec3(27.0, 13.5, 24.0) + vec3(3.4, 29.1, 11.6)
        );
        vec3 ocean = mix(
          vec3(0.005, 0.014, 0.03),
          vec3(0.018, 0.041, 0.069),
          oceanCurrent * 0.46 + oceanBasin * 0.28 + terrain * 0.08
        );
        ocean *= 0.84 + oceanDetail * 0.26;
        vec3 landColor = mix(
          vec3(0.026, 0.043, 0.052),
          vec3(0.058, 0.076, 0.081),
          terrain * 0.6 + coastalBreakup * 0.16
        );
        float landTexture = fbm3(
          spherePosition * vec3(34.0, 18.0, 30.0)
            + continentalWarp * 0.8
            + vec3(31.7, 9.8, 16.4)
        );
        float terrainMicro = fbm3(
          spherePosition * vec3(56.0, 29.0, 49.0)
            - continentalWarp * 0.55
            + vec3(44.2, 13.5, 6.9)
        );
        landColor *= 0.735 + landTexture * 0.61;
        landColor *= 0.965 + terrainMicro * 0.07;
        vec3 color = mix(ocean, landColor, land);
        float landRelief = (terrain - 0.5) * land;
        color += vec3(0.012, 0.016, 0.02) * landRelief;
        float coastVariation = smoothstep(0.08, 0.52, land)
          * (1.0 - smoothstep(0.58, 0.94, land))
          * (coastalBreakup - 0.42);
        color += vec3(0.005, 0.008, 0.009) * coastVariation;
        color *= 0.72 + nightMask * 0.28;
        color += vec3(0.02, 0.07, 0.13) * horizon * 0.022;

        if (uLayerMode < 0.5) {
          color = ocean * (0.9 + oceanCurrent * 0.1);
        } else if (uLayerMode < 1.5) {
          vec3 diagnosticOcean = vec3(0.006, 0.014, 0.029);
          color = mix(diagnosticOcean, landColor * 1.5, land);
        } else if (uLayerMode < 2.5) {
          color = mix(vec3(0.004, 0.009, 0.019), vec3(0.012, 0.026, 0.046), land * 0.42);
        } else if (uLayerMode < 4.5) {
          color = vec3(0.004, 0.011, 0.025);
        }
        if (uDebugSeam > 0.5) {
          float seamMarker = (1.0 - smoothstep(0.002, 0.014, abs(spherePosition.z)))
            * (1.0 - smoothstep(-0.92, -0.18, spherePosition.x));
          color = mix(color, vec3(1.0, 0.08, 0.48), seamMarker * 0.9);
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthWrite: true,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: true
  });
}

function createCityLightsMaterial(sharedTime) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime,
      uLayerMode: { value: EARTH_LAYER_MODES.combined },
      uSunDirectionObject: { value: EARTH_SUN_DIRECTION.clone() }
    },
    vertexShader: `
      varying vec3 vPositionObject;
      varying vec3 vNormalView;
      varying vec3 vNormalObject;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vPositionObject = position;
        vNormalView = normalize(normalMatrix * normal);
        vNormalObject = normalize(normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLayerMode;
      uniform vec3 uSunDirectionObject;
      varying vec3 vPositionObject;
      varying vec3 vNormalView;
      varying vec3 vNormalObject;
      varying vec3 vViewDirection;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;

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
          p = p * 2.03 + vec3(3.7, 7.1, 5.3);
          amplitude *= 0.49;
        }
        return value;
      }

      vec3 sphereDirection(vec2 uv) {
        float longitude = uv.x * TAU;
        float latitude = (0.5 - uv.y) * PI;
        float latitudeRadius = cos(latitude);
        return normalize(vec3(
          -cos(longitude) * latitudeRadius,
          sin(latitude),
          sin(longitude) * latitudeRadius
        ));
      }

      void tangentFrame(vec3 center, out vec3 east, out vec3 north) {
        east = normalize(vec3(center.z, 0.0, -center.x));
        north = normalize(cross(center, east));
      }

      vec2 tangentUv(vec3 point, vec3 center) {
        vec3 east;
        vec3 north;
        tangentFrame(center, east, north);
        return vec2(dot(point, east) / TAU, -dot(point, north) / PI);
      }

      float sphericalArea(vec3 point, vec2 centerUv, vec2 radius, float strength) {
        vec3 center = sphereDirection(centerUv);
        vec2 delta = tangentUv(point, center) / radius;
        float localHemisphere = smoothstep(0.08, 0.4, dot(point, center));
        return exp(-dot(delta, delta) * 2.35) * strength * localHemisphere;
      }

      float networkSegment2d(vec2 uv, vec2 start, vec2 end, float width, float bend) {
        vec2 segment = end - start;
        vec2 point = uv - start;
        float projection = clamp(
          dot(point, segment) / max(dot(segment, segment), 0.0001),
          0.0,
          1.0
        );
        vec2 normal = normalize(vec2(-segment.y, segment.x));
        vec2 curvedPoint = start + segment * projection
          + normal * bend * sin(projection * PI);
        float distanceToSegment = length(uv - curvedPoint);
        float endpointFade = smoothstep(0.0, 0.14, projection)
          * (1.0 - smoothstep(0.86, 1.0, projection));
        return (1.0 - smoothstep(width, width * 2.5, distanceToSegment))
          * endpointFade;
      }

      float sphericalNetworkSegment(
        vec3 point,
        vec2 startUv,
        vec2 endUv,
        float width,
        float bend
      ) {
        vec3 startDirection = sphereDirection(startUv);
        vec3 endDirection = sphereDirection(endUv);
        vec3 center = normalize(startDirection + endDirection);
        vec2 pointUv = tangentUv(point, center);
        vec2 start = tangentUv(startDirection, center);
        vec2 end = tangentUv(endDirection, center);
        float localHemisphere = smoothstep(0.18, 0.52, dot(point, center));
        return networkSegment2d(pointUv, start, end, width, bend) * localHemisphere;
      }

      void main() {
        vec3 spherePosition = normalize(vPositionObject);
        vec3 continentalWarp = vec3(
          fbm3(spherePosition * vec3(2.8, 1.9, 2.45) + vec3(2.1, 4.7, 1.3)),
          fbm3(spherePosition * vec3(3.2, 2.1, 2.75) + vec3(11.4, 1.9, 6.8)),
          fbm3(spherePosition * vec3(2.55, 2.35, 3.05) + vec3(4.6, 8.2, 13.7))
        ) - 0.5;
        vec3 continentPosition = normalize(spherePosition + continentalWarp * 0.024);
        float continentalLow = fbm3(
          continentPosition * vec3(3.4, 2.15, 3.05) + vec3(2.1, 4.7, 7.8)
        );
        float coastalBreakup = fbm3(
          continentPosition * vec3(13.5, 7.4, 11.8)
            - continentalWarp * 0.38
            + vec3(8.4, 3.2, 12.7)
        );
        float continentalMass = 0.0;
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.54, 0.25), vec2(0.11, 0.08), 1.0));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.65, 0.27), vec2(0.1, 0.075), 0.94));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.78, 0.26), vec2(0.09, 0.065), 0.86));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.9, 0.23), vec2(0.08, 0.06), 0.82));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.28, 0.3), vec2(0.11, 0.075), 0.8));
        continentalMass = max(continentalMass, sphericalArea(continentPosition, vec2(0.42, 0.24), vec2(0.095, 0.07), 0.84));
        float coastalCuts = 0.0;
        coastalCuts = max(coastalCuts, sphericalArea(continentPosition, vec2(0.585, 0.255), vec2(0.028, 0.032), 0.7));
        coastalCuts = max(coastalCuts, sphericalArea(continentPosition, vec2(0.72, 0.285), vec2(0.03, 0.035), 0.66));
        coastalCuts = max(coastalCuts, sphericalArea(continentPosition, vec2(0.34, 0.275), vec2(0.032, 0.032), 0.62));
        coastalCuts = max(coastalCuts, sphericalArea(continentPosition, vec2(0.86, 0.245), vec2(0.028, 0.03), 0.58));
        float coastalErosion = smoothstep(
          0.5,
          0.74,
          fbm3(
            continentPosition * vec3(19.0, 10.5, 16.8)
              + continentalWarp * 0.85
              + vec3(27.6, 11.8, 5.4)
          )
        );
        float exposedCoast = 1.0 - smoothstep(0.58, 0.9, continentalMass);
        float landSignal = continentalMass
          * (
            0.74
            + (continentalLow - 0.5) * 0.3
            + (coastalBreakup - 0.5) * 0.48
          )
          - coastalCuts * 0.42
          - coastalErosion * exposedCoast * 0.16;
        float land = smoothstep(0.36, 0.56, landSignal);
        float landMask = smoothstep(0.18, 0.55, land);

        float cluster0 = sphericalArea(spherePosition, vec2(0.535, 0.195), vec2(0.025, 0.021), 0.6);
        float cluster1 = sphericalArea(spherePosition, vec2(0.645, 0.225), vec2(0.029, 0.023), 0.78);
        float cluster2 = sphericalArea(spherePosition, vec2(0.575, 0.275), vec2(0.034, 0.027), 1.0);
        float cluster3 = sphericalArea(spherePosition, vec2(0.595, 0.345), vec2(0.026, 0.022), 0.64);
        float cluster4 = sphericalArea(spherePosition, vec2(0.77, 0.285), vec2(0.029, 0.023), 0.72);
        float cluster5 = sphericalArea(spherePosition, vec2(0.9, 0.205), vec2(0.025, 0.019), 0.52);
        float cluster6 = sphericalArea(spherePosition, vec2(0.2, 0.325), vec2(0.024, 0.021), 0.48);
        float cluster7 = sphericalArea(spherePosition, vec2(0.35, 0.235), vec2(0.025, 0.021), 0.46);
        float metroCluster = max(
          max(max(cluster0, cluster1), max(cluster2, cluster3)),
          max(max(cluster4, cluster5), max(cluster6, cluster7))
        );
        landMask = max(landMask, smoothstep(0.12, 0.5, metroCluster));
        float settlementBreakup = fbm3(
          spherePosition * vec3(28.0, 15.0, 24.0) + vec3(13.4, 2.9, 18.7)
        );
        float settlementVoids = smoothstep(
          0.62,
          0.82,
          fbm3(spherePosition * vec3(17.0, 11.0, 15.0) + vec3(31.7, 6.4, 12.8))
        );
        float cityDensity = metroCluster
          * mix(0.42, 1.0, smoothstep(0.29, 0.7, settlementBreakup))
          * (1.0 - settlementVoids * 0.5);

        float citySeed = noise3(
          spherePosition * vec3(178.0, 108.0, 171.0) + vec3(17.3, 4.1, 29.6)
        );
        float cityDetail = noise3(
          spherePosition * vec3(336.0, 212.0, 326.0) + vec3(41.2, 3.8, 19.4)
        );
        float cityVariance = noise3(
          spherePosition * vec3(229.0, 143.0, 221.0) + vec3(19.4, 7.8, 33.1)
        );
        float satelliteDots = smoothstep(0.64, 0.84, citySeed)
          * smoothstep(0.38, 0.72, cityDetail);
        float smallDots = smoothstep(0.7, 0.9, citySeed)
          * smoothstep(0.52, 0.8, cityDetail);
        float citySparkle = max(
          smoothstep(0.6, 0.82, cityDetail),
          smoothstep(0.68, 0.88, citySeed)
        );
        float primaryCore = max(
          smoothstep(0.96, 0.995, cluster2),
          smoothstep(0.62, 0.9, cluster2) * citySparkle * 0.58
        );
        float secondaryPin = max(
          max(smoothstep(0.57, 0.599, cluster0), smoothstep(0.75, 0.778, cluster1)),
          max(smoothstep(0.61, 0.638, cluster3), smoothstep(0.69, 0.718, cluster4))
        );
        float secondaryHalo = max(
          max(smoothstep(0.31, 0.54, cluster0), smoothstep(0.44, 0.69, cluster1)),
          max(smoothstep(0.36, 0.58, cluster3), smoothstep(0.41, 0.64, cluster4))
        ) * citySparkle * 0.42;
        float secondaryCore = max(secondaryPin, secondaryHalo);

        float viewFacing = clamp(
          dot(normalize(vNormalView), normalize(vViewDirection)),
          0.0,
          1.0
        );
        float frontFacingMask = smoothstep(0.04, 0.3, viewFacing);
        float sunFacing = dot(normalize(vNormalObject), normalize(uSunDirectionObject));
        float nightMask = 1.0 - smoothstep(0.28, 0.62, sunFacing);
        float visibilityMask = landMask * nightMask * frontFacingMask;

        float pointOpacity = satelliteDots * cityDensity
          * mix(0.18, 0.52, smoothstep(0.08, 0.82, metroCluster));
        pointOpacity = max(pointOpacity, smallDots * cityDensity * 0.34);
        float coreOpacity = max(primaryCore * 0.88, secondaryCore * 0.52);
        float pulse = 0.97 + sin(uTime * 0.42 + cityVariance * 13.0) * 0.03;

        float transportNetwork = 0.0;
        transportNetwork = max(transportNetwork, sphericalNetworkSegment(spherePosition, vec2(0.558, 0.264), vec2(0.582, 0.28), 0.00018, 0.0032));
        transportNetwork = max(transportNetwork, sphericalNetworkSegment(spherePosition, vec2(0.574, 0.278), vec2(0.596, 0.294), 0.00016, -0.0028));
        transportNetwork = max(transportNetwork, sphericalNetworkSegment(spherePosition, vec2(0.626, 0.216), vec2(0.65, 0.228), 0.00016, 0.0026));
        transportNetwork = max(transportNetwork, sphericalNetworkSegment(spherePosition, vec2(0.58, 0.332), vec2(0.603, 0.346), 0.00015, -0.0024));
        transportNetwork = max(transportNetwork, sphericalNetworkSegment(spherePosition, vec2(0.752, 0.274), vec2(0.774, 0.288), 0.00015, 0.0022));
        float networkBreakup = smoothstep(
          0.58,
          0.82,
          fbm3(spherePosition * vec3(46.0, 27.0, 41.0) + vec3(7.3, 18.4, 3.6))
        );
        float networkOpacity = transportNetwork * networkBreakup
          * smoothstep(0.08, 0.46, cityDensity)
          * 0.13;

        float warmWhite = smoothstep(0.972, 0.998, cityVariance);
        vec3 cityColor = mix(
          vec3(1.0, 0.52, 0.16),
          vec3(1.0, 0.78, 0.48),
          warmWhite
        );
        float opacity = (max(pointOpacity, coreOpacity) + networkOpacity)
          * visibilityMask
          * pulse;
        if (uLayerMode > 1.5 && uLayerMode < 2.5) opacity *= 1.12;
        opacity = clamp(opacity, 0.0, 0.95);
        if (opacity < 0.012) discard;
        gl_FragColor = vec4(cityColor, opacity);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: false
  });
}

function createCloudMaterial(sharedTime, debugSeam = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime,
      uLayerMode: { value: EARTH_LAYER_MODES.combined },
      uDebugSeam: { value: debugSeam ? 1 : 0 }
    },
    vertexShader: `
      varying vec3 vPositionObject;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vPositionObject = position;
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLayerMode;
      uniform float uDebugSeam;
      varying vec3 vPositionObject;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;

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
        for (int i = 0; i < 4; i++) {
          value += noise3(p) * amplitude;
          p = p * 2.08 + vec3(4.3, 1.7, 6.1);
          amplitude *= 0.48;
        }
        return value;
      }

      vec3 sphereDirection(vec2 uv) {
        float longitude = uv.x * TAU;
        float latitude = (0.5 - uv.y) * PI;
        float latitudeRadius = cos(latitude);
        return normalize(vec3(
          -cos(longitude) * latitudeRadius,
          sin(latitude),
          sin(longitude) * latitudeRadius
        ));
      }

      float sphericalArea(vec3 point, vec2 centerUv, vec2 radius) {
        vec3 center = sphereDirection(centerUv);
        vec3 east = normalize(vec3(center.z, 0.0, -center.x));
        vec3 north = normalize(cross(center, east));
        vec2 delta = vec2(
          dot(point, east) / TAU,
          -dot(point, north) / PI
        ) / radius;
        float localHemisphere = smoothstep(0.08, 0.4, dot(point, center));
        return exp(-dot(delta, delta) * 2.35) * localHemisphere;
      }

      void main() {
        vec3 spherePosition = normalize(vPositionObject);
        float shaderDrift = uTime * 0.00028 * TAU;
        float driftCos = cos(shaderDrift);
        float driftSin = sin(shaderDrift);
        vec3 driftPosition = normalize(vec3(
          spherePosition.x * driftCos - spherePosition.z * driftSin,
          spherePosition.y,
          spherePosition.x * driftSin + spherePosition.z * driftCos
        ));
        vec3 warp = vec3(
          fbm3(driftPosition * vec3(3.4, 2.1, 3.0) + vec3(8.2, 3.1, 6.4)),
          fbm3(driftPosition * vec3(3.8, 2.4, 3.25) + vec3(17.6, 9.3, 2.8)),
          fbm3(driftPosition * vec3(3.1, 2.65, 3.7) + vec3(4.2, 12.7, 18.5))
        ) - 0.5;
        float cloudLow = fbm3(
          driftPosition * vec3(8.2, 4.4, 7.4)
            + warp * 0.78
            + vec3(8.2, 3.1, 11.7)
        );
        float cloudDetail = fbm3(
          driftPosition * vec3(18.0, 9.5, 16.0)
            - warp * 0.34
            + vec3(2.7, 8.6, 14.1)
        );
        float cloudField = cloudLow * 0.76 + cloudDetail * 0.24;
        float cloud = smoothstep(0.49, 0.68, cloudField);
        float bandShape = fbm3(
          driftPosition * vec3(4.4, 2.2, 3.9)
            + warp * 0.42
            + vec3(21.3, 7.4, 13.2)
        );
        float bandBreak = smoothstep(0.28, 0.66, bandShape);
        float clearPocket = smoothstep(
          0.58,
          0.76,
          fbm3(driftPosition * vec3(6.2, 3.1, 5.5) + vec3(47.8, 19.4, 8.2))
        );
        float polar = acos(clamp(driftPosition.y, -1.0, 1.0)) / PI;
        float foldedBand = 0.5 + 0.5 * sin(
          polar * 34.0 + warp.x * 8.0 + warp.y * 4.0 + warp.z * 2.5
        );
        float latitudeBand = smoothstep(0.28, 0.76, foldedBand);
        cloud *= bandBreak * mix(0.22, 1.0, latitudeBand) * (1.0 - clearPocket * 0.62);
        float thinWisp = smoothstep(0.43, 0.6, cloudLow)
          * mix(0.32, 1.0, latitudeBand)
          * (1.0 - clearPocket * 0.36);
        float secondaryBand = 0.5 + 0.5 * sin(
          polar * 22.0 - warp.x * 6.5 + warp.y * 5.2 - warp.z * 2.1 + 2.4
        );
        float brokenSecondary = smoothstep(0.42, 0.61, cloudLow)
          * smoothstep(0.4, 0.7, secondaryBand)
          * smoothstep(0.31, 0.65, bandShape)
          * (1.0 - clearPocket * 0.5);
        cloud = max(cloud, thinWisp * 0.68);
        cloud = max(cloud, brokenSecondary * 0.74);
        float cityClear = 0.0;
        cityClear = max(cityClear, sphericalArea(driftPosition, vec2(0.565, 0.72), vec2(0.058, 0.048)));
        cityClear = max(cityClear, sphericalArea(driftPosition, vec2(0.6, 0.765), vec2(0.062, 0.05)));
        cityClear = max(cityClear, sphericalArea(driftPosition, vec2(0.655, 0.71), vec2(0.066, 0.052)));
        cityClear = max(cityClear, sphericalArea(driftPosition, vec2(0.69, 0.75), vec2(0.06, 0.049)));
        cityClear = max(cityClear, sphericalArea(driftPosition, vec2(0.735, 0.815), vec2(0.062, 0.05)));
        cityClear = max(cityClear, sphericalArea(driftPosition, vec2(0.59, 0.85), vec2(0.058, 0.045)));
        cityClear = max(cityClear, sphericalArea(driftPosition, vec2(0.775, 0.745), vec2(0.056, 0.047)));
        cityClear = max(cityClear, sphericalArea(driftPosition, vec2(0.455, 0.79), vec2(0.058, 0.048)));
        cloud *= 1.0 - smoothstep(0.12, 0.62, cityClear) * 0.42;
        float facing = clamp(
          dot(normalize(vNormalView), normalize(vViewDirection)),
          0.0,
          1.0
        );
        float limbFade = smoothstep(0.02, 0.42, facing);
        float diagnosticBand = smoothstep(0.42, 0.61, cloudField)
          * mix(0.25, 1.0, latitudeBand)
          * limbFade;
        cloud = max(cloud, diagnosticBand * 0.34);
        vec3 cloudColor = mix(vec3(0.078, 0.094, 0.116), vec3(0.285, 0.305, 0.325), cloud);
        float cloudAlpha = cloud * limbFade * 0.198;
        if (uLayerMode > 2.5 && uLayerMode < 3.5) {
          float diagnosticCloud = smoothstep(0.3, 0.53, cloudField)
            * mix(0.38, 1.0, latitudeBand)
            * (1.0 - clearPocket * 0.48);
          diagnosticCloud = max(diagnosticCloud, max(cloud, brokenSecondary * 0.72));
          cloudColor = mix(
            vec3(0.06, 0.09, 0.13),
            vec3(0.46, 0.54, 0.62),
            diagnosticCloud
          );
          float diagnosticLimbFade = smoothstep(0.025, 0.16, facing);
          cloudAlpha = diagnosticCloud * diagnosticLimbFade * 0.5;
        }
        if (uDebugSeam > 0.5) {
          float seamMarker = (1.0 - smoothstep(0.002, 0.014, abs(spherePosition.z)))
            * (1.0 - smoothstep(-0.92, -0.18, spherePosition.x));
          cloudColor = mix(cloudColor, vec3(0.08, 0.92, 1.0), seamMarker * 0.92);
          cloudAlpha = max(cloudAlpha, seamMarker * 0.72);
        }
        if (cloudAlpha < 0.007) discard;
        gl_FragColor = vec4(cloudColor, min(cloudAlpha, 0.42));
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: true
  });
}

function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLayerMode: { value: EARTH_LAYER_MODES.combined }
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uLayerMode;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        float facing = clamp(
          dot(normalize(vNormalView), normalize(vViewDirection)),
          0.0,
          1.0
        );
        float limb = 1.0 - facing;
        float rim = pow(limb, 96.0);
        float softRim = pow(limb, 52.0);
        vec3 sunriseDirection = normalize(vec3(0.76, 0.58, 0.12));
        float sunrise = pow(max(dot(vNormalView, sunriseDirection), 0.0), 56.0)
          * pow(limb, 5.0);
        vec3 color = mix(vec3(0.06, 0.22, 0.46), vec3(0.48, 0.78, 1.0), rim);
        color += vec3(0.76, 0.91, 1.0) * sunrise * 0.58;
        float alpha = rim * 0.0365 + softRim * 0.0051 + sunrise * 0.105;
        if (uLayerMode > 3.5 && uLayerMode < 4.5) {
          color = mix(vec3(0.12, 0.38, 0.72), vec3(0.58, 0.84, 1.0), rim);
          color += vec3(0.78, 0.92, 1.0) * sunrise * 0.72;
          alpha = rim * 0.34 + softRim * 0.035 + sunrise * 0.28;
        }
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: false
  });
}

function readEarthLayerModeOverride() {
  if (!import.meta.env.DEV) return null;

  const params = new URLSearchParams(window.location.search);
  const debugLayers = params.get('debugEarthLayers');
  const requestedMode = params.get('earthLayerMode');

  if (!debugLayers || !requestedMode) return null;
  return Object.hasOwn(EARTH_LAYER_MODES, requestedMode) ? requestedMode : null;
}

function readCityOnlyDebugState() {
  if (!import.meta.env.DEV) return false;

  const params = new URLSearchParams(window.location.search);
  const debugValue = params.get('debugEarthLayers');
  const debugEnabled = debugValue !== null
    && debugValue !== '0'
    && debugValue !== 'false';
  const requestedMode = params.get('earthLayerMode')
    || params.get('earthLayer')
    || debugValue;

  return debugEnabled && requestedMode === 'cityOnly';
}

function createEarthHybridDebug() {
  const params = new URLSearchParams(window.location.search);
  const directValue = params.get('debugEarthHybrid');
  const enabled = import.meta.env.DEV
    && directValue !== null
    && directValue !== '0'
    && directValue !== 'false';
  const requestedMode = params.get('earthHybridMode')
    || params.get('debugEarthHybridMode')
    || directValue;
  const mode = EARTH_HYBRID_MODES.has(requestedMode) ? requestedMode : 'combined';

  if (!enabled) {
    return { enabled: false, mode: 'combined', update() {}, dispose() {} };
  }

  const panel = document.createElement('pre');
  const hiddenSiblings = [];
  const hiddenOverlays = [];
  let isolated = false;
  let scene = null;
  let previousBackground = null;

  panel.className = 'earth-hybrid-debug';
  Object.assign(panel.style, {
    position: 'fixed',
    right: '18px',
    top: '18px',
    zIndex: '9999',
    margin: '0',
    padding: '10px 12px',
    color: '#9eeaff',
    background: 'rgba(2, 10, 32, 0.84)',
    border: '1px solid rgba(110, 220, 255, 0.38)',
    font: '12px/1.55 monospace',
    pointerEvents: 'none'
  });
  document.body.append(panel);

  function isolateScene(group) {
    if (isolated || !group.parent) return;

    isolated = true;
    group.parent.children.forEach((object) => {
      if (object === group) return;
      hiddenSiblings.push({ object, visible: object.visible });
      object.visible = false;
    });
    document.querySelectorAll('.hero-copy, .hero-scroll-hint').forEach((element) => {
      hiddenOverlays.push({ element, display: element.style.display });
      element.style.display = 'none';
    });
    scene = group;
    while (scene.parent) scene = scene.parent;
    if (scene.isScene) {
      previousBackground = scene.background;
      scene.background = new THREE.Color(0x020814);
    }
  }

  function update({ group, status, qualityApproved, surfaceAngle, cloudAngle }) {
    isolateScene(group);
    const cycle = (((-surfaceAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
      / (Math.PI * 2);
    panel.textContent = [
      'EARTH HYBRID',
      `Mode       ${mode}`,
      `Textures   ${status}`,
      `Combined   ${qualityApproved ? 'texture active' : 'procedural fallback'}`,
      'V2 assets  aligned / normal disabled',
      'Cycle      12 s',
      `Surface    ${(cycle * 360).toFixed(1)} deg`,
      `Cloud      ${THREE.MathUtils.radToDeg(-cloudAngle).toFixed(1)} deg`
    ].join('\n');
  }

  function dispose() {
    hiddenSiblings.forEach(({ object, visible }) => {
      object.visible = visible;
    });
    hiddenOverlays.forEach(({ element, display }) => {
      element.style.display = display;
    });
    if (scene?.isScene) scene.background = previousBackground;
    panel.remove();
  }

  return { enabled, mode, update, dispose };
}

function createEarthSeamDebug() {
  const params = new URLSearchParams(window.location.search);
  const enabled = import.meta.env.DEV && params.get('debugEarthSeam') === '1';
  const supportedModes = new Set(['surfaceOnly', 'landOnly', 'cloudOnly', 'combined']);
  const requestedMode = params.get('earthLayer') || 'combined';
  const mode = supportedModes.has(requestedMode) ? requestedMode : 'combined';
  const surfacePeriod = 12;
  const surfaceAngularSpeed = Math.PI * 2 / surfacePeriod;

  if (!enabled) {
    return {
      enabled: false,
      mode: 'combined',
      surfaceAngularSpeed: EARTH_SURFACE_ANGULAR_SPEED,
      update() {},
      dispose() {}
    };
  }

  const panel = document.createElement('pre');
  const hiddenSiblings = [];
  const hiddenOverlays = [];
  let isolated = false;
  let scene = null;
  let previousBackground = null;

  panel.className = 'earth-seam-debug';
  Object.assign(panel.style, {
    position: 'fixed',
    right: '18px',
    top: '18px',
    zIndex: '9999',
    margin: '0',
    padding: '10px 12px',
    color: '#9eeaff',
    background: 'rgba(2, 10, 32, 0.82)',
    border: '1px solid rgba(110, 220, 255, 0.38)',
    font: '12px/1.55 monospace',
    pointerEvents: 'none'
  });
  document.body.append(panel);

  function isolateScene(group) {
    if (isolated || !group.parent) return;

    isolated = true;
    group.parent.children.forEach((object) => {
      if (object === group) return;
      hiddenSiblings.push({ object, visible: object.visible });
      object.visible = false;
    });
    document.querySelectorAll('.hero-copy, .hero-scroll-hint').forEach((element) => {
      hiddenOverlays.push({ element, display: element.style.display });
      element.style.display = 'none';
    });
    scene = group;
    while (scene.parent) scene = scene.parent;
    if (scene.isScene) {
      previousBackground = scene.background;
      scene.background = new THREE.Color(0x020814);
    }
  }

  function update({ group, surfaceAngle, cloudAngle, active }) {
    isolateScene(group);
    const normalizedAngle = ((-surfaceAngle % (Math.PI * 2)) + Math.PI * 2)
      % (Math.PI * 2);
    const progress = normalizedAngle / (Math.PI * 2);
    const state = {
      mode,
      surfaceAngle,
      cloudAngle,
      surfacePeriod,
      progress,
      active
    };

    window.__ACTIVE_THEORY_EARTH_SEAM__ = state;
    panel.textContent = [
      'EARTH SEAM CHECK',
      `Layer          ${mode}`,
      `Surface cycle  ${surfacePeriod.toFixed(0)} s`,
      `Rotation       ${(progress * 360).toFixed(1)} deg`,
      `Cycle progress ${(progress * 100).toFixed(1)}%`,
      `Update         ${active ? 'running' : 'paused'}`,
      'Magenta/cyan = original UV seam'
    ].join('\n');
  }

  function dispose() {
    hiddenSiblings.forEach(({ object, visible }) => {
      object.visible = visible;
    });
    hiddenOverlays.forEach(({ element, display }) => {
      element.style.display = display;
    });
    if (scene?.isScene) scene.background = previousBackground;
    panel.remove();
    delete window.__ACTIVE_THEORY_EARTH_SEAM__;
  }

  return { enabled, mode, surfaceAngularSpeed, update, dispose };
}

function createEarthRotationDebug() {
  const enabled = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('debugEarthRotation') === '1';

  if (!enabled) {
    return { guide: null, update() {}, dispose() {} };
  }

  const guide = createLatitudeLongitudeGuide();
  const panel = document.createElement('pre');

  panel.className = 'earth-rotation-debug';
  Object.assign(panel.style, {
    position: 'fixed',
    left: '18px',
    bottom: '18px',
    zIndex: '9999',
    margin: '0',
    padding: '10px 12px',
    color: '#9eeaff',
    background: 'rgba(2, 10, 32, 0.78)',
    border: '1px solid rgba(110, 220, 255, 0.35)',
    font: '12px/1.55 monospace',
    pointerEvents: 'none'
  });
  document.body.append(panel);

  function update({ surfaceAngle, cloudAngle, active }) {
    const state = {
      surfaceAngle,
      cloudAngle,
      surfaceDegrees: THREE.MathUtils.radToDeg(surfaceAngle),
      cloudDegrees: THREE.MathUtils.radToDeg(cloudAngle),
      surfacePeriod: EARTH_SURFACE_PERIOD,
      cloudPeriod: EARTH_SURFACE_PERIOD / EARTH_CLOUD_SPEED_MULTIPLIER,
      active
    };

    window.__ACTIVE_THEORY_EARTH_ROTATION__ = state;
    panel.textContent = [
      'EARTH ROTATION',
      `SurfaceGroup  ${state.surfaceDegrees.toFixed(2)} deg`,
      `CloudGroup    ${state.cloudDegrees.toFixed(2)} deg`,
      `Surface cycle ${state.surfacePeriod.toFixed(0)} s`,
      `Cloud cycle   ${state.cloudPeriod.toFixed(1)} s`,
      `Update        ${active ? 'running' : 'paused'}`
    ].join('\n');
  }

  function dispose() {
    guide.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    panel.remove();
    delete window.__ACTIVE_THEORY_EARTH_ROTATION__;
  }

  return { guide, update, dispose };
}

function createLatitudeLongitudeGuide() {
  const guide = new THREE.Group();
  const radius = 1.862;
  const segments = 72;
  const material = new THREE.LineBasicMaterial({
    color: 0x65dfff,
    transparent: true,
    opacity: 0.32,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });

  guide.name = 'EarthRotationLatitudeLongitudeGuide';
  guide.renderOrder = 8;
  for (let longitudeIndex = 0; longitudeIndex < 12; longitudeIndex += 1) {
    const longitude = longitudeIndex / 12 * Math.PI * 2;
    const points = [];

    for (let segment = 0; segment <= segments; segment += 1) {
      const latitude = -Math.PI * 0.5 + segment / segments * Math.PI;
      points.push(new THREE.Vector3(
        radius * Math.cos(latitude) * Math.cos(longitude),
        radius * Math.sin(latitude),
        radius * Math.cos(latitude) * Math.sin(longitude)
      ));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material.clone());
    line.renderOrder = 8;
    guide.add(line);
  }
  for (let latitudeIndex = -3; latitudeIndex <= 3; latitudeIndex += 1) {
    const latitude = latitudeIndex / 8 * Math.PI;
    const ringRadius = radius * Math.cos(latitude);
    const y = radius * Math.sin(latitude);
    const points = [];

    for (let segment = 0; segment < segments; segment += 1) {
      const longitude = segment / segments * Math.PI * 2;
      points.push(new THREE.Vector3(
        ringRadius * Math.cos(longitude),
        y,
        ringRadius * Math.sin(longitude)
      ));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const ring = new THREE.LineLoop(geometry, material.clone());
    ring.renderOrder = 8;
    guide.add(ring);
  }
  material.dispose();
  return guide;
}

function wrapAngle(angle) {
  if (angle < -Math.PI * 2) return angle + Math.PI * 2;
  if (angle > Math.PI * 2) return angle - Math.PI * 2;
  return angle;
}
