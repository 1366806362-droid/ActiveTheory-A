import {
  geoDashboardMockData,
  getGeoDashboardDataset as getLockedMockDataset,
  getGeoDashboardTrend as getLockedMockTrend
} from './geoDashboardMockData.js';
import { adaptGeoDashboardData } from './geoDashboardDataAdapter.js';
import { getGeoDashboardFixture } from './geoDashboardDataFixtures.js';
import {
  createGeoDashboardJsonLoaderCache,
  GeoDashboardJsonLoadError,
  loadGeoDashboardJsonDataset
} from './geoDashboardJsonLoader.js';
import {
  GeoDashboardFileLoadError,
  loadGeoDashboardLocalFile
} from './geoDashboardFileLoader.js';

export class GeoDashboardDataSourceNotImplementedError extends Error {
  constructor(mode) {
    super(`GEO Dashboard data source “${mode}” is declared by the contract but not implemented.`);
    this.name = 'GeoDashboardDataSourceNotImplementedError';
    this.mode = mode;
  }
}

function safeDisplayText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function displayPlatform(platform) {
  const shortLabels = { all: 'ALL', doubao: 'DB', deepseek: 'DS', kimi: 'KM', qwen: 'QW' };
  return {
    id: platform.id,
    label: safeDisplayText(platform.displayName || platform.name || platform.originalId || platform.id),
    shortLabel: shortLabels[platform.id] ?? String(platform.id).slice(0, 3).toUpperCase()
  };
}

function dashboardProjection(dataset, validation) {
  const answerMetrics = dataset.answer.metrics;
  const citationMetrics = dataset.citation.metrics;
  const keywordMetrics = dataset.keyword.metrics;
  const health = dataset.dataHealth;
  const warnings = validation.warnings.map((item) => safeDisplayText(item.message));
  const base = {
    overview: {
      finalScore: dataset.overview.finalScore,
      geoStructureScore: dataset.overview.geoStructureScore,
      geoSemanticScore: dataset.overview.geoSemanticScore,
      brandVisibilityRate: dataset.overview.brandVisibilityRate,
      firstRecommendationRate: dataset.overview.firstRecommendationRate,
      averageBrandPosition: dataset.overview.averageBrandPosition,
      qualityCitationRate: dataset.overview.qualityCitationRate,
      dailyDelta: dataset.overview.scoreChange ?? 0
    },
    answer: {
      ...answerMetrics,
      answerTypes: dataset.answer.answerTypes.map((item) => ({ label: safeDisplayText(item.label), value: item.rate ?? 0 })),
      platformComparison: dataset.answer.platformComparison.map((item) => ({
        id: item.platformId,
        label: safeDisplayText(dataset.platforms.find((platform) => platform.id === item.platformId)?.displayName ?? item.platformId),
        mention: item.brandMentionRate ?? 0,
        first: item.firstRecommendationRate ?? 0
      }))
    },
    citation: {
      totalCitations: dataset.citation.summary.totalCitations,
      ...citationMetrics,
      authorityRate: citationMetrics.qualityRate,
      sourceDomains: dataset.citation.sourceDomains.map((item, index) => ({
        domain: safeDisplayText(item.domain),
        value: item.count ?? item.rate ?? 0,
        tone: item.sourceType === 'official' ? 'ice' : item.sourceType === 'community' ? 'violet' : index % 2 ? 'white' : 'cyan'
      })),
      abnormalSources: dataset.citation.abnormalSources.map((item) => ({
        source: safeDisplayText(item.source ?? item.domain ?? 'unknown'),
        count: item.count ?? 0,
        severity: item.severity ?? 'medium'
      }))
    },
    keyword: {
      opportunityScore: keywordMetrics.opportunityScore,
      commercialValue: keywordMetrics.averageCommercialValue,
      brandOpportunity: `${Number(keywordMetrics.averageBrandOpportunity ?? 0).toFixed(1)} / 100`,
      optimizationDirection: safeDisplayText(dataset.keyword.topKeywords[0]?.optimizationDirection ?? '当前Fixture未提供优化方向。'),
      triggerTypes: dataset.keyword.triggerTypes.map((item) => ({ label: safeDisplayText(item.label ?? item.id), value: item.value ?? item.rate ?? item.count ?? 0 })),
      topKeywords: dataset.keyword.topKeywords.map((item) => ({
        keyword: safeDisplayText(item.keyword),
        score: item.brandOpportunity ?? item.commercialValue ?? 0,
        value: (item.commercialValue ?? 0) >= 80 ? '高' : '中',
        trend: item.trendValue ?? 0
      })),
      newKeywords: dataset.keyword.newKeywords.map((item) => safeDisplayText(typeof item === 'string' ? item : item.keyword)),
      decliningKeywords: dataset.keyword.decliningKeywords.map((item) => safeDisplayText(typeof item === 'string' ? item : item.keyword))
    },
    dataHealth: {
      availablePlatformCount: health.platformAccessibility.numerator ?? 0,
      expectedPlatformCount: health.platformAccessibility.denominator ?? 0,
      platformAccessibilityRate: health.platformAccessibility.rate ?? 0,
      collectedQuestions: health.questionCollectionCompleteness.numerator ?? 0,
      expectedQuestions: health.questionCollectionCompleteness.denominator ?? 0,
      questionCollectionCompleteness: health.questionCollectionCompleteness.rate ?? 0,
      validAnswers: health.collectedAnswerValidity.numerator ?? 0,
      collectedAnswers: health.collectedAnswerValidity.denominator ?? 0,
      collectedAnswerValidity: health.collectedAnswerValidity.rate ?? 0,
      status: health.overallStatus,
      warnings
    },
    alerts: dataset.alerts.map((item) => ({
      id: item.id,
      tone: item.level === 'critical' || item.level === 'warning' ? 'warning' : 'neutral',
      label: safeDisplayText(item.title),
      detail: safeDisplayText(item.message)
    })),
    recommendations: dataset.recommendations.map((item) => safeDisplayText(item.action))
  };
  return {
    metadata: {
      ...dataset.metadata,
      status: health.overallStatus,
      statusTone: health.overallStatus === 'healthy' ? 'healthy' : 'warning'
    },
    platforms: dataset.platforms.filter((platform) => platform.enabled).map(displayPlatform),
    base
  };
}

