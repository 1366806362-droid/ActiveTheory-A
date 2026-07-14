import * as THREE from 'three';

export const EARTH_TEXTURE_URLS = Object.freeze({
  surface: '/textures/hero/earth/earth-night-surface.webp',
  city: '/textures/hero/earth/earth-city-lights.webp',
  clouds: '/textures/hero/earth/earth-clouds.webp'
});

let didReportEarthTextureFailure = false;

export function createEarthTextureLoader({
  urls = EARTH_TEXTURE_URLS,
  anisotropy = 6
} = {}) {
  const loader = new THREE.TextureLoader();
  const listeners = new Set();
  let status = 'idle';
  let textures = null;
  let activeLoad = null;
  let disposed = false;
  let generation = 0;
  let lastError = null;

  function emitState() {
    listeners.forEach((listener) => listener({ status, textures, error: lastError }));
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
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(Math.max(anisotropy, 4), 8);
    texture.needsUpdate = true;
  }

  function loadTexture(url) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
  }

  function loadEarthTextures() {
    if (disposed) return Promise.resolve(null);
    if (status === 'ready') return Promise.resolve(textures);
    if (activeLoad) return activeLoad;

    const loadGeneration = ++generation;

    setStatus('loading');
    activeLoad = Promise.allSettled([
      loadTexture(urls.surface),
      loadTexture(urls.city),
      loadTexture(urls.clouds)
    ]).then((results) => {
      const loaded = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      const failed = results.find((result) => result.status === 'rejected');

      if (disposed || loadGeneration !== generation) {
        loaded.forEach((texture) => texture.dispose());
        return null;
      }
      if (failed) {
        loaded.forEach((texture) => texture.dispose());
        throw failed.reason;
      }

      const [surface, city, clouds] = loaded;

      configureTexture(surface, THREE.SRGBColorSpace);
      configureTexture(city, THREE.NoColorSpace);
      configureTexture(clouds, THREE.SRGBColorSpace);
      textures = { surface, city, clouds };
      setStatus('ready');
      return textures;
    }).catch((error) => {
      if (disposed || loadGeneration !== generation) return null;

      textures = null;
      setStatus('error', error);
      if (!didReportEarthTextureFailure) {
        didReportEarthTextureFailure = true;
        console.info(
          '[ActiveTheory] Earth textures are unavailable; the procedural Earth remains active.',
          urls
        );
      }
      return null;
    }).finally(() => {
      if (loadGeneration === generation) activeLoad = null;
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
    generation += 1;
    listeners.clear();
    Object.values(textures || {}).forEach((texture) => texture.dispose());
    textures = null;
    activeLoad = null;
    status = 'idle';
    lastError = null;
  }

  return {
    loadEarthTextures,
    subscribe,
    getStatus: () => status,
    getTextures: () => textures,
    dispose
  };
}

export const earthTextureLoaderFactory = { createEarthTextureLoader };
