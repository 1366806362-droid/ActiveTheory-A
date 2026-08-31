import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  GALAXY_V3_ASSET_TYPES,
  GALAXY_V3_CONFIG,
  GALAXY_V3_V4_CONFIG,
  GALAXY_V3_LAYER_ORDER,
  readGalaxyV3State
} from './galaxyV3Config.js';
import { createGalaxyV3HeroAsset, validateHeroAssetConfig } from './galaxyV3HeroAsset.js';
import { createGalaxyV3Root } from './galaxyV3Root.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('Galaxy V3 is opt-in and leaves the default route disabled', () => {
  assert.equal(readGalaxyV3State('').enabled, false);
  assert.equal(readGalaxyV3State('?galaxyV3=1').enabled, true);
});

test('V3 GPU stars default on only while V3 is active', () => {
  assert.equal(readGalaxyV3State('').useGpuStars, false);
  assert.equal(readGalaxyV3State('?galaxyV3=1').useGpuStars, true);
  assert.equal(readGalaxyV3State('?galaxyV3=1&v3UseGpuStars=0').useGpuStars, false);
});

test('V3 debug layers default on and accept explicit zero switches', () => {
  const defaults = readGalaxyV3State('?galaxyV3=1').debug;
  const disabled = readGalaxyV3State('?galaxyV3=1&debugV3Hero=0&debugV3GpuStars=0&debugV3Foreground=0&debugV3BusinessNebula=0').debug;
  assert.equal(defaults.hero, true);
  assert.equal(defaults.gpuStars, true);
  assert.equal(defaults.foreground, true);
  assert.equal(defaults.businessNebula, true);
  assert.equal(disabled.hero, false);
  assert.equal(disabled.gpuStars, false);
  assert.equal(disabled.foreground, false);
  assert.equal(disabled.businessNebula, false);
});

test('V4 LDI hero is opt-in and exposes layer and support-star debug switches', () => {
  const state = readGalaxyV3State('?galaxyV3=1&galaxyHero=v4&debugV4Core=0&debugV4SupportStars=0&debugV4Isolated=1');
  assert.equal(state.heroVersion, 'v4');
  assert.equal(state.isolated, true);
  assert.equal(state.debug.v4.core, false);
  assert.equal(state.debug.v4.nearArm, true);
  assert.equal(state.debug.v4.supportStars, false);
  assert.equal(readGalaxyV3State('?galaxyV3=1').heroVersion, 'foundation');
});

test('V4 LDI uses five world-space planes with stable far-to-near ordering', () => {
  const { layers } = GALAXY_V3_V4_CONFIG.galaxyHeroAsset;
  assert.equal(GALAXY_V3_V4_CONFIG.galaxyHeroAsset.type, 'ldi-5-layer');
  assert.equal(layers.length, 5);
  assert.deepEqual(layers.map(({ z }) => z), [-0.04, -0.02, 0, 0.02, 0.04]);
  assert.deepEqual(layers.map(({ renderOrder }) => renderOrder), [5, 6, 7, 8, 9]);
  assert.deepEqual(GALAXY_V3_V4_CONFIG.galaxyHeroAsset.position, [0.58, -0.06, 0]);
  assert.deepEqual(GALAXY_V3_V4_CONFIG.galaxyHeroAsset.scale, [2.03, 2.03, 1]);
});

test('V4.4 restrains near LDI spread while preserving five distinct depth factors', () => {
  const { layers } = GALAXY_V3_V4_CONFIG.galaxyHeroAsset;
  const factors = Object.fromEntries(layers.map(({ id, parallaxFactor }) => [id, parallaxFactor]));

  assert.deepEqual(
    layers.map(({ parallaxFactor }) => parallaxFactor),
    [0, 0.24, 0.42, 0.46, 0.58]
  );
  assert.ok(Math.abs(factors.nearArm / 0.56 - 0.8214285714285714) < Number.EPSILON * 2);
  assert.ok(Math.abs(factors.foreground / 0.78 - 0.7435897435897436) < Number.EPSILON * 2);
  assert.ok(factors.foreground > factors.nearArm && factors.nearArm > factors.core);
});

test('Layer order declares far-to-near ownership without a renderer', () => {
  assert.deepEqual(GALAXY_V3_LAYER_ORDER.map(({ id }) => id), [
    'rearDust', 'gpuStars', 'heroAsset', 'businessNebula', 'foregroundDust', 'optionalGlow'
  ]);
  assert.deepEqual(GALAXY_V3_LAYER_ORDER.map(({ depth }) => depth), [
    'far', 'mid-far', 'mid', 'mid-near', 'near', 'near'
  ]);
});

