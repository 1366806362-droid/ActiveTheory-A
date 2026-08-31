import assert from 'node:assert/strict';
import {
  EARTH_V2_HERO_COMPOSITION,
  EARTH_V3_CINEMATIC_PROFILE,
  readEarthV2State,
  readEarthV3State
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

test('Earth V3 is explicit opt-in and leaves the V2 baseline selectable', () => {
  assert.equal(readEarthV3State('').enabled, false);
  assert.equal(readEarthV3State('?earthV2=1').enabled, false);
  assert.equal(readEarthV3State('?earthV2=1&earthV3=0').enabled, false);
  assert.equal(readEarthV3State('?earthV2=1&earthV3=1').enabled, true);
});

test('Earth V3 keeps real shell separation without adding a draw call', () => {
  assert.ok(EARTH_V3_CINEMATIC_PROFILE.cityRadius > EARTH_V3_CINEMATIC_PROFILE.surfaceRadius);
  assert.ok(EARTH_V3_CINEMATIC_PROFILE.cloudRadius > EARTH_V3_CINEMATIC_PROFILE.cityRadius);
  assert.ok(EARTH_V3_CINEMATIC_PROFILE.atmosphereRadius > EARTH_V3_CINEMATIC_PROFILE.cloudRadius);
  assert.ok(EARTH_V3_CINEMATIC_PROFILE.atmosphereRadius > EARTH_V2_HERO_COMPOSITION.atmosphereRadius);
  assert.equal(EARTH_V3_CINEMATIC_PROFILE.drawCalls, 4);
  assert.equal(EARTH_V3_CINEMATIC_PROFILE.addedDrawCalls, 0);
});

test('Earth V3 raises local detail weights while keeping the surface dominant', () => {
  const { surface, city, clouds } = EARTH_V3_CINEMATIC_PROFILE.textureWeights;
  assert.equal(EARTH_V3_CINEMATIC_PROFILE.version, 'v3.1-cinematic');
  assert.ok(surface > city);
  assert.ok(city > clouds);
  assert.ok(city < 0.4);
  assert.ok(clouds > 0.18 && clouds < 0.24);
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
