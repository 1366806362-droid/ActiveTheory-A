import * as THREE from 'three';

const PARTICLE_COUNT = 35000;
const CORE_PARTICLE_COUNT = 3800;
const EDGE_EXTENSION_RATIO = 0.12;
const EDGE_SAMPLE_REDUCTION = 0.2;
const CLOUD_PARTICLE_COUNT = 1100;
const SUPPORTED_MODES = new Set([
  'front',
  'tilt',
  'side',
  'particlesOnly',
  'coreOnly',
  'cloudsOnly'
]);
const TEXTURE_URLS = Object.freeze({
  arms: '/textures/hero/galaxy-volume-preview-v3/galaxy-arms.webp',
  stars: '/textures/hero/galaxy-volume-preview-v3/galaxy-stars.webp',
  edge: '/textures/hero/galaxy-volume-preview-v3/galaxy-edge.webp'
});
const CLOUD_REGIONS = Object.freeze([
  Object.freeze({ centerDegrees: 34, halfWidthDegrees: 19 }),
  Object.freeze({ centerDegrees: 82, halfWidthDegrees: 15 }),
  Object.freeze({ centerDegrees: 136, halfWidthDegrees: 17 }),
  Object.freeze({ centerDegrees: 174, halfWidthDegrees: 18 }),
  Object.freeze({ centerDegrees: -118, halfWidthDegrees: 17 }),
  Object.freeze({ centerDegrees: -72, halfWidthDegrees: 14 }),
  Object.freeze({ centerDegrees: -36, halfWidthDegrees: 19 })
]);
const EDGE_EXTENSION_REGIONS = Object.freeze([
  Object.freeze({ centerDegrees: 35, halfWidthDegrees: 23, tangentSign: 1 }),
  Object.freeze({ centerDegrees: 157, halfWidthDegrees: 20, tangentSign: -1 }),
  Object.freeze({ centerDegrees: -43, halfWidthDegrees: 22, tangentSign: 1 }),
  Object.freeze({ centerDegrees: -119, halfWidthDegrees: 18, tangentSign: -1 })
]);

let didWarnParticleVolumeFailure = false;

export function readGalaxyParticleVolumePreviewState() {
  if (typeof window === 'undefined') {
    return Object.freeze({ enabled: false, mode: 'front' });
  }

  const params = new URLSearchParams(window.location.search);
  const enabled = import.meta.env.DEV
    && params.get('galaxyVolumePreview') === 'particle-poc';
  const requestedMode = params.get('mode') || 'front';

  return Object.freeze({
    enabled,
    mode: SUPPORTED_MODES.has(requestedMode) ? requestedMode : 'front'
  });
}

