import * as THREE from 'three';
import './heroCinematicV2.css';
import { createHeroCinematicCamera } from './heroCinematicCamera.js';
import { createHeroCinematicDebug } from './heroCinematicDebug.js';
import { createHeroCinematicGalaxy } from './heroCinematicGalaxy.js';
import { createHeroCinematicStarField } from './heroCinematicStarField.js';
import {
  HERO_CINEMATIC_DURATION_MS,
  resolveHeroCinematicTimeline
} from './heroCinematicTimeline.js';

const INSTANCE_KEY = '__ACTIVE_THEORY_HERO_CINEMATIC_V2__';
const STATUS_KEY = '__ACTIVE_THEORY_HERO_CINEMATIC_V2_STATUS__';
const PHASE_JUMP_TIMES = Object.freeze({ 1: 600, 2: 2500, 3: 4500 });

export function initializeHeroCinematicV2() {
  window[INSTANCE_KEY]?.dispose?.();

  const params = new URLSearchParams(window.location.search);
  const quality = params.get('heroQuality') === 'company' ? 'company' : 'default';
  const debugEnabled = import.meta.env.DEV && params.get('heroDebug') === '1';
  const acceptanceFrameMs = resolveAcceptanceFrame(params);
  const pixelRatioCap = quality === 'company' ? 1.2 : 1.45;
  const app = document.querySelector('#app');
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  const cameraRig = createHeroCinematicCamera({
    aspect: window.innerWidth / window.innerHeight
  });
  const starField = createHeroCinematicStarField({
    quality,
    viewportHeight: window.innerHeight
  });
  const clock = createPlaybackClock();
  const performanceProbe = createPerformanceProbe({ warmupMs: 700 });
  let animationFrameId = null;
  let acceptanceFrameId = null;
  let disposed = false;
  let completed = false;
  let paused = acceptanceFrameMs !== null;
  let lastStatusPublishAt = 0;
  let status = null;

  renderer.domElement.className = 'hero-cinematic-v2__canvas';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.39;
  scene.background = new THREE.Color(0x01040a);
  scene.fog = new THREE.FogExp2(0x020711, 0.0024);
  app.replaceChildren(renderer.domElement);
  const galaxy = createHeroCinematicGalaxy();
  scene.add(starField.group, galaxy.group);
  document.body.dataset.heroCinematic = 'v2';

  const debug = createHeroCinematicDebug({
    enabled: debugEnabled,
    onTogglePause: togglePause,
    onReplay: replay,
    onJump: jumpToPhase
  });

  window.addEventListener('resize', handleResize);
  const instance = Object.freeze({
    dispose,
    replay,
    pause,
    resume,
    jumpToPhase,
    getStatus: () => status
  });
  window[INSTANCE_KEY] = instance;
  renderAt(acceptanceFrameMs ?? 0, performance.now());
  if (acceptanceFrameMs === null) scheduleFrame();
  else scheduleAcceptanceFrame(performance.now());

  if (import.meta.hot) {
    import.meta.hot.dispose(dispose);
  }

  return instance;

  function scheduleFrame() {
    if (disposed || paused || completed || animationFrameId !== null) return;
    animationFrameId = window.requestAnimationFrame(frame);
  }

  function scheduleAcceptanceFrame(startedAt) {
    const renderFixedFrame = (now) => {
      acceptanceFrameId = null;
      if (disposed) return;
      renderAt(acceptanceFrameMs, now);
      const videoReady = (galaxy.getDiagnostics().video?.readyState ?? 0) >= 2;
      const hasSettledFrame = now - startedAt >= 650;
      if ((!videoReady || !hasSettledFrame) && now - startedAt < 1800) {
        acceptanceFrameId = window.requestAnimationFrame(renderFixedFrame);
      } else {
        galaxy.freeze();
      }
    };
    acceptanceFrameId = window.requestAnimationFrame(renderFixedFrame);
  }

  function frame(now) {
    animationFrameId = null;
    if (disposed || paused) return;
    const elapsedMs = clock.read(now);
    performanceProbe.addFrame(now);
    const completing = elapsedMs >= HERO_CINEMATIC_DURATION_MS;
    if (completing) galaxy.freeze();
    renderAt(elapsedMs, now);
    if (completing) {
      completed = true;
      publishStatus(now, true);
      return;
    }
    scheduleFrame();
  }

  function renderAt(elapsedMs, now) {
    const timeline = resolveHeroCinematicTimeline(elapsedMs);
    const camera = cameraRig.update(timeline.cameraProgress, timeline.fov);

    starField.update(timeline);
    galaxy.update(timeline);
    renderer.toneMappingExposure = timeline.exposure;
    renderer.render(scene, cameraRig.camera);
    status = {
      active: true,
      quality,
      elapsedMs: timeline.timeMs,
      durationMs: timeline.durationMs,
      progress: timeline.progress,
      phase: timeline.phase,
      completed: timeline.complete,
      paused,
      acceptanceFrameMs,
      camera,
      particleCounts: starField.counts,
      streakCount: starField.streakCount,
      canvasCount: document.querySelectorAll('canvas').length,
      domCount: document.querySelectorAll('*').length,
      activeRafCount: disposed || paused || timeline.complete ? 0 : 1,
      resizeListenerCount: 1,
      performance: performanceProbe.read(),
      galaxy: galaxy.getDiagnostics()
    };
    debug.update(status, now);
    publishStatus(now, timeline.complete);
  }

  function publishStatus(now, force = false) {
    if (!status || (!force && now - lastStatusPublishAt < 180)) return;
    lastStatusPublishAt = now;
    window[STATUS_KEY] = status;
    document.documentElement.dataset.heroCinematicStatus = JSON.stringify(status);
  }

  function togglePause() {
    if (paused) resume();
    else pause();
  }

  function pause() {
    if (disposed || paused) return;
    paused = true;
    clock.pause(performance.now());
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (acceptanceFrameId !== null) {
      window.cancelAnimationFrame(acceptanceFrameId);
      acceptanceFrameId = null;
    }
    galaxy.freeze();
    renderAt(clock.read(performance.now()), performance.now());
  }

  function resume() {
    if (disposed || !paused) return;
    paused = false;
    completed = false;
    clock.resume(performance.now());
    galaxy.play();
    scheduleFrame();
  }

  function replay() {
    if (disposed) return;
    completed = false;
    paused = false;
    performanceProbe.reset();
    clock.reset(performance.now());
    galaxy.replay();
    renderAt(0, performance.now());
    scheduleFrame();
  }

  function jumpToPhase(phaseNumber) {
    if (!debugEnabled || !PHASE_JUMP_TIMES[phaseNumber]) return;
    paused = true;
    completed = false;
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    clock.set(PHASE_JUMP_TIMES[phaseNumber], performance.now());
    renderAt(PHASE_JUMP_TIMES[phaseNumber], performance.now());
  }

  function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    renderer.setSize(width, height);
    cameraRig.resize(width / height);
    starField.resize(height);
    renderAt(clock.read(performance.now()), performance.now());
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (acceptanceFrameId !== null) {
      window.cancelAnimationFrame(acceptanceFrameId);
      acceptanceFrameId = null;
    }
    window.removeEventListener('resize', handleResize);
    debug.dispose();
    galaxy.dispose();
    starField.dispose();
    scene.clear();
    renderer.dispose();
    renderer.domElement.remove();
    delete document.body.dataset.heroCinematic;
    delete document.documentElement.dataset.heroCinematicStatus;
    if (window[STATUS_KEY] === status) delete window[STATUS_KEY];
    if (window[INSTANCE_KEY] === instance) delete window[INSTANCE_KEY];
  }
}

