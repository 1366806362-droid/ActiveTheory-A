const MOBILE_PORTRAIT_MAX_WIDTH = 720;
const MOBILE_PORTRAIT_MAX_ASPECT = 0.9;
const MOBILE_LANDSCAPE_MAX_WIDTH = 1100;
const MOBILE_LANDSCAPE_MAX_HEIGHT = 520;

export const VIEWPORT_MODES = Object.freeze({
  DESKTOP: 'desktop',
  MOBILE_PORTRAIT: 'mobilePortrait',
  MOBILE_LANDSCAPE: 'mobileLandscape'
});

export function readViewportMetrics(windowObject = globalThis.window) {
  const visualViewport = windowObject?.visualViewport;
  const width = Math.max(1, Math.round(
    visualViewport?.width
      || windowObject?.innerWidth
      || windowObject?.document?.documentElement?.clientWidth
      || 1
  ));
  const height = Math.max(1, Math.round(
    visualViewport?.height
      || windowObject?.innerHeight
      || windowObject?.document?.documentElement?.clientHeight
      || 1
  ));
  const aspect = width / height;
  const coarsePointer = Boolean(windowObject?.matchMedia?.('(pointer: coarse)').matches);
  const mode = resolveViewportMode({ width, height, aspect, coarsePointer });

  return Object.freeze({
    width,
    height,
    aspect,
    mode,
    coarsePointer,
    pixelRatio: Math.min(Math.max(windowObject?.devicePixelRatio || 1, 1), 1.5),
    visualViewport: Boolean(visualViewport)
  });
}

export function resolveViewportMode({ width, height, aspect = width / height, coarsePointer = false }) {
  const portrait = width <= MOBILE_PORTRAIT_MAX_WIDTH
    && aspect <= MOBILE_PORTRAIT_MAX_ASPECT;
  const landscape = height <= MOBILE_LANDSCAPE_MAX_HEIGHT
    && width <= MOBILE_LANDSCAPE_MAX_WIDTH
    && aspect > MOBILE_PORTRAIT_MAX_ASPECT;
  const coarseCompact = coarsePointer
    && Math.min(width, height) <= 820
    && Math.max(width, height) <= 1200;

  if (portrait || (coarseCompact && aspect <= 1)) {
    return VIEWPORT_MODES.MOBILE_PORTRAIT;
  }
  if (landscape || coarseCompact) {
    return VIEWPORT_MODES.MOBILE_LANDSCAPE;
  }
  return VIEWPORT_MODES.DESKTOP;
}

export function subscribeViewport(callback, windowObject = globalThis.window) {
  if (!windowObject || typeof callback !== 'function') return () => {};

  let animationFrame = 0;
  const visualViewport = windowObject.visualViewport;

  function publish() {
    animationFrame = 0;
    const metrics = readViewportMetrics(windowObject);
    applyViewportCss(metrics, windowObject.document);
    callback(metrics);
  }

  function schedule() {
    if (animationFrame) return;
    animationFrame = windowObject.requestAnimationFrame(publish);
  }

  windowObject.addEventListener('resize', schedule);
  visualViewport?.addEventListener('resize', schedule);
  visualViewport?.addEventListener('scroll', schedule);
  publish();

  return () => {
    windowObject.removeEventListener('resize', schedule);
    visualViewport?.removeEventListener('resize', schedule);
    visualViewport?.removeEventListener('scroll', schedule);
    if (animationFrame) windowObject.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };
}

export function applyViewportCss(metrics, documentObject = globalThis.document) {
  const root = documentObject?.documentElement;
  if (!root) return;

  root.style.setProperty('--active-viewport-width', `${metrics.width}px`);
  root.style.setProperty('--active-viewport-height', `${metrics.height}px`);
  root.dataset.activeTheoryViewport = metrics.mode;
}
