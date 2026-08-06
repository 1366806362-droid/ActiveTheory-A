import { calculateGeoDashboardSha256 } from './geoDashboardJsonLoader.js';

export const GEO_DASHBOARD_FILE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const GEO_DASHBOARD_FILE_ALLOWED_EXTENSIONS = Object.freeze(['.json']);

const JSON_MIME_PATTERN = /^(application|text)\/(?:[A-Za-z0-9.+-]*\+)?json(?:\s*;|$)/i;

export class GeoDashboardFileLoadError extends Error {
  constructor(code, message, diagnostics, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'GeoDashboardFileLoadError';
    this.code = code;
    this.diagnostics = { ...diagnostics, errorCode: code, errorMessage: message };
  }
}

export class GeoDashboardFileSelectionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoDashboardFileSelectionError';
    this.code = code;
  }
}

export function selectSingleGeoDashboardLocalFile(fileList) {
  const files = Array.from(fileList ?? []);
  if (files.length === 0) return null;
  if (files.length > 1) {
    throw new GeoDashboardFileSelectionError('multiple_files', '一次只能导入一个JSON文件。');
  }
  return files[0];
}

function getExtension(fileName) {
  const normalized = String(fileName ?? '').trim().toLowerCase();
  const index = normalized.lastIndexOf('.');
  return index >= 0 ? normalized.slice(index) : '';
}

function createDiagnostics(file, maxSizeBytes) {
  const extension = getExtension(file?.name);
  const mimeType = String(file?.type ?? '').trim().toLowerCase();
  return {
    fileName: String(file?.name ?? ''),
    extension,
    mimeType,
    sizeBytes: Number(file?.size ?? 0),
    lastModified: Number.isFinite(Number(file?.lastModified)) ? Number(file.lastModified) : null,
    maxSizeBytes,
    expectedMaxSizeBytes: maxSizeBytes,
    sizeAccepted: false,
    extensionAccepted: false,
    mimeAccepted: mimeType === '' || JSON_MIME_PATTERN.test(mimeType),
    mimeWarning: null,
    emptyFile: Number(file?.size ?? 0) === 0,
    sha256: null,
    checksumCalculated: false,
    utf8Decoded: false,
    parseSucceeded: false,
    rootType: null,
    loadStartedAt: new Date().toISOString(),
    loadCompletedAt: null,
    durationMs: null,
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
  throw new GeoDashboardFileLoadError(code, message, diagnostics, cause);
}

function createAbortError(diagnostics, startedAt) {
  diagnostics.aborted = true;
  diagnostics.errorCode = 'aborted';
  diagnostics.errorMessage = '文件读取已取消。';
  completeDiagnostics(diagnostics, startedAt);
  const error = new DOMException('文件读取已取消。', 'AbortError');
  error.geoDashboardDiagnostics = diagnostics;
  return error;
}

function assertFile(file, diagnostics, startedAt) {
  if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
    fail('invalid_file', '请选择一个有效的本地文件。', diagnostics, startedAt);
  }
}

function normalizeExtensions(extensions) {
  return new Set(extensions.map((extension) => {
    const value = String(extension).trim().toLowerCase();
    return value.startsWith('.') ? value : `.${value}`;
  }));
}

function readWithFileReader(file, signal, diagnostics, startedAt) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onAbort = () => {
      if (reader.readyState === FileReader.LOADING) reader.abort();
      finish(reject, createAbortError(diagnostics, startedAt));
    };
    reader.addEventListener('load', () => finish(resolve, reader.result), { once: true });
    reader.addEventListener('error', () => {
      finish(reject, new GeoDashboardFileLoadError(
        'file_read_error',
        '无法读取本地文件。',
        completeDiagnostics(diagnostics, startedAt),
        reader.error
      ));
    }, { once: true });
    reader.addEventListener('abort', () => finish(reject, createAbortError(diagnostics, startedAt)), { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    reader.readAsArrayBuffer(file);
  });
}

