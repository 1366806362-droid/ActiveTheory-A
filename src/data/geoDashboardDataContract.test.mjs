import assert from 'node:assert/strict';
import { adaptGeoDashboardData } from './geoDashboardDataAdapter.js';
import { getGeoDashboardFixture } from './geoDashboardDataFixtures.js';
import {
  GeoDashboardDataSourceNotImplementedError,
  loadGeoDashboardDataset
} from './geoDashboardDataSource.js';

const results = [];

function test(name, callback) {
  callback();
  results.push({ name, status: 'pass' });
}

test('validFixture -> pass', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'valid' });
  assert.equal(result.gate.status, 'pass');
  assert.equal(result.fallbackUsed, false);
});

test('warningFixture -> warning', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'warning' });
  assert.equal(result.gate.status, 'warning');
  assert.equal(result.fallbackUsed, false);
});

test('invalidFixture -> fail + Mock fallback', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'invalid' });
  assert.equal(result.gate.status, 'fail');
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.dataset.source.type, 'mock');
});

test('platform aliases normalize to stable ids', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'valid' });
  assert.deepEqual(result.requestedDataset?.platforms, undefined);
  assert.deepEqual(result.dataset.platforms.map(({ id }) => id), ['all', 'doubao', 'deepseek', 'kimi', 'qwen']);
});

test('unknown platforms are preserved and warned', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'warning' });
  const unknown = result.dataset.platforms.find(({ known }) => !known);
  assert.equal(unknown.id, 'Moonshot Preview');
  assert.ok(result.warnings.some(({ code }) => code === 'UNKNOWN_PLATFORM'));
});

test('dates normalize to YYYY-MM-DD', () => {
  const raw = getGeoDashboardFixture('valid');
  raw.metadata['报告日期'] = 'August 4, 2026';
  const result = adaptGeoDashboardData(raw, { mode: 'fixture' });
  assert.equal(result.dataset.metadata.reportDate, '2026-08-04');
  assert.ok(result.transformations.some(({ type, path }) => type === 'date-normalization' && path === 'metadata.reportDate'));
});

test('percentage strings convert to numbers', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'valid' });
  assert.equal(result.dataset.answer.metrics.brandMentionRate, 78.5);
  assert.ok(result.transformations.some(({ type }) => type === 'percentage-to-number'));
});

test('numerator above denominator produces warning without mutation', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'warning' });
  assert.ok(result.warnings.some(({ code }) => code === 'NUMERATOR_EXCEEDS_DENOMINATOR'));
  assert.equal(result.dataset.platforms.at(-1).collectedQuestionCount, 6);
  assert.equal(result.dataset.platforms.at(-1).expectedQuestionCount, 5);
});

test('three Data Health metrics remain independent', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'valid' });
  assert.deepEqual(Object.keys(result.dataset.dataHealth).sort(), [
    'collectedAnswerValidity',
    'overallStatus',
    'platformAccessibility',
    'questionCollectionCompleteness'
  ]);
  assert.notStrictEqual(result.dataset.dataHealth.platformAccessibility, result.dataset.dataHealth.questionCollectionCompleteness);
});

test('trend comparisonKey is platformId::questionId', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'valid' });
  assert.equal(result.dataset.trends[0].comparisonKey, 'doubao::Q-001');
});

test('different platform/question combinations are not joined', () => {
  const result = loadGeoDashboardDataset({ mode: 'fixture', fixture: 'valid' });
  const keys = new Set(result.dataset.trends.map(({ comparisonKey }) => comparisonKey));
  assert.ok(keys.has('doubao::Q-001'));
  assert.ok(keys.has('deepseek::Q-001'));
  assert.equal(keys.size, 2);
});

test('adapter does not mutate raw input', () => {
  const raw = getGeoDashboardFixture('valid');
  const before = JSON.stringify(raw);
  adaptGeoDashboardData(raw, { mode: 'fixture' });
  assert.equal(JSON.stringify(raw), before);
});

test('unimplemented sources throw explicit errors', () => {
  assert.throws(
    () => loadGeoDashboardDataset({ mode: 'excel' }),
    (error) => error instanceof GeoDashboardDataSourceNotImplementedError && error.mode === 'excel'
  );
});

test('Mock mode remains V1.2 presentation-compatible', () => {
  const result = loadGeoDashboardDataset({ mode: 'mock' });
  const data = result.getDashboardData('deepseek');
  const trend = result.getDashboardTrend('deepseek', '7d');
  assert.equal(result.gate.status, 'pass');
  assert.equal(typeof data.overview.finalScore, 'number');
  assert.equal(data.answer.platformComparison.length, 4);
  assert.ok(trend.every(({ points }) => points.length <= 7));
});

console.log(JSON.stringify({ passed: results.length, failed: 0, results }, null, 2));
