const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
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
    const valueLength = trackLength * value / 100;
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
      createSvgElement('circle', { r: 5 + item.score / 24 }),
      createSvgElement('circle', { r: 2.2, class: 'geo-opportunity-node__core' })
    );
    const label = createSvgElement('text', { x: 12, y: 4 });
    label.textContent = item.keyword;
    group.append(label);
    svg.append(group);
  });

  container.replaceChildren(svg);
}
