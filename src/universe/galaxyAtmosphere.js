import * as THREE from 'three';

const TAU = Math.PI * 2;
const GALAXY_AURA_URL = '/textures/hero/galaxy/main-galaxy-v2-aura.webp';
const SUPPORTED_DEBUG_MODES = new Set([
  'off',
  'v21',
  'rearMistOnly',
  'starSpillOnly',
  'wispsOnly',
  'foregroundDustOnly',
  'edgeDissolveOnly',
  'armSpillOnly',
  'lightSpillOnly',
  'depthLayersOnly',
  'auraOnly',
  'atmosphereWithoutAura',
  'occlusionOnly',
  'lowerRightOcclusionOnly',
  'upperRightOcclusionOnly',
  'leftArmOcclusionOnly',
  'atmosphereWithoutOcclusion',
  'combined'
]);

const PARAMETERS = Object.freeze({
  rearMist: Object.freeze({
    alpha: 0.043,
    width: 2.04,
    height: 1.42,
    extent: 1.14
  }),
  starSpill: Object.freeze({
    count: 960,
    alpha: 0.17,
    extent: 1.14,
    rearCount: 420,
    midCount: 540,
    rearParallaxX: -0.004,
    rearParallaxY: -0.003,
    midParallaxX: 0.008,
    midParallaxY: 0.006
  }),
  wisps: Object.freeze({
    regions: 4,
    targetCount: 315,
    alpha: 0.068,
    extent: 1.12
  }),
  foregroundDust: Object.freeze({
    count: 104,
    alpha: 0.078,
    extent: 1.1,
    parallaxX: 0.022,
    parallaxY: 0.016
  }),
  lightSpill: Object.freeze({
    spots: 3,
    alpha: 0.029,
    width: 2.06,
    height: 1.46,
    extent: 1.15
  }),
  volumeAura: Object.freeze({
    textureUrl: GALAXY_AURA_URL,
    baseSize: 1.76904,
    rearScale: 1.16,
    nearScale: 1.1,
    rearAlpha: 0.055,
    nearAlpha: 0.078,
    blend: 'AdditiveBlending'
  }),
  edgeOcclusion: Object.freeze({
    blend: 'NormalBlending',
    alphaModulationMin: 0.44,
    alphaModulationMax: 1,
    temporalAmplitude: 0.015,
    driftSpeed: 0.0022,
    lowerRight: Object.freeze({
      position: Object.freeze([0.61, -0.29, 0.045]),
      range: Object.freeze([0.48, 0.27]),
      alpha: 0.072,
      rotation: -0.22
    }),
    upperRight: Object.freeze({
      position: Object.freeze([0.59, 0.3, 0.048]),
      range: Object.freeze([0.41, 0.235]),
      alpha: 0.061,
      rotation: 0.31
    }),
    leftArm: Object.freeze({
      position: Object.freeze([-0.58, 0.035, 0.046]),
      range: Object.freeze([0.43, 0.22]),
      alpha: 0.056,
      rotation: -0.12
    })
  })
});

export function readGalaxyAtmosphereDebugState() {
  if (typeof window === 'undefined') {
    return Object.freeze({ enabled: false, mode: 'combined' });
  }

  const params = new URLSearchParams(window.location.search);
  const fusionDebugValue = params.get('debugGalaxyFusion');
  const auraDebugValue = params.get('debugGalaxyAura');
  const occlusionDebugValue = params.get('debugGalaxyOcclusion');
  const rawDebugValue = occlusionDebugValue
    ?? auraDebugValue
    ?? fusionDebugValue
    ?? params.get('debugGalaxyAtmosphere');
  const enabled = import.meta.env.DEV
    && rawDebugValue !== null
    && rawDebugValue !== '0'
    && rawDebugValue !== 'false';
  const requestedMode = params.get('galaxyOcclusionMode')
    || params.get('galaxyAuraMode')
    || params.get('galaxyFusionMode')
    || params.get('galaxyAtmosphereMode')
    || (SUPPORTED_DEBUG_MODES.has(rawDebugValue) ? rawDebugValue : 'combined');
  const mode = SUPPORTED_DEBUG_MODES.has(requestedMode)
    ? requestedMode
    : 'combined';

  return Object.freeze({ enabled, mode });
}

