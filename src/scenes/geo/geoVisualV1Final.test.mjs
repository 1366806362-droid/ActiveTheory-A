import assert from 'node:assert/strict';
import { GEO_BUSINESS_TEXT_ART_PROFILE } from './geoBusinessClusters.js';
import { GEO_CINEMATIC_CORE_ART_PROFILE } from './geoCinematicCoreShell.js';
import { GEO_CINEMATIC_STREAM_ART_PROFILE } from './geoCinematicStreams.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('GEO final stream art keeps the existing particle budget', () => {
  assert.equal(GEO_CINEMATIC_STREAM_ART_PROFILE.bodyParticles, 656);
  assert.equal(GEO_CINEMATIC_STREAM_ART_PROFILE.highlightParticles, 64);
  assert.equal(GEO_CINEMATIC_STREAM_ART_PROFILE.totalParticles, 720);
});

test('GEO final stream art uses selective energy and distinct signal clumps', () => {
  assert.deepEqual(GEO_CINEMATIC_STREAM_ART_PROFILE.brightnessRatio, {
    lowMid: 0.85,
    brighter: 0.12,
    hero: 0.03
  });
  assert.deepEqual(GEO_CINEMATIC_STREAM_ART_PROFILE.signalClumps, {
    answer: 4,
    citation: 5,
    keyword: 4
  });
  assert.equal(GEO_CINEMATIC_STREAM_ART_PROFILE.particleLanguage, 'radial-soft-signal');
  assert.equal(GEO_CINEMATIC_STREAM_ART_PROFILE.trajectoryLanguage, 'broken-secondary-guides');
});

test('GEO final core restores bounded particle activity without adding a new core system', () => {
  assert.equal(GEO_CINEMATIC_CORE_ART_PROFILE.shellFragments, 5);
  assert.equal(GEO_CINEMATIC_CORE_ART_PROFILE.shellNodes, 72);
  assert.equal(GEO_CINEMATIC_CORE_ART_PROFILE.processingBandScale, 0.68);
  assert.equal(GEO_CINEMATIC_CORE_ART_PROFILE.coreLanguage, 'irregular-particle-convergence');
  assert.equal(GEO_CINEMATIC_CORE_ART_PROFILE.shellLanguage, 'broken-secondary-fragments');
});

test('GEO final labels preserve primary semantics while reducing text weight', () => {
  assert.equal(GEO_BUSINESS_TEXT_ART_PROFILE.primaryLabelScale, 0.82);
  assert.equal(GEO_BUSINESS_TEXT_ART_PROFILE.primaryLabelOpacity, 0.52);
  assert.equal(GEO_BUSINESS_TEXT_ART_PROFILE.auxiliaryLabelOpacity, 0.2);
  assert.ok(GEO_BUSINESS_TEXT_ART_PROFILE.perceivedTextReduction >= 0.3);
  assert.ok(GEO_BUSINESS_TEXT_ART_PROFILE.perceivedTextReduction <= 0.5);
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
