import * as THREE from 'three';

const H1_VIDEO_URL = '/videos/hero/galaxy/h1-galaxy-alpha.webm';
export const H1_HD_VIDEO_URL = '/videos/hero/galaxy/h1-galaxy-alpha-hd.webm';
export const H1_COMPOSITION_D_CONFIG = Object.freeze({
  localPosition: Object.freeze([0.46, 0.186, 0.018]),
  localScale: 1.296,
  localRotationZ: 0
});
const VIDEO_ASPECT = 16 / 9;
const LOAD_TIMEOUT_MS = 12000;
const DEFAULT_CONFIG = Object.freeze({
  outerRadius: 0.78,
  extentScale: 2.7,
  localPosition: Object.freeze([0.0388, 0.004, 0.018]),
  localScale: 0.72,
  localRotationZ: 0,
  coreUv: Object.freeze({ x: 0.485, y: 0.5 })
});

export function createGalaxyVideoLayer({
  enabled = false,
  url = H1_VIDEO_URL,
  onReady = null,
  onFallback = null,
  ...parameters
} = {}) {
  const config = { ...DEFAULT_CONFIG, ...parameters };
  const group = new THREE.Group();
  const createdAtMs = readPerformanceNow();

  group.name = 'H1GalaxyVideoGroup';
  group.visible = false;

  if (!enabled || typeof document === 'undefined') {
    return createDisabledLayer(group, config);
  }

  const video = document.createElement('video');

  video.muted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('loop', '');
  video.setAttribute('playsinline', '');

  const canPlayVp9 = video.canPlayType('video/webm; codecs="vp9"')
    || video.canPlayType('video/webm');
  if (!canPlayVp9) {
    return createFallbackLayer({
      group,
      config,
      video,
      reason: 'vp9-unsupported',
      onFallback,
      createdAtMs
    });
  }

  const extent = config.outerRadius * config.extentScale;
  let geometry = null;
  let texture = null;
  let material = null;

  try {
    geometry = new THREE.PlaneGeometry(extent * VIDEO_ASPECT, extent, 1, 1);
    texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      alphaTest: 0,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      toneMapped: false
    });
  } catch (error) {
    texture?.dispose();
    material?.dispose();
    geometry?.dispose();
    return createFallbackLayer({
      group,
      config,
      video,
      reason: 'video-texture-creation-failed',
      error,
      onFallback,
      createdAtMs
    });
  }
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'H1GalaxyVideoMesh';
  mesh.position.fromArray(config.localPosition);
  mesh.scale.setScalar(config.localScale);
  mesh.rotation.z = config.localRotationZ;
  mesh.renderOrder = -6;
  mesh.frustumCulled = false;
  mesh.visible = false;
  group.add(mesh);

  let status = 'loading';
  let ready = false;
  let disposed = false;
  let warningIssued = false;
  let currentJourneyOpacity = 1;
  let currentRevealOpacity = 0;
  let frameCallbackId = null;
  let timeoutId = null;
  let alphaCorners = null;
  let firstFrameTime = null;
  let requestStartedAtMs = null;
  let loadedDataAtMs = null;
  let firstFrameReadyAtMs = null;
  let readyPromise = null;
  const canvas = document.querySelector('canvas');
  const counters = Object.freeze({
    videoElements: 1,
    videoTextures: 1,
    geometries: 1,
    materials: 1
  });

  const handleVisibilityChange = () => {
    if (!disposed && ready && !document.hidden && video.paused) {
      void video.play().catch((error) => fail('resume-playback-failed', error));
    }
  };
  const handleVideoError = () => {
    fail('video-decode-failed', video.error);
  };
  const handleWebGlContextLost = () => {
    fail('webgl-context-lost');
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  video.addEventListener('error', handleVideoError, { once: true });
  canvas?.addEventListener('webglcontextlost', handleWebGlContextLost, { once: true });
  readyPromise = loadFirstFrame();
  requestStartedAtMs = readPerformanceNow();
  video.src = url;
  video.load();

  async function loadFirstFrame() {
    try {
      await waitForLoadedData(video);
      if (disposed) return false;
      loadedDataAtMs = readPerformanceNow();
      await video.play();
      await waitForDecodedFrame(video);
      if (disposed) return false;

      const alphaResult = inspectVideoAlpha(video);

      alphaCorners = alphaResult.corners;
      if (!alphaResult.supported) {
        throw new Error(`VP9 Alpha validation failed: ${alphaResult.corners.join(',')}`);
      }

      firstFrameTime = video.currentTime;
      firstFrameReadyAtMs = readPerformanceNow();
      status = 'ready';
      ready = true;
      group.visible = true;
      material.opacity = currentJourneyOpacity * currentRevealOpacity;
      mesh.visible = material.opacity >= 0.01;
      onReady?.();
      return true;
    } catch (error) {
      fail(classifyLoadError(error), error);
      return false;
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  }

  function update(journeyProgress = 0, revealOpacity = 1) {
    if (disposed) return;
    const textureFade = smootherstep(0.22, 0.72, journeyProgress);

    currentJourneyOpacity = 1 - textureFade * 0.84;
    currentRevealOpacity = THREE.MathUtils.clamp(revealOpacity, 0, 1);
    material.opacity = ready ? currentJourneyOpacity * currentRevealOpacity : 0;
    group.visible = ready;
    mesh.visible = ready && material.opacity >= 0.01;
  }

  function sourceUvToLocalPoint(sourceUv = config.coreUv) {
    const point = new THREE.Vector3(
      (sourceUv.x - 0.5) * extent * VIDEO_ASPECT,
      (sourceUv.y - 0.5) * extent,
      0
    );

    mesh.updateMatrix();
    return point.applyMatrix4(mesh.matrix);
  }

  function fail(reason, error) {
    if (disposed || status === 'fallback') return;
    status = 'fallback';
    ready = false;
    group.visible = false;
    mesh.visible = false;
    material.opacity = 0;
    video.pause();
    if (!warningIssued) {
      warningIssued = true;
      console.warn(`[H1 galaxy video preview] ${reason}; keeping V2.4 fallback.`, error ?? '');
    }
    onFallback?.(reason);
  }

  function getDiagnostics() {
    return {
      enabled: true,
      status,
      ready,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : null,
      paused: video.paused,
      ended: video.ended,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      alphaCorners,
      firstFrameTime,
      revealOpacity: currentRevealOpacity,
      timings: {
        domReadyAtMs: readDomReadyTime(),
        createdAtMs,
        requestStartedAtMs,
        loadedDataAtMs,
        firstFrameReadyAtMs,
        requestToFirstFrameMs: firstFrameReadyAtMs !== null
          ? firstFrameReadyAtMs - requestStartedAtMs
          : null
      },
      creationCounts: counters,
      configuration: {
        localPosition: [...config.localPosition],
        localScale: config.localScale,
        localRotationZ: config.localRotationZ,
        coreUv: { ...config.coreUv }
      }
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    ready = false;
    status = 'disposed';
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    video.removeEventListener('error', handleVideoError);
    canvas?.removeEventListener('webglcontextlost', handleWebGlContextLost);
    if (frameCallbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(frameCallbackId);
    }
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
    texture.dispose();
    material.dispose();
    geometry.dispose();
    group.clear();
  }

  function waitForLoadedData(element) {
    if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        element.removeEventListener('loadeddata', handleLoaded);
        element.removeEventListener('canplay', handleLoaded);
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      const handleLoaded = () => {
        cleanup();
        resolve();
      };

      element.addEventListener('loadeddata', handleLoaded, { once: true });
      element.addEventListener('canplay', handleLoaded, { once: true });
      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('H1 video load timeout'));
      }, LOAD_TIMEOUT_MS);
    });
  }

  function waitForDecodedFrame(element) {
    if (typeof element.requestVideoFrameCallback === 'function') {
      return new Promise((resolve, reject) => {
        timeoutId = window.setTimeout(() => {
          timeoutId = null;
          reject(new Error('H1 first decoded frame timeout'));
        }, LOAD_TIMEOUT_MS);
        frameCallbackId = element.requestVideoFrameCallback(() => {
          frameCallbackId = null;
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
          }
          resolve();
        });
      });
    }
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    });
  }

  return {
    group,
    mesh,
    video,
    texture,
    material,
    update,
    sourceUvToLocalPoint,
    getDiagnostics,
    isReady: () => ready,
    ready: readyPromise,
    dispose
  };
}

