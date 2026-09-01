import './brandMindDataPanel.css';
import {
  BRAND_MIND_DATA_PANEL_ISOLATED_EVENTS,
  createBrandMindDataPanelController
} from './brandMindDataPanelController.js';
import { buildBrandMindDataPanelViewModel } from './brandMindDataPanelViewModel.js';

export function createBrandMindDataPanel({ snapshot, documentObject = document, windowObject = window }) {
  const viewModel = buildBrandMindDataPanelViewModel(snapshot);
  const element = documentObject.createElement('aside');

  element.className = 'brandmind-data-panel';
  element.dataset.brandMindDataPanel = 'v1';
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('aria-label', '品牌心智数据表');
  element.innerHTML = renderPanel(viewModel);

  const closeButton = element.querySelector('[data-brandmind-panel-close]');
  const controller = createBrandMindDataPanelController({
    onStateChange({ open, reason }) {
      element.classList.toggle('is-open', open);
      element.setAttribute('aria-hidden', open ? 'false' : 'true');
      element.dataset.openReason = reason;
      documentObject.documentElement.dataset.brandMindDataPanelOpen = open ? '1' : '0';
      if (open) closeButton?.focus({ preventScroll: true });
    }
  });
  const stopPanelEvent = (event) => event.stopPropagation();
  const handleKeyDown = (event) => controller.handleKeyDown(event);

  closeButton?.addEventListener('click', () => controller.close('close-button'));
  BRAND_MIND_DATA_PANEL_ISOLATED_EVENTS.forEach((eventName) => {
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
      BRAND_MIND_DATA_PANEL_ISOLATED_EVENTS.forEach((eventName) => {
        element.removeEventListener(eventName, stopPanelEvent);
      });
      controller.destroy();
      element.remove();
      delete documentObject.documentElement.dataset.brandMindDataPanelOpen;
      if (windowObject.__ACTIVE_THEORY_BRAND_MIND_DATA_PANEL__ === api) {
        delete windowObject.__ACTIVE_THEORY_BRAND_MIND_DATA_PANEL__;
      }
    }
  };

  if (import.meta.env.DEV) windowObject.__ACTIVE_THEORY_BRAND_MIND_DATA_PANEL__ = api;
  return Object.freeze(api);
}

function renderPanel(viewModel) {
  return `
    <div class="brandmind-data-panel__surface">
      <header class="brandmind-data-panel__header">
        <div>
          <p class="brandmind-data-panel__eyebrow">ACTIVE THEORY V2 · DATA INTERPRETATION</p>
          <h1>品牌心智数据表 <span>Brand Mind Data</span></h1>
        </div>
        <button class="brandmind-data-panel__close" type="button" data-brandmind-panel-close aria-label="关闭品牌心智数据表">关闭</button>
      </header>
      ${renderSnapshot(viewModel.header)}
      <section class="brandmind-data-panel__section brandmind-data-panel__section--core">
        ${renderSectionHeading('品牌心智核心', 'Brand Mind Core', `Confidence ${viewModel.coreMetrics.confidenceLabel}`)}
        <div class="brandmind-data-panel__core-grid">
          ${renderCoreMetric('核心心智强度', 'Core Strength', viewModel.coreMetrics.strengthLabel, viewModel.coreMetrics.changeVsLastLabel, viewModel.coreMetrics.strength)}
          ${renderCoreMetric('心智集中度', 'Concentration', viewModel.coreMetrics.concentrationLabel, null, viewModel.coreMetrics.concentration)}
          ${renderCoreMetric('心智覆盖度', 'Coverage', viewModel.coreMetrics.coverageLabel, null, viewModel.coreMetrics.coverage)}
          ${renderCoreMetric('关联节点数量', 'Associations', viewModel.coreMetrics.associationCountLabel)}
          ${renderCoreMetric('核心稳定度', 'Stability', viewModel.coreMetrics.stabilityLabel, null, viewModel.coreMetrics.stability)}
          ${renderCoreStatusMetric(viewModel.coreStatus)}
        </div>
      </section>
      <section class="brandmind-data-panel__section brandmind-data-panel__section--associations">
        ${renderSectionHeading('心智关联概览', 'Association Overview', `${viewModel.associationRows.length} NODES`)}
        <div class="brandmind-data-panel__table-wrap">
          <table class="brandmind-data-panel__table brandmind-data-panel__table--associations">
            <thead><tr>
              ${tableHeading('', 'Rank')}
              ${tableHeading('心智词', 'Association')}
              ${tableHeading('类别', 'Category')}
              ${tableHeading('关联强度', 'Strength')}
              ${tableHeading('权重', 'Weight')}
              ${tableHeading('提及量', 'Mentions')}
              ${tableHeading('置信度', 'Confidence')}
              ${tableHeading('较上期', 'Change')}
              ${tableHeading('状态', 'Status')}
            </tr></thead>
            <tbody>${viewModel.associationRows.map(renderAssociationRow).join('')}</tbody>
          </table>
        </div>
      </section>
      <div class="brandmind-data-panel__middle-grid">
        <section class="brandmind-data-panel__section brandmind-data-panel__section--relationships">
          ${renderSectionHeading('关联关系网络', 'Relationship Network', `TOP ${viewModel.relationshipRows.length}`)}
          <div class="brandmind-data-panel__relationship-list">
            ${viewModel.relationshipRows.map(renderRelationshipRow).join('') || renderEmpty('未提供关联关系')}
          </div>
        </section>
        <section class="brandmind-data-panel__section brandmind-data-panel__section--drift">
          ${renderSectionHeading('心智变化趋势', 'Mind Trend / Drift', viewModel.mindDrift.status)}
          ${renderMindDrift(viewModel.mindDrift)}
        </section>
      </div>
      <div class="brandmind-data-panel__bottom-grid">
        ${renderOpportunities(viewModel.opportunityInsights)}
        ${renderDiagnostics(viewModel.diagnostics, viewModel.rules)}
        ${renderQuality(viewModel.dataQuality)}
      </div>
      <footer class="brandmind-data-panel__footer">
        <span>${escapeHtml(viewModel.header.snapshotId)}</span>
        <span>MOCK PANEL · NOT PRODUCTION DATA</span>
      </footer>
    </div>
  `;
}

