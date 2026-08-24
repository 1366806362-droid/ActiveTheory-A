const TRAIL_LENGTH = 20;
const trailX = new Float32Array(TRAIL_LENGTH);
const trailY = new Float32Array(TRAIL_LENGTH);
const trailLife = new Float32Array(TRAIL_LENGTH);

const interactionState = {
  targetX: 0,
  targetY: 0,
  x: 0,
  y: 0,
  parallaxX: 0,
  parallaxY: 0,
  strength: 0,
  targetStrength: 0,
  proximity: 0,
  targetProximity: 0,
  active: 0,
  targetActive: 0,
  intentVersion: 0,
  intentX: 0,
  intentY: 0,
  trailX,
  trailY,
  trailLife,
  trailLength: TRAIL_LENGTH,
  trailIndex: 0
};

let isInitialized = false;
let pointerDownX = 0;
let pointerDownY = 0;
let pointerDownClientX = 0;
let pointerDownClientY = 0;

function normalizePointer(event) {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;

  return {
    x: (event.clientX / width - 0.5) * 2,
    y: -(event.clientY / height - 0.5) * 2
  };
}

function handlePointerMove(event) {
  const pointer = normalizePointer(event);

  interactionState.targetX = pointer.x;
  interactionState.targetY = pointer.y;
  const distance = Math.min(
    Math.sqrt(
      interactionState.targetX * interactionState.targetX +
      interactionState.targetY * interactionState.targetY
    ),
    1
  );

  interactionState.targetStrength = distance;
  interactionState.targetProximity = 1 - smoothstep(0.18, 0.82, distance);
  interactionState.targetActive = 1;
}

function handlePointerDown(event) {
  if (event.button !== 0) return;

  const pointer = normalizePointer(event);
  pointerDownX = pointer.x;
  pointerDownY = pointer.y;
  pointerDownClientX = event.clientX;
  pointerDownClientY = event.clientY;
}

function handlePointerUp(event) {
  if (event.button !== 0) return;

  const travel = Math.hypot(
    event.clientX - pointerDownClientX,
    event.clientY - pointerDownClientY
  );

  if (travel > 8) return;

  interactionState.intentX = pointerDownX;
  interactionState.intentY = pointerDownY;
  interactionState.intentVersion += 1;
}

function handlePointerLeave() {
  interactionState.targetX = 0;
  interactionState.targetY = 0;
  interactionState.targetStrength = 0;
  interactionState.targetProximity = 0;
  interactionState.targetActive = 0;
}

export function initializeInteraction() {
  if (!isInitialized) {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerleave', handlePointerLeave);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    isInitialized = true;
  }

  return {
    dispose() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      isInitialized = false;
    }
  };
}

export function updateInteraction(renderState, delta) {
  const inputFollow = damping(5.5, delta);
  const parallaxFollow = damping(1.15, delta);
  const energyFollow = damping(3.4, delta);

  interactionState.x += (interactionState.targetX - interactionState.x) * inputFollow;
  interactionState.y += (interactionState.targetY - interactionState.y) * inputFollow;
  interactionState.parallaxX += (interactionState.x - interactionState.parallaxX) * parallaxFollow;
  interactionState.parallaxY += (interactionState.y - interactionState.parallaxY) * parallaxFollow;
  interactionState.strength += (interactionState.targetStrength - interactionState.strength) * energyFollow;
  interactionState.proximity += (interactionState.targetProximity - interactionState.proximity) * energyFollow;
  interactionState.active += (interactionState.targetActive - interactionState.active) * energyFollow;
  updateTrail(delta);

  renderState.cameraOffset.x += interactionState.parallaxX * 0.16;
  renderState.cameraOffset.y += interactionState.parallaxY * 0.065;
  renderState.cameraOffset.z += interactionState.strength * 0.085;
  renderState.cameraOffset.targetX += interactionState.parallaxX * 0.075;
  renderState.cameraOffset.targetY += interactionState.parallaxY * 0.045;
}

function updateTrail(delta) {
  const trailDecay = Math.exp(-5.8 * delta);

  for (let i = 0; i < TRAIL_LENGTH; i += 1) {
    trailLife[i] *= trailDecay;
  }

  if (interactionState.active < 0.01 && interactionState.targetActive < 0.01) {
    return;
  }

  interactionState.trailIndex = (interactionState.trailIndex + 1) % TRAIL_LENGTH;
  trailX[interactionState.trailIndex] = interactionState.x;
  trailY[interactionState.trailIndex] = interactionState.y;
  trailLife[interactionState.trailIndex] = 0.55 + interactionState.active * 0.45;
}

function damping(speed, delta) {
  return 1 - Math.exp(-speed * delta);
}

function smoothstep(edge0, edge1, value) {
  const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return x * x * (3 - 2 * x);
}

export function getInteractionState() {
  return interactionState;
}

export const interactionManager = {
  initializeInteraction,
  updateInteraction,
  getInteractionState
};
