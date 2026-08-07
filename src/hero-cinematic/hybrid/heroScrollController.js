const DEFAULT_DAMPING = 0.24;
const DEFAULT_SENSITIVITY = 0.15;
const FRAME_MS = 1000 / 60;

export function createHeroScrollController({
  target = window,
  windowObject = window,
  performanceObject = performance,
  initialProgress = 0,
  damping = DEFAULT_DAMPING,
  sensitivity = DEFAULT_SENSITIVITY,
  onProgress = () => {},
  onWheel = () => {},
  shouldHandleWheel = () => true
} = {}) {
  let targetProgress = clamp01(initialProgress);
  let currentProgress = targetProgress;
  let normalizedWheelDelta = 0;
  let animationFrameId = null;
  let previousFrameAt = null;
  let disposed = false;
  let wheelListenerAttached = false;
  let frameTimes = [];

  setEnabled(true);
  publish(performanceObject.now(), true);

  function setEnabled(enabled) {
    if (disposed) return;
    if (enabled && !wheelListenerAttached) {
      target.addEventListener('wheel', handleWheel, { passive: false });
      wheelListenerAttached = true;
    } else if (!enabled && wheelListenerAttached) {
      target.removeEventListener('wheel', handleWheel);
      wheelListenerAttached = false;
    }
  }

  function handleWheel(event) {
    if (disposed) return;
    if (!shouldHandleWheel({
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      targetProgress,
      currentProgress
    })) {
      normalizedWheelDelta = 0;
      onWheel(getDiagnostics());
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    applyWheelDelta(event.deltaY, event.deltaMode);
  }

  function applyWheelDelta(deltaY, deltaMode = 0) {
    if (disposed || !Number.isFinite(deltaY)) return;
    normalizedWheelDelta = normalizeWheelDelta(deltaY, deltaMode, windowObject.innerHeight);
    if (Math.abs(normalizedWheelDelta) < 0.001) return;
    targetProgress = clamp01(targetProgress + normalizedWheelDelta * sensitivity);
    onWheel(getDiagnostics());
    scheduleFrame();
  }

  function setTargetProgress(progress, { immediate = false } = {}) {
    if (disposed) return;
    targetProgress = clamp01(progress);
    normalizedWheelDelta = 0;
    if (immediate) {
      currentProgress = targetProgress;
      publish(performanceObject.now(), true);
      return;
    }
    scheduleFrame();
  }

  function scheduleFrame() {
    if (disposed || animationFrameId !== null) return;
    animationFrameId = windowObject.requestAnimationFrame(update);
  }

  function update(now) {
    animationFrameId = null;
    if (disposed) return;

    if (previousFrameAt !== null) {
      const frameTime = now - previousFrameAt;
      if (frameTime > 0 && frameTime < 250) {
        frameTimes.push(frameTime);
        if (frameTimes.length > 720) frameTimes.shift();
      }
    }
    const deltaMs = previousFrameAt === null ? FRAME_MS : Math.min(64, now - previousFrameAt);
    previousFrameAt = now;
    const frameDamping = 1 - Math.pow(1 - damping, deltaMs / FRAME_MS);
    currentProgress += (targetProgress - currentProgress) * frameDamping;

    const settled = Math.abs(targetProgress - currentProgress) < 0.00012;
    if (settled) currentProgress = targetProgress;
    publish(now, settled);
    if (!settled) scheduleFrame();
    else previousFrameAt = null;
  }

  function publish(now, settled) {
    onProgress({
      targetProgress,
      currentProgress,
      normalizedWheelDelta,
      settled,
      now
    });
  }

  function getDiagnostics() {
    const settling = Math.abs(targetProgress - currentProgress) >= 0.00012;
    return {
      targetProgress,
      currentProgress,
      normalizedWheelDelta,
      sensitivity,
      damping,
      settled: !settling,
      activeRafCount: settling ? 1 : 0,
      wheelListenerCount: wheelListenerAttached ? 1 : 0,
      performance: summarizeFrameTimes(frameTimes)
    };
  }

  function dispose() {
    if (disposed) return;
    if (wheelListenerAttached) target.removeEventListener('wheel', handleWheel);
    wheelListenerAttached = false;
    disposed = true;
    if (animationFrameId !== null) {
      windowObject.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    frameTimes = [];
  }

  return Object.freeze({
    applyWheelDelta,
    setTargetProgress,
    setEnabled,
    getDiagnostics,
    dispose
  });
}

export function normalizeWheelDelta(deltaY, deltaMode = 0, viewportHeight = 1080) {
  const modeScale = deltaMode === 1
    ? 16
    : deltaMode === 2
      ? Math.max(480, viewportHeight)
      : 1;
  const pixelDelta = clamp(deltaY * modeScale, -240, 240);
  return clamp(pixelDelta / 100, -1, 1);
}

function summarizeFrameTimes(frameTimes) {
  if (frameTimes.length < 2) {
    return { state: 'measuring', frameCount: frameTimes.length, averageFps: null, onePercentLow: null };
  }
  const averageFrameTime = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
  const slowest = [...frameTimes].sort((a, b) => b - a);
  const sampleSize = Math.max(1, Math.ceil(slowest.length * 0.01));
  const slowAverage = slowest.slice(0, sampleSize).reduce((sum, value) => sum + value, 0) / sampleSize;
  return {
    state: 'complete',
    frameCount: frameTimes.length,
    averageFps: 1000 / averageFrameTime,
    onePercentLow: 1000 / slowAverage
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}
