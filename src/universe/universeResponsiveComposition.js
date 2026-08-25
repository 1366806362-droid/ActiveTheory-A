import { VIEWPORT_MODES } from '../engine/viewport.js';

export const UNIVERSE_V4_RESPONSIVE_COMPOSITION = Object.freeze({
  [VIEWPORT_MODES.DESKTOP]: freezeComposition({
    galaxyRoot: { position: [0.12, 0.4, 0], scale: 1.42 },
    heroAssetLayer: { position: [0, 0, 0], scale: 1 },
    gpuStarsLayer: { position: [0, 0, 0], scale: 1 }
  }),
  [VIEWPORT_MODES.MOBILE_PORTRAIT]: freezeComposition({
    galaxyRoot: { position: [-0.02, 0.05, 0], scale: 1 },
    heroAssetLayer: { position: [-0.75, 0.85, 0], scale: 0.58 },
    gpuStarsLayer: { position: [0, 0.12, -0.02], scale: 0.86 }
  }),
  [VIEWPORT_MODES.MOBILE_LANDSCAPE]: freezeComposition({
    galaxyRoot: { position: [0.02, 0.24, 0], scale: 1.15 },
    heroAssetLayer: { position: [-0.18, 0.14, 0], scale: 0.82 },
    gpuStarsLayer: { position: [0, 0.04, -0.02], scale: 0.92 }
  })
});

export function resolveUniverseV4Composition(mode) {
  return UNIVERSE_V4_RESPONSIVE_COMPOSITION[mode]
    ?? UNIVERSE_V4_RESPONSIVE_COMPOSITION[VIEWPORT_MODES.DESKTOP];
}

function freezeComposition(composition) {
  return Object.freeze(Object.fromEntries(Object.entries(composition).map(([key, value]) => [
    key,
    Object.freeze({
      position: Object.freeze([...value.position]),
      scale: value.scale
    })
  ])));
}
