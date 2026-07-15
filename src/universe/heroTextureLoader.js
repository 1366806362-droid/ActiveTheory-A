import * as THREE from 'three';

export const HERO_GALAXY_V1_TEXTURE_URLS = Object.freeze({
  color: '/textures/hero/galaxy/main-galaxy-color.webp',
  masks: '/textures/hero/galaxy/main-galaxy-masks.webp'
});

let didReportGalaxyTextureFailure = false;

export function createHeroTextureLoader({
  urls = HERO_GALAXY_V1_TEXTURE_URLS,
  anisotropy = 6
} = {}) {
  const loader = new THREE.TextureLoader();
  const listeners = new Set();
  let status = 'idle';
  let textures = null;
  let activeLoad = null;
  let disposed = false;
  let loadGeneration = 0;
  let lastError = null;

  function emitState() {
    listeners.forEach((listener) => {
      listener({ status, textures, error: lastError });
    });
  }

  function setStatus(nextStatus, error = null) {
    status = nextStatus;
    lastError = error;
    emitState();
  }

  function configureTexture(texture, colorSpace) {
    texture.colorSpace = colorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(Math.max(anisotropy, 4), 8);
    texture.needsUpdate = true;
  }

  function loadTexture(url) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
  }

  function loadGalaxyTextures() {
    if (disposed) {
      return Promise.resolve(null);
    }
    if (status === 'ready') {
      return Promise.resolve(textures);
    }
    if (activeLoad) {
      return activeLoad;
    }

    const generation = ++loadGeneration;

    setStatus('loading');
    const requests = [
      Object.freeze({ key: 'color', promise: loadTexture(urls.color) })
    ];

    if (urls.masks) {
      requests.push(Object.freeze({ key: 'masks', promise: loadTexture(urls.masks) }));
    }

    activeLoad = Promise.allSettled(requests.map((request) => request.promise)).then((results) => {
      const fulfilledTextures = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      const failedResult = results.find((result) => result.status === 'rejected');

      if (disposed || generation !== loadGeneration) {
        fulfilledTextures.forEach((texture) => texture.dispose());
        return null;
      }
      if (failedResult) {
        fulfilledTextures.forEach((texture) => texture.dispose());
        throw failedResult.reason;
      }

      const loaded = Object.fromEntries(results.map((result, index) => [
        requests[index].key,
        result.status === 'fulfilled' ? result.value : null
      ]));
      const color = loaded.color;
      const masks = loaded.masks ?? null;

      configureTexture(color, THREE.SRGBColorSpace);
      if (masks) {
        configureTexture(masks, THREE.NoColorSpace);
      }
      textures = { color, masks };
      setStatus('ready');
      return textures;
    }).catch((error) => {
      if (disposed || generation !== loadGeneration) {
        return null;
      }

      textures = null;
      setStatus('error', error);
      if (!didReportGalaxyTextureFailure) {
        didReportGalaxyTextureFailure = true;
        console.info(
          '[ActiveTheory] Main galaxy textures are unavailable; the procedural galaxy remains active.',
          urls
        );
      }
      return null;
    }).finally(() => {
      if (generation === loadGeneration) {
        activeLoad = null;
      }
    });

    return activeLoad;
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener({ status, textures, error: lastError });
    return () => listeners.delete(listener);
  }

  function dispose() {
    disposed = true;
    loadGeneration += 1;
    listeners.clear();
    textures?.color.dispose();
    textures?.masks?.dispose();
    textures = null;
    activeLoad = null;
    status = 'idle';
    lastError = null;
  }

  return {
    loadGalaxyTextures,
    subscribe,
    getStatus: () => status,
    getTextures: () => textures,
    dispose
  };
}

export const heroTextureLoaderFactory = { createHeroTextureLoader };
