import * as THREE from 'three';
import { getCamera } from '../engine/camera.js';

const TAU = Math.PI * 2;
const SUPPORTED_MODES = new Set([
  'haze',
  'arms',
  'dust',
  'core',
  'stars',
  'edge',
  'combined',
  'sideView'
]);

const LAYER_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'haze',
    name: 'GalaxyVolumeRearHaze',
    url: '/textures/hero/galaxy-volume-preview-v3/galaxy-haze.webp',
    z: -0.08,
    scale: 1.07,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    blendingName: 'AdditiveBlending',
    rotationMultiplier: 0.9996,
    parallaxPixels: 1.6,
    renderOrder: -7.8
  }),
  Object.freeze({
    key: 'arms',
    name: 'GalaxyVolumeMainArms',
    url: '/textures/hero/galaxy-volume-preview-v3/galaxy-arms.webp',
    z: -0.015,
    scale: 1,
    opacity: 0.86,
    blending: THREE.NormalBlending,
    blendingName: 'NormalBlending',
    rotationMultiplier: 1,
    parallaxPixels: 0,
    renderOrder: -7.5
  }),
  Object.freeze({
    key: 'dust',
    name: 'GalaxyVolumeDust',
    url: '/textures/hero/galaxy-volume-preview-v3/galaxy-dust.webp',
    z: 0.01,
    scale: 1.005,
    opacity: 0.44,
    blending: THREE.NormalBlending,
    blendingName: 'NormalBlending',
    rotationMultiplier: 1,
    parallaxPixels: 0.4,
    renderOrder: -7.2
  }),
  Object.freeze({
    key: 'core',
    name: 'GalaxyVolumeCore',
    url: '/textures/hero/galaxy-volume-preview-v3/galaxy-core.webp',
    z: 0.035,
    scale: 0.995,
    opacity: 0.62,
    blending: THREE.NormalBlending,
    blendingName: 'NormalBlending',
    rotationMultiplier: 1,
    parallaxPixels: 0.3,
    renderOrder: -6.9
  }),
  Object.freeze({
    key: 'stars',
    name: 'GalaxyVolumeStars',
    url: '/textures/hero/galaxy-volume-preview-v3/galaxy-stars.webp',
    z: 0.065,
    scale: 1.01,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    blendingName: 'AdditiveBlending',
    rotationMultiplier: 1.0003,
    parallaxPixels: 1.6,
    renderOrder: -6.6
  }),
  Object.freeze({
    key: 'edge',
    name: 'GalaxyVolumeEdge',
    url: '/textures/hero/galaxy-volume-preview-v3/galaxy-edge.webp',
    z: 0.09,
    scale: 1.025,
    opacity: 0.28,
    blending: THREE.NormalBlending,
    blendingName: 'NormalBlending',
    rotationMultiplier: 1.0005,
    parallaxPixels: 2.6,
    renderOrder: -6.3
  })
]);

const EDGE_REGIONS = Object.freeze([
  Object.freeze({ name: 'rightUpper', centerDegrees: 43, halfWidthDegrees: 40 }),
  Object.freeze({ name: 'rightLower', centerDegrees: -38, halfWidthDegrees: 30 }),
  Object.freeze({ name: 'leftShort', centerDegrees: -168, halfWidthDegrees: 34 }),
  Object.freeze({ name: 'upperLeftFragment', centerDegrees: 126, halfWidthDegrees: 23 })
]);

let didWarnGalaxyVolumeLoadFailure = false;

export function readGalaxyVolumePreviewState() {
  if (typeof window === 'undefined') {
    return Object.freeze({ enabled: false, mode: 'combined' });
  }

  const params = new URLSearchParams(window.location.search);
  const enabled = import.meta.env.DEV && params.get('galaxyVolumePreview') === '1';
  const requestedMode = params.get('mode') || 'combined';

  return Object.freeze({
    enabled,
    mode: SUPPORTED_MODES.has(requestedMode) ? requestedMode : 'combined'
  });
}

