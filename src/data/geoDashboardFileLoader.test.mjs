import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptGeoDashboardData } from './geoDashboardDataAdapter.js';
import {
  activateGeoDashboardFileResult,
  createGeoDashboardDataDiagnostics,
  loadGeoDashboardDataset
} from './geoDashboardDataSource.js';
import {
  GEO_DASHBOARD_FILE_MAX_SIZE_BYTES,
  loadGeoDashboardLocalFile,
  selectSingleGeoDashboardLocalFile
} from './geoDashboardFileLoader.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(currentDirectory, '../../public/data/geo-dashboard');
const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

function createFile(parts, name = 'dataset.json', type = 'application/json') {
  return new File(parts, name, { type, lastModified: 1722729600000 });
}

async function sampleFile(name, type = 'application/json') {
  const bytes = await fs.readFile(path.join(dataDirectory, name));
  return createFile([bytes], name, type);
}

async function expectCode(promise, code) {
  try {
    await promise;
  } catch (error) {
    if (error.code === code) return error;
    throw new Error(`Expected ${code}, received ${error.code ?? error.name}: ${error.message}`);
  }
  throw new Error(`Expected ${code}, but the operation succeeded.`);
}

test('Valid local JSON file reads and calculates diagnostics', async () => {
  const loaded = await loadGeoDashboardLocalFile(await sampleFile('sample-valid.json'));
  if (loaded.rawData.datasetId !== 'sample-valid') throw new Error('Unexpected datasetId.');
  if (!loaded.fileDiagnostics.parseSucceeded || !loaded.fileDiagnostics.checksumCalculated) {
    throw new Error('Expected parse and checksum diagnostics.');
  }
  if (loaded.fileDiagnostics.maxSizeBytes !== GEO_DASHBOARD_FILE_MAX_SIZE_BYTES) {
    throw new Error('Expected maxSizeBytes in file diagnostics.');
  }
});

test('Warning file creates a preview without automatic application', async () => {
  const result = await loadGeoDashboardDataset({ mode: 'file', file: await sampleFile('sample-warning.json') });
  if (result.gate.status !== 'warning' || !result.pendingUserConfirmation || result.applied) {
    throw new Error('Warning preview state is incorrect.');
  }
});

test('Invalid contract file is blocked from application', async () => {
  const result = await loadGeoDashboardDataset({ mode: 'file', file: await sampleFile('sample-invalid.json') });
  if (result.gate.status !== 'fail' || result.pendingUserConfirmation || result.dashboard !== null) {
    throw new Error('Invalid contract was not blocked.');
  }
});

test('Empty file is rejected', async () => {
  await expectCode(loadGeoDashboardLocalFile(createFile([], 'empty.json')), 'empty_file');
});

test('Files above 5MB are rejected before reading', async () => {
  const oversized = createFile([new Uint8Array(GEO_DASHBOARD_FILE_MAX_SIZE_BYTES + 1)], 'large.json');
  await expectCode(loadGeoDashboardLocalFile(oversized), 'size_exceeded');
});

test('Non-JSON extension is rejected', async () => {
  await expectCode(loadGeoDashboardLocalFile(createFile(['{}'], 'dataset.csv', 'text/csv')), 'invalid_extension');
});

test('Unexpected MIME is preserved as a warning while .json remains eligible', async () => {
  const loaded = await loadGeoDashboardLocalFile(createFile(['{}'], 'dataset.json', 'text/plain'));
  if (loaded.fileDiagnostics.mimeAccepted || !loaded.fileDiagnostics.mimeWarning) {
    throw new Error('MIME warning policy did not run.');
  }
});

test('Unexpected MIME promotes an otherwise valid preview to warning', async () => {
  const result = await loadGeoDashboardDataset({
    mode: 'file',
    file: await sampleFile('sample-valid.json', 'text/plain')
  });
  if (result.gate.status !== 'warning'
    || !result.warnings.some((item) => item.code === 'FILE_MIME_WARNING')) {
    throw new Error('File MIME warning was not preserved by the Data Source.');
  }
});

test('Invalid UTF-8 is rejected', async () => {
  await expectCode(loadGeoDashboardLocalFile(createFile([new Uint8Array([0xff, 0xfe])])), 'invalid_utf8');
});

test('JSON parse errors are rejected', async () => {
  await expectCode(loadGeoDashboardLocalFile(createFile(['{"broken":'])), 'json_parse_error');
});

test('Root arrays are rejected', async () => {
  await expectCode(loadGeoDashboardLocalFile(createFile(['[]'])), 'invalid_json_root');
});

test('SHA-256 matches the V1.4 sample checksum', async () => {
  const loaded = await loadGeoDashboardLocalFile(await sampleFile('sample-valid.json'));
  const expected = '68ec7201b2e30cab889d973e13fd5da1be0942a2ccb5babdaf9d9ce22a8b3c81';
  if (loaded.fileDiagnostics.sha256 !== expected) throw new Error('SHA-256 mismatch.');
});

