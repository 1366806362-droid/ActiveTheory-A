import { deepFreeze } from '../contracts/brandUniverseContract.js';

export const REPLAY_ASSERTION_TYPE = deepFreeze({
  MONOTONIC_INCREASE: 'MONOTONIC_INCREASE',
  MONOTONIC_DECREASE: 'MONOTONIC_DECREASE',
  NON_INVERTING: 'NON_INVERTING',
  PRESERVED_ID: 'PRESERVED_ID',
  PRESERVED_METADATA: 'PRESERVED_METADATA',
  NO_NAN: 'NO_NAN',
  NO_INFINITY: 'NO_INFINITY',
  WITHIN_GUARDRAIL: 'WITHIN_GUARDRAIL',
  EXPECTED_CATEGORY: 'EXPECTED_CATEGORY',
  MISSING_PRESERVED: 'MISSING_PRESERVED'
});

export function createReplayScenario({ id, moduleId, title, frames, assertions = [], golden = {} }) {
  if (!id || !moduleId || !Array.isArray(frames) || frames.length < 2) {
    throw new TypeError('Replay scenario requires id, moduleId, and at least two frames.');
  }
  const frameIds = new Set();
  let lastCapturedAt = null;
  for (const frame of frames) {
    if (!frame?.frameId || !frame?.snapshot?.metadata?.snapshotId || !frame.snapshot.metadata.capturedAt) {
      throw new TypeError(`${id} frames require frameId and canonical snapshot metadata.`);
    }
    if (frameIds.has(frame.frameId)) throw new Error(`${id} duplicates frameId ${frame.frameId}.`);
    if (lastCapturedAt && Date.parse(frame.snapshot.metadata.capturedAt) < Date.parse(lastCapturedAt)) {
      throw new Error(`${id} frames must be chronological.`);
    }
    frameIds.add(frame.frameId);
    lastCapturedAt = frame.snapshot.metadata.capturedAt;
  }
  return deepFreeze({ id, moduleId, title: title ?? id, frames, assertions, golden });
}
