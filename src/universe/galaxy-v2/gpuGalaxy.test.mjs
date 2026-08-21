import assert from 'node:assert/strict';
import {
  GPU_GALAXY_V2_CONFIG,
  GPU_GALAXY_V4_SUPPORT_CONFIG,
  readGpuGalaxyV2State
} from './galaxyV2Config.js';
import { GPU_GALAXY_HYBRID_CONFIG, readGpuGalaxyHybridState } from './galaxyHybridConfig.js';
import { createGpuGalaxyGeometry } from './gpuGalaxyGeometry.js';
import { createHybridGalaxyArmGeometry, createHybridGalaxyLayers } from './hybridGalaxyLayers.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('GPU Galaxy V2 is opt-in and defaults to 100k particles', () => {
  assert.equal(readGpuGalaxyV2State('').enabled, false);
  assert.equal(readGpuGalaxyV2State('?galaxyV2=1').enabled, true);
  assert.equal(GPU_GALAXY_V2_CONFIG.particleCount, 100000);
});

test('GPU Galaxy V2 particle layers sum to the configured budget', () => {
  assert.equal(
    GPU_GALAXY_V2_CONFIG.coreStarCount
      + GPU_GALAXY_V2_CONFIG.armStarCount
      + GPU_GALAXY_V2_CONFIG.haloStarCount
      + GPU_GALAXY_V2_CONFIG.dustCount,
    GPU_GALAXY_V2_CONFIG.particleCount
  );
});

test('GPU Galaxy V2 generates four spiral arms and non-flat Z depth', () => {
  const generated = createGpuGalaxyGeometry(GPU_GALAXY_V2_CONFIG);
  const starPositions = generated.starGeometry.getAttribute('position');
  const dustPositions = generated.dustGeometry.getAttribute('position');
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let index = 0; index < starPositions.count; index += 1) {
    const z = starPositions.getZ(index);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  assert.equal(GPU_GALAXY_V2_CONFIG.armCount, 4);
  assert.equal(starPositions.count + dustPositions.count, 100000);
  assert.ok(maxZ - minZ > 0.5, `Expected substantial Z depth, received ${maxZ - minZ}`);
  assert.equal(generated.counts.core, 15000);
  assert.equal(generated.counts.arms, 60000);
  assert.equal(generated.counts.halo, 7000);
  assert.equal(generated.counts.dust, 18000);

  generated.starGeometry.dispose();
  generated.dustGeometry.dispose();
});

test('V4 support stars preserve the particle budget without galaxy structure', () => {
  const generated = createGpuGalaxyGeometry(GPU_GALAXY_V4_SUPPORT_CONFIG);
  const types = generated.starGeometry.getAttribute('aType');
  let brightCount = 0;
  for (let index = 0; index < types.count; index += 1) {
    if (types.getX(index) === 1) brightCount += 1;
  }

  assert.equal(GPU_GALAXY_V4_SUPPORT_CONFIG.armCount, 0);
  assert.equal(generated.counts.far, 68000);
  assert.equal(generated.counts.mid, 12000);
  assert.equal(generated.counts.near, 2000);
  assert.equal(generated.counts.total, GPU_GALAXY_V2_CONFIG.particleCount);
  assert.equal(brightCount, 24);
  generated.starGeometry.dispose();
  generated.dustGeometry.dispose();
});

test('Galaxy Hybrid is explicitly opt-in and adds two draw calls', () => {
  assert.equal(readGpuGalaxyHybridState('').enabled, false);
  assert.equal(readGpuGalaxyHybridState('?galaxyHybrid=0').enabled, false);
  assert.equal(readGpuGalaxyHybridState('?galaxyHybrid=1').enabled, true);
  assert.equal(GPU_GALAXY_HYBRID_CONFIG.addedDrawCalls, 2);
});

test('Hybrid arm volume merges both primary arms into one non-flat geometry', () => {
  const geometry = createHybridGalaxyArmGeometry(GPU_GALAXY_V2_CONFIG);
  const positions = geometry.getAttribute('position');
  const armIndices = geometry.getAttribute('aArmIndex');
  let minZ = Infinity;
  let maxZ = -Infinity;
  const arms = new Set();

  for (let index = 0; index < positions.count; index += 1) {
    minZ = Math.min(minZ, positions.getZ(index));
    maxZ = Math.max(maxZ, positions.getZ(index));
    arms.add(armIndices.getX(index));
  }

  assert.deepEqual([...arms], [0, 1]);
  assert.ok(maxZ - minZ > 0.1, `Expected hybrid volume depth, received ${maxZ - minZ}`);
  assert.ok(geometry.index.count > 0);
  geometry.dispose();
});

test('Hybrid layers use one arm mesh and one core mesh', () => {
  const hybrid = createHybridGalaxyLayers(GPU_GALAXY_V2_CONFIG);
  assert.equal(hybrid.drawCalls, 2);
  assert.equal(hybrid.group.children.length, 2);
  hybrid.dispose();
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