function createDatasetAccessors(dataset, validation) {
  const projection = dashboardProjection(dataset, validation);
  const pointsBySeries = new Map();
  dataset.trends.forEach((point) => {
    if (!point.comparable || !point.comparisonKey) return;
    const seriesId = `${point.metricId}::${point.comparisonKey}`;
    const current = pointsBySeries.get(seriesId) ?? {
      platform: point.platformId,
      questionId: point.questionId,
      label: `${projection.platforms.find((platform) => platform.id === point.platformId)?.label ?? safeDisplayText(point.platformId)} · ${safeDisplayText(point.question)}`,
      points: []
    };
    current.points.push({ date: point.date, value: point.value });
    pointsBySeries.set(seriesId, current);
  });

  function getDashboardData(platformId = 'all') {
    if (platformId === 'all') return projection.base;
    const comparison = dataset.answer.platformComparison.find((item) => item.platformId === platformId);
    if (!comparison) return projection.base;
    return {
      ...projection.base,
      answer: {
        ...projection.base.answer,
        platformAccessibilityRate: comparison.accessibilityRate ?? projection.base.answer.platformAccessibilityRate,
        questionCollectionCompleteness: comparison.completenessRate ?? projection.base.answer.questionCollectionCompleteness,
        collectedAnswerValidity: comparison.validityRate ?? projection.base.answer.collectedAnswerValidity,
        brandMentionRate: comparison.brandMentionRate ?? projection.base.answer.brandMentionRate,
        firstRecommendationRate: comparison.firstRecommendationRate ?? projection.base.answer.firstRecommendationRate,
        averageBrandPosition: comparison.averageBrandPosition ?? projection.base.answer.averageBrandPosition
      },
      overview: {
        ...projection.base.overview,
        brandVisibilityRate: comparison.brandMentionRate ?? projection.base.overview.brandVisibilityRate,
        firstRecommendationRate: comparison.firstRecommendationRate ?? projection.base.overview.firstRecommendationRate,
        averageBrandPosition: comparison.averageBrandPosition ?? projection.base.overview.averageBrandPosition
      }
    };
  }

  function getDashboardTrend(platformId = 'all', range = '30d') {
    const pointLimit = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const series = [...pointsBySeries.values()];
    const selected = platformId === 'all'
      ? series.filter((item) => item.questionId === series[0]?.questionId)
      : series.filter((item) => item.platform === platformId);
    return selected.map((item) => ({ ...item, points: item.points.slice(-pointLimit) }));
  }

  return { projection, getDashboardData, getDashboardTrend };
}

