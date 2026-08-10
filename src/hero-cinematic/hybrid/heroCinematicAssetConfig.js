export const HERO_CINEMATIC_ASSET_MODES = Object.freeze({
  PLACEHOLDER: 'placeholder',
  FINAL: 'final'
});

export const HERO_CINEMATIC_ASSET_CONFIG = Object.freeze({
  cinematicAssetMode: HERO_CINEMATIC_ASSET_MODES.PLACEHOLDER,
  final: Object.freeze({
    master: '/cinematic/hero-v2/hero-cinematic-v2-master.webm',
    gop6: '/cinematic/hero-v2/hero-cinematic-v2-gop6.webm',
    gop12: '/cinematic/hero-v2/hero-cinematic-v2-gop12.webm'
  })
});

export function resolveHeroCinematicAsset({
  placeholderSource,
  mode = HERO_CINEMATIC_ASSET_CONFIG.cinematicAssetMode
} = {}) {
  if (!placeholderSource) throw new Error('A placeholder cinematic source is required.');

  if (mode === HERO_CINEMATIC_ASSET_MODES.FINAL) {
    return Object.freeze({
      mode,
      source: HERO_CINEMATIC_ASSET_CONFIG.final.master,
      fallbackSource: placeholderSource,
      placeholder: false
    });
  }

  return Object.freeze({
    mode: HERO_CINEMATIC_ASSET_MODES.PLACEHOLDER,
    source: placeholderSource,
    fallbackSource: null,
    placeholder: true
  });
}