function readWithArrayBuffer(file, signal, diagnostics, startedAt) {
  if (signal?.aborted) return Promise.reject(createAbortError(diagnostics, startedAt));
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      reject(createAbortError(diagnostics, startedAt));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    file.arrayBuffer().then((buffer) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(buffer);
    }, (error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      reject(new GeoDashboardFileLoadError(
        'file_read_error',
        '无法读取本地文件。',
        completeDiagnostics(diagnostics, startedAt),
        error
      ));
    });
  });
}

function readFileBuffer(file, signal, diagnostics, startedAt) {
  return typeof FileReader === 'function'
    ? readWithFileReader(file, signal, diagnostics, startedAt)
    : readWithArrayBuffer(file, signal, diagnostics, startedAt);
}

export async function loadGeoDashboardLocalFile(file, options = {}) {
  const startedAt = Date.now();
  const maxSizeBytes = options.maxSizeBytes ?? GEO_DASHBOARD_FILE_MAX_SIZE_BYTES;
  const allowedExtensions = normalizeExtensions(
    options.allowedExtensions ?? GEO_DASHBOARD_FILE_ALLOWED_EXTENSIONS
  );
  const verifyChecksum = options.verifyChecksum !== false;
  const diagnostics = createDiagnostics(file, maxSizeBytes);

  try {
    assertFile(file, diagnostics, startedAt);
    if (!Number.isFinite(maxSizeBytes) || maxSizeBytes <= 0) {
      fail('invalid_size_limit', 'maxSizeBytes必须为正数。', diagnostics, startedAt);
    }
    if (allowedExtensions.size === 0 || !allowedExtensions.has(diagnostics.extension)) {
      fail('invalid_extension', '只允许导入.json文件。', diagnostics, startedAt);
    }
    diagnostics.extensionAccepted = true;
    if (diagnostics.emptyFile) {
      fail('empty_file', '所选文件为空。', diagnostics, startedAt);
    }
    if (!Number.isFinite(diagnostics.sizeBytes) || diagnostics.sizeBytes < 0) {
      fail('invalid_file_size', '文件大小无效。', diagnostics, startedAt);
    }
    if (diagnostics.sizeBytes > maxSizeBytes) {
      fail('size_exceeded', '文件超过5MB大小上限。', diagnostics, startedAt);
    }
    diagnostics.sizeAccepted = true;
    if (!diagnostics.mimeAccepted) {
      diagnostics.mimeWarning = '文件MIME不是标准JSON类型，已依据.json扩展名继续安全校验。';
    }

    const buffer = await readFileBuffer(file, options.signal, diagnostics, startedAt);
    if (!(buffer instanceof ArrayBuffer)) {
      fail('file_read_error', '本地文件未返回有效二进制内容。', diagnostics, startedAt);
    }
    if (buffer.byteLength !== diagnostics.sizeBytes) {
      fail('size_mismatch', '读取到的文件大小与浏览器报告不一致。', diagnostics, startedAt);
    }

    if (verifyChecksum) {
      diagnostics.sha256 = await calculateGeoDashboardSha256(buffer, options.cryptoImpl);
      diagnostics.checksumCalculated = true;
    }

    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      diagnostics.utf8Decoded = true;
    } catch (error) {
      fail('invalid_utf8', '文件不是有效UTF-8 JSON。', diagnostics, startedAt, error);
    }
    if (!text.trim()) {
      fail('empty_file', '所选文件不包含JSON内容。', diagnostics, startedAt);
    }

    let rawData;
    try {
      rawData = JSON.parse(text);
      diagnostics.parseSucceeded = true;
    } catch (error) {
      fail('json_parse_error', '文件无法解析为JSON。', diagnostics, startedAt, error);
    }
    diagnostics.rootType = Array.isArray(rawData)
      ? 'array'
      : rawData === null
        ? 'null'
        : typeof rawData;
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
      fail('invalid_json_root', 'JSON根节点必须是Object。', diagnostics, startedAt);
    }

    completeDiagnostics(diagnostics, startedAt);
    return { rawData, fileDiagnostics: diagnostics };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (error instanceof GeoDashboardFileLoadError) throw error;
    fail('file_load_failed', '本地JSON文件读取失败。', diagnostics, startedAt, error);
  }
}
