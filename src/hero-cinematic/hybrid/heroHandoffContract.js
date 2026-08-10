import { HERO_HANDOFF_THREE_V11 } from './heroHandoffThreeV11.generated.js';

const generated = HERO_HANDOFF_THREE_V11;

export const HANDOFF_PREPARE_PROGRESS = generated.handoff.prepareStart;
export const HANDOFF_START_PROGRESS = generated.handoff.blendStart;
export const HANDOFF_END_PROGRESS = generated.handoff.blendEnd;
export const THREE_READY_PROGRESS = generated.handoff.finalProgress;

export const HERO_HANDOFF_CONTRACT = Object.freeze({
  contractVersion: 'hybrid-scroll-v1.1',
  sourceBaselineVersion: generated.sourceBaselineVersion,
  sourceBaselineSha256: generated.sourceBaselineSha256,
  placeholder: true,
  coordinateSystem: generated.coordinateSystem,
  renderWidth: generated.render.width,
  renderHeight: generated.render.height,
  aspectRatio: generated.render.aspect,
  fps: generated.render.fps,
  duration: generated.render.duration,
  cameraFov: generated.camera.verticalFovDeg,
  cameraVerticalFovDeg: generated.camera.verticalFovDeg,
  cameraHorizontalFovDeg: generated.camera.horizontalFovDeg,
  cameraPositionFinal: generated.camera.position,
  cameraQuaternionXYZW: generated.camera.quaternionXYZW,
  cameraTargetFinal: generated.camera.target,
  cameraNear: generated.camera.near,
  cameraFar: generated.camera.far,
  galaxyMasterAnchor: generated.galaxy.masterAnchor,
  galaxyCoreAnchor: generated.galaxy.coreAnchor,
  entryAnchors: generated.entryAnchors,
  galaxyAnchorScreenX: generated.galaxy.masterAnchor.sourceScreenNormalized[0],
  galaxyAnchorScreenY: generated.galaxy.masterAnchor.sourceScreenNormalized[1],
  galaxyCoreScreenX: generated.galaxy.coreAnchor.sourceScreenNormalized[0],
  galaxyCoreScreenY: generated.galaxy.coreAnchor.sourceScreenNormalized[1],
  galaxyScaleReference: 'TBD',
  galaxyRotationReference: 'TBD',
  backgroundExposure: 'TBD',
  handoffPrepareProgress: HANDOFF_PREPARE_PROGRESS,
  handoffStartProgress: HANDOFF_START_PROGRESS,
  handoffEndProgress: HANDOFF_END_PROGRESS,
  threeReadyProgress: THREE_READY_PROGRESS,
  legacyThreeReference: Object.freeze({
    source: 'Hero Cinematic V2 P1 final frame',
    cameraFov: 54,
    cameraPositionFinal: Object.freeze([8.4, 4, -48]),
    cameraTargetFinal: Object.freeze([24, 7.2, -124]),
    galaxySource: 'H1_HD / Composition D reference'
  })
});
