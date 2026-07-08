const interactionState = {
  targetX: 0,
  targetY: 0,
  x: 0,
  y: 0,
  strength: 0,
  targetStrength: 0
};

let isInitialized = false;

function handlePointerMove(event) {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;

  interactionState.targetX = (event.clientX / width - 0.5) * 2;
  interactionState.targetY = -(event.clientY / height - 0.5) * 2;
  interactionState.targetStrength = Math.min(
    Math.sqrt(
      interactionState.targetX * interactionState.targetX +
      interactionState.targetY * interactionState.targetY
    ),
    1
  );
}

function handlePointerLeave() {
  interactionState.targetX = 0;
  interactionState.targetY = 0;
  interactionState.targetStrength = 0;
}

export function initializeInteraction() {
  if (!isInitialized) {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerleave', handlePointerLeave);
    isInitialized = true;
  }

  return {
    dispose() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      isInitialized = false;
    }
  };
}

export function updateInteraction(renderState, delta) {
  const follow = Math.min(delta * 3.2, 1);

  interactionState.x += (interactionState.targetX - interactionState.x) * follow;
  interactionState.y += (interactionState.targetY - interactionState.y) * follow;
  interactionState.strength += (interactionState.targetStrength - interactionState.strength) * follow;

  renderState.cameraOffset.x += interactionState.x * 0.055;
  renderState.cameraOffset.y += interactionState.y * 0.025;
  renderState.cameraOffset.targetX += interactionState.x * 0.045;
  renderState.cameraOffset.targetY += interactionState.y * 0.028;
}

export function getInteractionState() {
  return interactionState;
}

export const interactionManager = {
  initializeInteraction,
  updateInteraction,
  getInteractionState
};