export function createGalaxyAtmosphere({
  debugState = Object.freeze({ enabled: false, mode: 'combined' })
} = {}) {
  const activeMode = debugState.enabled ? debugState.mode : 'combined';
  const debugGain = debugState.enabled && activeMode.endsWith('Only') ? 4 : 1;
  const group = new THREE.Group();
  const volumeAura = createGalaxyVolumeAura(debugGain);
  const rearMist = createRearNebulaMist(debugGain);
  const lightSpill = createGalaxyLightSpill(debugGain);
  const starSpill = createOuterStarSpill(debugGain);
  const wisps = createArmEdgeWisps(debugGain);
  const foregroundDust = createForegroundDust(debugGain);
  const occlusionDebugGain = debugState.enabled
    && (activeMode === 'occlusionOnly' || activeMode.endsWith('OcclusionOnly'))
    ? 8
    : 1;
  const edgeOcclusion = createGalaxyEdgeOcclusion(occlusionDebugGain);
  const layers = {
    volumeAura: volumeAura.group,
    rearMist: rearMist.mesh,
    lightSpill: lightSpill.mesh,
    starSpill: starSpill.group,
    wisps: wisps.points,
    foregroundDust: foregroundDust.points,
    edgeOcclusion: edgeOcclusion.group
  };
  let journeyOpacity = 1;
  let phaseTime = 0;
  let frameCount = 0;
  let fpsWindowStart = performance.now();
  let measuredFps = 0;
  let disposed = false;

  group.name = 'GalaxyAtmosphereGroup';
  group.add(
    volumeAura.group,
    rearMist.mesh,
    lightSpill.mesh,
    starSpill.group,
    wisps.points,
    foregroundDust.points,
    edgeOcclusion.group
  );
  applyMode(activeMode);
  publishDiagnostics();

  function update(delta, time, interaction, journeyProgress = 0) {
    if (disposed) return;

    journeyOpacity = 1 - smootherstep(0.28, 0.66, journeyProgress);
    phaseTime = time;
    volumeAura.update(time, journeyOpacity);
    rearMist.update(time, journeyOpacity);
    lightSpill.update(time, journeyOpacity);
    starSpill.update(time, journeyOpacity, interaction);
    wisps.update(time, journeyOpacity);
    foregroundDust.update(time, journeyOpacity, interaction);
    edgeOcclusion.update(time, journeyOpacity);
    updateFpsMeasurement();
  }

  function applyMode(mode = 'combined') {
    const normalizedMode = SUPPORTED_DEBUG_MODES.has(mode) ? mode : 'combined';

    group.visible = normalizedMode !== 'off';
    volumeAura.group.visible = normalizedMode === 'combined'
      || normalizedMode === 'auraOnly'
      || normalizedMode === 'atmosphereWithoutOcclusion';
    rearMist.mesh.visible = normalizedMode === 'combined'
      || normalizedMode === 'v21'
      || normalizedMode === 'atmosphereWithoutAura'
      || normalizedMode === 'atmosphereWithoutOcclusion'
      || normalizedMode === 'rearMistOnly';
    lightSpill.mesh.visible = normalizedMode === 'atmosphereWithoutAura'
      || normalizedMode === 'lightSpillOnly';
    starSpill.group.visible = normalizedMode === 'combined'
      || normalizedMode === 'v21'
      || normalizedMode === 'atmosphereWithoutAura'
      || normalizedMode === 'atmosphereWithoutOcclusion'
      || normalizedMode === 'starSpillOnly'
      || normalizedMode === 'armSpillOnly'
      || normalizedMode === 'depthLayersOnly';
    wisps.points.visible = normalizedMode === 'combined'
      || normalizedMode === 'v21'
      || normalizedMode === 'atmosphereWithoutAura'
      || normalizedMode === 'atmosphereWithoutOcclusion'
      || normalizedMode === 'wispsOnly'
      || normalizedMode === 'armSpillOnly';
    foregroundDust.points.visible = normalizedMode === 'combined'
      || normalizedMode === 'v21'
      || normalizedMode === 'atmosphereWithoutAura'
      || normalizedMode === 'atmosphereWithoutOcclusion'
      || normalizedMode === 'foregroundDustOnly'
      || normalizedMode === 'depthLayersOnly';
    edgeOcclusion.setVisibility(normalizedMode);
  }

  function updateFpsMeasurement() {
    frameCount += 1;
    const now = performance.now();
    const elapsed = now - fpsWindowStart;

    if (elapsed < 2000) return;
    measuredFps = frameCount * 1000 / elapsed;
    frameCount = 0;
    fpsWindowStart = now;
    publishDiagnostics();
  }

  function publishDiagnostics() {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;

    const diagnostics = {
      enabled: group.visible,
      mode: activeMode,
      debugGain,
      instanceUuid: group.uuid,
      phaseTime,
      journeyOpacity,
      fps: measuredFps,
      layers: {
        volumeAura: {
          textureUrl: PARAMETERS.volumeAura.textureUrl,
          textureLoadCount: volumeAura.getTextureLoadCount(),
          textureStatus: volumeAura.getTextureStatus(),
          primitives: 2,
          rearScale: PARAMETERS.volumeAura.rearScale,
          nearScale: PARAMETERS.volumeAura.nearScale,
          rearAlpha: PARAMETERS.volumeAura.rearAlpha,
          nearAlpha: PARAMETERS.volumeAura.nearAlpha,
          blending: PARAMETERS.volumeAura.blend,
          visible: volumeAura.group.visible
        },
        rearMist: {
          primitives: 1,
          alpha: PARAMETERS.rearMist.alpha,
          extent: PARAMETERS.rearMist.extent,
          visible: rearMist.mesh.visible
        },
        lightSpill: {
          spots: PARAMETERS.lightSpill.spots,
          alpha: PARAMETERS.lightSpill.alpha,
          extent: PARAMETERS.lightSpill.extent,
          visible: lightSpill.mesh.visible
        },
        starSpill: {
          particles: PARAMETERS.starSpill.count,
          rearParticles: PARAMETERS.starSpill.rearCount,
          midParticles: PARAMETERS.starSpill.midCount,
          alpha: PARAMETERS.starSpill.alpha,
          extent: PARAMETERS.starSpill.extent,
          visible: starSpill.group.visible
        },
        wisps: {
          regions: PARAMETERS.wisps.regions,
          particles: wisps.count,
          alpha: PARAMETERS.wisps.alpha,
          extent: PARAMETERS.wisps.extent,
          visible: wisps.points.visible
        },
        foregroundDust: {
          particles: PARAMETERS.foregroundDust.count,
          alpha: PARAMETERS.foregroundDust.alpha,
          extent: PARAMETERS.foregroundDust.extent,
          visible: foregroundDust.points.visible
        },
        edgeOcclusion: {
          groupName: edgeOcclusion.group.name,
          blending: PARAMETERS.edgeOcclusion.blend,
          alphaModulation: [
            PARAMETERS.edgeOcclusion.alphaModulationMin,
            PARAMETERS.edgeOcclusion.alphaModulationMax
          ],
          temporalAmplitude: PARAMETERS.edgeOcclusion.temporalAmplitude,
          driftSpeed: PARAMETERS.edgeOcclusion.driftSpeed,
          resources: edgeOcclusion.getResourceCounts(),
          visible: edgeOcclusion.group.visible,
          regions: edgeOcclusion.getDiagnostics()
        }
      }
    };
    window.__ACTIVE_THEORY_GALAXY_ATMOSPHERE__ = diagnostics;
    document.documentElement.dataset.galaxyAtmosphereDiagnostics = JSON.stringify(
      diagnostics
    );
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    volumeAura.dispose();
    rearMist.dispose();
    lightSpill.dispose();
    starSpill.dispose();
    wisps.dispose();
    foregroundDust.dispose();
    edgeOcclusion.dispose();
    group.clear();
    if (typeof window !== 'undefined') {
      delete window.__ACTIVE_THEORY_GALAXY_ATMOSPHERE__;
      delete document.documentElement.dataset.galaxyAtmosphereDiagnostics;
    }
  }

  return {
    group,
    layers,
    update,
    applyMode,
    dispose,
    parameters: PARAMETERS,
    debugState,
    getFps: () => measuredFps
  };
}

