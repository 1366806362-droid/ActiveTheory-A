import './dataCenterShell.css';

export function createDataCenterShell({
  definition,
  eyebrow,
  statusMessage,
  moduleLabels,
  onRequestClose,
  documentObject = document
}) {
  const abortController = new AbortController();
  const { signal } = abortController;
  let dataset = null;
  let destroyed = false;

  const root = documentObject.createElement('main');
  root.className = `data-center-shell data-center-shell--${definition.theme}`;
  root.dataset.dataCenterId = definition.id;
  root.setAttribute('aria-label', definition.name);
  root.innerHTML = `
    <div class="data-center-shell__backdrop" aria-hidden="true">
      <svg class="data-center-shell__network" viewBox="0 0 1600 900" preserveAspectRatio="none">
        <path d="M72 250 C330 110 480 360 762 265 S1220 110 1510 238" />
        <path d="M90 690 C350 510 520 720 810 612 S1260 450 1518 655" />
        <path d="M310 65 C420 270 610 240 800 448 S1160 610 1320 822" />
      </svg>
      <span class="data-center-shell__signal data-center-shell__signal--one"></span>
      <span class="data-center-shell__signal data-center-shell__signal--two"></span>
      <span class="data-center-shell__signal data-center-shell__signal--three"></span>
    </div>

    <header class="data-center-shell__header">
      <div>
        <p class="data-center-shell__eyebrow">${eyebrow}</p>
        <h1>${definition.name}</h1>
        <p class="data-center-shell__subtitle">${definition.displayName}</p>
      </div>
      <button class="data-center-shell__return" type="button">返回品牌认知宇宙</button>
    </header>

    <section class="data-center-shell__stage" aria-labelledby="${definition.id}-status-title">
      <div class="data-center-shell__orbit data-center-shell__orbit--outer" aria-hidden="true"></div>
      <div class="data-center-shell__orbit data-center-shell__orbit--inner" aria-hidden="true"></div>
      <div class="data-center-shell__core">
        <span class="data-center-shell__core-label">STATUS CORE</span>
        <h2 id="${definition.id}-status-title">${statusMessage}</h2>
        <p>${definition.description}</p>
        <span class="data-center-shell__state">WAITING FOR DATA CONTRACT</span>
      </div>
      <div class="data-center-shell__modules" aria-label="未来模块结构">
        ${moduleLabels.map((label, index) => `
          <article class="data-center-shell__module" style="--module-index:${index}">
            <span>${String(index + 1).padStart(2, '0')}</span>
            <h3>${label}</h3>
            <p>结构接口已预留</p>
          </article>
        `).join('')}
      </div>
    </section>

    <footer class="data-center-shell__footer">
      <span>${definition.version.toUpperCase()} ARCHITECTURE SHELL</span>
      <span>DATA STATUS · WAITING</span>
      <span>ESC · RETURN</span>
    </footer>
  `;

  root.querySelector('.data-center-shell__return')?.addEventListener(
    'click',
    () => onRequestClose?.(),
    { signal }
  );
  documentObject.addEventListener('keydown', handleKeyDown, { signal });
  documentObject.body.append(root);
  root.querySelector('.data-center-shell__return')?.focus({ preventScroll: true });

  return Object.freeze({
    id: definition.id,
    root,
    setDataset(value) {
      dataset = value ?? null;
      return getDataStatus();
    },
    clearDataset() {
      dataset = null;
      return getDataStatus();
    },
    getDataStatus,
    destroy
  });

  function handleKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onRequestClose?.();
  }

  function getDataStatus() {
    return {
      status: dataset ? 'ready' : 'waiting',
      hasDataset: Boolean(dataset),
      contractStatus: definition.dataStatus
    };
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    dataset = null;
    abortController.abort();
    root.remove();
  }
}
