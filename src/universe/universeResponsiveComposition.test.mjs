import assert from 'node:assert/strict';
import {
  UNIVERSE_V4_RESPONSIVE_COMPOSITION,
  resolveUniverseV4Composition
} from './universeResponsiveComposition.js';
import { VIEWPORT_MODES } from '../engine/viewport.js';

const results = [];

test('desktop preset preserves the approved V1.4.1 composition', () => {
  assert.deepEqual(resolveUniverseV4Composition(VIEWPORT_MODES.DESKTOP).galaxyRoot, {
    position: [0.12, 0.4, 0],
    scale: 1.42
  });
});

test('portrait and landscape use separate cinematic framing', () => {
  const portrait = resolveUniverseV4Composition(VIEWPORT_MODES.MOBILE_PORTRAIT);
  const landscape = resolveUniverseV4Composition(VIEWPORT_MODES.MOBILE_LANDSCAPE);
  assert.notDeepEqual(portrait.heroAssetLayer, landscape.heroAssetLayer);
  assert.ok(portrait.heroAssetLayer.scale < 1);
  assert.ok(landscape.heroAssetLayer.scale < 1);
});

test('unknown modes fall back to desktop without mutation', () => {
  const fallback = resolveUniverseV4Composition('unknown');
  assert.equal(fallback, UNIVERSE_V4_RESPONSIVE_COMPOSITION[VIEWPORT_MODES.DESKTOP]);
  assert.equal(Object.isFrozen(fallback), true);
  assert.equal(Object.isFrozen(fallback.galaxyRoot.position), true);
});

console.log(JSON.stringify({
  passed: results.filter((result) => result.status === 'pass').length,
  failed: results.filter((result) => result.status === 'fail').length,
  results
}, null, 2));

if (results.some((result) => result.status === 'fail')) process.exitCode = 1;

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}