function createPlaybackClock() {
  let startedAt = performance.now();
  let pausedAt = null;
  let pausedDuration = 0;

  return {
    read(now) {
      const effectiveNow = pausedAt ?? now;
      return Math.min(HERO_CINEMATIC_DURATION_MS, Math.max(0, effectiveNow - startedAt - pausedDuration));
    },
    pause(now) {
      pausedAt = now;
    },
    resume(now) {
      if (pausedAt !== null) pausedDuration += now - pausedAt;
      pausedAt = null;
    },
    reset(now) {
      startedAt = now;
      pausedAt = null;
      pausedDuration = 0;
    },
    set(elapsedMs, now) {
      startedAt = now - elapsedMs;
      pausedAt = now;
      pausedDuration = 0;
    }
  };
}

function createPerformanceProbe({ warmupMs = 0 } = {}) {
  let startedAt = performance.now();
  let previousAt = null;
  let frameTimes = [];

  return {
    addFrame(now) {
      if (now - startedAt < warmupMs) {
        previousAt = now;
        return;
      }
      if (previousAt !== null) {
        const frameTime = now - previousAt;
        if (frameTime > 0 && frameTime < 250) frameTimes.push(frameTime);
      }
      previousAt = now;
    },
    read() {
      if (!frameTimes.length) return { state: 'measuring', averageFps: null, onePercentLow: null };
      const total = frameTimes.reduce((sum, value) => sum + value, 0);
      const averageFps = frameTimes.length * 1000 / total;
      const slowest = [...frameTimes].sort((a, b) => b - a);
      const sampleCount = Math.max(1, Math.ceil(slowest.length * 0.01));
      const slowAverage = slowest.slice(0, sampleCount).reduce((sum, value) => sum + value, 0) / sampleCount;
      return {
        state: 'complete',
        frameCount: frameTimes.length,
        averageFps,
        onePercentLow: 1000 / slowAverage
      };
    },
    reset() {
      startedAt = performance.now();
      previousAt = null;
      frameTimes = [];
    }
  };
}

function resolveAcceptanceFrame(params) {
  if (!import.meta.env.DEV || !params.has('heroFrame')) return null;
  const requested = Number(params.get('heroFrame'));
  if (!Number.isFinite(requested)) return null;
  return THREE.MathUtils.clamp(requested, 0, HERO_CINEMATIC_DURATION_MS);
}
