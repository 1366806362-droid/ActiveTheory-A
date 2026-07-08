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
  const cinematicDriftX = Math.sin(time * 0.065) * 0.34 * profile.motionScale;
  const secondaryDriftX = Math.sin(time * 0.031) * 0.12;
  const cinematicDriftY = Math.sin(time * 0.045) * 0.1 * profile.motionScale;
  const dollyBreath = Math.sin(time * 0.055) * 0.42 * profile.depthDriftScale;
  const depthFloat = Math.sin(time * 0.021) * 0.16;
  const targetBreathX = Math.sin(time * 0.052) * 0.14;
  const targetBreathY = Math.sin(time * 0.041) * 0.055;

  renderState.cameraOffset.x = cinematicDriftX + secondaryDriftX;
  renderState.cameraOffset.y = cinematicDriftY;
  renderState.cameraOffset.z = profile.zOffset - profile.compression + dollyBreath + depthFloat - 0.08;
  renderState.cameraOffset.targetX = profile.targetXOffset + targetBreathX;
  renderState.cameraOffset.targetY = profile.targetYOffset + targetBreathY;
  renderState.cameraOffset.targetZ = Math.sin(time * 0.035) * 0.08;
}

export const cameraEmotionManager = {
  startCameraEmotion,
  updateCameraEmotion
};