function createFallbackLayer({
  group,
  config,
  video,
  reason,
  error = null,
  onFallback = null,
  createdAtMs = null
}) {
  group.visible = false;
  video.pause();
  console.warn(`[H1 galaxy video] ${reason}; keeping V2.4 fallback.`, error ?? '');
  window.queueMicrotask(() => onFallback?.(reason));

  return {
    group,
    mesh: null,
    video,
    texture: null,
    material: null,
    update() {},
    sourceUvToLocalPoint() { return new THREE.Vector3(); },
    getDiagnostics() {
      return {
        enabled: true,
        status: 'fallback',
        ready: false,
        fallbackReason: reason,
        creationCounts: {
          videoElements: 1,
          videoTextures: 0,
          geometries: 0,
          materials: 0
        },
        timings: {
          domReadyAtMs: readDomReadyTime(),
          createdAtMs,
          requestStartedAtMs: null,
          loadedDataAtMs: null,
          firstFrameReadyAtMs: null,
          requestToFirstFrameMs: null
        },
        configuration: {
          localPosition: [...config.localPosition],
          localScale: config.localScale,
          localRotationZ: config.localRotationZ,
          coreUv: { ...config.coreUv }
        }
      };
    },
    isReady: () => false,
    ready: Promise.resolve(false),
    dispose() {
      video.pause();
      video.removeAttribute('src');
      video.load();
      group.clear();
    }
  };
}

