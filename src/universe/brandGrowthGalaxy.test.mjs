import assert from 'node:assert/strict';
import {
  BRAND_GROWTH_NEBULAE,
  BRAND_GROWTH_V4_HOME_COMPOSITION,
  BUSINESS_INTERACTION_DEBUG_PARAMS,
  readBusinessHoverTarget,
  readBusinessInteractionDebug
} from './galaxyPlanets.js';
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

test('V4 home composition preserves depth separation and descending visual weight', () => {
  const [geo, fiveA, brandMind] = BRAND_GROWTH_V4_HOME_COMPOSITION;

  assert.ok(geo.position[0] > fiveA.position[0]);
  assert.ok(geo.position[2] > fiveA.position[2]);
  assert.ok(fiveA.position[1] > geo.position[1]);
  assert.ok(brandMind.position[1] < 0);
  assert.ok(brandMind.position[2] < fiveA.position[2]);
  assert.ok(geo.opacity > fiveA.opacity && fiveA.opacity > brandMind.opacity);
  assert.ok(geo.layers.core > fiveA.layers.core);
  assert.ok(fiveA.layers.flow > fiveA.layers.core);
  assert.ok(brandMind.layers.dust > brandMind.layers.visibleCore);
});

test('V5.1 restores business-nebula visibility by roughly twelve percent without changing hierarchy', () => {
  const [geo, fiveA, brandMind] = BRAND_GROWTH_V4_HOME_COMPOSITION;
  const baselines = [0.78, 0.64, 0.59];
  for (const [index, nebula] of [geo, fiveA, brandMind].entries()) {
    const gain = nebula.opacity / baselines[index] - 1;
    assert.ok(gain >= 0.10 && gain <= 0.15);
  }
  assert.ok(geo.opacity > fiveA.opacity && fiveA.opacity > brandMind.opacity);
});

test('V1.2 assigns distinct signal, flow, and memory identities without adding systems', () => {
  const [geo, fiveA, brandMind] = BRAND_GROWTH_V4_HOME_COMPOSITION;

  assert.deepEqual(
    BRAND_GROWTH_V4_HOME_COMPOSITION.map(({ identity }) => identity.mode),
    ['signal', 'flow', 'memory']
  );
  assert.ok(geo.identity.coreConcentration > 0.6);
  assert.ok(geo.identity.railCount >= 3 && geo.identity.railCount <= 5);
  assert.ok(fiveA.identity.flowClusters >= 4);
  assert.ok(brandMind.identity.haloSpread > 1.5);
  assert.ok(geo.identity.pointSizes.cluster < fiveA.identity.pointSizes.cluster);
  assert.ok(brandMind.identity.pointSizes.flow > fiveA.identity.pointSizes.flow);
  assert.ok(brandMind.layers.visibleCore < 0.1);
  assert.ok(brandMind.layers.core < 0.05);
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

test('V1.4 business labels stay minimal and bound to the existing nebulae', () => {
  assert.deepEqual(
    BRAND_GROWTH_NEBULAE.map(({ label }) => label),
    ['GEO', '5A', 'BRAND MIND']
  );
  BRAND_GROWTH_NEBULAE.forEach(({ labelOffset }) => {
    assert.equal(labelOffset.length, 3);
  });
});

test('V1.4 labels and hover can be disabled independently by URL flags', () => {
  assert.deepEqual(readBusinessInteractionDebug(''), { labels: true, hover: true });
  Object.entries(BUSINESS_INTERACTION_DEBUG_PARAMS).forEach(([target, parameter]) => {
    const state = readBusinessInteractionDebug(`?${parameter}=0`);
    Object.entries(state).forEach(([key, enabled]) => {
      assert.equal(enabled, key !== target, `${parameter} changed ${key}`);
    });
  });
});

test('V1.4.1 browser gate can force one existing hover target without changing layout', () => {
  assert.equal(readBusinessHoverTarget('?debugBusinessHover=geo'), 'GEO Nebula');
  assert.equal(readBusinessHoverTarget('?debugBusinessHover=5a'), '5A Nebula');
  assert.equal(readBusinessHoverTarget('?debugBusinessHover=brandMind'), 'Brand Mind Nebula');
  assert.equal(readBusinessHoverTarget('?debugBusinessHover=0'), null);
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
