export const HANDOFF_PREPARE_PROGRESS = 0.88;
export const HANDOFF_START_PROGRESS = 0.96;
export const HANDOFF_END_PROGRESS = 1;
export const THREE_READY_PROGRESS = 1;

export const HERO_HANDOFF_CONTRACT = Object.freeze({
  contractVersion: 'hybrid-scroll-v1',
  placeholder: true,
  renderWidth: 1920,
  renderHeight: 1080,
  aspectRatio: '16:9',
  fps: 30,
  duration: 8,
  cameraFov: 'TBD',
  cameraPositionFinal: 'TBD',
  cameraTargetFinal: 'TBD',
  galaxyAnchorScreenX: 'TBD',
  galaxyAnchorScreenY: 'TBD',
  galaxyCoreScreenX: 'TBD',
  galaxyCoreScreenY: 'TBD',
  galaxyScaleReference: 'TBD',
  galaxyRotationReference: 'TBD',
  backgroundExposure: 'TBD',
  handoffPrepareProgress: HANDOFF_PREPARE_PROGRESS,
  handoffStartProgress: HANDOFF_START_PROGRESS,
  handoffEndProgress: HANDOFF_END_PROGRESS,
  threeReadyProgress: THREE_READY_PROGRESS,
  threeReference: Object.freeze({
    source: 'Hero Cinematic V2 P1 final frame',
    cameraFov: 54,
    cameraPositionFinal: Object.freeze([8.4, 4, -48]),
    cameraTargetFinal: Object.freeze([24, 7.2, -124]),
    galaxySource: 'H1_HD / Composition D reference'
  })
});
