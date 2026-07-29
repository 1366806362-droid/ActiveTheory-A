import './geoDashboard.css';
import {
  geoDashboardMockData,
  getGeoDashboardDataset,
  getGeoDashboardTrend
} from '../data/geoDashboardMockData.js';
import {
  renderOpportunityMap,
  renderRingMeter,
  renderSegmentArc,
  renderTrendChart
} from './geoDashboardCharts.js';
import {
  animateDashboardEntry,
  animateDashboardExit,
  animateMetric,
  pulseCoreFeedback
} from './geoDashboardTransitions.js';

const DASHBOARD_INSTANCE_KEY = '__GEO_DASHBOARD_EXPERIENCE__';
const DASHBOARD_STATUS_KEY = '__GEO_DASHBOARD_STATUS__';
const VIEW_DEFINITIONS = Object.freeze([
  { id: 'overview', label: 'Overview' },
  { id: 'answer', label: 'AI Answer' },
  { id: 'citation', label: 'AI Citation' },
  { id: 'keyword', label: 'GEO Keyword' },
  { id: 'data-health', label: 'Data Health' }
]);

export function initializeGeoDashboardExperience() {
  window[DASHBOARD_INSTANCE_KEY]?.dispose();

  const abortController = new AbortController();
  const { signal } = abortController;
  const params = new URLSearchParams(window.location.search);
  const dashboardRequested = params.get('geoDashboard') === 'v1';
  const entryMode = params.get('entry') === 'geo';
  const state = {
    root: null,
    prompt: null,
    view: 'overview',
    platform: 'all',
    range: '30d',
    scoreExpanded: false,
    cancelAnimations: [],
    openedFrom: entryMode ? 'geo' : 'direct'
  };
  const status = {
    mounted: false,
    view: state.view,
    platform: state.platform,
    range: state.range,
    openedFrom: state.openedFrom,
    renderCount: 0,
    canvasCount: document.querySelectorAll('canvas').length,
    domCount: document.querySelectorAll('*').length,
    performance: import.meta.env.DEV ? { state: 'pending' } : null
  };

  window[DASHBOARD_STATUS_KEY] = status;

  document.addEventListener('keydown', handleKeyDown, { signal });
  document.addEventListener('pointerdown', handleCorePointer, { signal });

  if (dashboardRequested && entryMode) {
    window.setTimeout(showEntryPrompt, 420);
  } else if (dashboardRequested) {
    requestAnimationFrame(() => openDashboard('direct'));
  }

  const experience = {
    open: openDashboard,
    close: closeDashboard,
    dispose() {
      abortController.abort();
      cancelMetricAnimations();
      state.prompt?.remove();
      state.root?.remove();
      state.prompt = null;
      state.root = null;
      delete window[DASHBOARD_STATUS_KEY];
      if (window[DASHBOARD_INSTANCE_KEY] === experience) {
        delete window[DASHBOARD_INSTANCE_KEY];
      }
    }
  };

  window[DASHBOARD_INSTANCE_KEY] = experience;
  return experience;

  function showEntryPrompt() {
    if (state.root || state.prompt || !isGeoReady()) return;

    const prompt = document.createElement('button');
    prompt.type = 'button';
    prompt.className = 'geo-core-entry-prompt';
    prompt.setAttribute('aria-label', '进入GEO数据指挥中心');
    prompt.innerHTML = '<span>Enter Data Core</span>';
    prompt.addEventListener('click', () => openDashboard('geo'), { signal });
    document.body.append(prompt);
    state.prompt = prompt;
  }

  function handleCorePointer(event) {
    if (state.root || state.prompt || event.target?.closest?.('.geo-dashboard')) return;
    if (event.target?.tagName !== 'CANVAS' || !isGeoReady()) return;

    const x = event.clientX / window.innerWidth;
    const y = event.clientY / window.innerHeight;
    const withinCore = ((x - 0.51) / 0.18) ** 2 + ((y - 0.56) / 0.24) ** 2 <= 1;

    if (withinCore) openDashboard('geo');
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && state.root) {
      event.preventDefault();
      closeDashboard();
    }
  }

  function isGeoReady() {
    const geo = window.__GEO_SCENE_STATUS__;
    const tour = window.__GALAXY_TOUR_STATUS__;
    return geo?.activeScene === 'GeoScene'
      && Number(geo?.journeyProgress ?? 1) >= 0.999
      && tour?.activeScene === 'GeoScene';
  }

  function openDashboard(origin = 'direct') {
    if (state.root) return;

    state.openedFrom = origin;
    state.prompt?.remove();
    state.prompt = null;
    if (origin === 'geo') playEntryFlash();

    const root = buildDashboard();
    state.root = root;
    document.body.append(root);
    bindDashboardEvents(root);
    updateDashboard();
    animateDashboardEntry(root, origin);
    root.querySelector('.geo-action-button--return')?.focus({ preventScroll: true });

    status.mounted = true;
    status.openedFrom = origin;
    publishStatus();
    if (import.meta.env.DEV) {
      state.cancelAnimations.push(startPerformanceProbe());
    }
  }

  function closeDashboard() {
    if (!state.root) return;
    const root = state.root;

    animateDashboardExit(root, () => {
      root.remove();
      if (state.root === root) state.root = null;
      cancelMetricAnimations();
      status.mounted = false;
      publishStatus();
      removeDashboardQuery();
    });
  }

  function buildDashboard() {
    const root = document.createElement('main');
    root.className = 'geo-dashboard geo-dashboard--entering';
    root.setAttribute('aria-label', 'GEO Data Command Center');
    root.innerHTML = `
      <div class="geo-dashboard__ambient" aria-hidden="true">
        <div class="geo-dashboard__depth geo-dashboard__depth--rear"></div>
        <div class="geo-dashboard__depth geo-dashboard__depth--mid"></div>
        <svg class="geo-dashboard__veins" viewBox="0 0 1600 900" preserveAspectRatio="none">
          <path d="M36 322 C220 250 342 296 492 414 S716 512 800 452" />
          <path d="M1564 286 C1390 236 1266 310 1120 410 S918 514 800 452" />
          <path d="M1528 718 C1328 694 1224 624 1080 548 S906 486 800 452" />
          <path d="M108 766 C314 716 434 654 588 554 S724 480 800 452" />
          <path d="M470 58 C566 190 630 282 706 360 S760 428 800 452" />
        </svg>
        ${'<i class="geo-dashboard__signal"></i>'.repeat(6)}
      </div>
      ${renderHeader()}
      <div class="geo-dashboard__shell">
        <nav class="geo-dashboard__nav" aria-label="数据视图">
          ${VIEW_DEFINITIONS.map(({ id, label }) => `
            <button class="geo-nav-button" type="button" data-view-target="${id}"
              aria-label="${label}" aria-selected="${id === state.view}">
              <span>${label}</span>
            </button>
          `).join('')}
        </nav>
        <div class="geo-dashboard__viewport">
          ${renderOverviewView()}
          ${renderAnswerView()}
          ${renderCitationView()}
          ${renderKeywordView()}
          ${renderDataHealthView()}
        </div>
      </div>
      <div class="geo-alert-rail" aria-live="polite"></div>
    `;
    return root;
  }

  function renderHeader() {
    const metadata = geoDashboardMockData.metadata;
    const dateCells = [
      ['报告日期', metadata.reportDate],
      ['GEO数据', metadata.geoDataDate],
      ['5A快照', metadata.fiveASnapshotDate],
      ['品牌心智', metadata.brandMindSnapshotDate],
      ['滞后', `${metadata.lagDays} DAY`]
    ];

    return `
      <header class="geo-dashboard__header">
        <div class="geo-dashboard__brand">
          <p class="geo-dashboard__eyebrow">Generative Engine Intelligence</p>
          <h1 class="geo-dashboard__title">GEO DATA COMMAND CENTER</h1>
        </div>
        <div class="geo-dashboard__dates" aria-label="独立数据日期">
          ${dateCells.map(([label, value]) => `
            <div class="geo-date-cell"><span>${label}</span><strong>${value}</strong></div>
          `).join('')}
        </div>
        <div class="geo-dashboard__actions">
          <label class="geo-select-field">
            <span>Platform</span>
            <select data-platform-select aria-label="平台筛选">
              ${geoDashboardMockData.platforms.map(({ id, label }) => (
                `<option value="${id}">${label}</option>`
              )).join('')}
            </select>
          </label>
          <label class="geo-select-field">
            <span>Range</span>
            <select data-range-select aria-label="时间范围">
              <option value="7d">近7天</option>
              <option value="30d" selected>近30天</option>
              <option value="90d">近90天</option>
            </select>
          </label>
          <button class="geo-action-button" type="button" data-fullscreen>全屏</button>
          <button class="geo-action-button geo-action-button--return" type="button">返回 GEO</button>
        </div>
      </header>
    `;
  }

  function renderOverviewView() {
    return `
      <section class="geo-view geo-overview geo-view--active" data-view="overview"
        aria-label="GEO总览">
        <button class="geo-panel geo-overview__answer" type="button" data-open-view="answer">
          <div class="geo-panel__head">
            <div><p class="geo-panel__eyebrow">Answer Intelligence</p><h2 class="geo-panel__title">AI ANSWER</h2></div>
            <i class="geo-panel__signal" aria-hidden="true"></i>
          </div>
          <div class="geo-metric-grid">
            ${metricMarkup('answer-access', '平台可访问率', '三者独立，不合并为完成率')}
            ${metricMarkup('answer-complete', '问题采集完整率', '实际采集问题 / 预期问题')}
            ${metricMarkup('answer-mention', '品牌提及率', '有效回答中的品牌提及比例')}
            ${metricMarkup('answer-first', '首位推荐率', '品牌作为第一推荐出现的比例')}
          </div>
          <p class="geo-panel__microcopy">有效回答率、品牌露出位置及平台差异已按相同口径拆分。</p>
        </button>
        <button class="geo-core geo-overview__core" type="button" data-core-explain
          aria-label="查看GEO综合评分说明" aria-pressed="false">
          <div class="geo-core__meter" data-core-meter></div>
          <div class="geo-core__satellites" aria-hidden="true">
            <span class="geo-core__satellite geo-core__satellite--visibility">
              <em>品牌可见</em><b data-metric="core-visibility">0.0%</b>
            </span>
            <span class="geo-core__satellite geo-core__satellite--first">
              <em>首位推荐</em><b data-metric="core-first">0.0%</b>
            </span>
            <span class="geo-core__satellite geo-core__satellite--quality">
              <em>高质引用</em><b data-metric="core-quality">0.0%</b>
            </span>
            <span class="geo-core__satellite geo-core__satellite--keyword">
              <em>机会评分</em><b data-metric="core-keyword">0.0</b>
            </span>
          </div>
          <div class="geo-core__content">
            <p class="geo-core__eyebrow">Central Signal Intelligence</p>
            <p class="geo-core__score"><strong data-metric="core-score">0.0</strong><span>/100</span></p>
            <span class="geo-core__delta" data-core-delta>今日 +0.0%</span>
            <p class="geo-core__caption" data-core-caption>结构、语义、品牌可见与引用质量的综合信号。</p>
          </div>
        </button>
        <button class="geo-panel geo-overview__citation" type="button" data-open-view="citation">
          <div class="geo-panel__head">
            <div><p class="geo-panel__eyebrow">Source Intelligence</p><h2 class="geo-panel__title">AI CITATION</h2></div>
            <i class="geo-panel__signal" aria-hidden="true"></i>
          </div>
          <div class="geo-metric-grid">
            ${metricMarkup('citation-total', '引用数量', '已采集有效回答中的去重引用')}
            ${metricMarkup('citation-quality', '高质量引用率', '官方与高权威第三方来源占比')}
            ${metricMarkup('citation-authority', '权威来源占比', '按来源分级规则计算')}
            ${metricMarkup('citation-indexed', '收录与索引状态', '可访问并被平台引用的来源比例')}
          </div>
          <div class="geo-segment-chart" data-citation-segment></div>
          <p class="geo-panel__microcopy">官方 / 第三方 / 社区来源保持独立口径。</p>
        </button>
        <button class="geo-panel geo-overview__keyword" type="button" data-open-view="keyword">
          <div class="geo-panel__head">
            <div><p class="geo-panel__eyebrow">Opportunity Tissue</p><h2 class="geo-panel__title">GEO KEYWORD</h2></div>
            <i class="geo-panel__signal" aria-hidden="true"></i>
          </div>
          <div class="geo-keyword-summary">
            <div class="geo-keyword-score">
              <strong data-metric="keyword-score">0.0</strong>
              <p><b data-keyword-opportunity></b><br><span data-keyword-direction></span></p>
            </div>
            <div class="geo-opportunity-mini" aria-hidden="true">${'<span></span>'.repeat(5)}</div>
          </div>
        </button>
        <section class="geo-panel geo-overview__trend" tabindex="0"
          data-tooltip="趋势仅比较相同平台 × 相同问题组合，缺失样本不会按0处理。">
          <div class="geo-panel__head">
            <div><p class="geo-panel__eyebrow">Comparable Signals</p><h2 class="geo-panel__title">趋势与异常</h2></div>
            <i class="geo-panel__signal" aria-hidden="true"></i>
          </div>
          <div class="geo-trend-chart" data-overview-trend></div>
        </section>
      </section>
    `;
  }

  function renderAnswerView() {
    return moduleViewMarkup('answer', 'Answer Intelligence', 'AI ANSWER',
      '从平台可访问、问题采集、有效回答到品牌首位推荐，保持每一层分母清晰。', `
        <div class="geo-module__surface" data-answer-metrics></div>
        <div class="geo-module__surface geo-module__surface--wide">
          <p class="geo-panel__eyebrow">Platform Difference</p>
          <h3 class="geo-panel__title">平台可见与首位推荐</h3>
          <div class="geo-platform-bars" data-answer-platforms></div>
          <div class="geo-answer-structure" data-answer-trend></div>
        </div>
        <div class="geo-module__surface">
          <p class="geo-panel__eyebrow">Answer Structure</p>
          <h3 class="geo-panel__title">回答类型</h3>
          <div class="geo-segment-chart" data-answer-types></div>
          <ul class="geo-recommendation-list" data-answer-recommendations></ul>
        </div>
      `);
  }

  function renderCitationView() {
    return moduleViewMarkup('citation', 'Source Intelligence', 'AI CITATION',
      '识别官方、第三方与社区来源的引用质量，并定位异常来源与索引缺口。', `
        <div class="geo-module__surface" data-citation-metrics></div>
        <div class="geo-module__surface geo-module__surface--wide">
          <p class="geo-panel__eyebrow">Authority Flow</p>
          <h3 class="geo-panel__title">来源域名分布</h3>
          <ul class="geo-source-list" data-source-domains></ul>
          <div class="geo-citation-structure" data-citation-trend></div>
        </div>
        <div class="geo-module__surface">
          <p class="geo-panel__eyebrow">Risk Signals</p>
          <h3 class="geo-panel__title">异常引用来源</h3>
          <ul class="geo-warning-list" data-abnormal-sources></ul>
        </div>
      `);
  }

  function renderKeywordView() {
    return moduleViewMarkup('keyword', 'Opportunity Intelligence', 'GEO KEYWORD',
      '将商业价值、AI触发类型与品牌机会映射为可执行的内容和引用优化方向。', `
        <div class="geo-module__surface" data-keyword-metrics></div>
        <div class="geo-module__surface geo-module__surface--wide">
          <p class="geo-panel__eyebrow">Opportunity Field</p>
          <h3 class="geo-panel__title">机会词组织</h3>
          <div class="geo-opportunity-map" data-opportunity-map></div>
          <ul class="geo-keyword-list" data-keyword-list></ul>
        </div>
        <div class="geo-module__surface">
          <p class="geo-panel__eyebrow">Optimization Vector</p>
          <h3 class="geo-panel__title">新增与下降信号</h3>
          <ul class="geo-recommendation-list" data-keyword-signals></ul>
        </div>
      `);
  }

  function renderDataHealthView() {
    return `
      <section class="geo-view geo-module" data-view="data-health" aria-label="数据健康">
        <div class="geo-module__head">
          <div><p class="geo-module__eyebrow">Data Integrity</p><h2 class="geo-module__title">DATA HEALTH</h2></div>
          <p class="geo-module__description">平台可访问、问题采集完整和已采集回答有效率保持三个独立分母，不合并为单一完成率。</p>
        </div>
        <div>
          <div class="geo-health-grid" data-health-grid></div>
          <div class="geo-module__grid geo-module__grid--health">
            <div class="geo-module__surface geo-module__surface--wide">
              <p class="geo-panel__eyebrow">Date Lineage</p>
              <h3 class="geo-panel__title">数据日期血缘</h3>
              <ul class="geo-recommendation-list" data-date-lineage></ul>
            </div>
            <div class="geo-module__surface">
              <p class="geo-panel__eyebrow">Validation Notes</p>
              <h3 class="geo-panel__title">健康警告</h3>
              <ul class="geo-warning-list" data-health-warnings></ul>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function moduleViewMarkup(id, eyebrow, title, description, body) {
    return `
      <section class="geo-view geo-module" data-view="${id}" aria-label="${title}">
        <div class="geo-module__head">
          <div><p class="geo-module__eyebrow">${eyebrow}</p><h2 class="geo-module__title">${title}</h2></div>
          <p class="geo-module__description">${description}</p>
        </div>
        <div class="geo-module__grid">${body}</div>
      </section>
    `;
  }

  function metricMarkup(key, label, tooltip) {
    return `
      <div class="geo-metric" tabindex="0" data-tooltip="${tooltip}">
        <span>${label}</span><strong data-metric="${key}">0.0</strong>
      </div>
    `;
  }

  function bindDashboardEvents(root) {
    root.addEventListener('click', (event) => {
      const viewTarget = event.target.closest('[data-view-target], [data-open-view]');
      if (viewTarget) {
        setView(viewTarget.dataset.viewTarget ?? viewTarget.dataset.openView);
        return;
      }
      if (event.target.closest('.geo-action-button--return')) {
        closeDashboard();
        return;
      }
      if (event.target.closest('[data-fullscreen]')) {
        toggleFullscreen();
        return;
      }
      const core = event.target.closest('[data-core-explain]');
      if (core) toggleCoreExplanation(core);
    }, { signal });

    root.querySelector('[data-platform-select]').addEventListener('change', (event) => {
      state.platform = event.target.value;
      updateDashboard();
    }, { signal });

    root.querySelector('[data-range-select]').addEventListener('change', (event) => {
      state.range = event.target.value;
      updateDashboard();
    }, { signal });

    root.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true, signal });
  }

  function setView(view) {
    if (!VIEW_DEFINITIONS.some(({ id }) => id === view)) return;
    state.view = view;
    state.root.querySelectorAll('[data-view]').forEach((element) => {
      element.classList.toggle('geo-view--active', element.dataset.view === view);
    });
    state.root.querySelectorAll('[data-view-target]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.viewTarget === view));
    });
    status.view = view;
    publishStatus();
  }

  function toggleCoreExplanation(core) {
    state.scoreExpanded = !state.scoreExpanded;
    core.setAttribute('aria-pressed', String(state.scoreExpanded));
    core.querySelector('[data-core-caption]').textContent = state.scoreExpanded
      ? '综合评分 = 结构 30% + 语义 25% + 品牌可见 25% + 高质量引用 20%。'
      : '结构、语义、品牌可见与引用质量的综合信号。';
    pulseCoreFeedback(core);
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }

  function updateDashboard() {
    const data = getGeoDashboardDataset(state.platform);
    const trend = getGeoDashboardTrend(state.platform, state.range);

    cancelMetricAnimations();
    updateOverview(data, trend);
    updateAnswer(data, trend);
    updateCitation(data, trend);
    updateKeyword(data);
    updateDataHealth(data);
    updateAlerts(data.alerts);
    status.platform = state.platform;
    status.range = state.range;
    status.renderCount += 1;
    publishStatus();
  }

  function updateOverview(data, trend) {
    updateMetric('core-score', data.overview.finalScore);
    updateMetric('core-visibility', data.overview.brandVisibilityRate, '%');
    updateMetric('core-first', data.overview.firstRecommendationRate, '%');
    updateMetric('core-quality', data.overview.qualityCitationRate, '%');
    updateMetric('core-keyword', data.keyword.opportunityScore);
    updateMetric('answer-access', data.answer.platformAccessibilityRate, '%');
    updateMetric('answer-complete', data.answer.questionCollectionCompleteness, '%');
    updateMetric('answer-mention', data.answer.brandMentionRate, '%');
    updateMetric('answer-first', data.answer.firstRecommendationRate, '%');
    updateMetric('citation-total', data.citation.totalCitations, '', 0);
    updateMetric('citation-quality', data.citation.qualityRate, '%');
    updateMetric('citation-authority', data.citation.authorityRate, '%');
    updateMetric('citation-indexed', data.citation.indexedRate, '%');
    updateMetric('keyword-score', data.keyword.opportunityScore);

    const delta = state.root.querySelector('[data-core-delta]');
    delta.textContent = `今日 ${data.overview.dailyDelta >= 0 ? '+' : ''}${data.overview.dailyDelta.toFixed(1)}%`;
    state.root.querySelector('[data-keyword-opportunity]').textContent = data.keyword.brandOpportunity;
    state.root.querySelector('[data-keyword-direction]').textContent = data.keyword.optimizationDirection;

    renderRingMeter(state.root.querySelector('[data-core-meter]'), data.overview);
    renderSegmentArc(state.root.querySelector('[data-citation-segment]'), [
      { label: '官方', value: data.citation.officialRate },
      { label: '第三方', value: data.citation.thirdPartyRate },
      { label: '社区', value: data.citation.communityRate }
    ], { label: '引用来源结构' });
    renderTrendChart(state.root.querySelector('[data-overview-trend]'), trend, {
      label: '相同平台与问题组合趋势'
    });
  }

  function updateAnswer(data, trend) {
    state.root.querySelector('[data-answer-metrics]').innerHTML = [
      ['平台可访问率', data.answer.platformAccessibilityRate, '%', '可访问平台 / 预期平台'],
      ['问题采集完整率', data.answer.questionCollectionCompleteness, '%', '采集问题 / 预期问题'],
      ['回答有效率', data.answer.collectedAnswerValidity, '%', '有效回答 / 已采集回答'],
      ['平均品牌位置', data.answer.averageBrandPosition, '', '仅在品牌被提及的回答内计算']
    ].map(([label, value, suffix, note]) => moduleMetricMarkup(label, value, suffix, note)).join('');

    state.root.querySelector('[data-answer-platforms]').innerHTML = data.answer.platformComparison
      .map((item) => `
        <div class="geo-platform-bar">
          <span>${item.label}</span>
          <i class="geo-platform-bar__track" style="--value:${item.mention}%"></i>
          <strong>${item.mention}</strong>
        </div>
      `).join('');

    renderTrendChart(state.root.querySelector('[data-answer-trend]'), trend, {
      label: 'AI Answer同组合趋势'
    });
    renderSegmentArc(state.root.querySelector('[data-answer-types]'), data.answer.answerTypes, {
      label: '回答类型结构'
    });
    state.root.querySelector('[data-answer-recommendations]').innerHTML = data.recommendations
      .slice(0, 3)
      .map((item) => `<li>${item}</li>`)
      .join('');
  }

  function updateCitation(data, trend) {
    state.root.querySelector('[data-citation-metrics]').innerHTML = [
      ['引用数量', data.citation.totalCitations, '', '去重后的有效引用'],
      ['高质量引用率', data.citation.qualityRate, '%', '官方与高权威第三方来源'],
      ['榜单/测评引用', data.citation.rankingReviewRate, '%', '榜单及评测型来源占比'],
      ['收录与索引', data.citation.indexedRate, '%', '可访问且被平台索引的来源']
    ].map(([label, value, suffix, note]) => moduleMetricMarkup(label, value, suffix, note)).join('');

    state.root.querySelector('[data-source-domains]').innerHTML = data.citation.sourceDomains
      .map((item) => `
        <li class="geo-source-row">
          <span>${item.domain}</span><strong>${item.value}</strong><em>${item.tone}</em>
        </li>
      `).join('');
    state.root.querySelector('[data-abnormal-sources]').innerHTML = data.citation.abnormalSources
      .map((item) => `<li>${item.source} · ${item.count}条 · ${item.severity}</li>`)
      .join('');
    renderTrendChart(state.root.querySelector('[data-citation-trend]'), trend.slice(0, 2), {
      label: '引用质量同组合趋势'
    });
  }

  function updateKeyword(data) {
    state.root.querySelector('[data-keyword-metrics]').innerHTML = [
      ['机会评分', data.keyword.opportunityScore, '', '需求、竞争与品牌能力综合'],
      ['商业价值', data.keyword.commercialValue, '', '商业意图与转化潜力'],
      ['新增机会词', data.keyword.newKeywords.length, '', '本周期首次进入机会池'],
      ['下降词', data.keyword.decliningKeywords.length, '', '同口径趋势下降']
    ].map(([label, value, suffix, note]) => moduleMetricMarkup(label, value, suffix, note)).join('');

    renderOpportunityMap(
      state.root.querySelector('[data-opportunity-map]'),
      data.keyword.topKeywords
    );
    state.root.querySelector('[data-keyword-list]').innerHTML = data.keyword.topKeywords
      .slice(0, 5)
      .map((item) => `
        <li class="geo-keyword-row">
          <span>${item.keyword}</span><strong>${item.score}</strong>
          <em>${item.trend >= 0 ? '+' : ''}${item.trend}%</em>
        </li>
      `).join('');
    state.root.querySelector('[data-keyword-signals]').innerHTML = [
      ...data.keyword.newKeywords.map((item) => `新增 · ${item}`),
      ...data.keyword.decliningKeywords.map((item) => `下降 · ${item}`)
    ].map((item) => `<li>${item}</li>`).join('');
  }

  function updateDataHealth(data) {
    const healthMetrics = [
      {
        label: '平台可访问率',
        value: data.dataHealth.platformAccessibilityRate,
        detail: `${data.dataHealth.availablePlatformCount} / ${data.dataHealth.expectedPlatformCount}个平台可访问`
      },
      {
        label: '问题采集完整率',
        value: data.dataHealth.questionCollectionCompleteness,
        detail: `${data.dataHealth.collectedQuestions} / ${data.dataHealth.expectedQuestions}个问题已采集`
      },
      {
        label: '已采集回答有效率',
        value: data.dataHealth.collectedAnswerValidity,
        detail: `${data.dataHealth.validAnswers} / ${data.dataHealth.collectedAnswers}条回答有效`
      }
    ];

    state.root.querySelector('[data-health-grid]').innerHTML = healthMetrics
      .map((item) => `
        <article class="geo-health-gauge" style="--health:${item.value}">
          <p class="geo-panel__eyebrow">${item.label}</p>
          <strong>${item.value.toFixed(1)}%</strong>
          <p>${item.detail}</p>
        </article>
      `).join('');

    const metadata = geoDashboardMockData.metadata;
    state.root.querySelector('[data-date-lineage]').innerHTML = [
      `报告日期 · ${metadata.reportDate}`,
      `GEO数据日期 · ${metadata.geoDataDate}`,
      `5A快照日期 · ${metadata.fiveASnapshotDate}`,
      `品牌心智快照日期 · ${metadata.brandMindSnapshotDate}`,
      `数据滞后 · ${metadata.lagDays}天`
    ].map((item) => `<li>${item}</li>`).join('');
    state.root.querySelector('[data-health-warnings]').innerHTML = data.dataHealth.warnings
      .map((item) => `<li>${item}</li>`)
      .join('');
  }

  function moduleMetricMarkup(label, value, suffix, note) {
    const digits = Number.isInteger(value) ? 0 : 1;
    return `
      <div class="geo-module__metric" tabindex="0" data-tooltip="${note}">
        <span>${label}</span><strong>${Number(value).toFixed(digits)}${suffix}<small>${note}</small></strong>
      </div>
    `;
  }

  function updateAlerts(alerts) {
    state.root.querySelector('.geo-alert-rail').innerHTML = alerts.map((alert) => `
      <span class="geo-alert geo-alert--${alert.tone}">
        <b>${alert.label}</b> · ${alert.detail}
      </span>
    `).join('');
  }

  function updateMetric(key, value, suffix = '', digits = 1) {
    const element = state.root.querySelector(`[data-metric="${key}"]`);
    if (!element) return;
    state.cancelAnimations.push(animateMetric(element, value, { suffix, digits }));
  }

  function cancelMetricAnimations() {
    state.cancelAnimations.forEach((cancel) => cancel());
    state.cancelAnimations.length = 0;
  }

  function publishStatus() {
    status.canvasCount = document.querySelectorAll('canvas').length;
    status.domCount = document.querySelectorAll('*').length;
    document.documentElement.dataset.geoDashboardStatus = JSON.stringify(status);
  }

  function startPerformanceProbe(duration = 5000) {
    const frameTimes = [];
    const activeFrameTimes = [];
    let frame = 0;
    let startedAt = 0;
    let previousAt = 0;
    let cancelled = false;

    const tick = (now) => {
      if (cancelled) return;
      if (!startedAt) {
        startedAt = now;
        previousAt = now;
      } else {
        const frameTime = now - previousAt;
        previousAt = now;
        if (frameTime > 0) {
          frameTimes.push(frameTime);
          if (frameTime < 250) activeFrameTimes.push(frameTime);
        }
      }

      if (now - startedAt < duration) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - startedAt;
      const effectiveFps = frameTimes.length * 1000 / Math.max(1, elapsed);
      const environmentLimited = effectiveFps < 30;
      const measuredFrameTimes = environmentLimited ? activeFrameTimes : frameTimes;
      const fps = measuredFrameTimes.map((frameTime) => 1000 / frameTime);
      const slowest = [...fps].sort((a, b) => a - b);
      const lowSampleCount = Math.max(1, Math.ceil(slowest.length * 0.01));
      const average = fps.reduce((sum, value) => sum + value, 0) / Math.max(1, fps.length);
      const onePercentLow = slowest
        .slice(0, lowSampleCount)
        .reduce((sum, value) => sum + value, 0) / lowSampleCount;

      status.performance = {
        state: 'complete',
        durationMs: Math.round(elapsed),
        frameCount: frameTimes.length,
        effectiveFps: Number(effectiveFps.toFixed(2)),
        environmentLimited,
        averageFps: environmentLimited ? null : Number(average.toFixed(2)),
        onePercentLow: environmentLimited ? null : Number(onePercentLow.toFixed(2)),
        minimumFps: environmentLimited ? null : Number(Math.min(...fps).toFixed(2)),
        activeBurstFps: environmentLimited && fps.length
          ? Number(average.toFixed(2))
          : null
      };
      publishStatus();
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }

  function playEntryFlash() {
    const flash = document.createElement('div');
    flash.className = 'geo-entry-flash';
    flash.addEventListener('animationend', () => flash.remove(), { once: true });
    document.body.append(flash);
  }

  function removeDashboardQuery() {
    const url = new URL(window.location.href);
    url.searchParams.delete('geoDashboard');
    url.searchParams.delete('entry');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
}
