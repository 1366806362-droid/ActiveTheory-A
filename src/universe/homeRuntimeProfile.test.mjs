import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINAL_HOME_DEFAULTS,
  readHomeRuntimeProfile,
  resolveHomeRuntimeSearch
} from './homeRuntimeProfile.js';

const explicitFinal = new URLSearchParams(FINAL_HOME_DEFAULTS).toString();

test('no visual query resolves to the frozen final HOME profile', () => {
  assert.deepEqual(
    Object.fromEntries(new URLSearchParams(resolveHomeRuntimeSearch(''))),
    FINAL_HOME_DEFAULTS
  );
  const profile = readHomeRuntimeProfile('');
  assert.equal(profile.source, 'final-default');
  assert.deepEqual(profile.galaxy, { enabled: true, hero: 'repaired_m3', art: 'final' });
  assert.equal(profile.earth.hybrid, true);
  assert.equal(profile.earth.production, true);
  assert.equal(profile.earth.heroLock, true);
  assert.equal(profile.home.final, true);
  assert.equal(profile.home.memoryField, true);
  assert.equal(profile.home.meteors, true);
});

test('scene and non-profile switches retain the final default', () => {
  const profile = readHomeRuntimeProfile('?scene=fivea&homeMeteors=0');
  assert.equal(profile.source, 'final-default');
  assert.equal(profile.galaxy.hero, 'repaired_m3');
  assert.equal(profile.earth.heroLock, true);
  assert.equal(profile.home.meteors, false);
});

test('any existing visual selector preserves the complete historical query contract', () => {
  for (const query of [
    '?galaxyV3=0',
    '?galaxyV3=1',
    '?earthV2=0',
    '?earthV2=1',
    '?homeFinalV1=0',
    '?brandMindMemory=0'
  ]) {
    assert.equal(resolveHomeRuntimeSearch(query), query.slice(1));
    assert.equal(readHomeRuntimeProfile(query).source, 'explicit-query');
  }
});

test('the existing explicit final query matches the new default profile', () => {
  const expected = readHomeRuntimeProfile('');
  const actual = readHomeRuntimeProfile(`?${explicitFinal}`);
  assert.deepEqual(actual.galaxy, expected.galaxy);
  assert.deepEqual(actual.earth, expected.earth);
  assert.deepEqual(actual.home, expected.home);
  assert.equal(actual.source, 'explicit-query');
});
