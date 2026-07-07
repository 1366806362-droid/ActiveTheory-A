import { getNarrativeState } from './narrative.js';

const CAMERA_EMOTION_PROFILES = Object.freeze({
  calm: Object.freeze({
    motionScale: 0.55,
    depthDriftScale: 0.35,
    zOffset: 0,
    targetXOffset: 0.08,
    targetYOffset: 0.24,
    compression: 0
  }),
  focus: Object.freeze({
    motionScale: 0.75,
    depthDriftScale: 0.28,
    zOffset: -0.12,
    targetXOffset: 0.04,
    targetYOffset: 0.28,
    compression: 0.18
  }),
  drift: Object.freeze({
    motionScale: 1.25,
    depthDriftScale: 1.6,
    zOffset: 0.06,
    targetXOffset: 0.12,
    targetYOffset: 0.2,
    compression: -0.05
  })
});

export function startCameraEmotion() {
  return CAMERA_EMOTION_PROFILES.calm;
}

export function updateCameraEmotion(renderState, delta, time) {
  const profile = CAMERA_EMOTION_PROFILES[getNarrativeState()] ?? CAMERA_EMOTION_PROFILES.calm;
  const breathX = Math.sin(time * 0.2) * 0.18 * profile.motionScale;
  const breathY = Math.sin(time * 0.15) * 0.16 * profile.motionScale;
  const breathZ = Math.sin(time * 0.1) * 0.2 * profile.motionScale;
  const depthDrift = Math.sin(time * 0.07) * 0.18 * profile.depthDriftScale;

  renderState.cameraOffset.x = breathX;
  renderState.cameraOffset.y = breathY;
  renderState.cameraOffset.z = profile.zOffset - profile.compression + depthDrift + breathZ;
  renderState.cameraOffset.targetX = profile.targetXOffset;
  renderState.cameraOffset.targetY = profile.targetYOffset;
  renderState.cameraOffset.targetZ = 0;
}

export const cameraEmotionManager = {
  startCameraEmotion,
  updateCameraEmotion
};
