export function createHeroCinematicDebug({
  enabled,
  onTogglePause,
  onReplay,
  onJump
}) {
  if (!enabled) {
    return Object.freeze({ update() {}, dispose() {} });
  }

  const root = document.createElement('aside');
  let lastUpdateAt = 0;

  root.className = 'hero-cinematic-debug';
  root.setAttribute('aria-label', 'Hero Cinematic V2 debug');
  document.body.append(root);
  document.addEventListener('keydown', handleKeyDown);

  function update(status, now = 0) {
    if (now - lastUpdateAt < 100 && !status.completed) return;
    lastUpdateAt = now;
    root.textContent = [
      `PHASE ${status.phase.id} · ${status.phase.name}`,
      `PROGRESS ${status.progress.toFixed(3)} · ${status.elapsedMs.toFixed(0)}ms`,
      `CAM ${formatVector(status.camera.position)}`,
      `LOOK ${formatVector(status.camera.target)}`,
      `FOV ${status.camera.fov.toFixed(2)}`,
      `FPS ${formatFps(status.performance)}`,
      `STARS ${status.particleCounts.far} / ${status.particleCounts.mid} / ${status.particleCounts.near}`,
      'SPACE pause · R replay · 1–3 jump'
    ].join('\n');
  }

  function handleKeyDown(event) {
    if (event.code === 'Space') {
      event.preventDefault();
      onTogglePause();
      return;
    }
    if (event.key.toLowerCase() === 'r') {
      onReplay();
      return;
    }
    if (['1', '2', '3'].includes(event.key)) {
      onJump(Number(event.key));
    }
  }

  function dispose() {
    document.removeEventListener('keydown', handleKeyDown);
    root.remove();
  }

  return Object.freeze({ update, dispose });
}

function formatVector(vector) {
  return vector.map((value) => value.toFixed(2)).join(' ');
}

function formatFps(performance) {
  if (!performance?.averageFps) return 'MEASURING';
  return `${performance.averageFps.toFixed(1)} · LOW ${performance.onePercentLow.toFixed(1)}`;
}