test('Abort is preserved and not classified as damaged data', async () => {
  const controller = new AbortController();
  const slowFile = {
    name: 'slow.json',
    type: 'application/json',
    size: 2,
    lastModified: 0,
    arrayBuffer: () => new Promise((resolve) => setTimeout(() => resolve(new TextEncoder().encode('{}').buffer), 30))
  };
  const pending = loadGeoDashboardLocalFile(slowFile, { signal: controller.signal });
  controller.abort();
  try {
    await pending;
    throw new Error('Expected AbortError.');
  } catch (error) {
    if (error.name !== 'AbortError' || error.geoDashboardDiagnostics?.errorCode !== 'aborted') throw error;
  }
});

test('Adapter does not mutate raw file data', async () => {
  const { rawData } = await loadGeoDashboardLocalFile(await sampleFile('sample-valid.json'));
  const before = JSON.stringify(rawData);
  adaptGeoDashboardData(rawData, { mode: 'json' });
  if (JSON.stringify(rawData) !== before) throw new Error('Adapter mutated raw data.');
});

test('Failed preview cannot replace the current Dataset', async () => {
  const current = loadGeoDashboardDataset({ mode: 'file' });
  const failed = await loadGeoDashboardDataset({ mode: 'file', file: await sampleFile('sample-invalid.json') });
  let active = current;
  try {
    active = activateGeoDashboardFileResult(failed);
  } catch {}
  if (active !== current || active.dataset.datasetId !== current.dataset.datasetId) {
    throw new Error('Failed preview replaced the current Dataset.');
  }
});

test('Pass preview applies once and supports all dashboard data accessors', async () => {
  let reads = 0;
  const base = await sampleFile('sample-valid.json');
  const counted = {
    name: base.name,
    type: base.type,
    size: base.size,
    lastModified: base.lastModified,
    async arrayBuffer() {
      reads += 1;
      return base.arrayBuffer();
    }
  };
  const preview = await loadGeoDashboardDataset({ mode: 'file', file: counted });
  const active = activateGeoDashboardFileResult(preview);
  const data = active.getDashboardData('deepseek');
  const trend = active.getDashboardTrend('deepseek', '7d');
  if (!active.applied || active.pendingUserConfirmation || reads !== 1) throw new Error('Application state or read count is incorrect.');
  if (!data.overview || !data.answer || !data.citation || !data.keyword || !data.dataHealth || !Array.isArray(trend)) {
    throw new Error('Applied data does not support all five views.');
  }
});

test('Warning preview remains warning after confirmed application', async () => {
  const preview = await loadGeoDashboardDataset({ mode: 'file', file: await sampleFile('sample-warning.json') });
  const active = activateGeoDashboardFileResult(preview);
  if (!active.applied || active.gate.status !== 'warning' || active.warnings.length === 0) {
    throw new Error('Warning state was lost after application.');
  }
});

test('Restore returns the locked Mock-compatible Dataset', () => {
  const restored = loadGeoDashboardDataset({ mode: 'file', state: 'reverted' });
  if (restored.mode !== 'file' || restored.fileState !== 'reverted' || !restored.dashboard || restored.applied) {
    throw new Error('Mock restoration failed.');
  }
});

test('User cancellation with no selected files is a no-op', () => {
  if (selectSingleGeoDashboardLocalFile([]) !== null) throw new Error('Cancellation should return null.');
});

test('Multiple local files are rejected explicitly', () => {
  try {
    selectSingleGeoDashboardLocalFile([createFile(['{}'], 'a.json'), createFile(['{}'], 'b.json')]);
  } catch (error) {
    if (error.code === 'multiple_files') return;
    throw error;
  }
  throw new Error('Multiple files were accepted.');
});

test('Development diagnostics exclude File, Blob, ArrayBuffer and raw JSON', async () => {
  const preview = await loadGeoDashboardDataset({ mode: 'file', file: await sampleFile('sample-valid.json') });
  const diagnostics = createGeoDashboardDataDiagnostics(preview);
  const serialized = JSON.stringify(diagnostics);
  if (serialized.includes('rawData') || serialized.includes('arrayBuffer') || serialized.includes('File object')) {
    throw new Error('Diagnostics leaked raw file content.');
  }
  if (!diagnostics.fileName || !diagnostics.sha256 || diagnostics.pendingUserConfirmation !== true) {
    throw new Error('Safe file diagnostics are incomplete.');
  }
});

const results = [];
for (const current of tests) {
  try {
    await current.callback();
    results.push({ name: current.name, status: 'pass' });
  } catch (error) {
    results.push({ name: current.name, status: 'fail', error: error.stack ?? error.message });
  }
}

const passed = results.filter((result) => result.status === 'pass').length;
const failed = results.length - passed;
console.log(JSON.stringify({ passed, failed, results }, null, 2));
if (failed) process.exitCode = 1;
