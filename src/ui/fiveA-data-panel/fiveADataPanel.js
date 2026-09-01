import './fiveADataPanel.css';
import {
  FIVE_A_DATA_PANEL_ISOLATED_EVENTS,
  createFiveADataPanelController
} from './fiveADataPanelController.js';
import { buildFiveADataPanelViewModel } from './fiveADataPanelViewModel.js';

export function createFiveADataPanel({ snapshot, documentObject = document, windowObject = window }) {
  const viewModel = buildFiveADataPanelViewModel(snapshot);
  const element = documentObject.createElement('aside');
  element.className = 'fivea-data-panel';
  element.dataset.fiveADataPanel = 'v1';
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('aria-label', '5A 数据表');
  element.innerHTML = renderPanel(viewModel);

  const closeButton = element.querySelector('[data-fivea-panel-close]');
  const controller = createFiveADataPanelController({
    onStateChange({ open, reason }) {
      element.classList.toggle('is-open', open);
      element.setAttribute('aria-hidden', open ? 'false' : 'true');
      element.dataset.openReason = reason;
      documentObject.documentElement.dataset.fiveADataPanelOpen = open ? '1' : '0';
      if (open) closeButton?.focus({ preventScroll: true });
    }
  });
  const stopPanelEvent = (event) => event.stopPropagation();
  const handleKeyDown = (event) => controller.handleKeyDown(event);

  closeButton?.addEventListener('click', () => controller.close('close-button'));
  FIVE_A_DATA_PANEL_ISOLATED_EVENTS.forEach((eventName) => {
    element.addEventListener(eventName, stopPanelEvent, { passive: eventName !== 'wheel' });
  });
  windowObject.addEventListener('keydown', handleKeyDown);

  const api = {
    element,
    viewModel,
    open: controller.open,
    close: controller.close,
    toggle: controller.toggle,
    isOpen: controller.isOpen,
    destroy() {
      windowObject.removeEventListener('keydown', handleKeyDown);
      FIVE_A_DATA_PANEL_ISOLATED_EVENTS.forEach((eventName) => {
        element.removeEventListener(eventName, stopPanelEvent);
      });
      controller.destroy();
      element.remove();
      delete documentObject.documentElement.dataset.fiveADataPanelOpen;
      if (windowObject.__ACTIVE_THEORY_FIVEA_DATA_PANEL__ === api) {
        delete windowObject.__ACTIVE_THEORY_FIVEA_DATA_PANEL__;
      }
    }
  };

  if (import.meta.env.DEV) windowObject.__ACTIVE_THEORY_FIVEA_DATA_PANEL__ = api;
  return Object.freeze(api);
}

function renderPanel(viewModel) {
  return `
    <div class="fivea-data-panel__surface">
      <header class="fivea-data-panel__header">
        <div>
          <p class="fivea-data-panel__eyebrow">ACTIVE THEORY V2 · DATA INTERPRETATION</p>
          <h1>5A 数据表 <span>Five A Journey Data</span></h1>
        </div>
        <button class="fivea-data-panel__close" type="button" data-fivea-panel-close aria-label="关闭 5A 数据表">关闭</button>
      </header>
      ${renderSnapshot(viewModel.header)}
      <section class="fivea-data-panel__section fivea-data-panel__section--stage">
        ${renderSectionHeading('5A 阶段总览', 'Stage Overview', '瓶颈：实验规则')}
        <div class="fivea-data-panel__table-wrap">
          <table class="fivea-data-panel__table fivea-data-panel__table--stage">
            <thead><tr>
              ${tableHeading('阶段', 'Stage')}
              ${tableHeading('阶段名称', 'Stage Name')}
              ${tableHeading('人群规模', 'Population')}
              ${tableHeading('占比', 'Demo Share')}
              ${tableHeading('阶段强度', 'Score 0–100')}
              ${tableHeading('置信度', 'Confidence')}
              ${tableHeading('较上期', 'Change')}
              ${tableHeading('瓶颈', 'Experimental')}
            </tr></thead>
            <tbody>${viewModel.stageRows.map(renderStageRow).join('')}</tbody>
          </table>
        </div>
        <p class="fivea-data-panel__footnote">占比按当前五阶段 MOCK 人群合计推导；不代表正式业务口径。</p>
      </section>
      <section class="fivea-data-panel__section fivea-data-panel__section--flow">
        ${renderSectionHeading('阶段流转', 'Transition Flow', '固定四条相邻路径')}
        <div class="fivea-data-panel__table-wrap">
          <table class="fivea-data-panel__table fivea-data-panel__table--flow">
            <thead><tr>
              ${tableHeading('流转路径', 'Flow Path')}
              ${tableHeading('流入人数', 'In')}
              ${tableHeading('流出人数', 'Out')}
              ${tableHeading('流转率', 'Conversion')}
              ${tableHeading('流转强度', 'Not Provided')}
              ${tableHeading('断层率', 'Drop-off')}
              ${tableHeading('较上期', 'Change')}
              ${tableHeading('瓶颈', 'Experimental')}
            </tr></thead>
            <tbody>${viewModel.transitionRows.map(renderTransitionRow).join('')}</tbody>
          </table>
        </div>
      </section>
      <div class="fivea-data-panel__insights">
        ${renderOpportunity(viewModel.opportunityPool)}
        ${renderDiagnostics(viewModel.diagnostics, viewModel.rules)}
        ${renderQuality(viewModel.dataQuality)}
      </div>
      <footer class="fivea-data-panel__footer">
        <span>${escapeHtml(viewModel.header.snapshotId)}</span>
        <span>MOCK PANEL · NOT PRODUCTION DATA</span>
      </footer>
    </div>
  `;
}