function createMockResult() {
  const adapted = adaptGeoDashboardData(geoDashboardMockData, { mode: 'mock' });
  return {
    ...adapted,
    info: adapted.validation.info,
    mode: 'mock',
    fixture: null,
    dashboard: geoDashboardMockData,
    getDashboardData: getLockedMockDataset,
    getDashboardTrend: getLockedMockTrend
  };
}

export function loadGeoDashboardDataset(options = {}) {
  const mode = options.mode ?? 'mock';
  if (!['mock', 'fixture', 'json', 'file'].includes(mode)) {
    throw new GeoDashboardDataSourceNotImplementedError(mode);
  }
  if (mode === 'mock') return createMockResult();
  if (mode === 'json') return loadJsonDashboardDataset(options);
  if (mode === 'file') {
    return options.file
      ? loadFileDashboardDataset(options)
      : createFileModeMockResult(options.state ?? 'idle');
  }

  const fixture = options.fixture ?? 'valid';
  const adapted = adaptGeoDashboardData(getGeoDashboardFixture(fixture), { mode: 'fixture' });
  if (adapted.gate.status === 'fail') {
    const fallback = createMockResult();
    return {
      ...adapted,
      mode: 'fixture',
      fixture,
      requestedDataset: adapted.dataset,
      dataset: fallback.dataset,
      dashboard: fallback.dashboard,
      getDashboardData: fallback.getDashboardData,
      getDashboardTrend: fallback.getDashboardTrend,
      fallbackUsed: true,
      fallbackReason: adapted.errors.map((item) => item.message).join('；') || 'Fixture未通过数据质量闸门。',
      transformations: adapted.transformations
    };
  }

  const accessors = createDatasetAccessors(adapted.dataset, adapted.validation);
  return {
    ...adapted,
    info: adapted.validation.info,
    mode: 'fixture',
    fixture,
    dashboard: {
      metadata: accessors.projection.metadata,
      platforms: accessors.projection.platforms
    },
    getDashboardData: accessors.getDashboardData,
    getDashboardTrend: accessors.getDashboardTrend
  };
}

function createFileModeMockResult(state = 'idle') {
  const mock = createMockResult();
  return {
    ...mock,
    mode: 'file',
    fixture: null,
    fileState: state,
    pendingUserConfirmation: false,
    applied: false,
    sourceDiagnostics: null,
    fileDiagnostics: null
  };
}