export function createGalaxyVolumeLayer({
  textureLayer = {},
  previewState = Object.freeze({ enabled: false, mode: 'combined' })
} = {}) {
  if (!previewState.enabled) return null;

  const extent = (textureLayer.outerRadius ?? 0.78) * (textureLayer.extentScale ?? 2.7);
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(extent, extent, 1, 1);
  const textureLoader = new THREE.TextureLoader();
  const layers = new Map();
  const listeners = new Set();
  const edgeParticles = createVolumeEdgeParticles(extent);
  const projectionState = createProjectionState();
  let status = 'loading';
  let error = null;
  let loadGeneration = 1;
  let textureLoadCount = 0;
  let phase = 0;
  let journeyOpacity = 1;
  let disposed = false;
  let frameCount = 0;
  let fpsWindowStart = performance.now();
  let measuredFps = 0;
  let activeMode = previewState.mode;

  group.name = 'GalaxyVolumeGroup';
  group.position.z = textureLayer.localPositionZ ?? 0;
  group.scale.setScalar(textureLayer.localScale ?? 1);
  group.rotation.set(
    textureLayer.localRotationX ?? 0,
    textureLayer.localRotationY ?? 0,
    textureLayer.localRotationZ ?? 0
  );
  group.visible = false;

  LAYER_DEFINITIONS.forEach((definition) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0,
      transparent: true,
      blending: definition.blending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: true,
      premultipliedAlpha: false
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.name = definition.name;
    mesh.position.z = definition.z;
    mesh.scale.setScalar(definition.scale);
    mesh.renderOrder = definition.renderOrder;
    mesh.frustumCulled = false;
    mesh.visible = false;
    layers.set(definition.key, { definition, mesh, material, texture: null });
    group.add(mesh);
  });

  group.add(edgeParticles.points);
  void loadAllTextures();
  publishDiagnostics();

  function loadTexture(definition) {
    return new Promise((resolve, reject) => {
      textureLoader.load(
        definition.url,
        (texture) => resolve({ definition, texture }),
        undefined,
        reject
      );
    });
  }

  async function loadAllTextures() {
    const generation = loadGeneration;

    try {
      const loaded = await Promise.all(LAYER_DEFINITIONS.map(loadTexture));

      if (disposed || generation !== loadGeneration) {
        loaded.forEach(({ texture }) => texture.dispose());
        return;
      }

      loaded.forEach(({ definition, texture }) => {
        configureTexture(texture);
        const layer = layers.get(definition.key);

        layer.texture = texture;
        layer.material.map = texture;
        layer.material.needsUpdate = true;
      });
      edgeParticles.setSourceImage(layers.get('edge').texture.image);
      textureLoadCount = loaded.length;
      status = 'ready';
      error = null;
      applyMode(activeMode);
      emitStatus();
      publishDiagnostics();
    } catch (loadError) {
      if (disposed || generation !== loadGeneration) return;

      layers.forEach(({ material, texture }) => {
        material.map = null;
        texture?.dispose();
      });
      textureLoadCount = 0;
      status = 'error';
      error = loadError;
      group.visible = false;
      if (!didWarnGalaxyVolumeLoadFailure) {
        didWarnGalaxyVolumeLoadFailure = true;
        console.warn(
          '[ActiveTheory] Galaxy volume preview failed to load atomically; keeping the stable V2.4 texture.',
          loadError
        );
      }
      emitStatus();
      publishDiagnostics();
    }
  }

  function applyMode(mode = 'combined') {
    activeMode = SUPPORTED_MODES.has(mode) ? mode : 'combined';
    const ready = status === 'ready';
    const showAll = activeMode === 'combined' || activeMode === 'sideView';
    const sideView = activeMode === 'sideView';

    group.visible = ready;
    layers.forEach(({ definition, mesh, material, texture }) => {
      mesh.visible = ready && Boolean(texture) && (showAll || activeMode === definition.key);
      mesh.position.x = 0;
      mesh.position.y = 0;
      mesh.position.z = definition.z * (sideView ? 5.5 : 1);
      material.opacity = definition.opacity * journeyOpacity * (sideView ? 1.1 : 1);
    });
    edgeParticles.points.visible = ready
      && !sideView
      && (activeMode === 'combined' || activeMode === 'edge');
    group.rotation.y = sideView
      ? THREE.MathUtils.degToRad(74)
      : (textureLayer.localRotationY ?? 0);
  }

  function update(delta, time, interaction, journeyProgress = 0) {
    if (disposed || status !== 'ready') return;

    phase += delta * 0.00004;
    journeyOpacity = 1 - smootherstep(0.18, 0.72, journeyProgress);
    updateProjectionState(group, projectionState);
    const parallaxX = interaction?.parallaxX ?? 0;
    const parallaxY = interaction?.parallaxY ?? 0;
    const sideView = activeMode === 'sideView';

    layers.forEach(({ definition, mesh, material }) => {
      const pixelScaleX = sideView ? 0 : projectionState.localUnitsPerPixelX;
      const pixelScaleY = sideView ? 0 : projectionState.localUnitsPerPixelY;

      mesh.position.x = parallaxX * definition.parallaxPixels * pixelScaleX;
      mesh.position.y = parallaxY * definition.parallaxPixels * pixelScaleY * 0.72;
      mesh.rotation.z = phase * definition.rotationMultiplier;
      material.opacity = definition.opacity * journeyOpacity * (sideView ? 1.1 : 1);
    });
    edgeParticles.update({
      time,
      rotation: phase * LAYER_DEFINITIONS[5].rotationMultiplier,
      journeyOpacity,
      parallaxX: sideView
        ? 0
        : parallaxX * LAYER_DEFINITIONS[5].parallaxPixels
          * projectionState.localUnitsPerPixelX,
      parallaxY: sideView
        ? 0
        : parallaxY * LAYER_DEFINITIONS[5].parallaxPixels
          * projectionState.localUnitsPerPixelY * 0.72
    });
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
      atomicReady: status === 'ready' && textureLoadCount === LAYER_DEFINITIONS.length,
      projection: {
        localUnitsPerPixelX: projectionState.localUnitsPerPixelX,
        localUnitsPerPixelY: projectionState.localUnitsPerPixelY
      },
      layers: Object.fromEntries([...layers.entries()].map(([key, layer]) => [
        key,
        {
          uuid: layer.mesh.uuid,
          textureUuid: layer.texture?.uuid ?? null,
          z: layer.definition.z,
          displayedZ: layer.mesh.position.z,
          scale: layer.definition.scale,
          opacity: layer.definition.opacity,
          blending: layer.definition.blendingName,
          rotationMultiplier: layer.definition.rotationMultiplier,
          parallaxPixels: layer.definition.parallaxPixels,
          position: [layer.mesh.position.x, layer.mesh.position.y, layer.mesh.position.z],
          rotationZ: layer.mesh.rotation.z,
          visible: layer.mesh.visible
        }
      ])),
      edgeParticles: edgeParticles.getDiagnostics(),
      resources: {
        groups: 1,
        meshes: layers.size,
        points: 1,
        geometries: 2,
        materials: layers.size + 1,
        textures: textureLoadCount
      }
    };

    window.__ACTIVE_THEORY_GALAXY_VOLUME__ = diagnostics;
    document.documentElement.dataset.galaxyVolumeDiagnostics = JSON.stringify(diagnostics);
  }

  function dispose() {
    if (disposed) return;

    disposed = true;
    loadGeneration += 1;
    listeners.clear();
    layers.forEach(({ material, texture }) => {
      texture?.dispose();
      material.dispose();
    });
    edgeParticles.dispose();
    geometry.dispose();
    layers.clear();
    group.clear();
    if (typeof window !== 'undefined') {
      delete window.__ACTIVE_THEORY_GALAXY_VOLUME__;
      delete document.documentElement.dataset.galaxyVolumeDiagnostics;
    }
  }

  return {
    group,
    layers,
    previewState,
    applyMode,
    update,
    subscribe,
    dispose,
    getStatus: () => status,
    isReady: () => status === 'ready',
    getFps: () => measuredFps
  };
}

function configureTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 6;
  texture.needsUpdate = true;
}

function createProjectionState() {
  return {
    viewportWidth: 0,
    viewportHeight: 0,
    localUnitsPerPixelX: 0.001,
    localUnitsPerPixelY: 0.001,
    origin: new THREE.Vector3(),
    axisX: new THREE.Vector3(),
    axisY: new THREE.Vector3()
  };
}

function updateProjectionState(group, state) {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;

  if (state.viewportWidth === width && state.viewportHeight === height) return;
  const camera = getCamera();

  if (!camera) return;
  group.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  state.origin.set(0, 0, 0);
  state.axisX.set(1, 0, 0);
  state.axisY.set(0, 1, 0);
  group.localToWorld(state.origin);
  group.localToWorld(state.axisX);
  group.localToWorld(state.axisY);
  state.origin.project(camera);
  state.axisX.project(camera);
  state.axisY.project(camera);
  const xPixels = Math.max(Math.hypot(
    (state.axisX.x - state.origin.x) * width * 0.5,
    (state.axisX.y - state.origin.y) * height * 0.5
  ), 1);
  const yPixels = Math.max(Math.hypot(
    (state.axisY.x - state.origin.x) * width * 0.5,
    (state.axisY.y - state.origin.y) * height * 0.5
  ), 1);

  state.localUnitsPerPixelX = 1 / xPixels;
  state.localUnitsPerPixelY = 1 / yPixels;
  state.viewportWidth = width;
  state.viewportHeight = height;
}

