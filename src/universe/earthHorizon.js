import * as THREE from 'three';

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

export function createEarthHorizon() {
  const group = new THREE.Group();
  const surfaceGroup = new THREE.Group();
  const cloudGroup = new THREE.Group();
  const atmosphereGroup = new THREE.Group();
  const sunriseGlow = new THREE.Group();
  const surfaceGeometry = new THREE.SphereGeometry(1.85, 64, 40);
  const cloudGeometry = new THREE.SphereGeometry(1.86, 64, 40);
  const atmosphereGeometry = new THREE.SphereGeometry(1.864, 64, 40);
  const sharedTime = { value: 0 };
  const surfaceMaterial = createSurfaceMaterial(sharedTime);
  const cloudMaterial = createCloudMaterial(sharedTime);
  const atmosphereMaterial = createAtmosphereMaterial();
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  const rotationDebug = createEarthRotationDebug();
  const inverseSurfaceRotation = new THREE.Quaternion();
  let surfaceAngle = 0;
  let cloudAngle = 0;
  let visualTime = 0;

  group.name = 'EarthRoot';
  group.position.set(-19.3, -14, -0.35);
  group.scale.setScalar(5.55);
  group.rotation.set(-0.62, -0.5, 0.18);
  surfaceGroup.name = 'SurfaceGroup';
  cloudGroup.name = 'CloudGroup';
  atmosphereGroup.name = 'AtmosphereGroup';
  sunriseGlow.name = 'SunriseGlow';
  surface.name = 'EarthNightSurface';
  clouds.name = 'EarthLowCloudLayer';
  atmosphere.name = 'EarthAtmosphereRim';
  surface.renderOrder = 2;
  clouds.renderOrder = 3;
  atmosphere.renderOrder = 4;
  surfaceGroup.add(surface);
  cloudGroup.add(clouds);
  atmosphereGroup.add(atmosphere);
  if (rotationDebug.guide) surfaceGroup.add(rotationDebug.guide);
  group.add(surfaceGroup, cloudGroup, atmosphereGroup, sunriseGlow);
  setLayerMode('combined');

  function update(delta, time, active = true) {
    const safeDelta = active ? Math.min(Math.max(delta, 0), 0.1) : 0;

    visualTime += safeDelta;
    sharedTime.value = visualTime;
    surfaceAngle = wrapAngle(surfaceAngle - safeDelta * EARTH_SURFACE_ANGULAR_SPEED);
    cloudAngle = wrapAngle(cloudAngle - safeDelta * EARTH_CLOUD_ANGULAR_SPEED);
    surfaceGroup.rotation.y = surfaceAngle;
    cloudGroup.rotation.y = cloudAngle;
    inverseSurfaceRotation.setFromAxisAngle(EARTH_Y_AXIS, -surfaceAngle);
    surfaceMaterial.uniforms.uSunDirectionObject.value
      .copy(EARTH_SUN_DIRECTION)
      .applyQuaternion(inverseSurfaceRotation);
    group.userData.earthRotation = {
      surfaceAngle,
      cloudAngle,
      surfacePeriod: EARTH_SURFACE_PERIOD,
      cloudPeriod: EARTH_SURFACE_PERIOD / EARTH_CLOUD_SPEED_MULTIPLIER,
      active
    };
    rotationDebug.update({ surfaceAngle, cloudAngle, active });
  }

  function dispose() {
    surfaceGeometry.dispose();
    cloudGeometry.dispose();
    atmosphereGeometry.dispose();
    surfaceMaterial.dispose();
    cloudMaterial.dispose();
    atmosphereMaterial.dispose();
    rotationDebug.dispose();
    group.clear();
  }

  function setLayerMode(mode = 'combined') {
    const normalizedMode = Object.hasOwn(EARTH_LAYER_MODES, mode) ? mode : 'combined';
    const layerValue = EARTH_LAYER_MODES[normalizedMode];

    surfaceMaterial.uniforms.uLayerMode.value = layerValue;
    cloudMaterial.uniforms.uLayerMode.value = layerValue;
    atmosphereMaterial.uniforms.uLayerMode.value = layerValue;
    surface.visible = true;
    clouds.visible = normalizedMode === 'cloudOnly' || normalizedMode === 'combined';
    atmosphere.visible = normalizedMode === 'atmosphereOnly' || normalizedMode === 'combined';
  }

  return {
    group,
    surfaceGroup,
    cloudGroup,
    atmosphereGroup,
    sunriseGlow,
    update,
    setLayerMode,
    dispose
  };
}

