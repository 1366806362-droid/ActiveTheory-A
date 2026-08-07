import * as THREE from 'three';
import { GALAXY_ASSET_PROFILES } from '../universe/galaxyAssetProfiles.js';
import {
  createGalaxyVideoLayer,
  H1_COMPOSITION_D_CONFIG
} from '../universe/galaxyVideoLayer.js';

const GALAXY_BASE_POSITION = new THREE.Vector3(82, 20, -116);

export function createHeroCinematicGalaxy() {
  const group = new THREE.Group();
  const proxy = new THREE.Group();
  const videoLayer = createGalaxyVideoLayer({
    enabled: true,
    profile: GALAXY_ASSET_PROFILES.H1_HD,
    outerRadius: 27,
    extentScale: 3.2,
    localPosition: H1_COMPOSITION_D_CONFIG.localPosition,
    localScale: H1_COMPOSITION_D_CONFIG.localScale,
    localRotationZ: H1_COMPOSITION_D_CONFIG.localRotationZ
  });

  group.name = 'HeroCinematicGalaxyProxy';
  proxy.name = 'HeroCinematicH1HDWrapper';
  proxy.position.copy(GALAXY_BASE_POSITION);
  proxy.rotation.set(
    THREE.MathUtils.degToRad(-4),
    THREE.MathUtils.degToRad(2),
    THREE.MathUtils.degToRad(-10)
  );
  proxy.scale.setScalar(0.78);
  proxy.add(videoLayer.group);
  group.add(proxy);

  function update(timeline) {
    proxy.position.set(
      GALAXY_BASE_POSITION.x + timeline.galaxyOffsetX,
      GALAXY_BASE_POSITION.y + timeline.galaxyOffsetY,
      GALAXY_BASE_POSITION.z
    );
    proxy.scale.setScalar(timeline.galaxyScale);
    videoLayer.update(0, timeline.galaxyReveal);
  }

  function replay() {
    if (!videoLayer.video) return;
    videoLayer.video.currentTime = 0;
    void videoLayer.video.play().catch(() => {});
  }

  function play() {
    if (!videoLayer.video) return;
    void videoLayer.video.play().catch(() => {});
  }

  function freeze() {
    videoLayer.video?.pause();
  }

  function getDiagnostics() {
    return {
      sourceProfile: GALAXY_ASSET_PROFILES.H1_HD.id,
      sourceUrl: GALAXY_ASSET_PROFILES.H1_HD.url,
      composition: 'd',
      wrapperPosition: proxy.position.toArray(),
      wrapperScale: proxy.scale.x,
      video: videoLayer.getDiagnostics()
    };
  }

  function dispose() {
    videoLayer.dispose();
    proxy.clear();
    group.clear();
  }

  return Object.freeze({
    group,
    update,
    replay,
    play,
    freeze,
    getDiagnostics,
    dispose
  });
}
