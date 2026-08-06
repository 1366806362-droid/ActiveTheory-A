import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { adaptGeoDashboardData } from './geoDashboardDataAdapter.js';
import {
  createGeoDashboardJsonLoaderCache,
  GeoDashboardJsonLoadError,
  loadGeoDashboardJsonDataset
} from './geoDashboardJsonLoader.js';
import {
  GeoDashboardDataSourceNotImplementedError,
  loadGeoDashboardDataset
} from './geoDashboardDataSource.js';

const dataDirectory = fileURLToPath(new URL('../../public/data/geo-dashboard/', import.meta.url));
const baseUrl = 'http://localhost/';
const manifestUrl = `${baseUrl}data/geo-dashboard/manifest.json`;
const encoder = new TextEncoder();
const results = [];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value) {
  return encoder.encode(JSON.stringify(value));
}

async function loadStaticFiles() {
  const manifestBytes = await readFile(`${dataDirectory}manifest.json`);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const files = new Map([[new URL('/data/geo-dashboard/manifest.json', baseUrl).href, manifestBytes]]);
  for (const entry of manifest.datasets) {
    files.set(new URL(`/data/geo-dashboard/${entry.file}`, baseUrl).href, await readFile(`${dataDirectory}${entry.file}`));
  }
  return { manifest, files };
}

function responseFor(bytes, status = 200, contentType = 'application/json; charset=utf-8') {
  return new Response(bytes, {
    status,
    headers: {
      'content-type': contentType,
      'content-length': String(bytes.byteLength)
    }
  });
}

function createFetch(files, onFetch = () => {}) {
  return async (url, options = {}) => {
    onFetch(String(url));
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const bytes = files.get(String(url));
    return bytes ? responseFor(bytes) : responseFor(encoder.encode('{}'), 404);
  };
}

function withManifest(files, manifest) {
  const copy = new Map(files);
  copy.set(manifestUrl, jsonBytes(manifest));
  return copy;
}

async function test(name, callback) {
  try {
    await callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', error: error.message });
  }
}

const staticData = await loadStaticFiles();

await test('Manifest is readable and uses the supported schema', async () => {
  assert.equal(staticData.manifest.schemaVersion, '1.0.0');
  assert.ok(staticData.manifest.datasets.length >= 3);
  assert.deepEqual(
    ['sample-valid', 'sample-warning', 'sample-invalid'].filter((id) => !staticData.manifest.datasets.some((dataset) => dataset.id === id)),
    []
  );
});

await test('Manifest dataset ids are unique', async () => {
  const ids = staticData.manifest.datasets.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
});

await test('Valid JSON loads and passes the data gate', async () => {
  const result = await loadGeoDashboardDataset({ mode: 'json', datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(staticData.files), cryptoImpl: webcrypto });
  assert.equal(result.gate.status, 'pass');
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.sourceDiagnostics.checksumVerified, true);
});

await test('Warning JSON loads and returns gate=warning', async () => {
  const result = await loadGeoDashboardDataset({ mode: 'json', datasetId: 'sample-warning', baseUrl, fetchImpl: createFetch(staticData.files), cryptoImpl: webcrypto });
  assert.equal(result.gate.status, 'warning');
  assert.equal(result.fallbackUsed, false);
  assert.ok(result.warnings.some(({ code }) => code === 'UNKNOWN_PLATFORM'));
});

await test('Invalid contract JSON fails the gate and falls back to Mock', async () => {
  const result = await loadGeoDashboardDataset({ mode: 'json', datasetId: 'sample-invalid', baseUrl, fetchImpl: createFetch(staticData.files), cryptoImpl: webcrypto });
  assert.equal(result.gate.status, 'fail');
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.dataset.source.type, 'mock');
  assert.equal(result.sourceDiagnostics.checksumVerified, true);
});

await test('SHA-256 matches the Manifest', async () => {
  const result = await loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(staticData.files), cryptoImpl: webcrypto });
  assert.equal(result.loadDiagnostics.actualSha256, result.manifestEntry.sha256);
});

await test('Checksum mismatch is blocked before JSON parsing', async () => {
  const files = new Map(staticData.files);
  const original = files.get(new URL('/data/geo-dashboard/sample-valid.json', baseUrl).href);
  const changed = new Uint8Array(original);
  changed[changed.length - 2] = changed[changed.length - 2] === 32 ? 33 : 32;
  files.set(new URL('/data/geo-dashboard/sample-valid.json', baseUrl).href, changed);
  await assert.rejects(
    loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(files), cryptoImpl: webcrypto }),
    (error) => error instanceof GeoDashboardJsonLoadError && error.code === 'checksum_mismatch' && error.diagnostics.parseSucceeded === false
  );
});

await test('Manifest size limit blocks oversized data before file fetch', async () => {
  const manifest = structuredClone(staticData.manifest);
  manifest.datasets[0].sizeBytes = 30000;
  const files = withManifest(staticData.files, manifest);
  let dataFetches = 0;
  await assert.rejects(
    loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, maxSizeBytes: 20000, fetchImpl: createFetch(files, (url) => { if (url.endsWith('sample-valid.json')) dataFetches += 1; }), cryptoImpl: webcrypto }),
    (error) => error.code === 'size_exceeded'
  );
  assert.equal(dataFetches, 0);
});

await test('Unknown dataset is blocked by the Manifest whitelist', async () => {
  await assert.rejects(
    loadGeoDashboardJsonDataset({ datasetId: 'unknown', baseUrl, fetchImpl: createFetch(staticData.files), cryptoImpl: webcrypto }),
    (error) => error.code === 'unknown_dataset'
  );
});

