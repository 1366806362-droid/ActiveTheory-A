import assert from 'node:assert/strict';
import { BRAND_GROWTH_NEBULAE } from './galaxyPlanets.js';
import { HERO_GALAXY_V2_CONFIG } from './galaxyPreviewConfig.js';
import {
  readUniverseRenderDebug,
  UNIVERSE_RENDER_DEBUG_PARAMS
} from './universeRenderDebug.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('Brand Growth Galaxy keeps the three stable business entry names', () => {
  assert.deepEqual(
    BRAND_GROWTH_NEBULAE.map(({ name }) => name),
    ['GEO Nebula', '5A Nebula', 'Brand Mind Nebula']
  );
});

test('Business nebulae occupy distinct X, Y, and Z positions', () => {
  for (let axis = 0; axis < 3; axis += 1) {
    assert.equal(new Set(BRAND_GROWTH_NEBULAE.map(({ anchor }) => anchor[axis])).size, 3);
  }
});

test('GEO is forward-right, 5A is upper-rear, and Brand Mind is lower-deep', () => {
  const [geo, fiveA, brandMind] = BRAND_GROWTH_NEBULAE;

  assert.ok(geo.anchor[0] > 0 && geo.anchor[2] > 0);
  assert.ok(fiveA.anchor[0] < 0 && fiveA.anchor[1] > 0 && fiveA.anchor[2] < 0);
  assert.ok(brandMind.anchor[0] < 0 && brandMind.anchor[1] < 0);
  assert.ok(brandMind.anchor[2] < fiveA.anchor[2]);
});

test('GEO remains the densest business nebula', () => {
  const density = ({ coreStars, visibleCoreCount, mainArmCount, auxiliaryArmCount, dustCount, nebulaCount, nodeCount }) => (
    coreStars + visibleCoreCount + mainArmCount + auxiliaryArmCount + dustCount + nebulaCount + nodeCount
  );
  const [geo, fiveA, brandMind] = BRAND_GROWTH_NEBULAE.map(density);

  assert.ok(geo > fiveA);
  assert.ok(fiveA > brandMind);
});

test('Business nebula particle budget stays realtime-friendly', () => {
  const total = BRAND_GROWTH_NEBULAE.reduce((sum, config) => (
    sum
    + config.coreStars
    + config.visibleCoreCount
    + config.coreCount
    + config.mainArmCount
    + config.auxiliaryArmCount
    + config.dustCount
    + config.nebulaCount
    + config.nodeCount
  ), 0);

  assert.ok(total < 2000, `Expected fewer than 2000 business-nebula points, received ${total}.`);
});

test('V1.1 composition shrinks the main galaxy without changing the camera', () => {
  assert.ok(HERO_GALAXY_V2_CONFIG.composition.mainFrameScale >= 0.54);
  assert.ok(HERO_GALAXY_V2_CONFIG.composition.mainFrameScale <= 0.58);
});

test('Business nebulae use non-spherical visual envelopes', () => {
  BRAND_GROWTH_NEBULAE.forEach(({ visualScale }) => {
    assert.equal(visualScale.length, 3);
    assert.ok(new Set(visualScale).size > 1);
  });
});

test('Universe render debug keeps every layer enabled by default', () => {
  const state = readUniverseRenderDebug('');

  assert.ok(Object.values(state).every(Boolean));
});

test('Each Universe render debug URL parameter only disables its own layer', () => {
  Object.entries(UNIVERSE_RENDER_DEBUG_PARAMS).forEach(([targetLayer, parameter]) => {
    const state = readUniverseRenderDebug(`?${parameter}=0`);

    Object.entries(state).forEach(([layer, visible]) => {
      assert.equal(visible, layer !== targetLayer, `${parameter} changed ${layer}`);
    });
  });
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