function createVolumeEdgeParticles(extent) {
  const count = 600;
  let geometry = new THREE.BufferGeometry();
  const material = createEdgeParticleMaterial();
  const points = new THREE.Points(geometry, material);
  let sampledPixels = 0;
  let regionCounts = Object.fromEntries(EDGE_REGIONS.map((region) => [region.name, 0]));

  points.name = 'GalaxyVolumeEdgeParticles';
  points.renderOrder = -6;
  points.frustumCulled = false;
  points.visible = false;

  function setSourceImage(image) {
    if (!image) return;
    const samples = sampleEdgeTexture(image);

    if (samples.length === 0) return;
    sampledPixels = samples.length;
    const random = createSeededRandom(30119);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);
    const phases = new Float32Array(count);
    const depthLayers = new Uint8Array(count);
    const color = new THREE.Color();
    const ice = new THREE.Color(0xc6ebff);

    regionCounts = Object.fromEntries(EDGE_REGIONS.map((region) => [region.name, 0]));
    for (let index = 0; index < count; index += 1) {
      const sample = pickWeightedSample(samples, random);
      const baseX = (sample.u - 0.5) * extent * 1.025;
      const baseY = (sample.v - 0.5) * extent * 1.025;
      const radialLength = Math.max(Math.hypot(baseX, baseY), 0.001);
      const radialX = baseX / radialLength;
      const radialY = baseY / radialLength;
      const tangentX = -radialY;
      const tangentY = radialX;
      const extension = Math.pow(random(), 2.25) * 0.075;
      const tangentOffset = (random() - 0.5) * 0.036 * (1 - extension / 0.075);
      const depthRoll = random();
      const depthLayer = depthRoll < 0.55 ? 0 : depthRoll < 0.89 ? 1 : 2;
      const z = depthLayer === 0
        ? THREE.MathUtils.lerp(-0.12, -0.045, random())
        : depthLayer === 1
          ? THREE.MathUtils.lerp(-0.03, 0.06, random())
          : THREE.MathUtils.lerp(0.08, 0.16, random());

      positions.set([
        baseX + radialX * extension + tangentX * tangentOffset,
        baseY + radialY * extension + tangentY * tangentOffset,
        z
      ], index * 3);
      color.setRGB(sample.r, sample.g, sample.b)
        .lerp(ice, 0.1 + random() * 0.22)
        .multiplyScalar(0.34 + random() * 0.32);
      colors.set([color.r, color.g, color.b], index * 3);
      const sizeRoll = random();
      sizes[index] = sizeRoll < 0.75
        ? 0.24 + random() * 0.28
        : sizeRoll < 0.96
          ? 0.56 + random() * 0.34
          : 0.96 + random() * 0.4;
      opacities[index] = (0.14 + random() * 0.42) * (0.45 + sample.a * 0.55);
      phases[index] = random() * TAU;
      depthLayers[index] = depthLayer;
      regionCounts[sample.region] += 1;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    nextGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    nextGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    nextGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    nextGeometry.setAttribute('aDepthLayer', new THREE.BufferAttribute(depthLayers, 1));
    nextGeometry.computeBoundingSphere();
    geometry.dispose();
    geometry = nextGeometry;
    points.geometry = geometry;
  }

  return {
    points,
    setSourceImage,
    update({ time, rotation, journeyOpacity, parallaxX, parallaxY }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourneyOpacity.value = journeyOpacity;
      points.rotation.z = rotation;
      points.position.x = parallaxX;
      points.position.y = parallaxY;
    },
    getDiagnostics() {
      return {
        count,
        sampledPixels,
        regionCount: EDGE_REGIONS.length,
        regionCounts,
        zLayers: {
          rear: [-0.12, -0.045],
          mid: [-0.03, 0.06],
          front: [0.08, 0.16]
        },
        sizeDistributionPercent: { micro: 75, medium: 21, highlight: 4 },
        uuid: points.uuid,
        geometryUuid: geometry.uuid,
        materialUuid: material.uuid,
        visible: points.visible
      };
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function sampleEdgeTexture(image) {
  const sampleSize = 384;
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

      if (alpha < 0.055) continue;
      const u = x / (sampleSize - 1);
      const v = 1 - y / (sampleSize - 1);
      const angleDegrees = THREE.MathUtils.radToDeg(Math.atan2(v - 0.5, u - 0.5));
      const region = EDGE_REGIONS.find((candidate) => (
        angularDistanceDegrees(angleDegrees, candidate.centerDegrees)
          <= candidate.halfWidthDegrees
      ));

      if (!region) continue;
      samples.push({
        u,
        v,
        r: pixels[offset] / 255,
        g: pixels[offset + 1] / 255,
        b: pixels[offset + 2] / 255,
        a: alpha,
        region: region.name
      });
    }
  }
  return samples;
}

function angularDistanceDegrees(first, second) {
  return Math.abs(((first - second + 540) % 360) - 180);
}

function pickWeightedSample(samples, random) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const sample = samples[Math.floor(random() * samples.length)];

    if (random() <= Math.max(sample.a, 0.12)) return sample;
  }
  return samples[Math.floor(random() * samples.length)];
}

function createEdgeParticleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uJourneyOpacity: { value: 1 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uTime;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float shimmer = 0.96 + sin(uTime * 0.27 + aPhase) * 0.04;
        vColor = color;
        vOpacity = aOpacity * shimmer;
        gl_PointSize = clamp(aSize * 22.0 / max(-viewPosition.z, 1.0), 0.6, 3.8);
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
        float alpha = (1.0 - smoothstep(0.08, 1.0, radius))
          * vOpacity
          * 0.18
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

export const galaxyVolumeLayerFactory = {
  createGalaxyVolumeLayer,
  readGalaxyVolumePreviewState
};
