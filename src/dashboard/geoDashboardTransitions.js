const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function animateDashboardEntry(root, origin = 'direct') {
  root.dataset.entry = origin;
  root.classList.add('geo-dashboard--entering');
  root.classList.remove(
    'geo-dashboard--core-focus',
    'geo-dashboard--arc-open',
    'geo-dashboard--content-ready',
    'geo-dashboard--leaving'
  );
  const phaseScale = origin === 'geo' ? 1 : 0.58;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.add('geo-dashboard--core-focus');
    });
  });

  window.setTimeout(() => {
    root.classList.add('geo-dashboard--arc-open');
  }, 210 * phaseScale);
  window.setTimeout(() => {
    root.classList.add('geo-dashboard--active');
  }, 510 * phaseScale);
  window.setTimeout(() => {
    root.classList.remove('geo-dashboard--entering');
    root.classList.add('geo-dashboard--content-ready');
  }, 880 * phaseScale);
}

export function animateDashboardExit(root, onComplete) {
  root.classList.remove('geo-dashboard--content-ready', 'geo-dashboard--arc-open');
  root.classList.remove('geo-dashboard--active');
  root.classList.add('geo-dashboard--leaving');

  if (reducedMotion.matches) {
    onComplete();
    return;
  }

  const handleTransitionEnd = (event) => {
    if (event.target !== root) return;
    root.removeEventListener('transitionend', handleTransitionEnd);
    onComplete();
  };

  root.addEventListener('transitionend', handleTransitionEnd);
  window.setTimeout(() => {
    root.removeEventListener('transitionend', handleTransitionEnd);
    onComplete();
  }, 620);
}

export function animateMetric(element, value, options = {}) {
  const from = Number(element.dataset.value ?? 0);
  const to = Number(value);
  const duration = reducedMotion.matches ? 0 : (options.duration ?? 460);
  const suffix = options.suffix ?? '';
  const digits = options.digits ?? 1;
  const start = performance.now();
  let frame = 0;

  const render = (current) => {
    element.textContent = `${current.toFixed(digits)}${suffix}`;
    element.dataset.value = String(current);
  };

  if (duration === 0 || !Number.isFinite(from) || !Number.isFinite(to)) {
    render(to);
    return () => {};
  }

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    render(from + (to - from) * eased);
    if (progress < 1) frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export function pulseCoreFeedback(element) {
  element.classList.remove('geo-core-feedback');
  void element.offsetWidth;
  element.classList.add('geo-core-feedback');
}
