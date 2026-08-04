import {
  geoDashboardMockData,
  getGeoDashboardDataset as getLockedMockDataset,
  getGeoDashboardTrend as getLockedMockTrend
} from './geoDashboardMockData.js';
import { adaptGeoDashboardData } from './geoDashboardDataAdapter.js';
import { getGeoDashboardFixture } from './geoDashboardDataFixtures.js';

export class GeoDashboardDataSourceNotImplementedError extends Error {
  constructor(mode) {
    super(`GEO Dashboard data source “${mode}” is declared by the contract but not implemented in V1.3.`);
    this.name = 'GeoDashboardDataSourceNotImplementedError';
    this.mode = mode;
  }
}

function displayPlatform(platform) {
  const shortLabels = { all: 'ALL', doubao: 'DB', deepseek: 'DS', kimi: 'KM', qwen: 'QW' };
  return {
    id: platform.id,
    label: platform.displayName || platform.name || platform.originalId || platform.id,
    shortLabel: shortLabels[platform.id] ?? String(platform.id).slice(0, 3).toUpperCase()
  };
}

function dashboardProjection(dataset, validation) {
  const answerMetrics = dataset.answer.metrics;
  const citationMetrics = dataset.citation.metrics;
  const keywordMetrics = dataset.keyword.metrics;
  const health = dataset.dataHealth;
  const warnings = validation.warnings.map((item) => item.message);
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
      answerTypes: dataset.answer.answerTypes.map((item) => ({ label: item.label, value: item.rate ?? 0 })),
      platformComparison: dataset.answer.platformComparison.map((item) => ({
        id: item.platformId,
        label: dataset.platforms.find((platform) => platform.id === item.platformId)?.displayName ?? item.platformId,
        mention: item.brandMentionRate ?? 0,
        first: item.firstRecommendationRate ?? 0
      }))
    },
    citation: {
      totalCitations: dataset.citation.summary.totalCitations,
      ...citationMetrics,
      authorityRate: citationMetrics.qualityRate,
      sourceDomains: dataset.citation.sourceDomains.map((item, index) => ({
        domain: item.domain,
        value: item.count ?? item.rate ?? 0,
        tone: item.sourceType === 'official' ? 'ice' : item.sourceType === 'community' ? 'violet' : index % 2 ? 'white' : 'cyan'
      })),
      abnormalSources: dataset.citation.abnormalSources.map((item) => ({
        source: item.source ?? item.domain ?? 'unknown',
        count: item.count ?? 0,
        severity: item.severity ?? 'medium'
      }))
    },
    keyword: {
      opportunityScore: keywordMetrics.opportunityScore,
      commercialValue: keywordMetrics.averageCommercialValue,
      brandOpportunity: `${Number(keywordMetrics.averageBrandOpportunity ?? 0).toFixed(1)} / 100`,
      optimizationDirection: dataset.keyword.topKeywords[0]?.optimizationDirection ?? '当前Fixture未提供优化方向。',
      triggerTypes: dataset.keyword.triggerTypes.map((item) => ({ label: item.label ?? item.id, value: item.value ?? item.rate ?? item.count ?? 0 })),
      topKeywords: dataset.keyword.topKeywords.map((item) => ({
        keyword: item.keyword,
        score: item.brandOpportunity ?? item.commercialValue ?? 0,
        value: (item.commercialValue ?? 0) >= 80 ? '高' : '中',
        trend: item.trendValue ?? 0
      })),
      newKeywords: dataset.keyword.newKeywords.map((item) => typeof item === 'string' ? item : item.keyword),
      decliningKeywords: dataset.keyword.decliningKeywords.map((item) => typeof item === 'string' ? item : item.keyword)
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
      label: item.title,
      detail: item.message
    })),
    recommendations: dataset.recommendations.map((item) => item.action)
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

function createFixtureAccessors(dataset, validation) {
  const projection = dashboardProjection(dataset, validation);
  const pointsBySeries = new Map();
  dataset.trends.forEach((point) => {
    if (!point.comparable || !point.comparisonKey) return;
    const seriesId = `${point.metricId}::${point.comparisonKey}`;
    const current = pointsBySeries.get(seriesId) ?? {
      platform: point.platformId,
      questionId: point.questionId,
      label: `${projection.platforms.find((platform) => platform.id === point.platformId)?.label ?? point.platformId} · ${point.question}`,
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
    mode: 'mock',
    fixture: null,
    dashboard: geoDashboardMockData,
    getDashboardData: getLockedMockDataset,
    getDashboardTrend: getLockedMockTrend
  };
}

export function loadGeoDashboardDataset(options = {}) {
  const mode = options.mode ?? 'mock';
  if (!['mock', 'fixture'].includes(mode)) {
    throw new GeoDashboardDataSourceNotImplementedError(mode);
  }
  if (mode === 'mock') return createMockResult();

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

  const accessors = createFixtureAccessors(adapted.dataset, adapted.validation);
  return {
    ...adapted,
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

export function createGeoDashboardDataDiagnostics(result) {
  const attempted = result.requestedDataset ?? result.dataset;
  const comparable = attempted.trends?.filter((point) => point.comparable).length ?? 0;
  const nonComparable = attempted.trends?.filter((point) => !point.comparable).length ?? 0;
  return {
    mode: result.mode,
    fixture: result.fixture,
    schemaVersion: attempted.schemaVersion,
    datasetId: attempted.datasetId,
    datasetVersion: attempted.datasetVersion,
    source: attempted.source,
    gate: result.gate.status,
    fallbackUsed: result.fallbackUsed,
    fallbackReason: result.fallbackReason,
    errors: result.errors,
    warnings: result.warnings,
    info: result.validation.info,
    transformations: result.transformations,
    platformCount: attempted.platforms?.length ?? 0,
    trendComparableCount: comparable,
    trendNonComparableCount: nonComparable,
    metadata: attempted.metadata,
    loadedAt: new Date().toISOString()
  };
}
