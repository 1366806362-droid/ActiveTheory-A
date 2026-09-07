import assert from 'node:assert/strict';
import { startLoop, stopLoop, getLoopStatus } from './loop.js';
const queued = new Map();
let id = 0;
globalThis.window = { requestAnimationFrame(callback) { queued.set(++id, callback); return id; }, cancelAnimationFrame(key) { queued.delete(key); } };
const seen = [];
const deltas = [];
const options = { scene: {}, camera: {}, renderer: { render() {} }, renderState: {},
  applyRenderState(_state, time) { seen.push(time); }, updates: [(_state, delta, time) => { seen.push(time); deltas.push(delta); }] };
function frame(time) { const [key, callback] = queued.entries().next().value; queued.delete(key); callback(time); }
startLoop(options); startLoop(options);
assert.equal(queued.size, 1);
frame(100); frame(116);
assert.equal(queued.size, 1);
assert.equal(getLoopStatus().activeRafChains, 1);
stopLoop(); assert.equal(queued.size, 0);
assert.equal(getLoopStatus().activeRafChains, 0);
startLoop({ ...options, sampleTime: 12 }); frame(1000); frame(1016);
assert.deepEqual(seen.slice(-4), [12, 12, 12, 12]); stopLoop();
assert.deepEqual(deltas.slice(-2), [0, 0]);
console.log(JSON.stringify({ passed: 3, failed: 0, tests: ['one RAF after repeated start and updates', 'dispose cancels RAF', 'fixed evidence time uses same loop'] }));