test('Hero asset contract centralizes every required visual field', () => {
  for (const key of [
    'position', 'rotation', 'scale', 'opacity', 'depthBias', 'colorIntensity',
    'bloomIntensity', 'parallaxStrength', 'enabled'
  ]) {
    assert.ok(key in GALAXY_V3_CONFIG.galaxyHeroAsset, `Missing ${key}`);
  }
});

test('Hero asset contract keeps both 2D and 3D future formats open', () => {
  for (const type of ['transparent-image', 'texture-sequence', 'alpha-video', 'glb', 'mesh']) {
    assert.ok(GALAXY_V3_ASSET_TYPES.includes(type));
  }
});

test('Placeholder is a world-space Three group rather than a DOM overlay', () => {
  const asset = createGalaxyV3HeroAsset(GALAXY_V3_CONFIG.galaxyHeroAsset);
  assert.ok(asset.group instanceof THREE.Group);
  assert.equal(asset.group.name, 'GalaxyV3HeroAssetPlaceholder');
  assert.equal(asset.group.children.length, 2);
  asset.dispose();
});

test('Placeholder supports small camera-relative parallax', () => {
  const asset = createGalaxyV3HeroAsset(GALAXY_V3_CONFIG.galaxyHeroAsset);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2, 5);
  asset.update(camera);
  const x = asset.group.position.x;
  camera.position.x += 1;
  asset.update(camera);
  assert.ok(asset.group.position.x > x);
  asset.dispose();
});

test('Invalid transforms are rejected before entering the scene', () => {
  assert.throws(
    () => validateHeroAssetConfig({ ...GALAXY_V3_CONFIG.galaxyHeroAsset, position: [0, Number.NaN, 0] }),
    /finite/
  );
});

test('V3 root reuses exact GPU and Business Nebula group instances', () => {
  const gpuGalaxy = { group: new THREE.Group() };
  const businessNebula = { group: new THREE.Group() };
  const root = createGalaxyV3Root({ state: readGalaxyV3State('?galaxyV3=1'), gpuGalaxy, businessNebula });
  assert.equal(root.layers.gpuStars.children[0], gpuGalaxy.group);
  assert.equal(root.layers.businessNebula.children[0], businessNebula.group);
  assert.equal(root.getStatus().sharedGpuGalaxy, true);
  assert.equal(root.getStatus().sharedBusinessNebula, true);
  root.dispose();
});

test('Hero debug switch hides only the hero layer', () => {
  const root = createGalaxyV3Root({ state: readGalaxyV3State('?galaxyV3=1&debugV3Hero=0') });
  assert.equal(root.layers.heroAsset.visible, false);
  assert.equal(root.layers.gpuStars.visible, true);
  root.dispose();
});

test('GPU stars debug switch hides the support layer', () => {
  const root = createGalaxyV3Root({ state: readGalaxyV3State('?galaxyV3=1&debugV3GpuStars=0') });
  assert.equal(root.layers.gpuStars.visible, false);
  root.dispose();
});

test('Missing future asset safely enables legacy fallback', () => {
  const fallbackGroup = new THREE.Group();
  const config = {
    ...GALAXY_V3_CONFIG,
    galaxyHeroAsset: { ...GALAXY_V3_CONFIG.galaxyHeroAsset, type: 'glb', source: null }
  };
  const root = createGalaxyV3Root({
    state: readGalaxyV3State('?galaxyV3=1'), config, fallbackGroup
  });
  assert.equal(root.fallbackUsed, true);
  assert.equal(root.fallbackMode, 'legacy-procedural');
  assert.equal(fallbackGroup.visible, true);
  root.dispose();
});

test('Debug-off is not treated as an asset failure', () => {
  const fallbackGroup = new THREE.Group();
  const root = createGalaxyV3Root({
    state: readGalaxyV3State('?galaxyV3=1&debugV3Hero=0'), fallbackGroup
  });
  assert.equal(root.fallbackUsed, false);
  assert.equal(fallbackGroup.visible, false);
  root.dispose();
});

test('Asset manifest uses only project-relative web paths', () => {
  const manifestPath = path.resolve('public/assets/galaxy-v3/manifest.json');
  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.galaxyHeroAsset.type, 'placeholder');
  assert.equal(manifest.galaxyHeroAsset.source, null);
  assert.ok(manifest.basePath.startsWith('/assets/galaxy-v3/'));
  assert.doesNotMatch(manifestText, /[A-Za-z]:\\\\|file:\/\//);
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
