const DEFAULT_DURATION_SECONDS = 8;

export function createHeroCinematicScrubber({
  source,
  duration = DEFAULT_DURATION_SECONDS,
  placeholder = true,
  maxSeekRate = 45,
  minProgressDelta = 0.0015,
  onDecodedFrame = () => {}
} = {}) {
  const video = document.createElement('video');
  const minimumSeekIntervalMs = 1000 / maxSeekRate;
  let cinematicDuration = duration;
  let desiredProgress = 0;
  let appliedProgress = -1;
  let lastSeekAt = -Infinity;
  let seekCount = 0;
  let frameCallbackCount = 0;
  let videoFrameCallbackId = null;
  let deferredSeekId = null;
  let disposed = false;
  let error = null;

  video.className = 'hero-cinematic-hybrid__video';
  video.muted = true;
  video.autoplay = false;
  video.loop = false;
  video.controls = false;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.dataset.placeholder = String(Boolean(placeholder));
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.addEventListener('loadedmetadata', handleMetadata);
  video.addEventListener('loadeddata', handleLoadedData);
  video.addEventListener('seeked', handleSeeked);
  video.addEventListener('error', handleError);
  video.src = source;
  video.load();
  video.pause();

  function handleMetadata() {
    if (Number.isFinite(video.duration) && video.duration > 0) cinematicDuration = video.duration;
    video.pause();
    seekToProgress(desiredProgress, performance.now(), true);
  }

  function handleLoadedData() {
    video.pause();
    onDecodedFrame(getDiagnostics());
  }

  function handleSeeked() {
    if (disposed) return;
    video.pause();
    onDecodedFrame(getDiagnostics());
    if (Math.abs(desiredProgress - appliedProgress) >= minProgressDelta) {
      scheduleDeferredSeek();
    }
  }

  function handleError() {
    error = video.error?.message ?? `Video decode error ${video.error?.code ?? 'unknown'}`;
  }

  function setProgress(progress, now = performance.now()) {
    desiredProgress = clamp01(progress);
    seekToProgress(desiredProgress, now);
  }

  function seekToProgress(progress, now, force = false) {
    if (disposed || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    if (!force && Math.abs(progress - appliedProgress) < minProgressDelta) return;
    if (video.seeking) return;
    if (!force && now - lastSeekAt < minimumSeekIntervalMs) {
      scheduleDeferredSeek();
      return;
    }

    const targetTime = clamp(progress * cinematicDuration, 0, Math.max(0, cinematicDuration - 0.001));
    appliedProgress = progress;
    lastSeekAt = now;
    seekCount += 1;
    video.pause();
    video.currentTime = targetTime;
    scheduleVideoFrameCallback();
  }

  function scheduleDeferredSeek() {
    if (disposed || deferredSeekId !== null) return;
    const delay = Math.max(0, minimumSeekIntervalMs - (performance.now() - lastSeekAt));
    deferredSeekId = window.setTimeout(() => {
      deferredSeekId = null;
      seekToProgress(desiredProgress, performance.now());
    }, delay);
  }

  function scheduleVideoFrameCallback() {
    if (typeof video.requestVideoFrameCallback !== 'function') return;
    if (videoFrameCallbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(videoFrameCallbackId);
    }
    videoFrameCallbackId = video.requestVideoFrameCallback(() => {
      videoFrameCallbackId = null;
      frameCallbackCount += 1;
      onDecodedFrame(getDiagnostics());
    });
  }

  function getDiagnostics() {
    const quality = typeof video.getVideoPlaybackQuality === 'function'
      ? video.getVideoPlaybackQuality()
      : null;
    return {
      placeholder: Boolean(placeholder),
      source,
      paused: video.paused,
      autoplay: video.autoplay,
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      duration: cinematicDuration,
      desiredProgress,
      appliedProgress: Math.max(0, appliedProgress),
      seekCount,
      frameCallbackCount,
      droppedFrames: quality?.droppedVideoFrames ?? null,
      totalVideoFrames: quality?.totalVideoFrames ?? null,
      readyState: video.readyState,
      seeking: video.seeking,
      error
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (deferredSeekId !== null) window.clearTimeout(deferredSeekId);
    if (videoFrameCallbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(videoFrameCallbackId);
    }
    video.removeEventListener('loadedmetadata', handleMetadata);
    video.removeEventListener('loadeddata', handleLoadedData);
    video.removeEventListener('seeked', handleSeeked);
    video.removeEventListener('error', handleError);
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }

  return Object.freeze({
    video,
    setProgress,
    getDiagnostics,
    dispose
  });
}

function clamp01(value) {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
