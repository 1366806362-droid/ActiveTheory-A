const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function metricText(value, digits = 1, suffix = '') {
  return Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '未提供';
}

function extent(values) {
  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

function pointsToPath(points, width, height, padding = 10) {
  const values = points.map(({ value }) => value);
  const { min, max } = extent(values);
  const range = Math.max(max - min, 1);

  return points.map(({ value }, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

export function renderTrendChart(container, series, options = {}) {
  const width = 560;
  const height = 172;
  const svg = createSvgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': options.label ?? '同平台同问题趋势'
  });
  const defs = createSvgElement('defs');
  const gradient = createSvgElement('linearGradient', {
    id: 'geo-trend-fill',
    x1: '0',
    y1: '0',
    x2: '0',
    y2: '1'
  });

  gradient.append(
    createSvgElement('stop', { offset: '0%', 'stop-color': '#74e4ff', 'stop-opacity': 0.28 }),
    createSvgElement('stop', { offset: '100%', 'stop-color': '#74e4ff', 'stop-opacity': 0 })
  );
  defs.append(gradient);
  svg.append(defs);

  [0.25, 0.5, 0.75].forEach((ratio) => {
    svg.append(createSvgElement('line', {
      x1: 8,
      x2: width - 8,
      y1: height * ratio,
      y2: height * ratio,
      class: 'geo-chart-grid'
    }));
  });

  series.slice(0, 4).forEach((item, index) => {
    const pathData = pointsToPath(item.points, width, height, 14);
    const path = createSvgElement('path', {
      d: pathData,
      class: `geo-trend-line geo-trend-line--${index + 1}`,
      'data-series': item.label
    });

    svg.append(path);
    if (index === 0) {
      const area = createSvgElement('path', {
        d: `${pathData} L${width - 14},${height - 12} L14,${height - 12} Z`,
        class: 'geo-trend-area'
      });
      svg.insertBefore(area, path);
    }
  });

  const legend = document.createElement('div');
  legend.className = 'geo-chart-legend';
  series.slice(0, 4).forEach((item, index) => {
    const label = document.createElement('span');
    label.innerHTML = `<i class="geo-chart-key geo-chart-key--${index + 1}"></i>${item.label}`;
    legend.append(label);
  });

  container.replaceChildren(svg, legend);
}

export function renderRingMeter(container, metrics) {
  const svg = createSvgElement('svg', {
    viewBox: '0 0 440 440',
    role: 'img',
    'aria-label': `GEO comprehensive signal ${metrics.finalScore}`
  });
  const center = 220;
  const defs = createSvgElement('defs');
  const glow = createSvgElement('radialGradient', { id: 'geo-core-glow-v11' });
  glow.append(
    createSvgElement('stop', { offset: '0%', 'stop-color': '#d9fbff', 'stop-opacity': 0.16 }),
    createSvgElement('stop', { offset: '46%', 'stop-color': '#4fcbe8', 'stop-opacity': 0.055 }),
    createSvgElement('stop', { offset: '100%', 'stop-color': '#071624', 'stop-opacity': 0 })
  );
  defs.append(glow);
  svg.append(defs);
  svg.append(createSvgElement('circle', {
    cx: center,
    cy: center,
    r: 160,
    fill: 'url(#geo-core-glow-v11)',
    class: 'geo-core-field'
  }));

  const arcs = [
    {
      radius: 172,
      value: metrics.geoStructureScore,
      className: 'answer',
      start: -146,
      coverage: 0.24
    },
    {
      radius: 151,
      value: metrics.geoSemanticScore,
      className: 'citation',
      start: -18,
      coverage: 0.22
    },
    {
      radius: 130,
      value: metrics.finalScore,
      className: 'keyword',
      start: 103,
      coverage: 0.26
    }
  ];

  arcs.forEach(({ radius, value, className, start, coverage }) => {
    const circumference = Math.PI * 2 * radius;
    const trackLength = circumference * coverage;
    const valueLength = trackLength * (finiteOrNull(value) ?? 0) / 100;
    const track = createSvgElement('circle', {
      cx: center,
      cy: center,
      r: radius,
      class: `geo-core-open-track geo-core-open-track--${className}`,
      'stroke-dasharray': `${trackLength.toFixed(2)} ${circumference.toFixed(2)}`,
      transform: `rotate(${start} ${center} ${center})`
    });
    const arc = createSvgElement('circle', {
      cx: center,
      cy: center,
      r: radius,
      class: `geo-core-open-arc geo-core-open-arc--${className}`,
      'stroke-dasharray': `${valueLength.toFixed(2)} ${circumference.toFixed(2)}`,
      transform: `rotate(${start} ${center} ${center})`
    });
    svg.append(track, arc);
  });

  [
    'M32 176 C90 166 126 176 174 204 C194 216 204 218 220 220',
    'M408 146 C348 154 310 174 270 202 C248 216 235 219 220 220',
    'M382 354 C328 326 294 292 262 250 C246 230 232 223 220 220',
    'M78 366 C132 332 164 292 190 252 C203 232 211 224 220 220'
  ].forEach((d, index) => {
    svg.append(createSvgElement('path', {
      d,
      class: `geo-core-flow geo-core-flow--${index + 1}`
    }));
  });

  const nodes = [
    [42, 176, 2.4], [82, 169, 1.7], [126, 184, 2.1], [170, 204, 1.5],
    [398, 149, 2.5], [352, 158, 1.6], [310, 177, 2.2], [270, 203, 1.5],
    [374, 350, 2.4], [330, 326, 1.6], [292, 291, 2.1], [259, 250, 1.5],
    [82, 362, 2.2], [128, 334, 1.5], [164, 293, 2], [190, 251, 1.5]
  ];
  nodes.forEach(([cx, cy, r], index) => {
    svg.append(createSvgElement('circle', {
      cx,
      cy,
      r,
      class: `geo-core-open-node geo-core-open-node--${index % 3 + 1}`
    }));
  });

  [
    { x: 64, y: 126, label: 'ANSWER', className: 'answer' },
    { x: 326, y: 112, label: 'CITATION', className: 'citation' },
    { x: 310, y: 390, label: 'KEYWORD', className: 'keyword' }
  ].forEach(({ x, y, label, className }) => {
    const text = createSvgElement('text', {
      x,
      y,
      class: `geo-core-open-label geo-core-open-label--${className}`
    });
    text.textContent = label;
    svg.append(text);
  });

  container.replaceChildren(svg);
}

export function renderSegmentArc(container, segments, options = {}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;
  const svg = createSvgElement('svg', {
    viewBox: '0 0 240 126',
    role: 'img',
    'aria-label': options.label ?? '数据结构分布'
  });
  const radius = 82;
  const circumference = Math.PI * radius;
  let offset = 0;

  segments.forEach((segment, index) => {
    const length = circumference * (segment.value / total);
    const path = createSvgElement('circle', {
      cx: 120,
      cy: 105,
      r: radius,
      class: `geo-segment-arc geo-segment-arc--${index + 1}`,
      'stroke-dasharray': `${Math.max(length - 3, 0)} ${circumference}`,
      'stroke-dashoffset': -offset,
      transform: 'rotate(180 120 105)'
    });
    offset += length;
    svg.append(path);
  });
  container.replaceChildren(svg);
}

export function renderOpportunityMap(container, keywords) {
  const svg = createSvgElement('svg', {
    viewBox: '0 0 520 220',
    role: 'img',
    'aria-label': '关键词机会分布'
  });

  svg.append(
    createSvgElement('path', { d: 'M38 181 C142 126 194 162 277 94 S427 38 490 54', class: 'geo-opportunity-path' }),
    createSvgElement('path', { d: 'M42 194 C126 177 209 188 290 138 S414 102 482 85', class: 'geo-opportunity-path geo-opportunity-path--secondary' })
  );

  keywords.slice(0, 8).forEach((item, index) => {
    const x = 48 + (index % 4) * 132 + (index > 3 ? 30 : 0);
    const y = index > 3 ? 152 - (index % 4) * 13 : 147 - index * 27;
    const group = createSvgElement('g', {
      class: 'geo-opportunity-node',
      transform: `translate(${x} ${y})`
    });
    group.append(
      createSvgElement('circle', { r: 5 + (finiteOrNull(item.score) ?? 0) / 24 }),
      createSvgElement('circle', { r: 2.2, class: 'geo-opportunity-node__core' })
    );
    const label = createSvgElement('text', { x: 12, y: 4 });
    label.textContent = item.keyword;
    group.append(label);
    svg.append(group);
  });

  container.replaceChildren(svg);
}

function appendSvgText(parent, text, attributes = {}) {
  const element = createSvgElement('text', attributes);
  element.textContent = text;
  parent.append(element);
  return element;
}

function appendSvgTitle(parent, text) {
  const title = createSvgElement('title');
  title.textContent = text;
  parent.append(title);
}

export function renderAnswerPath(container, answer) {
  const width = 820;
  const height = 420;
  const usePrimaryRecommendation = Number.isFinite(answer.primaryRecommendationRate);
  const svg = createSvgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': `用户问题经过语义理解、回答生成、品牌提及、${usePrimaryRecommendation ? '主推荐' : '首位推荐'}和品牌露出位置的回答路径`
  });
  const stages = [
    ['用户问题', 72],
    ['语义理解', 206],
    ['回答生成', 340],
    ['品牌提及', 474],
    [usePrimaryRecommendation ? '主推荐' : '首位推荐', 608],
    ['露出位置', 742]
  ];
  const lanes = [
    { id: 'doubao', label: '豆包', y: 122, tone: 1 },
    { id: 'deepseek', label: 'DeepSeek', y: 178, tone: 2 },
    { id: 'kimi', label: 'Kimi', y: 234, tone: 3 },
    { id: 'qwen', label: '千问', y: 290, tone: 4 }
  ].map((lane) => {
    const comparison = answer.platformComparison?.find((item) => item.id === lane.id);
    const recommendationRate = usePrimaryRecommendation ? comparison?.primary : comparison?.first;
    const outcome = (recommendationRate ?? 0) > 0 ? 'first' : (comparison?.mention ?? 0) > 0 ? 'mention' : 'dim';
    const count = answer.platformCounts?.[lane.id];
    return { ...lane, outcome, displayLabel: Number.isFinite(count) ? `${lane.label} · ${count}` : lane.label };
  });

  stages.forEach(([label, x], index) => {
    svg.append(createSvgElement('line', {
      x1: x,
      x2: x,
      y1: 78,
      y2: 324,
      class: `geo-answer-stage-guide geo-answer-stage-guide--${index + 1}`
    }));
    appendSvgText(svg, label, {
      x,
      y: 54,
      'text-anchor': 'middle',
      class: 'geo-answer-stage-label'
    });
  });

  lanes.forEach((lane, laneIndex) => {
    const bendA = laneIndex % 2 === 0 ? -15 : 13;
    const bendB = laneIndex === 3 ? 24 : laneIndex * 4 - 5;
    const d = `M${stages[0][1]},${lane.y} C132,${lane.y + bendA} 154,${lane.y - bendA} ${stages[1][1]},${lane.y}`
      + ` S286,${lane.y + bendB} ${stages[2][1]},${lane.y + bendB}`
      + ` S420,${lane.y - bendA} ${stages[3][1]},${lane.y}`
      + ` S554,${lane.y + bendA} ${stages[4][1]},${lane.y + bendA / 2}`
      + ` S688,${lane.y - bendB} ${stages[5][1]},${lane.y - bendB}`;
    svg.append(createSvgElement('path', {
      d,
      class: `geo-answer-route geo-answer-route--${lane.tone} geo-answer-route--${lane.outcome}`
    }));
    appendSvgText(svg, lane.displayLabel, {
      x: 22,
      y: lane.y + 4,
      class: `geo-answer-platform geo-answer-platform--${lane.tone}`
    });
    stages.forEach(([, x], stageIndex) => {
      if (lane.outcome === 'dim' && stageIndex > 2) return;
      svg.append(createSvgElement('circle', {
        cx: x,
        cy: stageIndex === 2 ? lane.y + bendB : stageIndex === 4 ? lane.y + bendA / 2 : lane.y,
        r: stageIndex === 4 && lane.outcome === 'first' ? 6.5 : 3.2,
        class: `geo-answer-route-node geo-answer-route-node--${lane.tone}${stageIndex === 4 && lane.outcome === 'first' ? ' is-first' : ''}`
      }));
    });
  });

  svg.append(createSvgElement('path', {
    d: 'M340 302 C410 330 452 344 520 352 S650 366 748 372',
    class: 'geo-answer-route geo-answer-route--discarded'
  }));
  appendSvgText(svg, '未提及 / 无效回答', {
    x: 548,
    y: 388,
    class: 'geo-answer-discard-label'
  });
  appendSvgText(svg, `平均品牌位置 ${answer.averageBrandPosition ?? '未提供'}`, {
    x: 742,
    y: 342,
    'text-anchor': 'end',
    class: 'geo-answer-position-label'
  });
  appendSvgText(svg, `有效回答 ${answer.validAnswers ?? '未提供'} / ${answer.collectedAnswers ?? '未提供'}`, {
    x: 742,
    y: 320,
    'text-anchor': 'end',
    class: 'geo-answer-position-label'
  });
  appendSvgText(svg, `次推荐 ${metricText(answer.secondaryRecommendationRate, 2, '%')} · 未提及 ${metricText(answer.unmentionedRate, 2, '%')}`, {
    x: 742,
    y: 364,
    'text-anchor': 'end',
    class: 'geo-answer-position-label'
  });
  appendSvgText(svg, `品牌提及 ${metricText(answer.brandMentionRate, 1, '%')}`, {
    x: 474,
    y: 88,
    'text-anchor': 'middle',
    class: 'geo-answer-value-label'
  });
  const recommendationLabel = Number.isFinite(answer.primaryRecommendationRate) ? '主推荐' : '首位推荐';
  const recommendationValue = Number.isFinite(answer.primaryRecommendationRate) ? answer.primaryRecommendationRate : answer.firstRecommendationRate;
  appendSvgText(svg, `${recommendationLabel} ${metricText(recommendationValue, 1, '%')}`, {
    x: 608,
    y: 88,
    'text-anchor': 'middle',
    class: 'geo-answer-value-label geo-answer-value-label--focus'
  });
  container.replaceChildren(svg);
}

