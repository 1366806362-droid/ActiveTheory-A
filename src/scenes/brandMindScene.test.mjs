import assert from 'node:assert/strict';
import { BRAND_MIND_VISUAL_V131 } from './brandMindScene.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('Brand Mind final balance preserves three visual languages across six association nodes', () => {
  assert.equal(BRAND_MIND_VISUAL_V131.associationNodeCount, 6);
  assert.equal(BRAND_MIND_VISUAL_V131.dominantNearNodeScaleReduction, 0.17);
  assert.equal(BRAND_MIND_VISUAL_V131.farNodeCohesionGain, 0.1);
  assert.deepEqual(
    BRAND_MIND_VISUAL_V131.associationNodeTypes,
    ['particle-shell', 'soft-glow', 'sparse-wire']
  );
});

test('Brand Mind final balance raises mid-low core density without adding particles', () => {
  assert.equal(BRAND_MIND_VISUAL_V131.coreParticleLayerCount, 3);
  assert.ok(BRAND_MIND_VISUAL_V131.coreEffectiveRadius >= 0.75);
  assert.equal(BRAND_MIND_VISUAL_V131.coreMidLowDensityGain, 0.12);
  assert.ok(BRAND_MIND_VISUAL_V131.nucleusParticleCount >= 80);
  assert.ok(BRAND_MIND_VISUAL_V131.nucleusParticleCount <= 140);
  assert.ok(BRAND_MIND_VISUAL_V131.coreParticleCount <= 500);
  assert.equal(BRAND_MIND_VISUAL_V131.memoryHaloParticleCount, 520);
  assert.ok(BRAND_MIND_VISUAL_V131.memoryHaloMaxPointSize <= 1.6);
});

test('Brand Mind final balance keeps internal circulation and four forming associations batched', () => {
  assert.ok(BRAND_MIND_VISUAL_V131.internalAssociationFlowCount >= 5);
  assert.ok(BRAND_MIND_VISUAL_V131.internalAssociationFlowCount <= 8);
  assert.equal(BRAND_MIND_VISUAL_V131.internalCirculationParticleCount, 18);
  assert.equal(BRAND_MIND_VISUAL_V131.shortAssociationFlowCount, 4);
  assert.ok(BRAND_MIND_VISUAL_V131.shortAssociationFlowOpacity >= 0.35);
  assert.ok(BRAND_MIND_VISUAL_V131.shortAssociationFlowOpacity <= 0.37);
  assert.ok(BRAND_MIND_VISUAL_V131.associationPathCount < BRAND_MIND_VISUAL_V131.associationNodeCount);
  assert.equal(BRAND_MIND_VISUAL_V131.associationPathsBroken, true);
  assert.equal(BRAND_MIND_VISUAL_V131.outerShellIncomplete, true);
});

test('Brand Mind final balance keeps the blue-led palette with one muted violet accent', () => {
  assert.deepEqual(
    BRAND_MIND_VISUAL_V131.palette,
    ['deep-blue', 'icy-blue', 'silver-white', 'muted-violet-accent']
  );
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
