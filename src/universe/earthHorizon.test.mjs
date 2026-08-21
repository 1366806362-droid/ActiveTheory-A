import assert from 'node:assert/strict';
import {
  EARTH_V2_HERO_COMPOSITION,
  readEarthV2State
} from './earthHorizon.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('Earth V2 is explicit opt-in', () => {
  assert.equal(readEarthV2State('').enabled, false);
  assert.equal(readEarthV2State('?earthV2=0').enabled, false);
  assert.equal(readEarthV2State('?earthV2=1').enabled, true);
});

test('Earth V2 composition stays cropped in the lower-left foreground', () => {
  assert.ok(EARTH_V2_HERO_COMPOSITION.position[0] < 0);
  assert.ok(EARTH_V2_HERO_COMPOSITION.position[1] < 0);
  assert.ok(EARTH_V2_HERO_COMPOSITION.position[2] > 0);
  assert.ok(EARTH_V2_HERO_COMPOSITION.scale > 5);
  assert.ok(EARTH_V2_HERO_COMPOSITION.atmosphereRadius > 1.9);
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
