import assert from 'node:assert/strict';
import {
  FIVE_A_PANEL_OPEN_PRESENTATION_STATE,
  FIVE_A_PRIMARY_INTERACTION_TARGET,
  FIVE_A_VISUAL_V1,
  FIVE_A_VISUAL_V2,
  resolveFiveAPanelPresentation
} from './fiveAScene.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('5A Visual V2 keeps Opportunity plus five primary business stages', () => {
  assert.equal(FIVE_A_VISUAL_V2.version, '2.0');
  assert.equal(FIVE_A_VISUAL_V2.stageCount, 6);
  assert.equal(FIVE_A_VISUAL_V2.primaryStageCount, 5);
  assert.equal(FIVE_A_VISUAL_V2.opportunityIsSecondary, true);
  assert.deepEqual(
    FIVE_A_VISUAL_V2.stageProfiles.map(({ id }) => id),
    ['O', 'A1', 'A2', 'A3', 'A4', 'A5']
  );
});

test('5A Visual V2 upgrades the core as one bounded GPU particle draw', () => {
  assert.ok(FIVE_A_VISUAL_V2.coreRadius >= 0.51);
  assert.ok(FIVE_A_VISUAL_V2.coreRadius <= 0.6);
  assert.ok(FIVE_A_VISUAL_V2.coreParticleCount >= 1500);
  assert.ok(FIVE_A_VISUAL_V2.coreParticleCount <= 3000);
  assert.equal(FIVE_A_VISUAL_V2.coreParticleDrawCalls, 1);
});

test('5A Visual V2 preserves flow and dust budgets with real stage depth', () => {
  assert.equal(FIVE_A_VISUAL_V2.transferParticleCount, 432);
  assert.equal(FIVE_A_VISUAL_V2.backgroundDustCount, 260);
  assert.equal(new Set(FIVE_A_VISUAL_V2.stageProfiles.map(({ depthOffset }) => depthOffset)).size, 6);
  assert.ok(FIVE_A_VISUAL_V2.stageProfiles.some(({ depthOffset }) => depthOffset > 0.5));
  assert.ok(FIVE_A_VISUAL_V2.stageProfiles.some(({ depthOffset }) => depthOffset < -0.5));
});

test('5A Visual V2 makes the right-side journey read as near, mid, and far', () => {
  const primaryStages = FIVE_A_VISUAL_V2.stageProfiles.slice(1);

  assert.deepEqual(FIVE_A_VISUAL_V2.depthLayers, {
    near: ['A2', 'A3'],
    mid: ['A4'],
    far: ['A1', 'A5']
  });
  assert.equal(primaryStages.filter(({ depthOffset }) => depthOffset >= 0.3).length, 2);
  assert.equal(primaryStages.filter(({ depthOffset }) => depthOffset <= -0.5).length, 2);
  assert.equal(primaryStages.filter(({ depthOffset }) => Math.abs(depthOffset) < 0.15).length, 1);
  assert.ok(primaryStages.every(({ radius }) => radius > 1));
  assert.ok(primaryStages[4].height > primaryStages[3].height);
  assert.ok(primaryStages[2].nodeBrightness > Math.max(...primaryStages.filter((_, index) => index !== 2).map(({ nodeBrightness }) => nodeBrightness)));
});

test('5A Visual V2 batches all primary luminous stages into one GPU draw', () => {
  const primaryStages = FIVE_A_VISUAL_V2.stageProfiles.slice(1);

  assert.equal(FIVE_A_VISUAL_V2.stageParticleCount, 4500);
  assert.equal(FIVE_A_VISUAL_V2.stageParticleDrawCalls, 1);
  assert.deepEqual(primaryStages.map(({ gpuParticleCount }) => gpuParticleCount), [780, 980, 1180, 880, 680]);
  assert.deepEqual(FIVE_A_VISUAL_V2.gpuParticleAttributes, [
    'nodeId', 'seed', 'radius', 'size', 'brightness', 'depthBias'
  ]);
  assert.deepEqual(FIVE_A_VISUAL_V2.selectiveEnergyRatios, {
    lowMid: 0.9,
    brighter: 0.08,
    hero: 0.02
  });
  assert.equal(FIVE_A_VISUAL_V2.coreActivitySpread, 1.22);
  assert.equal(FIVE_A_VISUAL_V2.journeyEnergyPacketStride, 53);
  assert.equal(FIVE_A_VISUAL_V2.stageGroupCorePull, -0.13);
  assert.equal(FIVE_A_VISUAL_V2.transferParticleCount, 432);
  assert.equal(FIVE_A_VISUAL_V2.flowHasShortTrails, true);
  assert.equal(FIVE_A_VISUAL_V2.flowHasGaps, true);
});