async function loadFileDashboardDataset(options) {
  let loaded;
  try {
    loaded = await loadGeoDashboardLocalFile(options.file, {
      maxSizeBytes: options.maxSizeBytes,
      signal: options.signal,
      verifyChecksum: options.verifyChecksum,
      allowedExtensions: options.allowedExtensions,
      cryptoImpl: options.cryptoImpl
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    const diagnostics = error instanceof GeoDashboardFileLoadError
      ? error.diagnostics
      : error?.geoDashboardDiagnostics ?? null;
    const code = error?.code ?? diagnostics?.errorCode ?? 'file_load_failed';
    const message = error?.message ?? '本地JSON文件读取失败。';
    const issue = {
      severity: 'error',
      code: String(code).toUpperCase(),
      path: 'source',
      message,
      details: null
    };
    const validation = {
      errors: [issue],
      warnings: [],
      info: [],
      valid: false
    };
    return {
      mode: 'file',
      fixture: null,
      dataset: null,
      requestedDataset: null,
      dashboard: null,
      validation,
      gate: { status: 'fail', canRender: false, errorCount: 1, warningCount: 0 },
      warnings: validation.warnings,
      errors: validation.errors,
      info: validation.info,
      transformations: [],
      fallbackUsed: false,
      fallbackReason: null,
      pendingUserConfirmation: false,
      applied: false,
      fileState: 'failed',
      sourceDiagnostics: diagnostics,
      fileDiagnostics: diagnostics
    };
  }

  const adapted = adaptGeoDashboardData(loaded.rawData, { mode: 'json' });
  const fileWarnings = loaded.fileDiagnostics.mimeWarning
    ? [{
        severity: 'warning',
        code: 'FILE_MIME_WARNING',
        path: 'source.file',
        message: loaded.fileDiagnostics.mimeWarning,
        details: { mimeType: loaded.fileDiagnostics.mimeType }
      }]
    : [];
  const validation = fileWarnings.length
    ? { ...adapted.validation, warnings: [...fileWarnings, ...adapted.validation.warnings] }
    : adapted.validation;
  const gate = fileWarnings.length && adapted.gate.status === 'pass'
    ? { ...adapted.gate, status: 'warning', warningCount: validation.warnings.length }
    : adapted.gate;
  const prepared = {
    ...adapted,
    validation,
    gate,
    warnings: validation.warnings,
    info: validation.info
  };
  const sourceDetails = {
    mode: 'file',
    fixture: null,
    sourceDiagnostics: loaded.fileDiagnostics,
    fileDiagnostics: loaded.fileDiagnostics
  };
  if (prepared.gate.status === 'fail') {
    return {
      ...prepared,
      ...sourceDetails,
      requestedDataset: prepared.dataset,
      dashboard: null,
      getDashboardData: null,
      getDashboardTrend: null,
      info: prepared.validation.info,
      fallbackUsed: false,
      fallbackReason: null,
      pendingUserConfirmation: false,
      applied: false,
      fileState: 'failed'
    };
  }

  const accessors = createDatasetAccessors(prepared.dataset, prepared.validation);
  return {
    ...prepared,
    ...sourceDetails,
    info: prepared.validation.info,
    dashboard: {
      metadata: accessors.projection.metadata,
      platforms: accessors.projection.platforms
    },
    getDashboardData: accessors.getDashboardData,
    getDashboardTrend: accessors.getDashboardTrend,
    fallbackUsed: false,
    fallbackReason: null,
    pendingUserConfirmation: true,
    applied: false,
    fileState: prepared.gate.status === 'warning' ? 'warning' : 'ready'
  };
}

export function activateGeoDashboardFileResult(result) {
  if (result?.mode !== 'file'
    || result.pendingUserConfirmation !== true
    || !['pass', 'warning'].includes(result.gate?.status)
    || typeof result.getDashboardData !== 'function'
    || typeof result.getDashboardTrend !== 'function') {
    throw new Error('只有通过数据质量闸门的待确认本地数据包可以应用。');
  }
  return {
    ...result,
    pendingUserConfirmation: false,
    applied: true,
    fileState: 'applied'
  };
}

async function loadJsonDashboardDataset(options) {
  const datasetId = options.datasetId ?? 'sample-valid';
  let loaded;
  try {
    loaded = await loadGeoDashboardJsonDataset({
      datasetId,
      manifestUrl: options.manifestUrl,
      signal: options.signal,
      maxSizeBytes: options.maxSizeBytes,
      verifyChecksum: options.verifyChecksum,
      fetchImpl: options.fetchImpl,
      cryptoImpl: options.cryptoImpl,
      baseUrl: options.baseUrl,
      cache: options.cache ?? createGeoDashboardJsonLoaderCache()
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    const fallback = createMockResult();
    const diagnostics = error instanceof GeoDashboardJsonLoadError
      ? error.diagnostics
      : error?.geoDashboardDiagnostics ?? null;
    const code = error?.code ?? diagnostics?.errorCode ?? 'json_load_failed';
    const message = error?.message ?? 'JSON数据包加载失败。';
    const issue = {
      severity: 'error',
      code: String(code).toUpperCase(),
      path: 'source',
      message,
      details: null
    };
    const validation = {
      errors: [issue],
      warnings: [],
      info: [{ severity: 'info', code: 'MOCK_FALLBACK_IN_USE', path: 'source.type', message: 'JSON数据包异常，已回退安全Mock数据。', details: null }],
      valid: false
    };
    return {
      ...fallback,
      mode: 'json',
      fixture: null,
      datasetId,
      datasetLabel: null,
      validation,
      gate: { status: 'fail', canRender: false, errorCount: 1, warningCount: 0 },
      warnings: validation.warnings,
      errors: validation.errors,
      info: validation.info,
      transformations: [],
      fallbackUsed: true,
      fallbackReason: code,
      sourceDiagnostics: diagnostics
    };
  }

  const adapted = adaptGeoDashboardData(loaded.rawData, { mode: 'json' });
  const sourceDetails = {
    datasetId,
    datasetLabel: loaded.manifestEntry.label,
    sourceDiagnostics: loaded.loadDiagnostics
  };
  if (adapted.gate.status === 'fail') {
    const fallback = createMockResult();
    return {
      ...adapted,
      ...sourceDetails,
      mode: 'json',
      fixture: null,
      requestedDataset: adapted.dataset,
      dataset: fallback.dataset,
      dashboard: fallback.dashboard,
      getDashboardData: fallback.getDashboardData,
      getDashboardTrend: fallback.getDashboardTrend,
      info: adapted.validation.info,
      fallbackUsed: true,
      fallbackReason: adapted.errors.map((item) => item.code).join(',') || 'data_gate_failed'
    };
  }

  const accessors = createDatasetAccessors(adapted.dataset, adapted.validation);
  return {
    ...adapted,
    ...sourceDetails,
    mode: 'json',
    fixture: null,
    info: adapted.validation.info,
    dashboard: {
      metadata: accessors.projection.metadata,
      platforms: accessors.projection.platforms
    },
    getDashboardData: accessors.getDashboardData,
    getDashboardTrend: accessors.getDashboardTrend
  };
}

export function createGeoDashboardDataDiagnostics(result) {
  const attempted = result.requestedDataset ?? result.dataset;
  const comparable = attempted?.trends?.filter((point) => point.comparable).length ?? 0;
  const nonComparable = attempted?.trends?.filter((point) => !point.comparable).length ?? 0;
  const sourceDiagnostics = result.sourceDiagnostics ?? null;
  return {
    mode: result.mode,
    fixture: result.fixture,
    state: result.fileState ?? null,
    datasetLabel: result.datasetLabel ?? attempted?.source?.name ?? null,
    schemaVersion: attempted?.schemaVersion ?? null,
    datasetId: attempted?.datasetId ?? null,
    datasetVersion: attempted?.datasetVersion ?? null,
    source: attempted?.source ?? null,
    fileName: sourceDiagnostics?.fileName ?? null,
    extension: sourceDiagnostics?.extension ?? null,
    mimeType: sourceDiagnostics?.mimeType ?? null,
    sizeBytes: sourceDiagnostics?.sizeBytes ?? null,
    lastModified: sourceDiagnostics?.lastModified ?? null,
    sha256: sourceDiagnostics?.sha256 ?? null,
    checksumCalculated: sourceDiagnostics?.checksumCalculated ?? false,
    utf8Decoded: sourceDiagnostics?.utf8Decoded ?? false,
    pendingUserConfirmation: result.pendingUserConfirmation ?? false,
    applied: result.applied ?? false,
    manifestUrl: sourceDiagnostics?.manifestUrl ?? null,
    fileUrl: sourceDiagnostics?.fileUrl ?? null,
    manifestStatus: sourceDiagnostics?.manifestStatus ?? null,
    fileStatus: sourceDiagnostics?.fileStatus ?? null,
    bytesLoaded: sourceDiagnostics?.bytesLoaded ?? 0,
    expectedSizeBytes: sourceDiagnostics?.expectedSizeBytes ?? null,
    actualSizeBytes: sourceDiagnostics?.actualSizeBytes ?? null,
    expectedSha256: sourceDiagnostics?.expectedSha256 ?? null,
    actualSha256: sourceDiagnostics?.actualSha256 ?? null,
    checksumVerified: sourceDiagnostics?.checksumVerified ?? false,
    parseSucceeded: sourceDiagnostics?.parseSucceeded ?? false,
    loadDurationMs: sourceDiagnostics?.durationMs ?? null,
    cacheHit: sourceDiagnostics?.cacheHit ?? false,
    aborted: sourceDiagnostics?.aborted ?? false,
    sourceDiagnostics,
    gate: result.gate.status,
    fallbackUsed: result.fallbackUsed,
    fallbackReason: result.fallbackReason,
    errors: result.errors,
    warnings: result.warnings,
    info: result.validation.info,
    transformations: result.transformations,
    platformCount: attempted?.platforms?.length ?? 0,
    trendComparableCount: comparable,
    trendNonComparableCount: nonComparable,
    metadata: attempted?.metadata ?? null,
    loadedAt: new Date().toISOString()
  };
}