export function renderCitationNetwork(container, citation) {
  const width = 820;
  const height = 430;
  const svg = createSvgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': '官方、第三方和社区来源经验证筛选形成高质量引用网络'
  });
  const sources = [
    { x: 82, y: 92, item: citation.sourceDomains[0] },
    { x: 72, y: 210, item: citation.sourceDomains[1] },
    { x: 128, y: 338, item: citation.sourceDomains[2] },
    { x: 254, y: 86, item: citation.sourceDomains[3] },
    { x: 246, y: 326, item: citation.sourceDomains[4] }
  ].filter((source) => source.item).map((source) => ({
    ...source,
    group: source.item.sourceType === 'official'
      ? 'official'
      : source.item.sourceType === 'community'
        ? 'community'
        : 'third'
  }));
  const filters = [
    { x: 382, y: 92, label: '行业报告' },
    { x: 360, y: 186, label: '媒体报道' },
    { x: 378, y: 286, label: '榜单 / 测评' },
    { x: 472, y: 350, label: '验证筛选' }
  ];
  const cores = [
    Number.isFinite(citation.contentSourceQualityScore)
      ? { x: 648, y: 132, label: '内容来源质量分', value: citation.contentSourceQualityScore, suffix: '', digits: 2 }
      : { x: 648, y: 132, label: '权威来源', value: citation.authorityRate, suffix: '%', digits: 1 },
    { x: 706, y: 228, label: '优质引用率', value: citation.qualityRate, suffix: '%', digits: 1 },
    { x: 628, y: 320, label: '收录率', value: citation.indexedRate, suffix: '%', digits: 1 }
  ];

  sources.forEach((source, index) => {
    const target = filters[index % filters.length];
    svg.append(createSvgElement('path', {
      d: `M${source.x},${source.y} C${source.x + 110},${source.y - 16} ${target.x - 78},${target.y + 12} ${target.x},${target.y}`,
      class: `geo-citation-link geo-citation-link--${source.group}`
    }));
  });
  filters.forEach((filter, index) => {
    const core = cores[index % cores.length];
    svg.append(createSvgElement('path', {
      d: `M${filter.x},${filter.y} C${filter.x + 90},${filter.y} ${core.x - 82},${core.y} ${core.x},${core.y}`,
      class: `geo-citation-link geo-citation-link--verified geo-citation-link--${index + 1}`
    }));
  });

  sources.forEach(({ x, y, item, group }) => {
    const node = createSvgElement('g', { class: `geo-citation-source geo-citation-source--${group}` });
    node.append(createSvgElement('circle', { cx: x, cy: y, r: 5 + (finiteOrNull(item.value) ?? 0) / 24 }));
    node.append(createSvgElement('circle', { cx: x, cy: y, r: 2.4, class: 'geo-citation-source__core' }));
    appendSvgText(node, item.domain, { x: x + 18, y: y + 4, class: 'geo-citation-source__label' });
    appendSvgText(node, String(item.value), { x: x + 18, y: y + 19, class: 'geo-citation-source__value' });
    svg.append(node);
  });
  filters.forEach(({ x, y, label }) => {
    svg.append(createSvgElement('circle', { cx: x, cy: y, r: 7, class: 'geo-citation-filter-node' }));
    appendSvgText(svg, label, { x: x + 14, y: y + 4, class: 'geo-citation-filter-label' });
  });
  cores.forEach(({ x, y, label, value, suffix, digits }, index) => {
    svg.append(createSvgElement('path', {
      d: `M${x - 22},${y - 12} A26,26 0 0 1 ${x + 18},${y + 18}`,
      class: `geo-citation-core-arc geo-citation-core-arc--${index + 1}`
    }));
    svg.append(createSvgElement('circle', { cx: x, cy: y, r: 5.5, class: 'geo-citation-core-node' }));
    appendSvgText(svg, label, { x: x + 16, y: y - 1, class: 'geo-citation-core-label' });
    appendSvgText(svg, metricText(value, digits, suffix), { x: x + 16, y: y + 17, class: 'geo-citation-core-value' });
  });
  appendSvgText(svg, `总引用 ${citation.totalCitations}`, { x: 654, y: 66, class: 'geo-citation-total' });
  appendSvgText(svg, `异常 ${citation.abnormalSources.reduce((sum, item) => sum + item.count, 0)}条`, {
    x: 654,
    y: 392,
    class: 'geo-citation-abnormal'
  });
  container.replaceChildren(svg);
}

