let animationFrameId = null;

export function stopLoop() {
  if (animationFrameId === null) {
    return;
  }

  window.cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

export function startLoop({
  scene,
  camera,
  renderer,
  renderState,
  applyRenderState,
  renderFrame = null,
  updates = []
}) {
  stopLoop();

  let lastTime = 0;
  let elapsedTime = 0;
  const maxDelta = 1 / 30;

  function animate(currentTime = 0) {
    const currentSeconds = currentTime * 0.001;
    const rawDelta = lastTime ? currentSeconds - lastTime : 0;
    const delta = Math.min(Math.max(rawDelta, 0), maxDelta);
    lastTime = currentSeconds;
    elapsedTime += delta;

    updates.forEach((update) => {
      update(renderState, delta, elapsedTime);
    });

    applyRenderState(renderState, elapsedTime);
    if (renderFrame) {
      renderFrame();
    } else {
      renderer.render(scene, camera);
    }
    animationFrameId = window.requestAnimationFrame(animate);
  }

  animationFrameId = window.requestAnimationFrame(animate);

  return stopLoop;
}