function createDisabledLayer(group, config) {
  return {
    group,
    mesh: null,
    video: null,
    texture: null,
    material: null,
    update() {},
    sourceUvToLocalPoint() { return new THREE.Vector3(); },
    getDiagnostics() {
      return {
        enabled: false,
        status: 'disabled',
        ready: false,
        creationCounts: {
          videoElements: 0,
          videoTextures: 0,
          geometries: 0,
          materials: 0
        },
        configuration: {
          localPosition: [...config.localPosition],
          localScale: config.localScale,
          localRotationZ: config.localRotationZ,
          coreUv: { ...config.coreUv }
        }
      };
    },
    isReady: () => false,
    ready: Promise.resolve(false),
    dispose() {}
  };
}

function inspectVideoAlpha(video) {
  const canvas = document.createElement('canvas');
  const width = 64;
  const height = 36;

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    return { supported: false, corners: [255, 255, 255, 255] };
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(video, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const cornerCoordinates = [
    [1, 1],
    [width - 2, 1],
    [1, height - 2],
    [width - 2, height - 2]
  ];
  const corners = cornerCoordinates.map(([x, y]) => pixels[(y * width + x) * 4 + 3]);

  return {
    supported: corners.every((alpha) => alpha <= 24),
    corners
  };
}

function classifyLoadError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();

  if (message.includes('timeout')) return 'video-load-timeout';
  if (message.includes('notallowed') || message.includes('play')) return 'autoplay-failed';
  if (message.includes('alpha')) return 'vp9-alpha-unsupported';
  return 'video-load-or-decode-failed';
}

function smootherstep(edge0, edge1, value) {
  const normalized = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return normalized * normalized * normalized
    * (normalized * (normalized * 6 - 15) + 10);
}

function readPerformanceNow() {
  return typeof performance === 'undefined' ? 0 : performance.now();
}

function readDomReadyTime() {
  const navigation = typeof performance === 'undefined'
    ? null
    : performance.getEntriesByType?.('navigation')?.[0];

  return navigation?.domContentLoadedEventEnd ?? null;
}

export const galaxyVideoLayerFactory = { createGalaxyVideoLayer };
