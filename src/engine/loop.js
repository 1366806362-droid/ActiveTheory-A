let lastTime = 0;

export function startLoop({ scene, camera, renderer, renderState, applyRenderState, updates = [] }) {
  function animate(currentTime = 0) {
    const time = currentTime * 0.001;
    const delta = lastTime ? time - lastTime : 0;
    lastTime = time;

    updates.forEach((update) => {
      update(renderState, delta, time);
    });

    applyRenderState(renderState, time);
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }

  animate();
}