export function createGalaxyParticleVolume({
  textureLayer = {},
  previewState = Object.freeze({ enabled: false, mode: 'front' })
} = {}) {
  if (!previewState.enabled) return null;

  const extent = (textureLayer.outerRadius ?? 0.78) * (textureLayer.extentScale ?? 2.7);
  const group = new THREE.Group();
  const textureLoader = new THREE.TextureLoader();
  const listeners = new Set();
  const stars = createStarVolume();
  const clouds = createCloudVolume();
  let status = 'loading';
  let error = null;
  let disposed = false;
  let loadGeneration = 1;
  let textureLoadCount = 0;
  let journeyOpacity = 1;
  let activeMode = previewState.mode;
  let frameCount = 0;
  let fpsWindowStart = performance.now();
  let measuredFps = 0;
  let phase = 0;

  group.name = 'GalaxyParticleVolumeGroup';
  group.position.z = textureLayer.localPositionZ ?? 0;
  group.scale.setScalar(textureLayer.localScale ?? 1);
  group.rotation.set(
    textureLayer.localRotationX ?? 0,
    textureLayer.localRotationY ?? 0,
    textureLayer.localRotationZ ?? 0
  );
  group.visible = false;
  group.add(clouds.points, stars.points);
  void loadSources();
  publishDiagnostics();

  function loadTexture(key, url) {
    return new Promise((resolve, reject) => {
      textureLoader.load(url, (texture) => resolve({ key, texture }), undefined, reject);
    });
  }

  async function loadSources() {
    const generation = loadGeneration;

    try {
      const loaded = await Promise.all(Object.entries(TEXTURE_URLS).map(
        ([key, url]) => loadTexture(key, url)
      ));

      if (disposed || generation !== loadGeneration) {
        loaded.forEach(({ texture }) => texture.dispose());
        return;
      }

      const textures = Object.fromEntries(loaded.map(({ key, texture }) => [key, texture]));
      loaded.forEach(({ texture }) => configureTexture(texture));
      const sources = {
        arms: readTextureSamples(textures.arms.image, 'arms'),
        stars: readTextureSamples(textures.stars.image, 'stars'),
        edge: readTextureSamples(textures.edge.image, 'edge')
      };

      stars.build(sources, extent);
      clouds.build(sources.arms, extent);
      loaded.forEach(({ texture }) => texture.dispose());
      textureLoadCount = loaded.length;
      status = 'ready';
      error = null;
      applyMode(activeMode);
      emitStatus();
      publishDiagnostics();
    } catch (loadError) {
      if (disposed || generation !== loadGeneration) return;

      status = 'error';
      error = loadError;
      group.visible = false;
      if (!didWarnParticleVolumeFailure) {
        didWarnParticleVolumeFailure = true;
        console.warn(
          '[ActiveTheory] Galaxy particle volume POC failed; keeping the stable V2.4 galaxy.',
          loadError
        );
      }
      emitStatus();
      publishDiagnostics();
    }
  }

  function applyMode(mode = 'front') {
    activeMode = SUPPORTED_MODES.has(mode) ? mode : 'front';
    const ready = status === 'ready';

    group.visible = ready;
    stars.points.visible = ready && activeMode !== 'cloudsOnly';
    clouds.points.visible = ready
      && activeMode !== 'particlesOnly'
      && activeMode !== 'coreOnly';
    stars.setLayerMode(activeMode === 'coreOnly' ? 'coreOnly' : 'combined');
    group.rotation.set(
      textureLayer.localRotationX ?? 0,
      textureLayer.localRotationY ?? 0,
      textureLayer.localRotationZ ?? 0
    );
    if (activeMode === 'tilt') {
      group.rotation.x += THREE.MathUtils.degToRad(26);
    } else if (activeMode === 'side') {
      group.rotation.y += THREE.MathUtils.degToRad(82);
    }
  }

  function update(delta, time, interaction, journeyProgress = 0) {
    if (disposed || status !== 'ready') return;

    phase += delta * 0.00016;
    journeyOpacity = 1 - smootherstep(0.18, 0.72, journeyProgress);
    const parallaxX = interaction?.parallaxX ?? 0;
    const parallaxY = interaction?.parallaxY ?? 0;

    stars.update(time, phase, journeyOpacity, parallaxX, parallaxY);
    clouds.update(time, phase * 0.93, journeyOpacity, parallaxX, parallaxY);
    updateFps();
  }

  function updateFps() {
    frameCount += 1;
    const now = performance.now();
    const elapsed = now - fpsWindowStart;

    if (elapsed < 2000) return;
    measuredFps = frameCount * 1000 / elapsed;
    frameCount = 0;
    fpsWindowStart = now;
    publishDiagnostics();
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener({ status, error });
    return () => listeners.delete(listener);
  }

  function emitStatus() {
    listeners.forEach((listener) => listener({ status, error }));
  }

  function publishDiagnostics() {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;

    const diagnostics = {
      enabled: true,
      mode: activeMode,
      status,
      error: error ? String(error) : null,
      instanceUuid: group.uuid,
      phase,
      journeyOpacity,
      fps: measuredFps,
      textureLoadCount,
      atomicReady: status === 'ready' && textureLoadCount === 3,
      stars: stars.getDiagnostics(),
      clouds: clouds.getDiagnostics(),
      resources: {
        groups: 1,
        points: 2,
        geometries: 2,
        materials: 2,
        sourceTexturesResident: 0
      }
    };

    window.__ACTIVE_THEORY_GALAXY_PARTICLE_VOLUME__ = diagnostics;
    document.documentElement.dataset.galaxyParticleVolumeDiagnostics = JSON.stringify(
      diagnostics
    );
  }

  function dispose() {
    if (disposed) return;

    disposed = true;
    loadGeneration += 1;
    listeners.clear();
    stars.dispose();
    clouds.dispose();
    group.clear();
    if (typeof window !== 'undefined') {
      delete window.__ACTIVE_THEORY_GALAXY_PARTICLE_VOLUME__;
      delete document.documentElement.dataset.galaxyParticleVolumeDiagnostics;
    }
  }

  return {
    group,
    previewState,
    subscribe,
    applyMode,
    update,
    dispose,
    isReady: () => status === 'ready',
    getStatus: () => status,
    getFps: () => measuredFps
  };
}