function createGalaxyEdgeOcclusion(debugGain = 1) {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const regionDefinitions = [
    {
      key: 'lowerRight',
      name: 'LowerRightOcclusion',
      seed: 2.7,
      colorA: new THREE.Color(0x081c3d),
      colorB: new THREE.Color(0x164a78)
    },
    {
      key: 'upperRight',
      name: 'UpperRightOcclusion',
      seed: 7.4,
      colorA: new THREE.Color(0x0a2146),
      colorB: new THREE.Color(0x303565)
    },
    {
      key: 'leftArm',
      name: 'LeftArmOcclusion',
      seed: 11.9,
      colorA: new THREE.Color(0x0a1e3c),
      colorB: new THREE.Color(0x34295c)
    }
  ];
  const regions = regionDefinitions.map((definition, index) => {
    const parameters = PARAMETERS.edgeOcclusion[definition.key];
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: parameters.alpha },
        uJourneyOpacity: { value: 1 },
        uDebugGain: { value: debugGain },
        uSeed: { value: definition.seed },
        uColorA: { value: definition.colorA },
        uColorB: { value: definition.colorB }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uJourneyOpacity;
        uniform float uDebugGain;
        uniform float uSeed;
        uniform vec3 uColorA;
        uniform vec3 uColorB;

        float hash21(vec2 point) {
          point = fract(point * vec2(127.17, 311.73));
          point += dot(point, point + 29.41 + uSeed);
          return fract(point.x * point.y);
        }

        float valueNoise(vec2 point) {
          vec2 cell = floor(point);
          vec2 local = fract(point);
          local = local * local * (3.0 - 2.0 * local);
          float a = hash21(cell);
          float b = hash21(cell + vec2(1.0, 0.0));
          float c = hash21(cell + vec2(0.0, 1.0));
          float d = hash21(cell + vec2(1.0, 1.0));
          return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
        }

        float fbm(vec2 point) {
          float value = valueNoise(point) * 0.62;
          value += valueNoise(point * 2.13 + 4.7) * 0.27;
          value += valueNoise(point * 4.07 + 9.1) * 0.11;
          return value;
        }

        void main() {
          vec2 local = (vUv - 0.5) * 2.0;
          float slowDrift = uTime * ${PARAMETERS.edgeOcclusion.driftSpeed.toFixed(4)};
          vec2 warped = local;
          warped.x += (valueNoise(local * 1.8 + uSeed) - 0.5) * 0.22;
          warped.y += (valueNoise(local * 2.1 - uSeed) - 0.5) * 0.17;
          float body = 1.0 - smoothstep(0.34, 1.02, length(warped));
          float cloud = fbm(
            local * vec2(2.7, 3.8)
              + vec2(uSeed * 0.41 + slowDrift, -uSeed * 0.29 - slowDrift)
          );
          float breakup = smoothstep(0.31, 0.73, cloud);
          float directionalCut = smoothstep(-1.08, -0.08, local.x + local.y * 0.28);
          float modulation = mix(
            ${PARAMETERS.edgeOcclusion.alphaModulationMin.toFixed(2)},
            ${PARAMETERS.edgeOcclusion.alphaModulationMax.toFixed(2)},
            breakup
          );
          modulation *= mix(0.52, 1.0, directionalCut);
          float breathing = 1.0
            + sin(uTime * 0.027 + uSeed) * ${PARAMETERS.edgeOcclusion.temporalAmplitude.toFixed(3)};
          float alpha = body
            * modulation
            * breathing
            * uOpacity
            * uJourneyOpacity
            * uDebugGain;
          vec3 color = mix(uColorA, uColorB, cloud * 0.62);

          if (alpha < 0.00035) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: true,
      premultipliedAlpha: false
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.name = definition.name;
    mesh.position.fromArray(parameters.position);
    mesh.scale.set(parameters.range[0], parameters.range[1], 1);
    mesh.rotation.z = parameters.rotation;
    mesh.renderOrder = -4 + index * 0.01;
    mesh.frustumCulled = false;
    group.add(mesh);

    return { definition, parameters, mesh, material };
  });

  group.name = 'GalaxyEdgeOcclusionGroup';

  return {
    group,
    update(time, journeyOpacity) {
      regions.forEach(({ material }) => {
        material.uniforms.uTime.value = time;
        material.uniforms.uJourneyOpacity.value = journeyOpacity;
      });
    },
    setVisibility(mode) {
      const showAll = mode === 'combined' || mode === 'occlusionOnly';
      group.visible = showAll || mode.endsWith('OcclusionOnly');
      regions.forEach(({ definition, mesh }) => {
        const individualMode = `${definition.key}OcclusionOnly`;
        mesh.visible = showAll || mode === individualMode;
      });
    },
    getDiagnostics() {
      return Object.fromEntries(regions.map(({ definition, parameters, mesh }) => [
        definition.key,
        {
          name: mesh.name,
          position: [...parameters.position],
          range: [...parameters.range],
          alpha: parameters.alpha,
          rotation: parameters.rotation,
          visible: mesh.visible
        }
      ]));
    },
    getResourceCounts() {
      return {
        groups: 1,
        meshes: regions.length,
        geometries: 1,
        materials: regions.length,
        textures: 0
      };
    },
    dispose() {
      geometry.dispose();
      regions.forEach(({ material }) => material.dispose());
      group.clear();
    }
  };
}

