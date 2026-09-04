import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REPLAY_SCENARIOS,
  createReplayReport,
  formatReplayReport,
  runAllBindingReplays,
  runBindingReplay,
  validateReplayGolden
} from '../index.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const replays = runAllBindingReplays();
const replay = (id) => replays.find((item) => item.scenario.id === id);
const assertion = (id, assertionId) => replay(id).assertions.find((item) => item.id === assertionId);

test('all eight replay scenarios execute', () => assert.equal(replays.length, 8));
test('replay output is deterministic', () => assert.deepEqual(runAllBindingReplays(), runAllBindingReplays()));
test('replay output is serializable', () => assert.deepEqual(JSON.parse(JSON.stringify(replays)), replays));
test('replay modules do not import Three.js or renderer classes', () => {
  for (const file of listJavaScriptFiles(fileURLToPath(new URL('./', import.meta.url))).filter((file) => !file.endsWith('.test.mjs'))) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(/(?:from\s+|import\s*)['"]three['"]/.test(source), false, file);
    assert.equal(/WebGLRenderer|ShaderMaterial|BufferGeometry|EffectComposer|new\s+Scene\s*\(/.test(source), false, file);
  }
});

test('FiveA A3 canonical population increases', () => pass('FIVEA_A3_GROWTH', 'a3PopulationDirection'));
test('FiveA A3 visual scale does not invert', () => pass('FIVEA_A3_GROWTH', 'a3ScaleDirection'));
test('FiveA A3 visual density does not invert', () => pass('FIVEA_A3_GROWTH', 'a3DensityDirection'));
test('FiveA A3 binding scale and density do not invert', () => {
  pass('FIVEA_A3_GROWTH', 'a3BindingScaleDirection');
  pass('FIVEA_A3_GROWTH', 'a3BindingDensityDirection');
});

test('FiveA A2 to A3 conversion decreases', () => pass('FIVEA_A2_A3_BOTTLENECK', 'conversionDecreases'));
test('FiveA A2 to A3 drop-off rises as conversion falls', () => pass('FIVEA_A2_A3_BOTTLENECK', 'dropOffIncreases'));
test('FiveA derived bottleneck rate and visual flow do not invert', () => {
  pass('FIVEA_A2_A3_BOTTLENECK', 'bottleneckRateDecreases');
  pass('FIVEA_A2_A3_BOTTLENECK', 'flowStrengthDecreases');
});
test('FiveA binding flow preserves stable transition identity', () => {
  pass('FIVEA_A2_A3_BOTTLENECK', 'bindingFlowStrengthDecreases');
  pass('FIVEA_A2_A3_BOTTLENECK', 'bottleneckTransitionId');
  assert.ok(replay('FIVEA_A2_A3_BOTTLENECK').frames.every((frame) => !JSON.stringify(frame.bindingPlan).includes('A6')));
});

test('Brand Mind association strength increases', () => pass('BRAND_MIND_ASSOCIATION_GROWTH', 'associationStrengthIncreases'));
test('Brand Mind node brightness and emphasis do not invert', () => {
  pass('BRAND_MIND_ASSOCIATION_GROWTH', 'nodeBrightnessIncreases');
  pass('BRAND_MIND_ASSOCIATION_GROWTH', 'nodeEmphasisNonDecreasing');
});
test('Brand Mind binding brightness retains stable association ID', () => {
  pass('BRAND_MIND_ASSOCIATION_GROWTH', 'bindingBrightnessIncreases');
  pass('BRAND_MIND_ASSOCIATION_GROWTH', 'associationStableId');
});

test('Brand Mind concentration categories follow current rules', () => pass('BRAND_MIND_CONCENTRATION_SHIFT', 'coreStatusMatchesRules'));
test('Brand Mind Panel sees the same core status categories', () => pass('BRAND_MIND_CONCENTRATION_SHIFT', 'panelCoreStatusMatchesRules'));
test('Brand Mind concentration visual and binding values do not invert', () => {
  pass('BRAND_MIND_CONCENTRATION_SHIFT', 'coreConcentrationIncreases');
  pass('BRAND_MIND_CONCENTRATION_SHIFT', 'bindingCoreConcentrationIncreases');
});

test('Brand Mind weakening association follows GROWING to STABLE to WEAKENING', () => pass('BRAND_MIND_WEAKENING_ASSOCIATION', 'driftFollowsActualRules'));
test('Brand Mind opportunity signal follows GROWTH to neutral to DEFEND', () => pass('BRAND_MIND_WEAKENING_ASSOCIATION', 'growthThenNeutralThenDefend'));

test('GEO citation strength, visual energy, and binding energy do not invert', () => {
  pass('GEO_CITATION_STRENGTH', 'citationStrengthIncreases');
  pass('GEO_CITATION_STRENGTH', 'citationEnergyIncreases');
  pass('GEO_CITATION_STRENGTH', 'bindingCitationEnergyIncreases');
});
test('GEO keyword opportunity and visual flow do not invert', () => {
  pass('GEO_KEYWORD_OPPORTUNITY', 'keywordOpportunityIncreases');
  pass('GEO_KEYWORD_OPPORTUNITY', 'keywordFlowIncreases');
});
test('GEO keyword binding flow does not invert', () => pass('GEO_KEYWORD_OPPORTUNITY', 'bindingKeywordFlowIncreases'));

test('PARTIAL source identity remains PARTIAL', () => pass('PARTIAL_DATA_DEGRADATION', 'partialSourceTypePreserved'));
test('PARTIAL A3 missing confidence is preserved', () => pass('PARTIAL_DATA_DEGRADATION', 'a3ConfidenceMissingPreserved'));
test('PARTIAL transition missing confidence remains diagnostic-only', () => pass('PARTIAL_DATA_DEGRADATION', 'transitionConfidenceDoesNotInventData'));
test('PARTIAL replay frames remain finite and guarded', () => {
  for (const frame of replay('PARTIAL_DATA_DEGRADATION').frames) {
    assert.ok(frame.assertions.every((item) => item.status === 'PASS'));
  }
});

test('every replay frame preserves complete lineage into BindingPlan metadata', () => {
  for (const frame of replays.flatMap((item) => item.frames)) {
    assert.deepEqual(frame.bindingPlan.metadata.lineage, frame.snapshot.metadata.lineage);
  }
});
test('golden regression records only compact expected identifiers and categories', () => {
  for (const item of replays) assert.equal(validateReplayGolden(item).ok, true);
});
test('compact text report contains every scenario and no rendering claim', () => {
  const report = createReplayReport(replays);
  const text = formatReplayReport(report);
  assert.equal(report.doesRender, false);
  assert.ok(REPLAY_SCENARIOS.every((scenario) => text.includes(scenario.title)));
});

const results = [];
for (const current of tests) {
  try {
    await current.run();
    results.push({ name: current.name, status: 'pass' });
  } catch (error) {
    results.push({ name: current.name, status: 'fail', error: error.stack ?? String(error) });
  }
}
const passed = results.filter((item) => item.status === 'pass').length;
const failed = results.length - passed;
console.log(JSON.stringify({ passed, failed, results }, null, 2));
if (failed) process.exitCode = 1;

function pass(scenarioId, assertionId) {
  assert.equal(assertion(scenarioId, assertionId)?.status, 'PASS', `${scenarioId}.${assertionId}`);
}

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(absolute);
    return /\.(?:js|mjs)$/.test(entry.name) ? [absolute] : [];
  });
}