test('5A final composition keeps the intended brightness hierarchy and distant shells readable', () => {
  const [, a1, a2, a3, a4, a5] = FIVE_A_VISUAL_V2.stageProfiles;

  assert.deepEqual(FIVE_A_VISUAL_V2.stageNodeComposition, [
    'particle-shell',
    'soft-inner-glow',
    'sparse-wireframe',
    'soft-fresnel-edge'
  ]);
  assert.ok(a3.nodeBrightness > a2.nodeBrightness);
  assert.ok(a2.nodeBrightness > a4.nodeBrightness);
  assert.ok(a4.nodeBrightness > a1.nodeBrightness);
  assert.ok(a1.nodeBrightness > a5.nodeBrightness);
  assert.ok(a4.nodeRadius >= 0.147 && a4.nodeRadius <= 0.15);
  assert.ok(a5.nodeRadius >= 0.135 && a5.nodeRadius <= 0.138);
  assert.ok(a4.visualRadiusScale >= 1.5);
  assert.ok(a5.visualRadiusScale >= 1.65);
  assert.ok(a4.shellVisibility >= 1.15);
  assert.ok(a5.shellVisibility >= 1.2);
  assert.equal(FIVE_A_VISUAL_V2.compositionReference, '137b3de-original-five-a');
  assert.ok(FIVE_A_VISUAL_V2.wireframeVisualWeight <= 0.1);
});

test('5A final composition preserves the compact journey while separating the five stage anchors', () => {
  const profiles = FIVE_A_VISUAL_V2.stageProfiles;

  assert.deepEqual(profiles.map(({ radius }) => radius), [0.82, 1.13, 1.45, 2, 2.15, 2.48]);
  assert.deepEqual(profiles.map(({ height }) => height), [-0.76, -0.62, -0.12, 0.32, 0.72, 1.18]);
  assert.deepEqual(
    profiles.slice(1).map(({ depthOffset }) => depthOffset),
    [-0.62, 0.44, 0.82, -0.12, -0.86]
  );
  assert.deepEqual(profiles.slice(1).map(({ nodeParticleCount }) => nodeParticleCount), [68, 84, 104, 76, 64]);
});

test('5A stages expose one transform contract for visual cohesion and journey targets', () => {
  assert.equal(FIVE_A_VISUAL_V2.stageRootContract, 'single-orbit-stage-root');
  assert.deepEqual(FIVE_A_VISUAL_V2.stageRootVisualChildren, [
    'particle-sphere',
    'inner-glow',
    'halo-fresnel',
    'sparse-wireframe',
    'label-anchor'
  ]);
  assert.equal(FIVE_A_VISUAL_V2.journeyUsesStageRoot, true);
});

test('5A Visual V2 keeps Opportunity subordinate and labels restrained', () => {
  const [opportunity, ...primaryStages] = FIVE_A_VISUAL_V2.stageProfiles;

  assert.ok(opportunity.nodeScale < Math.min(...primaryStages.map(({ nodeScale }) => nodeScale)));
  assert.ok(opportunity.nodeBrightness < Math.min(...primaryStages.map(({ nodeBrightness }) => nodeBrightness)));
  assert.equal(FIVE_A_VISUAL_V2.brokenOrbits, true);
  assert.equal(FIVE_A_VISUAL_V2.labelsIncludeValues, false);
  assert.deepEqual(
    FIVE_A_VISUAL_V2.palette,
    ['deep-navy', 'icy-blue', 'cyan-blue', 'silver-white']
  );
});

test('legacy visual export remains an exact compatibility alias', () => {
  assert.equal(FIVE_A_VISUAL_V1, FIVE_A_VISUAL_V2);
});

test('5A data panel binds the existing core rather than a normal stage sphere', () => {
  assert.deepEqual(FIVE_A_PRIMARY_INTERACTION_TARGET, {
    id: 'fivea-primary-core',
    objectName: 'FiveACorePrimaryHitTarget',
    semantic: 'PRIMARY_DATA_ENTRY'
  });
  assert.equal(FIVE_A_VISUAL_V2.stageProfiles.some(({ id }) => id === 'CORE'), false);
});

test('panel-open presentation transforms the complete FiveA scene root', () => {
  assert.deepEqual(resolveFiveAPanelPresentation(1), FIVE_A_PANEL_OPEN_PRESENTATION_STATE);
  assert.ok(FIVE_A_PANEL_OPEN_PRESENTATION_STATE.scale < 0.7);
  assert.ok(FIVE_A_PANEL_OPEN_PRESENTATION_STATE.position[0] < -4);
});

test('panel-close presentation restores the locked FiveA baseline', () => {
  assert.deepEqual(resolveFiveAPanelPresentation(0), {
    position: [-2.35, -0.22, -2.08],
    scale: 0.94
  });
});

test('panel presentation reopen is deterministic', () => {
  assert.deepEqual(resolveFiveAPanelPresentation(1), resolveFiveAPanelPresentation(1));
  assert.deepEqual(resolveFiveAPanelPresentation(0), resolveFiveAPanelPresentation(0));
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