function createGalaxyVolumeAura(debugGain = 1) {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(
    PARAMETERS.volumeAura.baseSize,
    PARAMETERS.volumeAura.baseSize,
    1,
    1
  );
  const textureLoader = new THREE.TextureLoader();
  let textureStatus = 'loading';
  let textureLoadCount = 1;
  let disposed = false;

  const auraTexture = textureLoader.load(
    PARAMETERS.volumeAura.textureUrl,
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      textureStatus = 'ready';
    },
    undefined,
    () => {
      if (!disposed) textureStatus = 'error';
    }
  );

  function createMaterial(opacity, phase, noiseScale) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uAuraMap: { value: auraTexture },
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uJourneyOpacity: { value: 1 },
        uDebugGain: { value: debugGain },
        uPhase: { value: phase },
        uNoiseScale: { value: noiseScale }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uAuraMap;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uJourneyOpacity;
        uniform float uDebugGain;
        uniform float uPhase;
        uniform float uNoiseScale;

        float hash21(vec2 point) {
          point = fract(point * vec2(217.31, 391.73));
          point += dot(point, point + 33.17);
          return fract(point.x * point.y);
        }

        float valueNoise(vec2 point) {
          vec2 cell = floor(point);
          vec2 local = fract(point);
          local = local * local * (3.0 - 2.0 * local);
          float a = hash21(cell);
          float b = hash21(cell + vec2(1.0, 0.0));
          float c = hash21(cell + vec2(0.0, 1.0));
          float d = hash21(cell + vec2(1.0, 1.0));
          return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
        }

        void main() {
          vec2 drift = vec2(
            sin(uTime * 0.0027 + uPhase),
            cos(uTime * 0.0021 + uPhase * 1.37)
          ) * 0.00085;
          vec4 aura = texture2D(uAuraMap, vUv + drift);
          float breakup = valueNoise(
            vUv * uNoiseScale + vec2(uPhase * 3.1, -uPhase * 2.7)
          );
          float breathing = 0.992 + sin(uTime * 0.031 + uPhase) * 0.008;
          float alpha = aura.a
            * mix(0.78, 1.0, breakup)
            * breathing
            * uOpacity
            * uJourneyOpacity
            * uDebugGain;
          if (alpha < 0.00035) discard;
          gl_FragColor = vec4(aura.rgb, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: true
    });
  }

  const rearMaterial = createMaterial(PARAMETERS.volumeAura.rearAlpha, 0.7, 5.6);
  const nearMaterial = createMaterial(PARAMETERS.volumeAura.nearAlpha, 3.4, 8.2);
  const rearMesh = new THREE.Mesh(geometry, rearMaterial);
  const nearMesh = new THREE.Mesh(geometry, nearMaterial);

  group.name = 'GalaxyVolumeAura';
  rearMesh.name = 'GalaxyVolumeAuraRear';
  nearMesh.name = 'GalaxyVolumeAuraNear';
  rearMesh.scale.setScalar(PARAMETERS.volumeAura.rearScale);
  nearMesh.scale.setScalar(PARAMETERS.volumeAura.nearScale);
  rearMesh.position.z = -0.115;
  nearMesh.position.z = -0.074;
  rearMesh.renderOrder = -12;
  nearMesh.renderOrder = -8;
  rearMesh.frustumCulled = false;
  nearMesh.frustumCulled = false;
  group.add(rearMesh, nearMesh);

  return {
    group,
    update(time, journeyOpacity) {
      rearMaterial.uniforms.uTime.value = time;
      nearMaterial.uniforms.uTime.value = time;
      rearMaterial.uniforms.uJourneyOpacity.value = journeyOpacity;
      nearMaterial.uniforms.uJourneyOpacity.value = journeyOpacity;
    },
    getTextureLoadCount: () => textureLoadCount,
    getTextureStatus: () => textureStatus,
    dispose() {
      if (disposed) return;
      disposed = true;
      textureStatus = 'disposed';
      textureLoadCount = 0;
      geometry.dispose();
      rearMaterial.dispose();
      nearMaterial.dispose();
      auraTexture.dispose();
      group.clear();
    }
  };
}