function renderSnapshot(header) {
  const tone = header.isMock ? 'is-mock' : header.isPartial ? 'is-partial' : '';
  return `<section class="brandmind-data-panel__snapshot ${tone}">
    ${snapshotItem('品牌', 'Brand', header.brand)}
    ${snapshotItem('快照日期', 'Snapshot Date', header.snapshotDate)}
    ${snapshotItem('数据来源', 'Source Type', header.sourceIdentity)}
    ${snapshotItem('样本量', 'Sample Size', header.sampleSizeLabel)}
    ${snapshotItem('数据状态', 'Verification', header.verification)}
  </section>`;
}

function snapshotItem(label, english, value) {
  return `<div class="brandmind-data-panel__snapshot-item"><span>${label} <small>${english}</small></span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderCoreMetric(label, english, value, change = null, barValue = null) {
  return `<article class="brandmind-data-panel__core-metric">
    <span>${label}<small>${english}</small></span>
    <strong>${escapeHtml(value)}</strong>
    ${barValue === null ? '' : renderBar(barValue)}
    ${change ? `<em>较上期 ${escapeHtml(change)}</em>` : ''}
  </article>`;
}

function renderCoreStatusMetric(status) {
  return `<article class="brandmind-data-panel__core-metric brandmind-data-panel__core-status" title="${escapeHtml(status.description)}">
    <span>心智状态<small>Core Status</small></span>
    <strong>${escapeHtml(status.label)}</strong>
    <em>${escapeHtml(status.code)}</em>
  </article>`;
}

function renderAssociationRow(row) {
  return `<tr class="${row.isTopAssociation ? 'is-top' : ''}">
    <td class="is-rank">${row.rank}</td>
    <td class="is-key"><strong>${escapeHtml(row.association)}</strong></td>
    <td>${escapeHtml(row.category)}</td>
    <td>${renderValueBar(row.strength, row.strengthLabel)}</td>
    <td class="is-number">${escapeHtml(row.weightLabel)}</td>
    <td class="is-meta">${escapeHtml(row.mentionsLabel)}</td>
    <td class="is-number">${escapeHtml(row.confidenceLabel)}</td>
    <td class="${changeClass(row.changeVsLast)}">${escapeHtml(row.changeVsLastLabel)}</td>
    <td><span class="brandmind-data-panel__status is-${row.status.toLowerCase()}">${escapeHtml(formatStatus(row.status))}</span></td>
  </tr>`;
}

function renderRelationshipRow(row) {
  return `<article class="brandmind-data-panel__relationship-row ${row.corePath ? 'is-core-path' : ''}">
    <span class="brandmind-data-panel__relationship-pair"><strong>${escapeHtml(row.sourceLabel)}</strong><i>→</i><strong>${escapeHtml(row.targetLabel)}</strong></span>
    <span>${escapeHtml(row.strengthLabel)}</span>
    <span>${escapeHtml(row.confidenceLabel)}</span>
    <span class="${changeClass(row.changeVsLast)}">${escapeHtml(row.changeVsLastLabel)}</span>
    <span>${row.corePath ? '核心路径' : '关联路径'}</span>
  </article>`;
}

function renderMindDrift(drift) {
  if (!drift.available) return renderEmpty('未提供历史对比，无法判断新增、增长、衰减或消失。');
  return `<div class="brandmind-data-panel__drift-summary">
      ${drift.categories.map((category) => `<div><span>${escapeHtml(formatStatus(category.status))}</span><strong>${escapeHtml(category.countLabel)}</strong></div>`).join('')}
    </div>
    <div class="brandmind-data-panel__drift-list">
      ${drift.rows.map((row) => `<div><strong>${escapeHtml(row.association)}</strong><span>${escapeHtml(formatStatus(row.status))}</span><em class="${changeClass(row.changeVsLast)}">${escapeHtml(row.changeVsLastLabel)}</em>${renderBar(Math.min(Math.abs(row.changeVsLast ?? 0) * 10, 1))}</div>`).join('')}
    </div>`;
}

function renderDiagnostics(diagnostics, rules) {
  return `<section class="brandmind-data-panel__card brandmind-data-panel__card--diagnostics">
    ${renderSectionHeading('关键诊断', 'Key Diagnostics', rules.status)}
    <div class="brandmind-data-panel__diagnostics">
      ${diagnostics.map((item) => `<article class="is-${escapeHtml(item.level)}">
        <span>${diagnosticLabel(item.level)}</span>
        <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>
      </article>`).join('')}
    </div>
  </section>`;
}

function renderOpportunities(insights) {
  const sourceIdentity = insights[0]?.sourceIdentity ?? 'NOT PROVIDED';
  return `<section class="brandmind-data-panel__card brandmind-data-panel__card--opportunities">
    ${renderSectionHeading('机会洞察', 'Opportunity Insights', sourceIdentity)}
    <div class="brandmind-data-panel__opportunities">
      ${insights.map((item) => `<article class="is-${escapeHtml(item.type.toLowerCase())}">
        <span>${escapeHtml(opportunityLabel(item.type))}</span>
        <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>
      </article>`).join('') || renderEmpty('当前数据未形成可用机会洞察。')}
    </div>
  </section>`;
}

function renderQuality(quality) {
  return `<section class="brandmind-data-panel__card">
    ${renderSectionHeading('数据质量', 'Data Quality', quality.status)}
    <dl class="brandmind-data-panel__metric-list">
      ${quality.metrics.map((item) => `<div class="${item.available ? '' : 'is-muted'}"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.valueLabel)}</dd></div>`).join('')}
    </dl>
  </section>`;
}

function renderSectionHeading(label, english, metadata) {
  return `<div class="brandmind-data-panel__section-heading"><h2>${label} <span>${english}</span></h2><p>${escapeHtml(metadata)}</p></div>`;
}

function tableHeading(label, english) {
  return `<th><span>${label}</span><small>${english}</small></th>`;
}

function renderValueBar(value, label) {
  return `<div class="brandmind-data-panel__value-bar"><span>${escapeHtml(label)}</span>${renderBar(value)}</div>`;
}

function renderBar(value) {
  const width = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) * 100 : 0;
  return `<i class="brandmind-data-panel__bar"><b style="width:${width.toFixed(1)}%"></b></i>`;
}

function renderEmpty(message) {
  return `<div class="brandmind-data-panel__empty">${escapeHtml(message)}</div>`;
}

function formatStatus(status) {
  return ({
    CORE: '核心',
    GROWING: '增长',
    STABLE: '稳定',
    WEAKENING: '衰减',
    EMERGING: '新增',
    LOST: '消失',
    NOT_PROVIDED: '未提供'
  })[status] ?? status;
}

function diagnosticLabel(level) {
  return level === 'warning' ? '重点' : level === 'positive' ? '增长' : level === 'attention' ? '观察' : '信息';
}

function opportunityLabel(type) {
  return ({ STRENGTHEN: '强化', GROWTH: '增长', DEFEND: '防御' })[type] ?? type;
}

function changeClass(value) {
  if (!Number.isFinite(value)) return 'is-meta';
  return value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : 'is-meta';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
