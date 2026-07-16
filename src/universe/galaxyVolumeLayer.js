import * as THREE from 'three';

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
    url: '/textures/hero/galaxy-volume-preview/galaxy-haze.webp',
    z: -0.08,
    scale: 1.07,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    blendingName: 'AdditiveBlending',
    speed: 0.96,
    parallax: -0.0044,
    renderOrder: -7.6
  }),
  Object.freeze({
    key: 'arms',
    name: 'GalaxyVolumeMainArms',
    url: '/textures/hero/galaxy-volume-preview/galaxy-arms.webp',
    z: -0.015,
    scale: 1,
    opacity: 0.9,
    blending: THREE.NormalBlending,
    blendingName: 'NormalBlending',
    speed: 1,
    parallax: 0,
    renderOrder: -7.2
  }),
  Object.freeze({
    key: 'dust',
    name: 'GalaxyVolumeDust',
    url: '/textures/hero/galaxy-volume-preview/galaxy-dust.webp',
    z: 0.01,
    scale: 1.005,
    opacity: 0.78,
    blending: THREE.NormalBlending,
    blendingName: 'NormalBlending',
    speed: 0.985,
    parallax: 0.0018,
    renderOrder: -6.9
  }),
  Object.freeze({
    key: 'core',
    name: 'GalaxyVolumeCore',
    url: '/textures/hero/galaxy-volume-preview/galaxy-core.webp',
    z: 0.035,
    scale: 0.995,
    opacity: 0.82,
    blending: THREE.NormalBlending,
    blendingName: 'NormalBlending',
    speed: 1.005,
    parallax: 0.0012,
    renderOrder: -6.6
  }),
  Object.freeze({
    key: 'stars',
    name: 'GalaxyVolumeStars',
    url: '/textures/hero/galaxy-volume-preview/galaxy-stars.webp',
    z: 0.065,
    scale: 1.01,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    blendingName: 'AdditiveBlending',
    speed: 1.015,
    parallax: 0.0042,
    renderOrder: -6.3
  }),
  Object.freeze({
    key: 'edge',
    name: 'GalaxyVolumeEdge',
    url: '/textures/hero/galaxy-volume-preview/galaxy-edge.webp',
    z: 0.09,
    scale: 1.025,
    opacity: 0.56,
    blending: THREE.AdditiveBlending,
    blendingName: 'AdditiveBlending',
    speed: 1.025,
    parallax: 0.0065,
    renderOrder: -6
  })
]);