await test('Cross-origin Manifest URLs are blocked before Fetch', async () => {
  let fetchCount = 0;
  await assert.rejects(
    loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, manifestUrl: 'https://example.com/manifest.json', fetchImpl: createFetch(staticData.files, () => { fetchCount += 1; }), cryptoImpl: webcrypto }),
    (error) => error.code === 'cross_origin_manifest'
  );
  assert.equal(fetchCount, 0);
});

await test('Disabled dataset is blocked', async () => {
  const manifest = structuredClone(staticData.manifest);
  manifest.datasets[0].enabled = false;
  await assert.rejects(
    loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(withManifest(staticData.files, manifest)), cryptoImpl: webcrypto }),
    (error) => error.code === 'dataset_disabled'
  );
});

await test('Path traversal in a Manifest entry is blocked before file fetch', async () => {
  const manifest = structuredClone(staticData.manifest);
  manifest.datasets[0].file = '../sample-valid.json';
  let dataFetches = 0;
  await assert.rejects(
    loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(withManifest(staticData.files, manifest), (url) => { if (!url.endsWith('manifest.json')) dataFetches += 1; }), cryptoImpl: webcrypto }),
    (error) => error.code === 'unsafe_dataset_path'
  );
  assert.equal(dataFetches, 0);
});

await test('Dataset HTTP 404 is reported and safely rejected', async () => {
  const manifest = structuredClone(staticData.manifest);
  const entry = manifest.datasets[0];
  entry.file = 'missing.json';
  entry.sizeBytes = 2;
  entry.sha256 = sha256(encoder.encode('{}'));
  await assert.rejects(
    loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(withManifest(staticData.files, manifest)), cryptoImpl: webcrypto }),
    (error) => error.code === 'dataset_http_error' && error.diagnostics.fileStatus === 404
  );
});

await test('JSON parse errors are reported after checksum verification', async () => {
  const invalidBytes = encoder.encode('{invalid-json');
  const manifest = structuredClone(staticData.manifest);
  const entry = manifest.datasets[0];
  entry.sizeBytes = invalidBytes.byteLength;
  entry.sha256 = sha256(invalidBytes);
  const files = withManifest(staticData.files, manifest);
  files.set(new URL('/data/geo-dashboard/sample-valid.json', baseUrl).href, invalidBytes);
  await assert.rejects(
    loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(files), cryptoImpl: webcrypto }),
    (error) => error.code === 'json_parse_error' && error.diagnostics.checksumVerified === true
  );
});

await test('AbortController cancellation is preserved as AbortError', async () => {
  const controller = new AbortController();
  const fetchImpl = (url, options = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(responseFor(staticData.files.get(String(url)))), 100);
    options.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
  const promise = loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, fetchImpl, signal: controller.signal, cryptoImpl: webcrypto });
  controller.abort();
  await assert.rejects(promise, (error) => error.name === 'AbortError' && error.geoDashboardDiagnostics.aborted === true);
});

await test('Platform filtering does not refetch the dataset', async () => {
  let fetchCount = 0;
  const result = await loadGeoDashboardDataset({ mode: 'json', datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(staticData.files, () => { fetchCount += 1; }), cryptoImpl: webcrypto, cache: createGeoDashboardJsonLoaderCache() });
  const afterLoad = fetchCount;
  result.getDashboardData('deepseek');
  result.getDashboardData('doubao');
  assert.equal(fetchCount, afterLoad);
});

await test('Time filtering and view data access do not refetch the dataset', async () => {
  let fetchCount = 0;
  const result = await loadGeoDashboardDataset({ mode: 'json', datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(staticData.files, () => { fetchCount += 1; }), cryptoImpl: webcrypto });
  const afterLoad = fetchCount;
  result.getDashboardTrend('deepseek', '7d');
  result.getDashboardTrend('deepseek', '30d');
  result.getDashboardData('all');
  assert.equal(fetchCount, afterLoad);
});

await test('Successful dataset results reuse the per-instance cache key', async () => {
  let fetchCount = 0;
  const cache = createGeoDashboardJsonLoaderCache();
  const options = { datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(staticData.files, () => { fetchCount += 1; }), cryptoImpl: webcrypto, cache };
  const first = await loadGeoDashboardJsonDataset(options);
  const afterFirst = fetchCount;
  const second = await loadGeoDashboardJsonDataset(options);
  assert.equal(fetchCount, afterFirst);
  assert.equal(first.loadDiagnostics.cacheHit, false);
  assert.equal(second.loadDiagnostics.cacheHit, true);
});

await test('Adapter does not mutate the loaded JSON object', async () => {
  const loaded = await loadGeoDashboardJsonDataset({ datasetId: 'sample-valid', baseUrl, fetchImpl: createFetch(staticData.files), cryptoImpl: webcrypto });
  const before = JSON.stringify(loaded.rawData);
  adaptGeoDashboardData(loaded.rawData, { mode: 'json' });
  assert.equal(JSON.stringify(loaded.rawData), before);
});

await test('Unimplemented sources still throw explicit errors', async () => {
  for (const mode of ['excel', 'feishu', 'api']) {
    assert.throws(
      () => loadGeoDashboardDataset({ mode }),
      (error) => error instanceof GeoDashboardDataSourceNotImplementedError && error.mode === mode
    );
  }
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