function createRearNebulaMist(debugGain = 1) {
  const geometry = new THREE.PlaneGeometry(
    PARAMETERS.rearMist.width,
    PARAMETERS.rearMist.height,
    1,
    1
  );
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: PARAMETERS.rearMist.alpha },
      uDebugGain: { value: debugGain },
      uJourneyOpacity: { value: 1 }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uDebugGain;
      uniform float uJourneyOpacity;

      float hash21(vec2 point) {
        point = fract(point * vec2(123.34, 456.21));
        point += dot(point, point + 45.32);
        return fract(point.x * point.y);
      }

      float valueNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        float a = hash21(cell);
        float b = hash21(cell + vec2(1.0, 0.0));
        float c = hash21(cell + vec2(0.0, 1.0));
        float d = hash21(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }

      float fbm(vec2 point) {
        float value = 0.0;
        float amplitude = 0.58;
        for (int octave = 0; octave < 4; octave += 1) {
          value += valueNoise(point) * amplitude;
          point = mat2(1.62, -1.18, 1.18, 1.62) * point + 3.7;
          amplitude *= 0.48;
        }
        return value;
      }

      float softBlob(vec2 point, vec2 center, vec2 radius) {
        return 1.0 - smoothstep(0.34, 1.0, length((point - center) / radius));
      }

      void main() {
        vec2 point = vUv;
        vec2 centered = point - 0.5;
        float ellipticalRadius = length(centered / vec2(0.52, 0.39));
        float centerCut = smoothstep(0.27, 0.47, ellipticalRadius);
        float outerFade = 1.0 - smoothstep(0.76, 1.08, ellipticalRadius);
        float rightUpperRegion = softBlob(point, vec2(0.76, 0.72), vec2(0.34, 0.25));
        float leftRearRegion = softBlob(point, vec2(0.24, 0.61), vec2(0.22, 0.16));
        float lowerTraceRegion = softBlob(point, vec2(0.61, 0.24), vec2(0.24, 0.12));
        float regionalMask = max(
          rightUpperRegion,
          max(leftRearRegion * 0.54, lowerTraceRegion * 0.2)
        );
        float broadNoise = fbm(point * 4.2 + vec2(2.1, 7.4));
        float breakNoise = fbm(point * 9.6 + vec2(11.3, 1.7));
        float brokenDensity = smoothstep(0.36, 0.78, broadNoise * 0.72 + breakNoise * 0.28);
        float edgeFade = smoothstep(0.0, 0.08, min(min(point.x, point.y), min(1.0 - point.x, 1.0 - point.y)));
        float alpha = regionalMask
          * centerCut
          * outerFade
          * brokenDensity
          * edgeFade
          * uOpacity
          * uDebugGain
          * uJourneyOpacity;
        vec3 deepBlue = vec3(0.04, 0.16, 0.4);
        vec3 iceBlue = vec3(0.15, 0.42, 0.7);
        vec3 restrainedPurple = vec3(0.22, 0.13, 0.4);
        vec3 color = mix(deepBlue, iceBlue, broadNoise * 0.48);
        color = mix(
          color,
          restrainedPurple,
          (leftRearRegion * 0.18 + rightUpperRegion * 0.05) * breakNoise
        );

        if (alpha < 0.001) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'RearNebulaMist';
  mesh.position.set(0.02, 0.025, -0.04);
  mesh.renderOrder = -9;
  mesh.frustumCulled = false;

  return {
    mesh,
    update(time, journeyOpacity) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createGalaxyLightSpill(debugGain = 1) {
  const geometry = new THREE.PlaneGeometry(
    PARAMETERS.lightSpill.width,
    PARAMETERS.lightSpill.height,
    1,
    1
  );
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: PARAMETERS.lightSpill.alpha },
      uDebugGain: { value: debugGain },
      uJourneyOpacity: { value: 1 }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform float uDebugGain;
      uniform float uJourneyOpacity;

      float hash21(vec2 point) {
        point = fract(point * vec2(213.17, 417.91));
        point += dot(point, point + 31.47);
        return fract(point.x * point.y);
      }

      float valueNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        float a = hash21(cell);
        float b = hash21(cell + vec2(1.0, 0.0));
        float c = hash21(cell + vec2(0.0, 1.0));
        float d = hash21(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }

      float irregularSpot(
        vec2 point,
        vec2 center,
        vec2 radius,
        float seed,
        float broadNoise,
        float detailNoise
      ) {
        vec2 local = (point - center) / radius;
        float angle = atan(local.y, local.x);
        float edgeNoise = broadNoise * 0.18
          + sin(angle * 3.0 + seed) * 0.045;
        float distanceFromCenter = length(local) - edgeNoise;
        float body = 1.0 - smoothstep(0.16, 1.0, distanceFromCenter);
        float breakup = smoothstep(0.28, 0.72, detailNoise);
        return body * mix(0.38, 1.0, breakup);
      }

      void main() {
        vec2 point = vUv;
        float broadNoise = valueNoise(point * 7.2 + vec2(2.3, 5.7));
        float detailNoise = valueNoise(point * 13.5 + vec2(8.1, 1.9));
        float rightUpper = irregularSpot(
          point,
          vec2(0.73, 0.72),
          vec2(0.25, 0.17),
          2.3,
          broadNoise,
          detailNoise
        );
        float leftShort = irregularSpot(
          point,
          vec2(0.25, 0.56),
          vec2(0.18, 0.12),
          7.1,
          1.0 - broadNoise,
          1.0 - detailNoise
        );
        float coreOuter = irregularSpot(
          point,
          vec2(0.54, 0.5),
          vec2(0.2, 0.14),
          11.6,
          mix(broadNoise, detailNoise, 0.42),
          mix(detailNoise, broadNoise, 0.36)
        );
        float coreCut = smoothstep(
          0.11,
          0.32,
          length((point - vec2(0.5)) / vec2(0.42, 0.31))
        );
        coreOuter *= coreCut * 0.38;
        float spill = max(rightUpper, max(leftShort * 0.64, coreOuter));
        float edgeFade = smoothstep(
          0.0,
          0.07,
          min(min(point.x, point.y), min(1.0 - point.x, 1.0 - point.y))
        );
        float alpha = spill
          * edgeFade
          * uOpacity
          * uDebugGain
          * uJourneyOpacity;
        vec3 deepBlue = vec3(0.025, 0.13, 0.34);
        vec3 iceBlue = vec3(0.12, 0.38, 0.67);
        vec3 bluePurple = vec3(0.16, 0.11, 0.34);
        vec3 warmTrace = vec3(0.34, 0.2, 0.12);
        vec3 color = mix(deepBlue, iceBlue, rightUpper * 0.42);
        color = mix(color, bluePurple, leftShort * 0.18);
        color = mix(color, warmTrace, coreOuter * 0.1);

        if (alpha < 0.001) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'GalaxyLightSpill';
  mesh.position.set(0.015, 0.01, -0.072);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;

  return {
    mesh,
    update(time, journeyOpacity) {
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createOuterStarSpill(debugGain = 1) {
  const terminalRegions = [
    {
      name: 'RightUpperLongArm',
      origin: new THREE.Vector2(0.49, 0.39),
      tangent: new THREE.Vector2(0.81, 0.59).normalize(),
      length: 0.46,
      spread: 0.075,
      curve: 0.055,
      weight: 0.44,
      color: new THREE.Color(0x9edcff)
    },
    {
      name: 'LeftShortArm',
      origin: new THREE.Vector2(-0.55, 0.12),
      tangent: new THREE.Vector2(-0.96, 0.29).normalize(),
      length: 0.24,
      spread: 0.052,
      curve: -0.026,
      weight: 0.23,
      color: new THREE.Color(0x7baee2)
    },
    {
      name: 'UpperBranch',
      origin: new THREE.Vector2(-0.18, 0.5),
      tangent: new THREE.Vector2(-0.42, 0.91).normalize(),
      length: 0.29,
      spread: 0.06,
      curve: 0.034,
      weight: 0.25,
      color: new THREE.Color(0x8797d5)
    },
    {
      name: 'LowerSparseArm',
      origin: new THREE.Vector2(0.43, -0.36),
      tangent: new THREE.Vector2(0.79, -0.61).normalize(),
      length: 0.17,
      spread: 0.036,
      curve: -0.018,
      weight: 0.08,
      color: new THREE.Color(0x5d86bd)
    }
  ];
  const rear = createSpillDepthLayer({
    name: 'OuterStarSpillRear',
    count: PARAMETERS.starSpill.rearCount,
    seed: 27021991,
    terminalRegions,
    zMin: -0.12,
    zMax: -0.055,
    pointScale: 18,
    opacity: PARAMETERS.starSpill.alpha * 0.66,
    sizeScale: 0.72,
    brightnessScale: 0.72,
    debugGain,
    renderOrder: -8
  });
  const mid = createSpillDepthLayer({
    name: 'OuterStarSpillMid',
    count: PARAMETERS.starSpill.midCount,
    seed: 27022057,
    terminalRegions,
    zMin: -0.015,
    zMax: 0.045,
    pointScale: 22,
    opacity: PARAMETERS.starSpill.alpha,
    sizeScale: 1,
    brightnessScale: 1,
    debugGain,
    renderOrder: -5
  });
  const group = new THREE.Group();

  group.name = 'OuterStarSpill';
  group.add(rear.points, mid.points);

  return {
    group,
    update(time, journeyOpacity, interaction) {
      rear.update(time, journeyOpacity);
      mid.update(time, journeyOpacity);
      rear.points.position.x = (interaction?.parallaxX ?? 0)
        * PARAMETERS.starSpill.rearParallaxX;
      rear.points.position.y = (interaction?.parallaxY ?? 0)
        * PARAMETERS.starSpill.rearParallaxY;
      mid.points.position.x = (interaction?.parallaxX ?? 0)
        * PARAMETERS.starSpill.midParallaxX;
      mid.points.position.y = (interaction?.parallaxY ?? 0)
        * PARAMETERS.starSpill.midParallaxY;
    },
    dispose() {
      rear.dispose();
      mid.dispose();
      group.clear();
    }
  };
}

function createSpillDepthLayer({
  name,
  count,
  seed,
  terminalRegions,
  zMin,
  zMax,
  pointScale,
  opacity,
  sizeScale,
  brightnessScale,
  debugGain,
  renderOrder
}) {
  const random = createSeededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const phases = new Float32Array(count);
  const twinkles = new Float32Array(count);
  const point = new THREE.Vector2();
  const normal = new THREE.Vector2();
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const region = selectWeightedRegion(terminalRegions, random());
    const progress = Math.pow(random(), 1.72);
    const taper = Math.pow(1 - progress, 1.35);
    const tangentJitter = (random() - 0.5) * 0.018;
    const crossJitter = (random() - 0.5)
      * region.spread
      * (0.38 + taper * 1.2);

    normal.set(-region.tangent.y, region.tangent.x);
    point.copy(region.origin)
      .addScaledVector(
        region.tangent,
        region.length * (0.08 + progress * 0.92) + tangentJitter
      )
      .addScaledVector(normal, crossJitter + Math.sin(progress * Math.PI) * region.curve);
    point.x += (random() - 0.5) * 0.016 * taper;
    point.y += (random() - 0.5) * 0.016 * taper;
    positions.set([
      point.x,
      point.y,
      THREE.MathUtils.lerp(zMin, zMax, random())
    ], index * 3);
    color.copy(region.color)
      .lerp(new THREE.Color(0xe1f3ff), random() * 0.28)
      .multiplyScalar((0.36 + random() * 0.36) * brightnessScale);
    colors.set([color.r, color.g, color.b], index * 3);
    const sizeRoll = random();
    sizes[index] = (sizeRoll < 0.87
      ? 0.28 + random() * 0.28
      : sizeRoll < 0.985
        ? 0.61 + random() * 0.34
        : 1.02 + random() * 0.3) * sizeScale;
    opacities[index] = (0.16 + random() * 0.58)
      * (0.32 + taper * 0.68);
    phases[index] = random() * TAU;
    twinkles[index] = random() < 0.072 ? 0.26 + random() * 0.42 : 0;
  }

  const geometry = createPointGeometry({
    positions,
    colors,
    attributes: {
      aSize: sizes,
      aOpacity: opacities,
      aPhase: phases,
      aTwinkle: twinkles
    }
  });
  const material = createStarPointMaterial({
    opacity,
    pointScale,
    blending: THREE.AdditiveBlending,
    debugGain
  });
  const points = new THREE.Points(geometry, material);

  points.name = name;
  points.renderOrder = renderOrder;
  points.frustumCulled = false;

  return {
    points,
    update(time, journeyOpacity) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function selectWeightedRegion(regions, roll) {
  let cursor = 0;

  for (const region of regions) {
    cursor += region.weight;
    if (roll <= cursor) return region;
  }
  return regions[regions.length - 1];
}

function createArmEdgeWisps(debugGain = 1) {
  const random = createSeededRandom(9012457);
  const paths = [
    {
      start: new THREE.Vector2(0.47, 0.38),
      control: new THREE.Vector2(0.72, 0.62),
      end: new THREE.Vector2(0.94, 0.69),
      count: 118,
      width: 0.05
    },
    {
      start: new THREE.Vector2(-0.53, 0.12),
      control: new THREE.Vector2(-0.68, 0.18),
      end: new THREE.Vector2(-0.79, 0.2),
      count: 72,
      width: 0.036
    },
    {
      start: new THREE.Vector2(-0.17, 0.48),
      control: new THREE.Vector2(-0.27, 0.67),
      end: new THREE.Vector2(-0.35, 0.76),
      count: 80,
      width: 0.041
    },
    {
      start: new THREE.Vector2(0.42, -0.35),
      control: new THREE.Vector2(0.51, -0.42),
      end: new THREE.Vector2(0.58, -0.46),
      count: 45,
      width: 0.027
    }
  ];
  const positions = [];
  const colors = [];
  const sizes = [];
  const opacities = [];
  const phases = [];
  const rotations = [];
  const stretches = [];
  const blue = new THREE.Color(0x77bdf2);
  const ice = new THREE.Color(0xc1e7ff);
  const purple = new THREE.Color(0x776fb5);
  const point = new THREE.Vector2();
  const tangent = new THREE.Vector2();
  const normal = new THREE.Vector2();
  const color = new THREE.Color();

  paths.forEach((path, pathIndex) => {
    for (let index = 0; index < path.count; index += 1) {
      const t = (index + random() * 0.84) / path.count;
      const fragmentation = Math.sin(t * 31 + pathIndex * 2.7)
        + Math.sin(t * 73 + 1.6) * 0.55;

      if (fragmentation < -0.93 && random() < 0.78) continue;
      quadraticBezier(point, path.start, path.control, path.end, t);
      quadraticBezierTangent(tangent, path.start, path.control, path.end, t);
      normal.set(-tangent.y, tangent.x).normalize();
      const envelope = Math.pow(Math.sin(Math.PI * t), 0.58);
      const width = path.width * (0.55 + envelope * 1.05);
      const offset = (random() - 0.5) * width * 2;

      point.addScaledVector(normal, offset);
      point.addScaledVector(tangent, (random() - 0.5) * 0.018);
      positions.push(point.x, point.y, 0.012 + random() * 0.026);
      color.copy(pathIndex === 2 ? purple : blue).lerp(ice, random() * 0.42);
      color.multiplyScalar(0.36 + random() * 0.32);
      colors.push(color.r, color.g, color.b);
      sizes.push(0.58 + random() * 0.82);
      opacities.push(envelope * (0.24 + random() * 0.64));
      phases.push(random() * TAU);
      rotations.push(Math.atan2(tangent.y, tangent.x));
      stretches.push(2.5 + random() * 2.4);
    }
  });

  const geometry = createPointGeometry({
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    attributes: {
      aSize: new Float32Array(sizes),
      aOpacity: new Float32Array(opacities),
      aPhase: new Float32Array(phases),
      aRotation: new Float32Array(rotations),
      aStretch: new Float32Array(stretches)
    }
  });
  const material = createWispPointMaterial({
    opacity: PARAMETERS.wisps.alpha,
    pointScale: 26,
    debugGain
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'ArmEdgeWisps';
  points.renderOrder = -4;
  points.frustumCulled = false;

  return {
    points,
    count: sizes.length,
    update(time, journeyOpacity) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createForegroundDust(debugGain = 1) {
  const random = createSeededRandom(7719021);
  const count = PARAMETERS.foregroundDust.count;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const phases = new Float32Array(count);
  const twinkles = new Float32Array(count);
  const clusters = [
    { center: new THREE.Vector2(0.62, 0.49), spread: new THREE.Vector2(0.17, 0.1), weight: 0.5 },
    { center: new THREE.Vector2(-0.47, 0.16), spread: new THREE.Vector2(0.12, 0.07), weight: 0.28 },
    { center: new THREE.Vector2(0.08, 0.58), spread: new THREE.Vector2(0.14, 0.07), weight: 0.22 }
  ];
  const palette = [
    new THREE.Color(0xbfe8ff),
    new THREE.Color(0x7fbce4),
    new THREE.Color(0x6077b5)
  ];
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const roll = random();
    const cluster = roll < clusters[0].weight
      ? clusters[0]
      : roll < clusters[0].weight + clusters[1].weight
        ? clusters[1]
        : clusters[2];
    const radial = Math.sqrt(random());
    const angle = random() * TAU;
    const x = cluster.center.x + Math.cos(angle) * cluster.spread.x * radial;
    const y = cluster.center.y + Math.sin(angle) * cluster.spread.y * radial;

    positions.set([x, y, 0.1 + random() * 0.12], index * 3);
    color.copy(palette[Math.floor(random() * palette.length)]);
    color.multiplyScalar(0.3 + random() * 0.3);
    colors.set([color.r, color.g, color.b], index * 3);
    sizes[index] = 0.78 + random() * 1.22;
    opacities[index] = 0.18 + random() * 0.48;
    phases[index] = random() * TAU;
    twinkles[index] = random() < 0.05 ? 0.2 + random() * 0.22 : 0;
  }

  const geometry = createPointGeometry({
    positions,
    colors,
    attributes: {
      aSize: sizes,
      aOpacity: opacities,
      aPhase: phases,
      aTwinkle: twinkles
    }
  });
  const material = createStarPointMaterial({
    opacity: PARAMETERS.foregroundDust.alpha,
    pointScale: 24,
    blending: THREE.NormalBlending,
    debugGain
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'ForegroundDust';
  points.renderOrder = 3;
  points.frustumCulled = false;

  return {
    points,
    update(time, journeyOpacity, interaction) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
      points.position.x = (interaction?.parallaxX ?? 0) * PARAMETERS.foregroundDust.parallaxX;
      points.position.y = (interaction?.parallaxY ?? 0) * PARAMETERS.foregroundDust.parallaxY;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createPointGeometry({ positions, colors, attributes }) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  Object.entries(attributes).forEach(([name, values]) => {
    geometry.setAttribute(name, new THREE.BufferAttribute(values, 1));
  });
  geometry.computeBoundingSphere();
  return geometry;
}

function createStarPointMaterial({ opacity, pointScale, blending, debugGain = 1 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uDebugGain: { value: debugGain },
      uJourneyOpacity: { value: 1 },
      uPointScale: { value: pointScale }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute float aPhase;
      attribute float aTwinkle;
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uTime;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 1.0 + sin(uTime * 0.86 + aPhase) * aTwinkle;
        vColor = color;
        vOpacity = aOpacity * twinkle;
        gl_PointSize = clamp(aSize * uPointScale / max(-viewPosition.z, 1.0), 0.65, 3.8);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uOpacity;
      uniform float uDebugGain;
      uniform float uJourneyOpacity;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered) * 2.0;
        if (radius >= 1.0) discard;
        float core = 1.0 - smoothstep(0.0, 0.34, radius);
        float halo = 1.0 - smoothstep(0.12, 1.0, radius);
        float alpha = (core * 0.74 + halo * 0.26)
          * vOpacity
          * uOpacity
          * uDebugGain
          * uJourneyOpacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
}

function createWispPointMaterial({ opacity, pointScale, debugGain = 1 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uDebugGain: { value: debugGain },
      uJourneyOpacity: { value: 1 },
      uPointScale: { value: pointScale }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute float aPhase;
      attribute float aRotation;
      attribute float aStretch;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vRotation;
      varying float vStretch;
      uniform float uTime;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vOpacity = aOpacity * (0.92 + sin(uTime * 0.18 + aPhase) * 0.08);
        vRotation = aRotation;
        vStretch = aStretch;
        gl_PointSize = clamp(aSize * aStretch * uPointScale / max(-viewPosition.z, 1.0), 1.2, 7.5);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      varying float vRotation;
      varying float vStretch;
      uniform float uOpacity;
      uniform float uDebugGain;
      uniform float uJourneyOpacity;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float sine = sin(vRotation);
        float cosine = cos(vRotation);
        vec2 rotated = mat2(cosine, -sine, sine, cosine) * centered;
        vec2 stretched = vec2(rotated.x, rotated.y * vStretch);
        float radius = length(stretched) * 2.0;
        if (radius >= 1.0) discard;
        float alpha = (1.0 - smoothstep(0.08, 1.0, radius))
          * vOpacity
          * uOpacity
          * uDebugGain
          * uJourneyOpacity;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
}

function quadraticBezier(target, start, control, end, t) {
  const oneMinusT = 1 - t;

  target.set(
    oneMinusT * oneMinusT * start.x
      + 2 * oneMinusT * t * control.x
      + t * t * end.x,
    oneMinusT * oneMinusT * start.y
      + 2 * oneMinusT * t * control.y
      + t * t * end.y
  );
}

function quadraticBezierTangent(target, start, control, end, t) {
  target.set(
    2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x),
    2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y)
  ).normalize();
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6D2B79F5;
    let value = state;

    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function smootherstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return t * t * t * (t * (t * 6 - 15) + 10);
}

export const galaxyAtmosphereFactory = {
  createGalaxyAtmosphere,
  readGalaxyAtmosphereDebugState
};
