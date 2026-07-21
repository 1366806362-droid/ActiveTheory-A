const createProfile = (profile) => Object.freeze(profile);

export const GALAXY_ASSET_PROFILES = Object.freeze({
  H1_720: createProfile({
    id: 'h1-720',
    url: '/videos/hero/galaxy/h1-galaxy-alpha.webm',
    width: 1280,
    height: 720,
    fps: 24,
    duration: 8,
    hasAlpha: true,
    fallbackProfile: 'v24',
    description: 'Legacy 720p H1 transparent video retained for isolated comparison.'
  }),
  H1_HD: createProfile({
    id: 'h1-hd',
    url: '/videos/hero/galaxy/h1-galaxy-alpha-hd.webm',
    width: 1920,
    height: 1080,
    fps: 24,
    duration: 8,
    hasAlpha: true,
    fallbackProfile: 'v24',
    description: 'Current production H1-HD transparent galaxy resource.'
  }),
  H1_4K: createProfile({
    id: 'h1-4k',
    url: '/videos/hero/galaxy/h1-galaxy-alpha-4k.webm',
    width: 3840,
    height: 2160,
    fps: 24,
    duration: 8,
    hasAlpha: true,
    fallbackProfile: 'h1-hd',
    description: 'Reserved 4K H1 transparent galaxy resource generated on the home workstation.'
  }),
  V24: createProfile({
    id: 'v24',
    url: null,
    width: null,
    height: null,
    fps: null,
    duration: null,
    hasAlpha: true,
    fallbackProfile: null,
    description: 'Stable E2 texture plus GalaxyAtmosphere V2.4 renderer fallback.'
  })
});

const PROFILES_BY_ID = Object.freeze(Object.fromEntries(
  Object.values(GALAXY_ASSET_PROFILES).map((profile) => [profile.id, profile])
));

export function getGalaxyAssetProfile(profileOrId) {
  if (profileOrId && typeof profileOrId === 'object') return profileOrId;
  return PROFILES_BY_ID[profileOrId] ?? GALAXY_ASSET_PROFILES.H1_HD;
}

export function isGalaxyVideoProfile(profileOrId) {
  if (!profileOrId) return false;
  return Boolean(getGalaxyAssetProfile(profileOrId).url);
}

export function readGalaxyAssetSelection(search = '') {
  const params = new URLSearchParams(search);
  const version = params.get('galaxyVersion');

  if (version === 'v24' || version === 'v1') {
    return Object.freeze({
      requestedProfile: GALAXY_ASSET_PROFILES.V24,
      composition: null,
      legacyPreview: null
    });
  }

  if (params.get('galaxyAsset') === GALAXY_ASSET_PROFILES.H1_4K.id) {
    return Object.freeze({
      requestedProfile: GALAXY_ASSET_PROFILES.H1_4K,
      composition: 'd',
      legacyPreview: 'h1-4k'
    });
  }

  const legacyPreview = params.get('galaxyVideoPreview');
  const requestedProfile = legacyPreview === 'h1'
    ? GALAXY_ASSET_PROFILES.H1_720
    : GALAXY_ASSET_PROFILES.H1_HD;

  return Object.freeze({
    requestedProfile,
    composition: params.get('galaxyComposition') === 'classic' ? 'classic' : 'd',
    legacyPreview: requestedProfile.id
  });
}