function createStarVolume() {
  let geometry = new THREE.BufferGeometry();
  const material = createStarMaterial();
  const points = new THREE.Points(geometry, material);
  let diagnostics = {
    count: 0,
    tiers: { micro: 0, medium: 0, highlight: 0 },
    zThickness: { core: 0.07, middle: 0.045, outer: 0.025, clusters: 0.1 },
    geometryUuid: geometry.uuid,
    materialUuid: material.uuid,
    uuid: points.uuid
  };

  points.name = 'GalaxyParticleVolumeStars';
  points.renderOrder = -5.8;
  points.frustumCulled = false;
  points.visible = false;

  function build(sources, extent) {
    const random = createSeededRandom(73191);
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const opacities = new Float32Array(PARTICLE_COUNT);
    const layers = new Float32Array(PARTICLE_COUNT);
    const tierCounts = { micro: 0, medium: 0, highlight: 0 };
    const depthCounts = { rear: 0, mid: 0, front: 0 };
    const extensionCount = Math.round(PARTICLE_COUNT * EDGE_EXTENSION_RATIO);
    const coreSamples = [...sources.arms, ...sources.stars].filter(
      (sample) => sample.radius < 0.27
    );
    const innerArmSamples = sources.arms.filter(
      (sample) => sample.radius >= 0.18 && sample.radius < 0.38
    );
    const reducedEdgeSamples = sources.edge.filter(
      (sample) => edgeSampleHash(sample) >= EDGE_SAMPLE_REDUCTION
    );
    const edgeRegionSamples = EDGE_EXTENSION_REGIONS.map((region) => (
      reducedEdgeSamples.filter((sample) => (
        angularDistanceDegrees(sample.angleDegrees, region.centerDegrees)
          <= region.halfWidthDegrees
      ))
    ));
    const color = new THREE.Color();
    const coolWhite = new THREE.Color(0xdff5ff);
    const deepBlue = new THREE.Color(0x234f88);
    const warmCore = new THREE.Color(0xffd4a0);

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const tierRoll = random();
      const tier = tierRoll < 0.8 ? 'micro' : tierRoll < 0.97 ? 'medium' : 'highlight';
      const isCore = index < CORE_PARTICLE_COUNT;
      const isExtendedEdge = index >= PARTICLE_COUNT - extensionCount;
      const extensionRegionIndex = isExtendedEdge
        ? (index - (PARTICLE_COUNT - extensionCount)) % EDGE_EXTENSION_REGIONS.length
        : -1;
      const sample = isCore
        ? chooseCoreSample(coreSamples, innerArmSamples, random)
        : isExtendedEdge
          ? pickWeightedSample(
            edgeRegionSamples[extensionRegionIndex].length > 0
              ? edgeRegionSamples[extensionRegionIndex]
              : reducedEdgeSamples,
            random
          )
          : chooseStarSample(sources, tier, random);
      let x = (sample.u - 0.5) * extent;
      let y = (sample.v - 0.5) * extent;

      if (isExtendedEdge) {
        const region = EDGE_EXTENSION_REGIONS[extensionRegionIndex];
        const extension = extendAlongArmTangent(sample, region, extent, random);
        x += extension.x;
        y += extension.y;
      }
      const radius = normalizedRadius(sample.u, sample.v);
      const cluster = tier === 'highlight' && sample.source === 'stars';
      const halfThickness = cluster
        ? 0.1
        : radius < 0.24
          ? 0.07
          : radius < 0.72
            ? 0.045
            : 0.025;
      const zNoise = signedBellNoise(random);
      const z = zNoise * halfThickness;
      const normalizedZ = z / Math.max(halfThickness, 0.001);
      const depth = normalizedZ > 0.2 ? 'front' : normalizedZ < -0.2 ? 'rear' : 'mid';
      const depthSize = depth === 'front' ? 1.2 : depth === 'rear' ? 0.8 : 1;
      const depthAlpha = depth === 'front' ? 1.12 : depth === 'rear' ? 0.84 : 1;

      positions.set([x, y, z], index * 3);
      color.setRGB(sample.r, sample.g, sample.b, THREE.SRGBColorSpace);
      if (isCore) {
        color.lerp(warmCore, 0.16 + random() * 0.12);
        if (random() < 0.12) color.lerp(coolWhite, 0.12);
      }
      if (tier === 'highlight') {
        color.lerp(coolWhite, 0.1 + random() * 0.14);
      }
      if (depth === 'front') color.lerp(coolWhite, 0.055 + random() * 0.035);
      if (depth === 'rear') color.lerp(deepBlue, 0.11 + random() * 0.055);
      color.multiplyScalar(tier === 'micro'
        ? 0.54 + random() * 0.24
        : tier === 'medium'
          ? 0.7 + random() * 0.25
          : 0.82 + random() * 0.17);
      colors.set([color.r, color.g, color.b], index * 3);
      sizes[index] = (tier === 'micro'
        ? 0.22 + random() * 0.25
        : tier === 'medium'
          ? 0.56 + random() * 0.38
          : 1.05 + random() * 0.62) * depthSize;
      opacities[index] = (tier === 'micro'
        ? 0.15 + random() * 0.2
        : tier === 'medium'
          ? 0.28 + random() * 0.27
          : 0.45 + random() * 0.27) * depthAlpha;
      layers[index] = isCore ? 1 : 0;
      tierCounts[tier] += 1;
      depthCounts[depth] += 1;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    nextGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    nextGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    nextGeometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
    nextGeometry.computeBoundingSphere();
    geometry.dispose();
    geometry = nextGeometry;
    points.geometry = geometry;
    diagnostics = {
      count: PARTICLE_COUNT,
      tiers: tierCounts,
      tierPercent: { micro: 80, medium: 17, highlight: 3 },
      zThickness: { core: 0.07, middle: 0.045, outer: 0.025, clusters: 0.1 },
      depthCounts,
      depthStyle: {
        rear: { size: 0.8, alpha: 0.84 },
        mid: { size: 1, alpha: 1 },
        front: { size: 1.2, alpha: 1.12 }
      },
      coreParticles: CORE_PARTICLE_COUNT,
      edgeSampleReduction: EDGE_SAMPLE_REDUCTION,
      edgeExtensionRatio: EDGE_EXTENSION_RATIO,
      edgeExtensionCount: extensionCount,
      edgeExtensionRegions: EDGE_EXTENSION_REGIONS.length,
      geometryUuid: geometry.uuid,
      materialUuid: material.uuid,
      uuid: points.uuid
    };
  }

  return {
    points,
    build,
    setLayerMode(mode) {
      material.uniforms.uCoreOnly.value = mode === 'coreOnly' ? 1 : 0;
    },
    update(time, rotation, opacity, parallaxX, parallaxY) {
      material.uniforms.uTime.value = time;
      material.uniforms.uRotation.value = rotation;
      material.uniforms.uJourneyOpacity.value = opacity;
      material.uniforms.uParallax.value.set(parallaxX, parallaxY);
    },
    getDiagnostics: () => ({ ...diagnostics, visible: points.visible }),
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createCloudVolume() {
  let geometry = new THREE.BufferGeometry();
  const material = createCloudMaterial();
  const points = new THREE.Points(geometry, material);
  let diagnostics = {
    regions: CLOUD_REGIONS.length,
    count: 0,
    zRange: [-0.06, 0.06],
    geometryUuid: geometry.uuid,
    materialUuid: material.uuid,
    uuid: points.uuid
  };

  points.name = 'GalaxyVolumeClouds';
  points.renderOrder = -6.1;
  points.frustumCulled = false;
  points.visible = false;

  function build(armSamples, extent) {
    const regionSamples = CLOUD_REGIONS.map((region) => armSamples.filter((sample) => (
      angularDistanceDegrees(sample.angleDegrees, region.centerDegrees)
        <= region.halfWidthDegrees
      && sample.radius > 0.24
      && sample.radius < 0.9
    )));
    const random = createSeededRandom(91247);
    const positions = new Float32Array(CLOUD_PARTICLE_COUNT * 3);
    const colors = new Float32Array(CLOUD_PARTICLE_COUNT * 3);
    const sizes = new Float32Array(CLOUD_PARTICLE_COUNT);
    const opacities = new Float32Array(CLOUD_PARTICLE_COUNT);
    const color = new THREE.Color();

    for (let index = 0; index < CLOUD_PARTICLE_COUNT; index += 1) {
      const regionIndex = index % CLOUD_REGIONS.length;
      const candidates = regionSamples[regionIndex].length > 0
        ? regionSamples[regionIndex]
        : armSamples;
      const sample = pickWeightedSample(candidates, random);
      const x = (sample.u - 0.5) * extent + (random() - 0.5) * 0.022;
      const y = (sample.v - 0.5) * extent + (random() - 0.5) * 0.022;
      const z = signedBellNoise(random) * 0.06;
      const depthSize = z > 0.012 ? 1.14 : z < -0.012 ? 0.84 : 1;
      const depthAlpha = z > 0.012 ? 1.08 : z < -0.012 ? 0.87 : 1;

      positions.set([x, y, z], index * 3);
      color.setRGB(sample.r, sample.g, sample.b, THREE.SRGBColorSpace)
        .lerp(new THREE.Color(0x6aaee8), 0.18 + random() * 0.24)
        .multiplyScalar(0.36 + random() * 0.24);
      if (z < -0.012) color.lerp(new THREE.Color(0x173b74), 0.12);
      colors.set([color.r, color.g, color.b], index * 3);
      sizes[index] = (1.1 + random() * 1.75) * depthSize;
      opacities[index] = (0.016 + random() * 0.034) * depthAlpha;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    nextGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    nextGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    nextGeometry.computeBoundingSphere();
    geometry.dispose();
    geometry = nextGeometry;
    points.geometry = geometry;
    diagnostics = {
      regions: CLOUD_REGIONS.length,
      count: CLOUD_PARTICLE_COUNT,
      zRange: [-0.06, 0.06],
      depthStyle: {
        rear: { size: 0.84, alpha: 0.87 },
        mid: { size: 1, alpha: 1 },
        front: { size: 1.14, alpha: 1.08 }
      },
      geometryUuid: geometry.uuid,
      materialUuid: material.uuid,
      uuid: points.uuid
    };
  }

  return {
    points,
    build,
    update(time, rotation, opacity, parallaxX, parallaxY) {
      material.uniforms.uTime.value = time;
      material.uniforms.uRotation.value = rotation;
      material.uniforms.uJourneyOpacity.value = opacity;
      material.uniforms.uParallax.value.set(parallaxX, parallaxY);
    },
    getDiagnostics: () => ({ ...diagnostics, visible: points.visible }),
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function readTextureSamples(image, source) {
  const sampleSize = 512;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  canvas.width = sampleSize;
  canvas.height = sampleSize;
  context.clearRect(0, 0, sampleSize, sampleSize);
  context.drawImage(image, 0, 0, sampleSize, sampleSize);
  const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
  const samples = [];

  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const offset = (y * sampleSize + x) * 4;
      const alpha = pixels[offset + 3] / 255;

      if (alpha < (source === 'stars' ? 0.035 : 0.02)) continue;
      const r = pixels[offset] / 255;
      const g = pixels[offset + 1] / 255;
      const b = pixels[offset + 2] / 255;
      const u = x / (sampleSize - 1);
      const v = 1 - y / (sampleSize - 1);
      const brightness = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const radius = normalizedRadius(u, v);

      samples.push({
        u,
        v,
        r,
        g,
        b,
        a: alpha,
        brightness,
        radius,
        angleDegrees: THREE.MathUtils.radToDeg(Math.atan2(v - 0.5, u - 0.5)),
        source,
        weight: Math.max(alpha * (0.18 + brightness * 0.82), 0.01)
      });
    }
  }
  return samples;
}

function chooseStarSample(sources, tier, random) {
  if (tier === 'highlight') {
    return pickWeightedSample(random() < 0.78 ? sources.stars : sources.arms, random);
  }
  if (tier === 'medium') {
    const roll = random();
    return pickWeightedSample(
      roll < 0.68 ? sources.arms : roll < 0.88 ? sources.stars : sources.edge,
      random
    );
  }
  return pickWeightedSample(random() < 0.87 ? sources.arms : sources.edge, random);
}

function chooseCoreSample(coreSamples, innerArmSamples, random) {
  const candidates = random() < 0.82 ? coreSamples : innerArmSamples;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const sample = pickWeightedSample(candidates, random);
    const centerBias = Math.max(1 - sample.radius, 0.08);

    if (random() < centerBias * centerBias * 1.35) return sample;
  }
  return pickWeightedSample(candidates, random);
}

function edgeSampleHash(sample) {
  const value = Math.sin(
    sample.u * 127.1 + sample.v * 311.7 + sample.brightness * 74.7
  ) * 43758.5453;

  return value - Math.floor(value);
}

function extendAlongArmTangent(sample, region, extent, random) {
  const radialX = sample.u - 0.5;
  const radialY = sample.v - 0.5;
  const radialLength = Math.max(Math.hypot(radialX, radialY), 0.001);
  const normalizedRadialX = radialX / radialLength;
  const normalizedRadialY = radialY / radialLength;
  const tangentX = -normalizedRadialY * region.tangentSign;
  const tangentY = normalizedRadialX * region.tangentSign;
  const distance = extent * (0.012 + Math.pow(random(), 1.7) * 0.058);
  const lateralJitter = (random() - 0.5) * extent * 0.012;

  return {
    x: (tangentX * 0.82 + normalizedRadialX * 0.18) * distance
      + normalizedRadialX * lateralJitter,
    y: (tangentY * 0.82 + normalizedRadialY * 0.18) * distance
      + normalizedRadialY * lateralJitter
  };
}

function pickWeightedSample(samples, random) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const sample = samples[Math.floor(random() * samples.length)];

    if (random() <= Math.min(sample.weight * 1.6, 1)) return sample;
  }
  return samples[Math.floor(random() * samples.length)];
}

