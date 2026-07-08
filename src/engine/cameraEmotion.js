import { getNarrativeState } from './narrative.js';

const CAMERA_EMOTION_PROFILES = Object.freeze({
  calm: Object.freeze({
    motionScale: 0.55,
    depthDriftScale: 0.35,
    zOffset: -0.18,
    targetXOffset: 0.02,
    targetYOffset: 0.3,
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
  const cinematicDriftX = Math.sin(time * 0.034) * 0.28 * profile.motionScale;
  const secondaryDriftX = Math.sin(time * 0.017) * 0.09;
  const cinematicDriftY = Math.sin(time * 0.028) * 0.07 * profile.motionScale;
  const dollyBreath = Math.sin(time * 0.03) * 0.34 * profile.depthDriftScale;
  const depthFloat = Math.sin(time * 0.013) * 0.12;
  const targetBreathX = Math.sin(time * 0.038) * 0.12;
  const targetBreathY = Math.sin(time * 0.031) * 0.048;

  renderState.cameraOffset.x = cinematicDriftX + secondaryDriftX;
  renderState.cameraOffset.y = cinematicDriftY;
  renderState.cameraOffset.z = profile.zOffset - profile.compression + dollyBreath + depthFloat - 0.08;
  renderState.cameraOffset.targetX = profile.targetXOffset + targetBreathX;
  renderState.cameraOffset.targetY = profile.targetYOffset + targetBreathY;
  renderState.cameraOffset.targetZ = Math.sin(time * 0.028) * 0.11;
}

export const cameraEmotionManager = {
  startCameraEmotion,
  updateCameraEmotion
};
