import { selectSingleGeoDashboardLocalFile } from '../data/geoDashboardFileLoader.js';

const FILE_IMPORT_STATES = new Set([
  'idle',
  'reading',
  'validating',
  'ready',
  'warning',
  'failed',
  'applied',
  'reverted'
]);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function shortSha(value) {
  const hash = String(value ?? '').toUpperCase();
  return hash.length >= 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : '—';
}

function safeIssues(items) {
  return (Array.isArray(items) ? items : []).slice(0, 4).map((item) => ({
    code: String(item?.code ?? ''),
    message: String(item?.message ?? '')
  }));
}

export function createGeoDashboardFileImport(options) {
  const root = options.root;
  const parentSignal = options.signal;
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  let layer = null;
  let input = null;
  let activeRead = null;
  let fileReference = null;
  let pendingResult = null;
  let lastResult = null;
  let disposed = false;
  const state = {
    state: 'idle',
    dragActive: false,
    applied: false,
    pendingUserConfirmation: false,
    fileDiagnostics: null,
    schemaVersion: null,
    datasetId: null,
    datasetVersion: null,
    dataDate: null,
    platformCount: 0,
    gate: null,
    errors: [],
    warnings: [],
    info: [],
    transformations: [],
    fallbackUsed: false,
    fallbackReason: null,
    appliedAt: null
  };

  parentSignal?.addEventListener('abort', dispose, { once: true });
  root.querySelector('[data-file-import-open]')?.addEventListener('click', open, { signal });

  function open() {
    if (disposed) return;
    if (!layer) buildLayer();
    layer.hidden = false;
    layer.setAttribute('aria-hidden', 'false');
    render();
    layer.querySelector('.geo-file-import__choose')?.focus({ preventScroll: true });
  }

  function close({ clearPending = false } = {}) {
    if (!layer) return;
    if (state.state === 'reading' || state.state === 'validating') cancelRead();
    if (clearPending && !state.applied) resetState('idle');
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
    root.querySelector('[data-file-import-open]')?.focus({ preventScroll: true });
  }

  function buildLayer() {
    layer = document.createElement('section');
    layer.className = 'geo-file-import';
    layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('aria-label', '导入本地GEO数据包');
    layer.innerHTML = `
      <div class="geo-file-import__backdrop" data-file-import-cancel></div>
      <div class="geo-file-import__panel" role="dialog" aria-modal="true" aria-labelledby="geo-file-import-title">
        <header class="geo-file-import__head">
          <div>
            <p>Local Data Ingestion</p>
            <h2 id="geo-file-import-title">导入数据包</h2>
          </div>
          <button type="button" class="geo-file-import__close" data-file-import-cancel aria-label="关闭导入层">×</button>
        </header>
        <div class="geo-file-import__drop" data-file-dropzone tabindex="0">
          <input type="file" accept=".json,application/json" data-file-input hidden>
          <span class="geo-file-import__glyph" aria-hidden="true">JSON</span>
          <strong data-file-drop-title>选择或拖入标准JSON文件</strong>
          <small>文件只在当前浏览器内读取 · 最大5MB · 不上传、不保存</small>
          <button type="button" class="geo-file-import__choose" data-file-choose>选择JSON文件</button>
        </div>
        <div class="geo-file-import__status" role="status" aria-live="polite">
          <i data-file-state-dot></i><strong data-file-state>未选择文件</strong><span data-file-state-detail>当前使用安全演示数据</span>
        </div>
        <dl class="geo-file-import__summary">
          <div><dt>文件</dt><dd data-file-name>—</dd></div>
          <div><dt>大小</dt><dd data-file-size>—</dd></div>
          <div><dt>SHA-256</dt><dd data-file-sha>—</dd></div>
          <div><dt>Schema</dt><dd data-file-schema>—</dd></div>
          <div><dt>Dataset</dt><dd data-file-dataset>—</dd></div>
          <div><dt>版本</dt><dd data-file-version>—</dd></div>
          <div><dt>数据日期</dt><dd data-file-date>—</dd></div>
          <div><dt>平台</dt><dd data-file-platforms>—</dd></div>
          <div><dt>Gate</dt><dd data-file-gate>—</dd></div>
          <div><dt>诊断</dt><dd data-file-counts>0 Error · 0 Warning · 0 Transform</dd></div>
        </dl>
        <ul class="geo-file-import__issues" data-file-issues aria-label="文件验证摘要"></ul>
        <footer class="geo-file-import__actions">
          <button type="button" data-file-apply disabled>应用数据</button>
          <button type="button" data-file-revert>恢复演示数据</button>
          <button type="button" data-file-import-cancel>取消</button>
        </footer>
      </div>
    `;
    root.append(layer);
    input = layer.querySelector('[data-file-input]');

    layer.querySelector('[data-file-choose]').addEventListener('click', () => input.click(), { signal });
    input.addEventListener('change', () => {
      if (!input.files?.length) return;
      handleFiles(input.files);
      input.value = '';
    }, { signal });
    layer.querySelectorAll('[data-file-import-cancel]').forEach((button) => {
      button.addEventListener('click', () => close({ clearPending: true }), { signal });
    });
    layer.querySelector('[data-file-apply]').addEventListener('click', applyPending, { signal });
    layer.querySelector('[data-file-revert]').addEventListener('click', revertToMock, { signal });

    const dropzone = layer.querySelector('[data-file-dropzone]');
    layer.addEventListener('dragover', preventFileNavigation, { signal });
    layer.addEventListener('drop', preventFileNavigation, { signal });
    dropzone.addEventListener('dragenter', () => setDragActive(true), { signal });
    dropzone.addEventListener('dragover', () => setDragActive(true), { signal });
    dropzone.addEventListener('dragleave', (event) => {
      if (!dropzone.contains(event.relatedTarget)) setDragActive(false);
    }, { signal });
    dropzone.addEventListener('drop', (event) => {
      setDragActive(false);
      handleFiles(event.dataTransfer?.files ?? []);
    }, { signal });
    dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.click();
      }
    }, { signal });
  }

  function preventFileNavigation(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function setDragActive(active) {
    state.dragActive = active;
    layer?.classList.toggle('geo-file-import--drag-active', active);
    notify();
  }

  async function handleFiles(fileList) {
    let selectedFile;
    try {
      selectedFile = selectSingleGeoDashboardLocalFile(fileList);
    } catch (error) {
      setImmediateFailure(error.code ?? 'MULTIPLE_FILES', error.message);
      return;
    }
    if (!selectedFile) {
      return;
    }
    cancelRead();
    pendingResult = null;
    lastResult = null;
    const currentFile = selectedFile;
    const readController = new AbortController();
    fileReference = currentFile;
    activeRead = readController;
    state.state = 'reading';
    state.applied = false;
    state.pendingUserConfirmation = false;
    state.fileDiagnostics = {
      fileName: currentFile.name,
      sizeBytes: currentFile.size,
      mimeType: currentFile.type,
      lastModified: currentFile.lastModified
    };
    state.errors = [];
    state.warnings = [];
    state.info = [];
    state.transformations = [];
    render();
    notify();

    try {
      state.state = 'validating';
      render();
      notify();
      const result = await options.loadFile(currentFile, readController.signal);
      lastResult = result;
      state.fileDiagnostics = result.fileDiagnostics ?? result.sourceDiagnostics ?? null;
      state.schemaVersion = result.requestedDataset?.schemaVersion ?? result.dataset?.schemaVersion ?? null;
      state.datasetId = result.requestedDataset?.datasetId ?? result.dataset?.datasetId ?? null;
      state.datasetVersion = result.requestedDataset?.datasetVersion ?? result.dataset?.datasetVersion ?? null;
      state.dataDate = result.requestedDataset?.metadata?.geoDataDate ?? result.dataset?.metadata?.geoDataDate ?? null;
      state.platformCount = result.requestedDataset?.platforms?.length ?? result.dataset?.platforms?.length ?? 0;
      state.gate = result.gate?.status ?? 'fail';
      state.errors = safeIssues(result.errors);
      state.warnings = safeIssues(result.warnings);
      state.info = safeIssues(result.info);
      state.transformations = Array.isArray(result.transformations) ? result.transformations : [];
      state.fallbackUsed = Boolean(result.fallbackUsed);
      state.fallbackReason = result.fallbackReason ?? null;
      if (result.pendingUserConfirmation && ['pass', 'warning'].includes(state.gate)) {
        pendingResult = result;
        state.pendingUserConfirmation = true;
        state.state = state.gate === 'warning' || state.warnings.length ? 'warning' : 'ready';
      } else {
        pendingResult = null;
        state.pendingUserConfirmation = false;
        state.state = 'failed';
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setImmediateFailure(error?.code ?? 'FILE_LOAD_FAILED', error?.message ?? '文件读取失败。', error?.diagnostics);
      return;
    } finally {
      if (fileReference === currentFile) fileReference = null;
      if (activeRead === readController) activeRead = null;
    }
    render();
    notify();
  }

  function setImmediateFailure(code, message, diagnostics = null) {
    cancelRead();
    fileReference = null;
    pendingResult = null;
    lastResult = null;
    state.state = 'failed';
    state.pendingUserConfirmation = false;
    state.applied = false;
    state.gate = 'fail';
    state.errors = [{ code, message }];
    state.warnings = [];
    state.info = [];
    state.transformations = [];
    state.fileDiagnostics = diagnostics;
    render();
    notify();
  }

  function applyPending() {
    if (!pendingResult || !state.pendingUserConfirmation) return;
    const appliedResult = options.applyFile(pendingResult);
    lastResult = appliedResult;
    pendingResult = null;
    state.pendingUserConfirmation = false;
    state.applied = true;
    state.state = 'applied';
    state.appliedAt = new Date().toISOString();
    render();
    notify();
  }

  function revertToMock() {
    cancelRead();
    fileReference = null;
    pendingResult = null;
    lastResult = null;
    options.revertToMock();
    resetState('reverted');
  }

  function cancelRead() {
    activeRead?.abort();
    activeRead = null;
    fileReference = null;
  }

  function resetState(nextState) {
    const preservedState = FILE_IMPORT_STATES.has(nextState) ? nextState : 'idle';
    Object.assign(state, {
      state: preservedState,
      dragActive: false,
      applied: false,
      pendingUserConfirmation: false,
      fileDiagnostics: null,
      schemaVersion: null,
      datasetId: null,
      datasetVersion: null,
      dataDate: null,
      platformCount: 0,
      gate: null,
      errors: [],
      warnings: [],
      info: [],
      transformations: [],
      fallbackUsed: false,
      fallbackReason: null,
      appliedAt: null
    });
    render();
    notify();
  }

  function render() {
    if (!layer) return;
    const diagnostics = state.fileDiagnostics ?? {};
    const statusLabels = {
      idle: ['未选择文件', '当前使用安全演示数据'],
      reading: ['正在读取数据包', '文件只在当前浏览器内处理'],
      validating: ['正在验证数据', '正在执行Adapter、Validator与Data Gate'],
      ready: ['数据包可应用', '验证通过，等待用户确认'],
      warning: ['数据包存在警告', '可查看摘要后确认应用'],
      failed: ['数据包未通过验证', '当前Dashboard数据保持不变'],
      applied: ['本地数据已应用', 'Dashboard已切换到当前数据包'],
      reverted: ['已恢复安全演示数据', '本地文件引用已经释放']
    };
    const [label, detail] = statusLabels[state.state] ?? statusLabels.idle;
    layer.dataset.fileState = state.state;
    layer.classList.toggle('geo-file-import--drag-active', state.dragActive);
    layer.querySelector('[data-file-state]').textContent = label;
    layer.querySelector('[data-file-state-detail]').textContent = detail;
    layer.querySelector('[data-file-name]').textContent = diagnostics.fileName || '—';
    layer.querySelector('[data-file-size]').textContent = formatBytes(diagnostics.sizeBytes);
    layer.querySelector('[data-file-sha]').textContent = shortSha(diagnostics.sha256);
    layer.querySelector('[data-file-schema]').textContent = state.schemaVersion || '—';
    layer.querySelector('[data-file-dataset]').textContent = state.datasetId || '—';
    layer.querySelector('[data-file-version]').textContent = state.datasetVersion || '—';
    layer.querySelector('[data-file-date]').textContent = state.dataDate || '—';
    layer.querySelector('[data-file-platforms]').textContent = state.platformCount ? String(state.platformCount) : '—';
    layer.querySelector('[data-file-gate]').textContent = state.gate || '—';
    layer.querySelector('[data-file-counts]').textContent = `${state.errors.length} Error · ${state.warnings.length} Warning · ${state.transformations.length} Transform`;
    const allIssues = [...state.errors, ...state.warnings];
    const issues = allIssues.slice(0, 3);
    const list = layer.querySelector('[data-file-issues]');
    const issueNodes = issues.map((issue) => {
      const item = document.createElement('li');
      const code = document.createElement('b');
      const message = document.createElement('span');
      code.textContent = issue.code || 'DATA';
      message.textContent = issue.message;
      item.append(code, message);
      return item;
    });
    if (allIssues.length > issues.length) {
      const remaining = document.createElement('li');
      remaining.className = 'geo-file-import__issues-more';
      const remainingType = state.errors.length ? '诊断' : '警告';
      remaining.textContent = `另有${allIssues.length - issues.length}项${remainingType}`;
      issueNodes.push(remaining);
    }
    list.replaceChildren(...issueNodes);
    layer.querySelector('[data-file-apply]').disabled = !state.pendingUserConfirmation;
    layer.querySelector('[data-file-revert]').disabled = state.state === 'reading' || state.state === 'validating';
  }

  function getSnapshot() {
    const diagnostics = state.fileDiagnostics ? { ...state.fileDiagnostics } : null;
    return {
      mode: 'file',
      state: state.state,
      fileName: diagnostics?.fileName ?? null,
      extension: diagnostics?.extension ?? null,
      mimeType: diagnostics?.mimeType ?? null,
      sizeBytes: diagnostics?.sizeBytes ?? null,
      lastModified: diagnostics?.lastModified ?? null,
      sha256: diagnostics?.sha256 ?? null,
      checksumCalculated: diagnostics?.checksumCalculated ?? false,
      utf8Decoded: diagnostics?.utf8Decoded ?? false,
      parseSucceeded: diagnostics?.parseSucceeded ?? false,
      schemaVersion: state.schemaVersion,
      datasetId: state.datasetId,
      datasetVersion: state.datasetVersion,
      gate: state.gate,
      pendingUserConfirmation: state.pendingUserConfirmation,
      applied: state.applied,
      fallbackUsed: state.fallbackUsed,
      fallbackReason: state.fallbackReason,
      errors: state.errors.map((item) => ({ ...item })),
      warnings: state.warnings.map((item) => ({ ...item })),
      info: state.info.map((item) => ({ ...item })),
      transformations: state.transformations.map((item) => ({ ...item })),
      fileDiagnostics: diagnostics,
      loadedAt: diagnostics?.loadCompletedAt ?? null,
      appliedAt: state.appliedAt,
      fileReferenceHeld: fileReference !== null,
      readerActive: activeRead !== null
    };
  }

  function notify() {
    options.onStateChange?.(getSnapshot(), lastResult);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelRead();
    pendingResult = null;
    lastResult = null;
    input = null;
    layer?.remove();
    layer = null;
    lifecycle.abort();
  }

  notify();
  return { open, close, dispose, getSnapshot, handleFiles };
}
