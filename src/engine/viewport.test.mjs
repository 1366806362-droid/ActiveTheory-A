import assert from 'node:assert/strict';
import { resolveViewportMode, VIEWPORT_MODES } from './viewport.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('desktop viewport stays on the existing composition', () => {
  assert.equal(
    resolveViewportMode({ width: 1920, height: 1080, coarsePointer: false }),
    VIEWPORT_MODES.DESKTOP
  );
});

test('narrow portrait viewport selects mobile portrait composition', () => {
  assert.equal(
    resolveViewportMode({ width: 390, height: 844, coarsePointer: false }),
    VIEWPORT_MODES.MOBILE_PORTRAIT
  );
});

test('short phone landscape selects mobile landscape composition', () => {
  assert.equal(
    resolveViewportMode({ width: 844, height: 390, coarsePointer: false }),
    VIEWPORT_MODES.MOBILE_LANDSCAPE
  );
});

test('coarse pointer is auxiliary for compact tablet portrait', () => {
  assert.equal(
    resolveViewportMode({ width: 768, height: 1024, coarsePointer: true }),
    VIEWPORT_MODES.MOBILE_PORTRAIT
  );
});

test('small desktop window is not classified as a phone by width alone', () => {
  assert.equal(
    resolveViewportMode({ width: 800, height: 600, coarsePointer: false }),
    VIEWPORT_MODES.DESKTOP
  );
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