function renderSnapshot(header) {
  const items = [
    ['品牌', 'Brand', header.brand],
    ['快照日期', 'Snapshot Date', header.snapshotDate],
    ['数据来源', 'Source Type', header.sourceIdentity],
    ['样本量', 'Sample Size', header.sampleSizeLabel],
    ['数据状态', 'Verification', header.verification]
  ];
  return `<section class="fivea-data-panel__snapshot ${header.isMock ? 'is-mock' : ''}">
    ${items.map(([label, english, value]) => `<div class="fivea-data-panel__snapshot-item">
      <span>${escapeHtml(label)} <small>${escapeHtml(english)}</small></span>
      <strong>${escapeHtml(value)}</strong>
    </div>`).join('')}
  </section>`;
}

function renderSectionHeading(title, subtitle, note) {
  return `<header class="fivea-data-panel__section-heading">
    <h2>${escapeHtml(title)} <span>${escapeHtml(subtitle)}</span></h2>
    <p>${escapeHtml(note)}</p>
  </header>`;
}

function tableHeading(label, english) {
  return `<th scope="col"><span>${escapeHtml(label)}</span><small>${escapeHtml(english)}</small></th>`;
}

function renderStageRow(row) {
  return `<tr class="${row.isBottleneck ? 'is-bottleneck' : ''} ${row.available ? '' : 'is-missing'}">
    <td class="is-key">${escapeHtml(row.stageId)}</td>
    <td><strong>${escapeHtml(row.stageNameEnglish)}</strong> <span>${escapeHtml(row.stageNameChinese)}</span></td>
    <td>${renderPopulation(row.populationRelative, row.populationLabel)}</td>
    <td class="is-number is-share">${escapeHtml(row.percentageLabel)}</td>
    <td class="is-number">${escapeHtml(row.strengthLabel)}</td>
    <td class="is-meta">${escapeHtml(row.confidenceLabel)}</td>
    <td class="is-meta">${escapeHtml(row.changeVsLastLabel)}</td>
    <td>${renderBottleneck(row.isBottleneck)}</td>
  </tr>`;
}

function renderTransitionRow(row) {
  return `<tr class="${row.isBottleneck ? 'is-bottleneck' : ''} ${row.available ? '' : 'is-missing'}">
    <td class="is-key">${escapeHtml(row.label)}</td>
    <td class="is-number">${escapeHtml(row.inPopulationLabel)}</td>
    <td class="is-number">${escapeHtml(row.outPopulationLabel)}</td>
    <td>${renderRate(row.conversionRate, row.conversionRateLabel)}</td>
    <td class="is-meta">${escapeHtml(row.flowStrengthLabel)}</td>
    <td class="is-number is-dropoff ${row.isBottleneck ? 'is-alert' : ''}">${escapeHtml(row.dropOffRateLabel)}</td>
    <td class="is-meta">${escapeHtml(row.changeVsLastLabel)}</td>
    <td>${renderBottleneck(row.isBottleneck)}</td>
  </tr>`;
}

function renderRate(value, label) {
  const width = Number.isFinite(value) ? Math.max(4, Math.min(value * 100, 100)) : 0;
  return `<div class="fivea-data-panel__rate"><span>${escapeHtml(label)}</span><i aria-hidden="true"><b style="width:${width.toFixed(1)}%"></b></i></div>`;
}

function renderPopulation(value, label) {
  const width = Number.isFinite(value) ? Math.max(5, Math.min(value * 100, 100)) : 0;

  return `<div class="fivea-data-panel__population"><span>${escapeHtml(label)}</span><i aria-hidden="true"><b style="width:${width.toFixed(1)}%"></b></i></div>`;
}

function renderBottleneck(isBottleneck) {
  return `<span class="fivea-data-panel__status ${isBottleneck ? 'is-warning' : ''}">${isBottleneck ? '是' : '否'}</span>`;
}

function renderOpportunity(pool) {
  return `<section class="fivea-data-panel__card">
    ${renderSectionHeading('机会池', 'Opportunity Pool', '非 A6 阶段')}
    <dl class="fivea-data-panel__metric-list">
      ${metric('机会池规模', pool.volumeLabel)}
      ${metric('阶段人群合计占比', pool.ratioLabel)}
      ${metric('机会强度', pool.strengthLabel)}
      ${metric('置信度', pool.confidenceLabel)}
    </dl>
    <span class="fivea-data-panel__badge">${escapeHtml(pool.status)}</span>
  </section>`;
}

function renderDiagnostics(diagnostics, rules) {
  return `<section class="fivea-data-panel__card fivea-data-panel__card--diagnostics">
    ${renderSectionHeading('关键诊断', 'Key Diagnostics', rules.status)}
    <div class="fivea-data-panel__diagnostics">
      ${diagnostics.map((item) => `<article class="is-${escapeHtml(item.level)}">
        <span class="fivea-data-panel__diagnostic-mark">${item.level === 'warning' ? '重点' : item.level === 'attention' ? '观察' : '信息'}</span>
        <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>
      </article>`).join('')}
    </div>
  </section>`;
}

function renderQuality(quality) {
  return `<section class="fivea-data-panel__card">
    ${renderSectionHeading('数据质量', 'Data Quality', 'MOCK STRUCTURE')}
    <dl class="fivea-data-panel__metric-list">
      ${quality.metrics.map((item) => metric(item.label, item.valueLabel, !item.available)).join('')}
    </dl>
    <span class="fivea-data-panel__badge is-neutral">${escapeHtml(quality.status)}</span>
  </section>`;
}

function metric(label, value, muted = false) {
  return `<div class="${muted ? 'is-muted' : ''}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