export function readGalaxyVolumePreviewState() {
  if (typeof window === 'undefined') {
    return Object.freeze({ enabled: false, mode: 'combined' });
  }

  const params = new URLSearchParams(window.location.search);
  const enabled = import.meta.env.DEV && params.get('galaxyVolumePreview') === '1';
  const requestedMode = params.get('mode') || 'combined';
  const mode = SUPPORTED_MODES.has(requestedMode) ? requestedMode : 'combined';

  return Object.freeze({ enabled, mode });
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
  const edgeParticles = createVolumeEdgeParticles(extent);
  let phase = 0;
  let journeyOpacity = 1;
  let textureLoadCount = 0;
  let disposed = false;
  let frameCount = 0;
  let fpsWindowStart = performance.now();
  let measuredFps = 0;

  group.name = 'GalaxyVolumeGroup';
  group.position.z = textureLayer.localPositionZ ?? 0;
  group.scale.setScalar(textureLayer.localScale ?? 1);
  group.rotation.set(
    textureLayer.localRotationX ?? 0,
    textureLayer.localRotationY ?? 0,
    textureLayer.localRotationZ ?? 0
  );

  LAYER_DEFINITIONS.forEach((definition) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0,
      transparent: true,
      blending: definition.blending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaTest: 0.001,
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
    layers.set(definition.key, { definition, mesh, material, texture: null });
    group.add(mesh);

    textureLoader.load(
      definition.url,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        material.map = texture;
        material.needsUpdate = true;
        const layer = layers.get(definition.key);
        layer.texture = texture;
        textureLoadCount += 1;
        if (definition.key === 'edge') {
          edgeParticles.setSourceTexture(texture);
        }
        applyMode(previewState.mode);
        publishDiagnostics();
      }
    );
  });

  group.add(edgeParticles.points);
  applyMode(previewState.mode);
  publishDiagnostics();

  function applyMode(mode = 'combined') {
    const normalizedMode = SUPPORTED_MODES.has(mode) ? mode : 'combined';
    const showAll = normalizedMode === 'combined' || normalizedMode === 'sideView';
    const sideView = normalizedMode === 'sideView';

    layers.forEach(({ definition, mesh, material, texture }) => {
      mesh.visible = Boolean(texture) && (showAll || normalizedMode === definition.key);
      mesh.position.z = definition.z * (sideView ? 3.4 : 1);
      material.opacity = definition.opacity * journeyOpacity * (sideView ? 1.08 : 1);
    });
    edgeParticles.points.visible = !sideView
      && (normalizedMode === 'combined' || normalizedMode === 'edge');
    group.rotation.y = sideView
      ? THREE.MathUtils.degToRad(82)
      : (textureLayer.localRotationY ?? 0);
  }

  function update(delta, time, interaction, journeyProgress = 0) {
    if (disposed) return;
    phase += delta * 0.00012;
    journeyOpacity = 1 - smootherstep(0.18, 0.72, journeyProgress);
    const parallaxX = interaction?.parallaxX ?? 0;
    const parallaxY = interaction?.parallaxY ?? 0;

    layers.forEach(({ definition, mesh, material }) => {
      mesh.position.x = parallaxX * definition.parallax;
      mesh.position.y = parallaxY * definition.parallax * 0.72;
      mesh.rotation.z = phase * definition.speed;
      material.opacity = definition.opacity * journeyOpacity;
    });
    edgeParticles.update(
      time,
      phase * 1.025,
      journeyOpacity,
      parallaxX * 0.0065,
      parallaxY * 0.0047
    );
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

  function publishDiagnostics() {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const diagnostics = {
      enabled: true,
      mode: previewState.mode,
      instanceUuid: group.uuid,
      phase,
      journeyOpacity,
      fps: measuredFps,
      textureLoadCount,
      layers: Object.fromEntries([...layers.entries()].map(([key, layer]) => [
        key,
        {
          uuid: layer.mesh.uuid,
          textureUuid: layer.texture?.uuid ?? null,
          z: layer.definition.z,
          scale: layer.definition.scale,
          opacity: layer.definition.opacity,
          blending: layer.definition.blendingName,
          speed: layer.definition.speed,
          parallax: layer.definition.parallax,
          position: [
            layer.mesh.position.x,
            layer.mesh.position.y,
            layer.mesh.position.z
          ],
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
    dispose,
    getFps: () => measuredFps
  };
}

function createVolumeEdgeParticles(extent) {
  const count = 800;
  let geometry = new THREE.BufferGeometry();
  let sampledPixels = 0;
  let sourceTextureUuid = null;
  const material = createEdgeParticleMaterial();
  const points = new THREE.Points(geometry, material);
  points.name = 'GalaxyVolumeEdgeParticles';
  points.renderOrder = -5.7;
  points.frustumCulled = false;

  function setSourceTexture(texture) {
    if (!texture?.image || sourceTextureUuid === texture.uuid) return;
    const samples = sampleEdgeTexture(texture.image);
    if (samples.length === 0) return;
    sampledPixels = samples.length;
    sourceTextureUuid = texture.uuid;
    const random = createSeededRandom(30119);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);
    const phases = new Float32Array(count);
    const color = new THREE.Color();

    for (let index = 0; index < count; index += 1) {
      const sample = samples[Math.floor(random() * samples.length)];
      const x = (sample.u - 0.5) * extent;
      const y = (sample.v - 0.5) * extent;
      const radialLength = Math.max(Math.hypot(x, y), 0.001);
      const radialX = x / radialLength;
      const radialY = y / radialLength;
      const tangentX = -radialY;
      const tangentY = radialX;
      const extension = Math.pow(random(), 2.1) * 0.085;
      const tangentOffset = (random() - 0.5) * 0.032 * (1 - extension / 0.085);
      positions.set([
        x + radialX * extension + tangentX * tangentOffset,
        y + radialY * extension + tangentY * tangentOffset,
        THREE.MathUtils.lerp(-0.12, 0.16, random())
      ], index * 3);
      color.setRGB(sample.r, sample.g, sample.b)
        .lerp(new THREE.Color(0xc6ebff), 0.12 + random() * 0.28)
        .multiplyScalar(0.42 + random() * 0.34);
      colors.set([color.r, color.g, color.b], index * 3);
      const sizeRoll = random();
      sizes[index] = sizeRoll < 0.78
        ? 0.28 + random() * 0.3
        : sizeRoll < 0.96
          ? 0.64 + random() * 0.38
          : 1.08 + random() * 0.42;
      opacities[index] = (0.18 + random() * 0.52) * (0.5 + sample.a * 0.5);
      phases[index] = random() * TAU;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    nextGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    nextGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    nextGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    nextGeometry.computeBoundingSphere();
    geometry.dispose();
    geometry = nextGeometry;
    points.geometry = geometry;
  }

  return {
    points,
    setSourceTexture,
    update(time, rotation, journeyOpacity, parallaxX, parallaxY) {
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
        sourceTextureUuid,
        zRange: [-0.12, 0.16],
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
  const sampleSize = 256;
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
      samples.push({
        u: x / (sampleSize - 1),
        v: 1 - y / (sampleSize - 1),
        r: pixels[offset] / 255,
        g: pixels[offset + 1] / 255,
        b: pixels[offset + 2] / 255,
        a: alpha
      });
    }
  }
  return samples;
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
        float shimmer = 0.94 + sin(uTime * 0.31 + aPhase) * 0.06;
        vColor = color;
        vOpacity = aOpacity * shimmer;
        gl_PointSize = clamp(aSize * 22.0 / max(-viewPosition.z, 1.0), 0.65, 4.2);
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
          * 0.2
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
