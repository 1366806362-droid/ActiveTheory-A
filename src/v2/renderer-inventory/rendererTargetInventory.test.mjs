import assert from 'node:assert/strict';
import { BINDING_CHANNELS } from '../binding/bindingChannels.js';
import {
  IMPLEMENTATION_PRIORITY,
  RENDERER_TARGET_MANIFEST,
  RENDERER_TARGET_STATUS
} from './rendererTargetManifest.js';
import { buildRendererTargetInventory } from './rendererTargetInventory.js';
import { buildRendererTargetReport, formatRendererTargetReport } from './rendererTargetReport.js';
import { validateRendererTargetManifest } from './rendererTargetValidation.js';

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test('all binding channel types are classified', () => {
  const inventory = buildRendererTargetInventory();
  assert.equal(inventory.channelCoverage.classifiedChannelTypes, BINDING_CHANNELS.length);
  assert.deepEqual(inventory.channelCoverage.uncoveredChannels, []);
});

test('no duplicate channel target manifest entry exists', () => {
  const keys = RENDERER_TARGET_MANIFEST.entries.map((entry) => `${entry.channel}:${entry.domain}:${entry.targetKey}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('FiveA documents exactly A1 through A5', () => {
  const ids = [...new Set(RENDERER_TARGET_MANIFEST.entries
    .filter((entry) => entry.targetKind === 'FiveAStageRoot')
    .map((entry) => entry.targetId))].sort();
  assert.deepEqual(ids, ['A1', 'A2', 'A3', 'A4', 'A5']);
});

test('FiveA never introduces A6', () => {
  assert.equal(RENDERER_TARGET_MANIFEST.entries.some((entry) => entry.targetId === 'A6'), false);
});

test('FiveA documents exactly four transition targets', () => {
  const ids = [...new Set(RENDERER_TARGET_MANIFEST.entries
    .filter((entry) => entry.targetKind === 'FiveATransitionFlow')
    .map((entry) => entry.targetId))];
  assert.deepEqual(ids, ['A1_TO_A2', 'A2_TO_A3', 'A3_TO_A4', 'A4_TO_A5']);
});

test('FiveA stage target IDs are stable semantic IDs', () => {
  const entries = RENDERER_TARGET_MANIFEST.entries.filter((entry) => entry.targetKind === 'FiveAStageRoot');
  assert.ok(entries.every((entry) => /^A[1-5]$/.test(entry.targetId) && entry.observedName.endsWith(entry.targetId)));
});

test('Brand Mind associations declare a stable registry policy', () => {
  const entries = RENDERER_TARGET_MANIFEST.entries.filter((entry) => entry.targetKind === 'BrandMindAssociationNode');
  assert.ok(entries.every((entry) => entry.requiredHook.includes('NEEDS_STABLE_REGISTRY_HOOK')));
});

test('Brand Mind relationships declare a stable key policy', () => {
  const entries = RENDERER_TARGET_MANIFEST.entries.filter((entry) => entry.targetKind === 'BrandMindRelationshipPath');
  assert.ok(entries.every((entry) => entry.targetId === 'relationship:<sourceId>:<targetId>' && entry.requiredHook.includes('sourceId+targetId')));
});

test('dynamic Brand Mind lifecycle is explicitly classified', () => {
  const entries = RENDERER_TARGET_MANIFEST.entries.filter((entry) => entry.status === RENDERER_TARGET_STATUS.DYNAMIC_TARGET);
  assert.ok(entries.length > 0 && entries.every((entry) => entry.lifecycle === 'REBUILT'));
});

test('GEO Answer is classified', () => assert.ok(RENDERER_TARGET_MANIFEST.entries.some((entry) => entry.targetId === 'ANSWER')));
test('GEO Citation is classified', () => assert.ok(RENDERER_TARGET_MANIFEST.entries.some((entry) => entry.targetId === 'CITATION')));
test('GEO Keyword is classified', () => assert.ok(RENDERER_TARGET_MANIFEST.entries.some((entry) => entry.targetId === 'KEYWORD')));
test('GEO Signal Core is classified', () => assert.ok(RENDERER_TARGET_MANIFEST.entries.some((entry) => entry.targetId === 'SIGNAL_CORE')));

test('HOME GEO Nebula is classified', () => assert.ok(RENDERER_TARGET_MANIFEST.entries.some((entry) => entry.targetId === 'HOME_GEO_NEBULA')));
test('HOME FiveA Nebula is classified', () => assert.ok(RENDERER_TARGET_MANIFEST.entries.some((entry) => entry.targetId === 'HOME_FIVE_A_NEBULA')));
test('HOME Brand Mind Nebula is classified', () => assert.ok(RENDERER_TARGET_MANIFEST.entries.some((entry) => entry.targetId === 'HOME_BRAND_MIND_NEBULA')));

test('no Art Direction target is included', () => {
  const source = JSON.stringify(RENDERER_TARGET_MANIFEST.entries).toLowerCase();
  ['camera', 'globalcomposition', 'earthposition', 'galaxyposition', 'route', 'scroll', 'handoff', 'typography', 'panellayout'].forEach((term) => assert.equal(source.includes(`\"${term}\"`), false));
});

test('the inventory does not import Three.js', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('./rendererTargetManifest.js', import.meta.url), 'utf8');
  assert.equal(/from\s+['\"]three['\"]/.test(source), false);
});

test('every adapter-hook entry names its required hook', () => {
  const entries = RENDERER_TARGET_MANIFEST.entries.filter((entry) => entry.status === RENDERER_TARGET_STATUS.NEEDS_ADAPTER_HOOK);
  assert.ok(entries.every((entry) => entry.requiredHook.length > 20));
});

test('not-found entries would be P0', () => {
  const mutated = structuredClone(RENDERER_TARGET_MANIFEST);
  mutated.entries[0].status = RENDERER_TARGET_STATUS.NOT_FOUND;
  mutated.entries[0].priority = IMPLEMENTATION_PRIORITY.P0;
  const inventory = buildRendererTargetInventory(mutated);
  assert.equal(inventory.preflightStatus, 'BLOCKED');
});

test('manifest is serializable', () => assert.doesNotThrow(() => JSON.parse(JSON.stringify(RENDERER_TARGET_MANIFEST))));
test('report is deterministic', () => assert.equal(JSON.stringify(buildRendererTargetReport()), JSON.stringify(buildRendererTargetReport())));
test('report separates channel and target coverage', () => {
  const report = buildRendererTargetReport();
  assert.equal(report.channelCoverage.totalChannelTypes, 46);
  assert.equal(report.targetCoverage.totalRuntimeTargets, 27);
});
test('preflight is blocked by the two unresolved stable registries', () => {
  const report = buildRendererTargetReport();
  assert.equal(report.status, 'BLOCKED');
  assert.equal(report.priorities.P0.length, 2);
});
test('preview report stays compact and explicit', () => {
  const output = formatRendererTargetReport();
  assert.match(output, /ACTIVE THEORY V2-3B PREFLIGHT/);
  assert.match(output, /V2-3B STATUS: BLOCKED/);
});

let passed = 0;
for (const { name, run } of tests) {
  await run();
  passed += 1;
}
console.log(`Renderer target inventory tests: ${passed}/${tests.length} PASS`);