function createSurfaceMaterial(sharedTime) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedTime,
      uLayerMode: { value: EARTH_LAYER_MODES.combined },
      uSunDirectionObject: { value: EARTH_SUN_DIRECTION.clone() }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vNormalObject;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vUv = uv;
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
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vNormalObject;
      varying vec3 vViewDirection;

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

      float metroArea(vec2 uv, vec2 center, vec2 radius, float strength) {
        vec2 delta = abs(uv - center);
        delta.x = min(delta.x, 1.0 - delta.x);
        delta /= radius;
        return exp(-dot(delta, delta) * 2.35) * strength;
      }

      void main() {
        vec2 wrappedUv = vec2(fract(vUv.x + 0.08), vUv.y);
        vec2 continentalWarp = vec2(
          fbm(wrappedUv * vec2(3.8, 2.5) + vec2(2.1, 4.7)),
          fbm(wrappedUv * vec2(4.2, 2.8) + vec2(11.4, 1.9))
        ) - 0.5;
        float landField = fbm(
          wrappedUv * vec2(7.2, 4.5) + continentalWarp * 0.72 + vec2(2.1, 4.7)
        );
        float coastalBreakup = fbm(wrappedUv * vec2(16.0, 9.0) - continentalWarp * 0.35 + 8.4);
        float continentalMass = 0.0;
        continentalMass += metroArea(wrappedUv, vec2(0.47, 0.41), vec2(0.18, 0.12), 0.72);
        continentalMass += metroArea(wrappedUv, vec2(0.66, 0.59), vec2(0.2, 0.14), 0.64);
        continentalMass += metroArea(wrappedUv, vec2(0.23, 0.55), vec2(0.17, 0.15), 0.58);
        continentalMass += metroArea(wrappedUv, vec2(0.86, 0.5), vec2(0.14, 0.12), 0.48);
        continentalMass += metroArea(wrappedUv, vec2(0.77, 0.73), vec2(0.19, 0.13), 0.54);
        continentalMass += metroArea(wrappedUv, vec2(0.74, 0.84), vec2(0.18, 0.105), 0.5);
        continentalMass += metroArea(wrappedUv, vec2(0.61, 0.71), vec2(0.14, 0.11), 0.78);
        continentalMass += metroArea(wrappedUv, vec2(0.85, 0.79), vec2(0.17, 0.12), 0.62);
        continentalMass += metroArea(wrappedUv, vec2(0.87, 0.87), vec2(0.14, 0.09), 0.48);
        float landSignal = landField * 0.7 + coastalBreakup * 0.21
          + continentalMass * (0.16 + coastalBreakup * 0.085);
        float land = smoothstep(0.41, 0.59, landSignal);
        float terrain = fbm(wrappedUv * vec2(21.0, 12.0) + 8.4);
        vec2 cityGrid = wrappedUv * vec2(166.0, 88.0);
        vec2 cell = floor(cityGrid);
        float citySeed = hash(cell);
        vec2 pointOffset = vec2(
          hash(cell + vec2(17.3, 4.1)),
          hash(cell + vec2(8.7, 29.6))
        ) - 0.5;
        vec2 pointUv = fract(cityGrid) - 0.5 - pointOffset * 0.72;
        float pointRadius = mix(0.09, 0.2, hash(cell + vec2(41.2, 3.8)));
        float cityDot = 1.0 - smoothstep(pointRadius * 0.28, pointRadius, length(pointUv));

        // Eight separated population basins create recognizable metro areas
        // metro clusters instead of a planet-wide procedural point grid.
        float metroCluster = 0.0;
        metroCluster = max(metroCluster, metroArea(wrappedUv, vec2(0.45, 0.43), vec2(0.045, 0.038), 0.62));
        metroCluster = max(metroCluster, metroArea(wrappedUv, vec2(0.515, 0.475), vec2(0.052, 0.04), 0.82));
        metroCluster = max(metroCluster, metroArea(wrappedUv, vec2(0.585, 0.51), vec2(0.058, 0.045), 1.0));
        metroCluster = max(metroCluster, metroArea(wrappedUv, vec2(0.655, 0.55), vec2(0.046, 0.043), 0.66));
        metroCluster = max(metroCluster, metroArea(wrappedUv, vec2(0.72, 0.585), vec2(0.056, 0.045), 0.74));
        metroCluster = max(metroCluster, metroArea(wrappedUv, vec2(0.62, 0.615), vec2(0.06, 0.047), 0.88));
        metroCluster = max(metroCluster, metroArea(wrappedUv, vec2(0.54, 0.57), vec2(0.048, 0.04), 0.58));
        metroCluster = max(metroCluster, metroArea(wrappedUv, vec2(0.695, 0.46), vec2(0.052, 0.043), 0.68));
        float regionalPopulation = smoothstep(
          0.57,
          0.74,
          fbm(wrappedUv * vec2(5.4, 3.1) + continentalWarp * 0.3 + vec2(19.2, 7.4))
        ) * 0.62;
        metroCluster = max(metroCluster, regionalPopulation);
        metroCluster = clamp(metroCluster, 0.0, 1.0);
        float settlementBreakup = fbm(wrappedUv * vec2(25.0, 13.0) + vec2(13.4, 2.9));
        float latitudeMask = smoothstep(0.08, 0.26, vUv.y)
          * (1.0 - smoothstep(0.9, 0.975, vUv.y));
        float sunFacing = dot(normalize(vNormalObject), normalize(uSunDirectionObject));
        float nightMask = 1.0 - smoothstep(0.38, 0.68, sunFacing);
        float viewFacing = clamp(
          dot(normalize(vNormalView), normalize(vViewDirection)),
          0.0,
          1.0
        );
        float surfaceFacing = smoothstep(0.1, 0.42, viewFacing);
        float cityMask = cityDot
          * smoothstep(0.2, 0.86, citySeed)
          * mix(0.35, 1.0, smoothstep(0.3, 0.75, settlementBreakup))
          * smoothstep(0.075, 0.32, metroCluster)
          * smoothstep(0.06, 0.46, land)
          * latitudeMask
          * surfaceFacing;
        float cityPulse = 0.94 + sin(uTime * 0.45 + citySeed * 15.0) * 0.06;
        float facing = viewFacing;
        float horizon = pow(1.0 - facing, 3.0);
        float oceanCurrent = fbm(wrappedUv * vec2(13.0, 6.0) + vec2(uTime * 0.00008, 18.1));
        vec3 ocean = mix(
          vec3(0.008, 0.018, 0.037),
          vec3(0.02, 0.039, 0.062),
          oceanCurrent * 0.5 + terrain * 0.12
        );
        vec3 landColor = mix(
          vec3(0.034, 0.047, 0.064),
          vec3(0.076, 0.09, 0.105),
          terrain * 0.66 + coastalBreakup * 0.1
        );
        vec3 color = mix(ocean, landColor, land);
        float landRelief = (terrain - 0.5) * land;
        color += vec3(0.012, 0.016, 0.02) * landRelief;
        color *= 0.72 + nightMask * 0.28;
        float warmWhite = hash(cell + vec2(19.4, 7.8));
        vec3 cityColor = mix(
          vec3(1.0, 0.43, 0.075),
          vec3(1.0, 0.82, 0.56),
          smoothstep(0.93, 0.995, warmWhite)
        );
        float cityHalo = smoothstep(
          0.12,
          0.52,
          metroCluster
        ) * smoothstep(0.18, 0.64, land) * nightMask;
        cityHalo *= smoothstep(0.38, 0.72, settlementBreakup);
        float metroCore = pow(metroCluster, 1.45);
        vec3 cityEmission = cityColor * cityHalo * (0.025 + metroCore * 0.022);
        cityEmission += cityColor * cityMask * cityPulse * nightMask
          * (2.6 + citySeed * 1.2 + metroCore * 1.6);
        color += cityEmission;
        color += vec3(0.02, 0.07, 0.13) * horizon * 0.022;

        if (uLayerMode < 0.5) {
          color = ocean * (0.9 + oceanCurrent * 0.1);
        } else if (uLayerMode < 1.5) {
          vec3 diagnosticOcean = vec3(0.006, 0.014, 0.029);
          color = mix(diagnosticOcean, landColor * 1.28, land);
        } else if (uLayerMode < 2.5) {
          color = vec3(0.004, 0.009, 0.019) + cityEmission;
        } else if (uLayerMode < 4.5) {
          color = vec3(0.004, 0.011, 0.025);
        }
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
      uTime: sharedTime,
      uLayerMode: { value: EARTH_LAYER_MODES.combined }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLayerMode;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

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

      float metroArea(vec2 uv, vec2 center, vec2 radius) {
        vec2 delta = abs(uv - center);
        delta.x = min(delta.x, 1.0 - delta.x);
        delta /= radius;
        return exp(-dot(delta, delta) * 2.35);
      }

      void main() {
        vec2 driftUv = vec2(fract(vUv.x + uTime * 0.00028), vUv.y);
        vec2 warp = vec2(
          fbm(driftUv * vec2(3.4, 2.1) + vec2(8.2, 3.1)),
          fbm(driftUv * vec2(3.8, 2.4) + vec2(17.6, 9.3))
        ) - 0.5;
        float cloudLow = fbm(driftUv * vec2(8.2, 4.4) + warp * 0.78 + vec2(8.2, 3.1));
        float cloudDetail = fbm(driftUv * vec2(18.0, 9.5) - warp * 0.34 + 2.7);
        float cloudField = cloudLow * 0.76 + cloudDetail * 0.24;
        float cloud = smoothstep(0.49, 0.75, cloudField);
        float bandShape = fbm(driftUv * vec2(4.4, 2.2) + warp * 0.42 + 21.3);
        float bandBreak = smoothstep(0.3, 0.72, bandShape);
        float clearPocket = smoothstep(0.58, 0.76, fbm(driftUv * vec2(6.2, 3.1) + 47.8));
        float foldedBand = 0.5 + 0.5 * sin(
          driftUv.y * 34.0 + warp.x * 8.0 + warp.y * 4.0
        );
        float latitudeBand = smoothstep(0.28, 0.76, foldedBand);
        cloud *= bandBreak * mix(0.22, 1.0, latitudeBand) * (1.0 - clearPocket * 0.62);
        float thinWisp = smoothstep(0.42, 0.64, cloudLow)
          * mix(0.32, 1.0, latitudeBand)
          * (1.0 - clearPocket * 0.36);
        cloud = max(cloud, thinWisp * 0.52);
        float cityClear = 0.0;
        cityClear = max(cityClear, metroArea(driftUv, vec2(0.45, 0.43), vec2(0.07, 0.06)));
        cityClear = max(cityClear, metroArea(driftUv, vec2(0.515, 0.475), vec2(0.078, 0.064)));
        cityClear = max(cityClear, metroArea(driftUv, vec2(0.585, 0.51), vec2(0.084, 0.068)));
        cityClear = max(cityClear, metroArea(driftUv, vec2(0.655, 0.55), vec2(0.076, 0.066)));
        cityClear = max(cityClear, metroArea(driftUv, vec2(0.62, 0.615), vec2(0.088, 0.07)));
        cloud *= 1.0 - smoothstep(0.12, 0.62, cityClear) * 0.48;
        float facing = clamp(
          dot(normalize(vNormalView), normalize(vViewDirection)),
          0.0,
          1.0
        );
        float limbFade = smoothstep(0.02, 0.42, facing);
        float diagnosticBand = smoothstep(0.34, 0.6, cloudField)
          * mix(0.25, 1.0, latitudeBand)
          * limbFade;
        cloud = max(cloud, diagnosticBand * 0.28);
        vec3 cloudColor = mix(vec3(0.045, 0.06, 0.078), vec3(0.21, 0.225, 0.235), cloud);
        float cloudAlpha = cloud * limbFade * 0.18;
        if (uLayerMode > 2.5 && uLayerMode < 3.5) {
          float diagnosticCloud = smoothstep(0.34, 0.56, cloudField)
            * mix(0.38, 1.0, latitudeBand)
            * (1.0 - clearPocket * 0.48);
          diagnosticCloud = max(diagnosticCloud, cloud);
          cloudColor = mix(
            vec3(0.06, 0.09, 0.13),
            vec3(0.46, 0.54, 0.62),
            diagnosticCloud
          );
          float diagnosticLimbFade = smoothstep(0.025, 0.16, facing);
          cloudAlpha = diagnosticCloud * diagnosticLimbFade * 0.5;
        }
        gl_FragColor = vec4(cloudColor, min(cloudAlpha, 0.42));
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
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
