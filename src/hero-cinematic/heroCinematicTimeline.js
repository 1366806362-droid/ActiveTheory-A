export const HERO_CINEMATIC_DURATION_MS = 6000;

export const HERO_CINEMATIC_PHASES = Object.freeze([
  Object.freeze({ id: 'A', name: 'DEEP SPACE', startMs: 0, endMs: 1500 }),
  Object.freeze({ id: 'B', name: 'INITIAL DRIFT', startMs: 1500, endMs: 3500 }),
  Object.freeze({ id: 'C', name: 'COSMIC ACCELERATION', startMs: 3500, endMs: 6000 })
]);

export function resolveHeroCinematicTimeline(elapsedMs) {
  const timeMs = clamp(elapsedMs, 0, HERO_CINEMATIC_DURATION_MS);
  const phase = HERO_CINEMATIC_PHASES.find(({ startMs, endMs }) => (
    timeMs >= startMs && timeMs < endMs
  )) ?? HERO_CINEMATIC_PHASES.at(-1);
  const phaseProgress = normalize(timeMs, phase.startMs, phase.endMs);
  const cameraProgress = resolveCameraProgress(timeMs);
  const reveal = smootherstep(700, 5400, timeMs);
  const acceleration = smootherstep(3500, 5600, timeMs);

  return Object.freeze({
    timeMs,
    durationMs: HERO_CINEMATIC_DURATION_MS,
    progress: timeMs / HERO_CINEMATIC_DURATION_MS,
    phase,
    phaseProgress,
    cameraProgress,
    fov: lerp(49.5, 54, smootherstep(2900, 5900, timeMs)),
    exposure: lerp(0.39, 0.63, smootherstep(850, 5900, timeMs)),
    galaxyReveal: lerp(0.008, 0.48, reveal),
    galaxyScale: lerp(0.62, 1.0, smootherstep(1600, 6000, timeMs)),
    galaxyOffsetX: lerp(6.5, -1.5, smootherstep(1900, 6000, timeMs)),
    galaxyOffsetY: lerp(3.5, -1.0, smootherstep(2200, 6000, timeMs)),
    farOpacity: lerp(0.22, 0.42, smootherstep(650, 4500, timeMs)),
    midOpacity: lerp(0.03, 0.58, smootherstep(1200, 5200, timeMs)),
    nearOpacity: lerp(0, 0.88, smootherstep(1550, 5200, timeMs)),
    streakIntensity: 0.13 * acceleration,
    complete: timeMs >= HERO_CINEMATIC_DURATION_MS
  });
}

function resolveCameraProgress(timeMs) {
  if (timeMs <= 1500) {
    return lerp(0, 0.075, smootherstep(0, 1500, timeMs));
  }
  if (timeMs <= 3500) {
    return lerp(0.075, 0.34, smootherstep(1500, 3500, timeMs));
  }

  return lerp(0.34, 1, easeInOutCubic(normalize(timeMs, 3500, 6000)));
}

export function smootherstep(edge0, edge1, value) {
  const x = normalize(value, edge0, edge1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function easeInOutCubic(value) {
  const x = clamp(value, 0, 1);
  return x < 0.5
    ? 4 * x * x * x
    : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function normalize(value, min, max) {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