export function renderKeywordOpportunityField(container, keyword) {
  const width = 820;
  const height = 430;
  const svg = createSvgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': '以关键词综合机会评分为中心的五类机会词场'
  });
  const center = { x: 410, y: 218 };
  const fallbackLabels = ['信息查询', '解决方案', '产品比较', '购买决策', '场景需求'];
  const groupLabels = [...new Set((keyword.opportunityGroups ?? [])
    .map((group) => group.dimension ?? group.opportunityType ?? group.marketSignalType)
    .filter(Boolean))];
  const labels = groupLabels.length ? groupLabels : fallbackLabels;
  const categories = labels.map((label, index) => {
    const angle = -Math.PI * 0.86 + (index / Math.max(labels.length - 1, 1)) * Math.PI * 1.72;
    return {
      label,
      x: center.x + Math.cos(angle) * 270,
      y: center.y + Math.sin(angle) * 154,
      angle: angle * 180 / Math.PI
    };
  });

  categories.forEach((category, index) => {
    svg.append(createSvgElement('path', {
      d: `M${center.x},${center.y} C${(center.x + category.x) / 2},${center.y + (index % 2 ? -34 : 32)} ${(center.x + category.x) / 2},${category.y + (index % 2 ? 26 : -24)} ${category.x},${category.y}`,
      class: `geo-keyword-field-link geo-keyword-field-link--${index + 1}`
    }));
    svg.append(createSvgElement('path', {
      d: `M${category.x - 24},${category.y + 13} Q${category.x},${category.y + 26} ${category.x + 28},${category.y + 8}`,
      class: 'geo-keyword-category-arc'
    }));
    appendSvgText(svg, category.label, {
      x: category.x,
      y: category.y - 18,
      'text-anchor': 'middle',
      class: 'geo-keyword-category-label'
    });
  });

  keyword.topKeywords.forEach((item, index) => {
    const category = categories[index % categories.length];
    const offsetIndex = Math.floor(index / categories.length);
    const x = category.x + (offsetIndex ? 48 : -34) + ((index % 2) * 12);
    const y = category.y + (offsetIndex ? 32 : 15);
    const group = createSvgElement('g', {
      class: `geo-keyword-field-node${Number.isFinite(item.trend) && item.trend < 0 ? ' is-declining' : ''}`,
      transform: `translate(${x} ${y})`
    });
    const score = finiteOrNull(item.score);
    const trend = finiteOrNull(item.trend);
    appendSvgTitle(group, `${item.keyword}：机会评分${score ?? '未提供'}，趋势${trend == null ? '未提供' : `${trend >= 0 ? '+' : ''}${trend}%`}`);
    group.append(createSvgElement('circle', { r: 4 + Math.max(0, ((score ?? 60) - 60) / 10), class: 'geo-keyword-field-node__halo' }));
    group.append(createSvgElement('circle', { r: 2.8, class: 'geo-keyword-field-node__core' }));
    appendSvgText(group, item.keyword, { x: 12, y: 4, class: 'geo-keyword-field-node__label' });
    svg.append(group);
  });
  svg.append(createSvgElement('path', {
    d: 'M347 220 A66 54 0 0 1 452 171',
    class: 'geo-keyword-center-arc'
  }));
  svg.append(createSvgElement('path', {
    d: 'M469 223 A60 48 0 0 1 389 269',
    class: 'geo-keyword-center-arc geo-keyword-center-arc--secondary'
  }));
  appendSvgText(svg, metricText(keyword.opportunityScore), {
    x: center.x,
    y: center.y + 8,
    'text-anchor': 'middle',
    class: 'geo-keyword-center-score'
  });
  appendSvgText(svg, Number.isFinite(keyword.industryOpportunityDriverScore) ? '行业机会驱动分' : '综合机会评分', {
    x: center.x,
    y: center.y + 30,
    'text-anchor': 'middle',
    class: 'geo-keyword-center-label'
  });
  appendSvgText(svg, `品牌机会 ${keyword.brandOpportunity ?? '未提供'}`, {
    x: center.x,
    y: 398,
    'text-anchor': 'middle',
    class: 'geo-keyword-field-caption'
  });
  container.replaceChildren(svg);
}

