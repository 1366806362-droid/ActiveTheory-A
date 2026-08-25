import assert from 'node:assert/strict';
import {
  GALAXY_TOUR_ANCHORS,
  GALAXY_TOUR_SEGMENTS,
  getDirectEntryContract
} from './galaxyTourRoute.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('the original sequential tour remains GEO to 5A to Brand Mind', () => {
  assert.deepEqual(
    GALAXY_TOUR_SEGMENTS.map(({ target }) => target),
    ['geo', 'geo', 'fiveA', 'fiveA', 'brandMind']
  );
});

test('5A direct entry reuses the existing enter, active, and return route records', () => {
  const contract = getDirectEntryContract('fiveA');

  assert.equal(contract.entrySegment.id, 'FIVE_A_ENTER');
  assert.equal(GALAXY_TOUR_ANCHORS[contract.activeIndex].id, 'FIVE_A_ACTIVE');
  assert.equal(contract.returnSegment.id, 'FIVE_A_RETURN');
});

test('Brand Mind direct entry reuses its existing enter and active records with a return contract', () => {
  const contract = getDirectEntryContract('brandMind');

  assert.equal(contract.entrySegment.id, 'BRAND_MIND_ENTER');
  assert.equal(GALAXY_TOUR_ANCHORS[contract.activeIndex].id, 'BRAND_MIND_ACTIVE');
  assert.equal(contract.returnSegment.id, 'BRAND_MIND_RETURN');
});

test('direct entry is not enabled for GEO', () => {
  assert.equal(getDirectEntryContract('geo'), null);
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
