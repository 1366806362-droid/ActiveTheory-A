import { GEO_DASHBOARD_SCHEMA_VERSION } from './geoDashboardDataContract.js';

export const GEO_DASHBOARD_JSON_MANIFEST_URL = '/data/geo-dashboard/manifest.json';
export const GEO_DASHBOARD_JSON_MAX_SIZE_BYTES = 5 * 1024 * 1024;

const DATASET_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const JSON_CONTENT_TYPE_PATTERN = /^(application|text)\/(?:[A-Za-z0-9.+-]*\+)?json(?:\s*;|$)/i;
const SHA256_PATTERN = /^[A-Fa-f0-9]{64}$/;

export class GeoDashboardJsonLoadError extends Error {
  constructor(code, message, diagnostics, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'GeoDashboardJsonLoadError';
    this.code = code;
    this.diagnostics = { ...diagnostics, errorCode: code, errorMessage: message };
  }
}

export function createGeoDashboardJsonLoaderCache() {
  return {
    manifestPromises: new Map(),
    datasetResults: new Map()
  };
}

function createDiagnostics(datasetId, manifestUrl) {
  return {
    datasetId,
    manifestUrl,
    fileUrl: null,
    manifestLoaded: false,
    manifestStatus: null,
    fileLoaded: false,
    fileStatus: null,
    contentType: null,
    expectedSizeBytes: null,
    actualSizeBytes: null,
    expectedSha256: null,
    actualSha256: null,
    checksumVerified: false,
    parseSucceeded: false,
    loadStartedAt: new Date().toISOString(),
    loadCompletedAt: null,
    durationMs: null,
    bytesLoaded: 0,
    cacheHit: false,
    aborted: false,
    errorCode: null,
    errorMessage: null
  };
}

function completeDiagnostics(diagnostics, startedAt) {
  diagnostics.loadCompletedAt = new Date().toISOString();
  diagnostics.durationMs = Date.now() - startedAt;
  return diagnostics;
}

function fail(code, message, diagnostics, startedAt, cause = null) {
  completeDiagnostics(diagnostics, startedAt);
  throw new GeoDashboardJsonLoadError(code, message, diagnostics, cause);
}

function assertSameOrigin(url, origin, code, diagnostics, startedAt) {
  if (url.origin !== origin) {
    fail(code, '仅允许加载当前站点同源的数据资源。', diagnostics, startedAt);
  }
}

function assertDatasetId(datasetId, diagnostics, startedAt) {
  if (!DATASET_ID_PATTERN.test(String(datasetId ?? ''))) {
    fail('invalid_dataset_id', 'datasetId只允许1至64位字母、数字、短横线和下划线。', diagnostics, startedAt);
  }
}

function assertSafeFileName(file, diagnostics, startedAt) {
  if (typeof file !== 'string'
    || !file.endsWith('.json')
    || file.includes('/')
    || file.includes('\\')
    || file.includes('..')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(file)
    || file !== file.trim()) {
    fail('unsafe_dataset_path', 'Manifest中的数据文件必须是当前目录下的安全JSON文件名。', diagnostics, startedAt);
  }
}

function normalizeSha256(value) {
  return String(value ?? '').trim().toLowerCase();
}