export function renderDataHealthPipeline(container, health) {
  const width = 900;
  const height = 430;
  const svg = createSvgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': '平台访问、问题采集和回答有效性三段独立数据生命线'
  });
  const stages = [
    {
      label: '平台访问',
      metric: '平台可访问率',
      value: health.platformAccessibilityRate,
      numerator: health.availablePlatformCount,
      denominator: health.expectedPlatformCount,
      status: health.platformAccessibilityStatus,
      reason: health.platformAccessibilityReason,
      unit: '个平台',
      x: 150,
      y: 212
    },
    {
      label: '问题采集',
      metric: '问题采集完整率',
      value: health.questionCollectionCompleteness,
      numerator: health.collectedQuestions,
      denominator: health.expectedQuestions,
      status: health.questionCollectionStatus,
      reason: health.questionCollectionReason,
      unit: '个问题',
      x: 450,
      y: 212
    },
    {
      label: '回答有效性',
      metric: '已采集回答有效率',
      value: health.collectedAnswerValidity,
      numerator: health.validAnswers,
      denominator: health.collectedAnswers,
      status: health.answerValidityStatus,
      reason: health.answerValidityReason,
      unit: '条回答',
      x: 750,
      y: 212
    }
  ];

  svg.append(createSvgElement('path', {
    d: 'M74 218 C204 160 292 280 418 218 S622 160 826 218',
    class: 'geo-health-life-line'
  }));
  svg.append(createSvgElement('path', {
    d: 'M74 218 C204 160 292 280 418 218 S622 160 826 218',
    class: 'geo-health-life-signal'
  }));

  stages.forEach((stage, index) => {
    const group = createSvgElement('g', { class: `geo-health-stage geo-health-stage--${index + 1}` });
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    group.append(createSvgElement('circle', { cx: stage.x, cy: stage.y, r: radius, class: 'geo-health-stage__track' }));
    const value = finiteOrNull(stage.value);
    group.append(createSvgElement('circle', {
      cx: stage.x,
      cy: stage.y,
      r: radius,
      class: 'geo-health-stage__value',
      'stroke-dasharray': `${(circumference * (value ?? 0) / 100).toFixed(2)} ${circumference.toFixed(2)}`,
      transform: `rotate(-112 ${stage.x} ${stage.y})`
    }));
    group.append(createSvgElement('circle', { cx: stage.x, cy: stage.y, r: 7, class: 'geo-health-stage__core' }));
    appendSvgText(group, stage.label, { x: stage.x, y: 94, 'text-anchor': 'middle', class: 'geo-health-stage__label' });
    appendSvgText(group, stage.metric, { x: stage.x, y: 122, 'text-anchor': 'middle', class: 'geo-health-stage__metric' });
    appendSvgText(group, metricText(value, 1, '%'), { x: stage.x, y: stage.y - 8, 'text-anchor': 'middle', class: 'geo-health-stage__score' });
    appendSvgText(group, `${stage.numerator ?? '未提供'} / ${stage.denominator ?? '未提供'}${stage.unit}`, { x: stage.x, y: stage.y + 24, 'text-anchor': 'middle', class: 'geo-health-stage__fraction' });
    appendSvgText(group, value == null ? '计划分母未提供' : `损失 ${(100 - value).toFixed(1)}%`, { x: stage.x, y: 328, 'text-anchor': 'middle', class: 'geo-health-stage__loss' });
    appendSvgText(group, `状态：${String(stage.status ?? (value == null ? 'missing' : 'healthy')).toUpperCase()}`, { x: stage.x, y: 354, 'text-anchor': 'middle', class: 'geo-health-stage__status' });
    appendSvgText(group, stage.reason ?? '当前数据未提供同口径昨值', { x: stage.x, y: 376, 'text-anchor': 'middle', class: 'geo-health-stage__delta' });
    svg.append(group);
  });
  appendSvgText(svg, '三段指标独立计算 · 不合并为总完成率', {
    x: 450,
    y: 404,
    'text-anchor': 'middle',
    class: 'geo-health-pipeline-note'
  });
  container.replaceChildren(svg);
}
