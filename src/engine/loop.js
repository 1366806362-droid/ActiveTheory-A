let animationFrameId = null;
let loopFrameCount = 0;
let measuredSeconds = 0;

export function getLoopStatus() {
  return { activeRafChains: animationFrameId === null ? 0 : 1,
    frames: loopFrameCount, averageFps: measuredSeconds > 0 ? (loopFrameCount - 1) / measuredSeconds : null };
}

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
  updates = [],
  sampleTime = null
}) {
  stopLoop();
  loopFrameCount = 0;
  measuredSeconds = 0;

  let lastTime = 0;
  let elapsedTime = 0;
  const maxDelta = 1 / 30;

  function animate(currentTime = 0) {
    const currentSeconds = currentTime * 0.001;
    const rawDelta = lastTime ? currentSeconds - lastTime : 0;
    const delta = Math.min(Math.max(rawDelta, 0), maxDelta);
    lastTime = currentSeconds;
    elapsedTime += delta;
    loopFrameCount += 1;
    measuredSeconds += rawDelta;

    updates.forEach((update) => {
      update(renderState, sampleTime === null ? delta : 0, sampleTime ?? elapsedTime);
    });

    applyRenderState(renderState, sampleTime ?? elapsedTime);
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