function normalizedRadius(u, v) {
  return Math.hypot((u - 0.5) / 0.46, (v - 0.5) / 0.36);
}

function signedBellNoise(random) {
  return ((random() + random() + random()) / 3 - 0.5) * 2;
}

function angularDistanceDegrees(first, second) {
  return Math.abs(((first - second + 540) % 360) - 180);
}

function configureTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
}

function createStarMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRotation: { value: 0 },
      uJourneyOpacity: { value: 1 },
      uParallax: { value: new THREE.Vector2() },
      uCoreOnly: { value: 0 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute float aLayer;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vLayer;
      uniform float uTime;
      uniform float uRotation;
      uniform vec2 uParallax;

      void main() {
        float differentialAngle = uRotation;
        float rotationSin = sin(differentialAngle);
        float rotationCos = cos(differentialAngle);
        vec3 rotatedPosition = position;
        rotatedPosition.xy = mat2(
          rotationCos, -rotationSin,
          rotationSin, rotationCos
        ) * position.xy;
        rotatedPosition.xy += vec2(uParallax.x, -uParallax.y)
          * rotatedPosition.z * 0.27;
        vec4 viewPosition = modelViewMatrix * vec4(rotatedPosition, 1.0);
        vColor = color;
        vOpacity = aOpacity;
        vLayer = aLayer;
        gl_PointSize = clamp(aSize * 16.0 / max(-viewPosition.z, 1.0), 0.45, 4.2);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      varying float vLayer;
      uniform float uJourneyOpacity;
      uniform float uCoreOnly;

      void main() {
        if (uCoreOnly > 0.5 && vLayer < 0.5) discard;
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered) * 2.0;
        if (radius >= 1.0) discard;
        float core = 1.0 - smoothstep(0.0, 0.32, radius);
        float halo = 1.0 - smoothstep(0.12, 1.0, radius);
        float alpha = (core * 0.58 + halo * 0.42)
          * vOpacity
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

function createCloudMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRotation: { value: 0 },
      uJourneyOpacity: { value: 1 },
      uParallax: { value: new THREE.Vector2() }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uTime;
      uniform float uRotation;
      uniform vec2 uParallax;

      void main() {
        float rotationSin = sin(uRotation);
        float rotationCos = cos(uRotation);
        vec3 rotatedPosition = position;
        rotatedPosition.xy = mat2(
          rotationCos, -rotationSin,
          rotationSin, rotationCos
        ) * position.xy;
        rotatedPosition.xy += vec2(uParallax.x, -uParallax.y)
          * rotatedPosition.z * 0.18;
        vec4 viewPosition = modelViewMatrix * vec4(rotatedPosition, 1.0);
        vColor = color;
        vOpacity = aOpacity;
        gl_PointSize = clamp(aSize * 76.0 / max(-viewPosition.z, 1.0), 5.0, 36.0);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uJourneyOpacity;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered) * 2.0;
        if (radius >= 1.0) discard;
        float alpha = pow(1.0 - smoothstep(0.0, 1.0, radius), 2.2)
          * vOpacity
          * 0.62
          * uJourneyOpacity;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
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

export const galaxyParticleVolumeFactory = {
  createGalaxyParticleVolume,
  readGalaxyParticleVolumePreviewState
};