export async function calculateGeoDashboardSha256(buffer, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle?.digest) {
    throw new Error('当前环境不支持Web Crypto SHA-256。');
  }
  const digest = await cryptoImpl.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readContentLength(response) {
  const raw = response.headers?.get?.('content-length');
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function assertJsonContentType(response, diagnostics, startedAt) {
  const contentType = response.headers?.get?.('content-type') ?? '';
  diagnostics.contentType = contentType;
  if (contentType && !JSON_CONTENT_TYPE_PATTERN.test(contentType)) {
    fail('invalid_content_type', '数据资源Content-Type不是JSON。', diagnostics, startedAt);
  }
}

function parseJsonBytes(bytes, diagnostics, startedAt, label) {
  if (!bytes.byteLength) {
    fail('empty_json', `${label}为空文件。`, diagnostics, startedAt);
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    fail('invalid_utf8', `${label}不是有效UTF-8。`, diagnostics, startedAt, error);
  }
  if (!text.trim()) {
    fail('empty_json', `${label}不包含JSON内容。`, diagnostics, startedAt);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    fail('json_parse_error', `${label}无法解析为JSON。`, diagnostics, startedAt, error);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('invalid_json_root', `${label}根节点必须是Object。`, diagnostics, startedAt);
  }
  return parsed;
}

function validateManifest(manifest, diagnostics, startedAt) {
  if (manifest.schemaVersion !== GEO_DASHBOARD_SCHEMA_VERSION) {
    fail('unsupported_manifest_schema', 'Manifest schemaVersion不受支持。', diagnostics, startedAt);
  }
  if (!Array.isArray(manifest.datasets)) {
    fail('invalid_manifest', 'Manifest datasets必须为数组。', diagnostics, startedAt);
  }
  const ids = manifest.datasets.map((entry) => entry?.id);
  if (new Set(ids).size !== ids.length) {
    fail('duplicate_dataset_id', 'Manifest中的datasetId必须唯一。', diagnostics, startedAt);
  }
  return manifest;
}

async function fetchManifest({ fetchImpl, manifestUrl, signal, maxSizeBytes, cache }, diagnostics, startedAt) {
  if (cache.manifestPromises.has(manifestUrl.href)) {
    return cache.manifestPromises.get(manifestUrl.href);
  }
  const promise = (async () => {
    const response = await fetchImpl(manifestUrl.href, { signal, credentials: 'same-origin' });
    diagnostics.manifestStatus = response.status;
    if (!response.ok) {
      fail('manifest_http_error', `Manifest请求失败，HTTP ${response.status}。`, diagnostics, startedAt);
    }
    assertJsonContentType(response, diagnostics, startedAt);
    const declaredLength = readContentLength(response);
    if (declaredLength != null && declaredLength > maxSizeBytes) {
      fail('manifest_size_exceeded', 'Manifest超过允许的文件大小。', diagnostics, startedAt);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxSizeBytes) {
      fail('manifest_size_exceeded', 'Manifest超过允许的文件大小。', diagnostics, startedAt);
    }
    diagnostics.manifestLoaded = true;
    return validateManifest(parseJsonBytes(new Uint8Array(buffer), diagnostics, startedAt, 'Manifest'), diagnostics, startedAt);
  })();
  cache.manifestPromises.set(manifestUrl.href, promise);
  try {
    return await promise;
  } catch (error) {
    cache.manifestPromises.delete(manifestUrl.href);
    throw error;
  }
}

export async function loadGeoDashboardJsonDataset(options = {}) {
  const startedAt = Date.now();
  const datasetId = options.datasetId;
  const maxSizeBytes = options.maxSizeBytes ?? GEO_DASHBOARD_JSON_MAX_SIZE_BYTES;
  const verifyChecksum = options.verifyChecksum !== false;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = new URL(options.baseUrl ?? globalThis.location?.href ?? 'http://localhost/');
  const manifestUrl = new URL(options.manifestUrl ?? GEO_DASHBOARD_JSON_MANIFEST_URL, baseUrl);
  const diagnostics = createDiagnostics(datasetId, manifestUrl.href);
  const cache = options.cache ?? createGeoDashboardJsonLoaderCache();

  try {
    if (typeof fetchImpl !== 'function') {
      fail('fetch_unavailable', '当前环境不支持Fetch。', diagnostics, startedAt);
    }
    if (!Number.isFinite(maxSizeBytes) || maxSizeBytes <= 0) {
      fail('invalid_size_limit', 'maxSizeBytes必须为正数。', diagnostics, startedAt);
    }
    assertDatasetId(datasetId, diagnostics, startedAt);
    assertSameOrigin(manifestUrl, baseUrl.origin, 'cross_origin_manifest', diagnostics, startedAt);

    const manifest = await fetchManifest({ fetchImpl, manifestUrl, signal: options.signal, maxSizeBytes, cache }, diagnostics, startedAt);
    const manifestEntry = manifest.datasets.find((entry) => entry?.id === datasetId);
    if (!manifestEntry) {
      fail('unknown_dataset', 'Manifest未登记该datasetId。', diagnostics, startedAt);
    }
    if (manifestEntry.enabled !== true) {
      fail('dataset_disabled', '该数据集已被Manifest禁用。', diagnostics, startedAt);
    }
    if (manifestEntry.schemaVersion !== GEO_DASHBOARD_SCHEMA_VERSION) {
      fail('unsupported_dataset_schema', '数据集schemaVersion不受支持。', diagnostics, startedAt);
    }
    assertSafeFileName(manifestEntry.file, diagnostics, startedAt);

    const dataDirectory = new URL('/data/geo-dashboard/', baseUrl);
    const fileUrl = new URL(manifestEntry.file, dataDirectory);
    assertSameOrigin(fileUrl, baseUrl.origin, 'cross_origin_dataset', diagnostics, startedAt);
    if (!fileUrl.pathname.startsWith(dataDirectory.pathname)) {
      fail('unsafe_dataset_path', '数据文件必须位于固定的同源数据目录。', diagnostics, startedAt);
    }

    diagnostics.fileUrl = fileUrl.href;
    diagnostics.expectedSizeBytes = Number(manifestEntry.sizeBytes);
    diagnostics.expectedSha256 = normalizeSha256(manifestEntry.sha256);
    if (!Number.isInteger(diagnostics.expectedSizeBytes) || diagnostics.expectedSizeBytes < 0) {
      fail('invalid_manifest_size', 'Manifest sizeBytes必须为非负整数。', diagnostics, startedAt);
    }
    if (diagnostics.expectedSizeBytes > maxSizeBytes) {
      fail('size_exceeded', 'Manifest声明的数据文件超过大小上限。', diagnostics, startedAt);
    }
    if (verifyChecksum && !SHA256_PATTERN.test(String(manifestEntry.sha256 ?? ''))) {
      fail('invalid_manifest_checksum', 'Manifest sha256格式无效。', diagnostics, startedAt);
    }

    const cacheKey = `${datasetId}::${manifestEntry.datasetVersion}::${diagnostics.expectedSha256}`;
    if (cache.datasetResults.has(cacheKey)) {
      const cached = cache.datasetResults.get(cacheKey);
      return {
        ...cached,
        loadDiagnostics: {
          ...cached.loadDiagnostics,
          cacheHit: true,
          loadStartedAt: diagnostics.loadStartedAt,
          loadCompletedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt
        }
      };
    }

    const response = await fetchImpl(fileUrl.href, { signal: options.signal, credentials: 'same-origin' });
    diagnostics.fileStatus = response.status;
    if (!response.ok) {
      fail('dataset_http_error', `数据文件请求失败，HTTP ${response.status}。`, diagnostics, startedAt);
    }
    assertJsonContentType(response, diagnostics, startedAt);
    const contentLength = readContentLength(response);
    if (contentLength != null && contentLength > maxSizeBytes) {
      fail('size_exceeded', 'HTTP Content-Length超过数据文件大小上限。', diagnostics, startedAt);
    }
    const buffer = await response.arrayBuffer();
    diagnostics.fileLoaded = true;
    diagnostics.bytesLoaded = buffer.byteLength;
    diagnostics.actualSizeBytes = buffer.byteLength;
    if (buffer.byteLength > maxSizeBytes) {
      fail('size_exceeded', '实际数据文件超过大小上限。', diagnostics, startedAt);
    }
    if (buffer.byteLength !== diagnostics.expectedSizeBytes) {
      fail('size_mismatch', '实际数据文件大小与Manifest不一致。', diagnostics, startedAt);
    }

    if (verifyChecksum) {
      diagnostics.actualSha256 = normalizeSha256(await calculateGeoDashboardSha256(buffer, options.cryptoImpl));
      if (diagnostics.actualSha256 !== diagnostics.expectedSha256) {
        fail('checksum_mismatch', '数据文件SHA-256与Manifest不一致。', diagnostics, startedAt);
      }
      diagnostics.checksumVerified = true;
    }

    const rawData = parseJsonBytes(new Uint8Array(buffer), diagnostics, startedAt, '数据文件');
    diagnostics.parseSucceeded = true;
    completeDiagnostics(diagnostics, startedAt);
    const result = { rawData, manifest, manifestEntry, loadDiagnostics: diagnostics };
    cache.datasetResults.set(cacheKey, result);
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') {
      diagnostics.aborted = true;
      diagnostics.errorCode = 'aborted';
      diagnostics.errorMessage = '数据加载已取消。';
      completeDiagnostics(diagnostics, startedAt);
      error.geoDashboardDiagnostics = diagnostics;
      throw error;
    }
    if (error instanceof GeoDashboardJsonLoadError) throw error;
    fail('network_error', 'JSON数据包加载失败。', diagnostics, startedAt, error);
  }
}
