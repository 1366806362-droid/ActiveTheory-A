import {
  GEO_DASHBOARD_PLATFORM_LABELS,
  GEO_DASHBOARD_SCHEMA_VERSION,
  createGeoDashboardComparisonKey,
  normalizeGeoDashboardPlatform,
  readAliasedField
} from './geoDashboardDataContract.js';
import {
  evaluateGeoDashboardDataGate,
  validateGeoDashboardData
} from './geoDashboardDataValidator.js';

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function finiteNumber(value, path, transformations, { percent = false, fallback = null } = {}) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const source = String(value).trim();
  const numeric = Number(source.replace(/,/g, '').replace(/%$/, ''));
  if (!Number.isFinite(numeric)) return fallback;
  transformations.push({ type: percent || source.endsWith('%') ? 'percentage-to-number' : 'string-to-number', path, from: value, to: numeric });
  return numeric;
}

function integer(value, path, transformations, fallback = 0) {
  const parsed = finiteNumber(value, path, transformations, { fallback });
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function isoDate(value, path, transformations) {
  if (value == null || value === '') return null;
  const source = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) return source;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return source;
  const normalized = [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0')
  ].join('-');
  transformations.push({ type: 'date-normalization', path, from: value, to: normalized });
  return normalized;
}

function daysBetween(start, end) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
  return Math.round((endTime - startTime) / 86400000);
}

function alignmentStatus(lagDays) {
  if (!Number.isFinite(lagDays)) return 'missing';
  if (lagDays <= 1) return 'aligned';
  if (lagDays <= 3) return 'warning';
  return 'stale';
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePlatformEntry(platform, index, transformations) {
  const rawId = readAliasedField(platform, 'platformId') ?? platform?.id ?? platform?.name;
  const normalized = normalizeGeoDashboardPlatform(rawId);
  if (normalized.id !== normalized.raw) {
    transformations.push({ type: 'platform-alias', path: `platforms[${index}].id`, from: normalized.raw, to: normalized.id });
  }
  return {
    id: normalized.id,
    name: platform?.name ?? normalized.displayName,
    displayName: platform?.displayName ?? platform?.label ?? normalized.displayName,
    aliases: array(platform?.aliases),
    enabled: platform?.enabled !== false,
    expectedQuestionCount: integer(platform?.expectedQuestionCount, `platforms[${index}].expectedQuestionCount`, transformations),
    collectedQuestionCount: integer(platform?.collectedQuestionCount, `platforms[${index}].collectedQuestionCount`, transformations),
    validAnswerCount: integer(platform?.validAnswerCount, `platforms[${index}].validAnswerCount`, transformations),
    accessibilityRate: finiteNumber(platform?.accessibilityRate, `platforms[${index}].accessibilityRate`, transformations, { percent: true }),
    questionCollectionCompleteness: finiteNumber(platform?.questionCollectionCompleteness, `platforms[${index}].questionCollectionCompleteness`, transformations, { percent: true }),
    collectedAnswerValidity: finiteNumber(platform?.collectedAnswerValidity, `platforms[${index}].collectedAnswerValidity`, transformations, { percent: true }),
    weight: finiteNumber(platform?.weight, `platforms[${index}].weight`, transformations),
    status: platform?.status ?? 'unknown',
    known: normalized.known,
    originalId: normalized.raw
  };
}

function normalizeMetricObject(raw, fields, basePath, transformations) {
  return Object.fromEntries(fields.map((field) => [
    field,
    finiteNumber(readAliasedField(raw, field), `${basePath}.${field}`, transformations, { percent: /Rate$/.test(field) })
  ]));
}

function legacyMockToContract(raw, options, transformations) {
  const metadata = raw.metadata ?? {};
  const health = raw.dataHealth ?? {};
  const platformLabelToId = new Map(array(raw.platforms).map((item) => [item.label, item.id]));
  const reportDate = isoDate(metadata.reportDate, 'metadata.reportDate', transformations);
  const geoDataDate = isoDate(metadata.geoDataDate, 'metadata.geoDataDate', transformations);
  const lagDays = finiteNumber(metadata.lagDays, 'metadata.lagDays', transformations, { fallback: daysBetween(geoDataDate, reportDate) });
  const trends = array(raw.trends).flatMap((series) => array(series.points).map((point) => {
    const comparisonKey = createGeoDashboardComparisonKey(series.platform, series.questionId);
    return {
      seriesId: `${series.platform}-${series.questionId}`,
      metricId: 'finalScore',
      platformId: series.platform,
      questionId: series.questionId,
      question: series.label ?? series.questionId,
      date: point.date,
      value: finiteNumber(point.value, 'trends.value', transformations),
      comparable: Boolean(comparisonKey),
      comparisonKey
    };
  }));

  return {
    schemaVersion: GEO_DASHBOARD_SCHEMA_VERSION,
    datasetId: options.datasetId ?? 'geo-dashboard-mock-v12',
    datasetVersion: options.datasetVersion ?? '1.2.0',
    source: {
      type: 'mock',
      name: 'GEO Dashboard V1.2 Mock Data',
      fileName: 'geoDashboardMockData.js',
      generatedAt: null,
      importedAt: new Date().toISOString(),
      producer: 'ActiveTheory GEO Dashboard',
      sourceVersion: 'v1.2',
      checksum: null,
      notes: ['V1.2 locked mock presentation data']
    },
    metadata: {
      reportDate,
      geoDataDate,
      fiveASnapshotDate: isoDate(metadata.fiveASnapshotDate, 'metadata.fiveASnapshotDate', transformations),
      brandMindSnapshotDate: isoDate(metadata.brandMindSnapshotDate, 'metadata.brandMindSnapshotDate', transformations),
      lagDays,
      timezone: 'Asia/Shanghai',
      dateAlignmentStatus: alignmentStatus(lagDays),
      competitorSetVersion: 'mock-v1',
      questionSetVersion: 'mock-v1',
      platformSetVersion: 'mock-v1',
      dataWindowStart: reportDate,
      dataWindowEnd: reportDate
    },
    platforms: array(raw.platforms).map((platform, index) => normalizePlatformEntry({
      ...platform,
      platformId: platform.id,
      displayName: platform.label,
      expectedQuestionCount: platform.id === 'all' ? health.expectedQuestions : Math.round((health.expectedQuestions ?? 0) / 4),
      collectedQuestionCount: platform.id === 'all' ? health.collectedQuestions : Math.round((health.collectedQuestions ?? 0) / 4),
      validAnswerCount: platform.id === 'all' ? health.validAnswers : Math.round((health.validAnswers ?? 0) / 4),
      accessibilityRate: health.platformAccessibilityRate,
      questionCollectionCompleteness: health.questionCollectionCompleteness,
      collectedAnswerValidity: health.collectedAnswerValidity,
      status: metadata.statusTone ?? health.status
    }, index, transformations)),
    overview: {
      ...normalizeMetricObject(raw.overview, [
        'finalScore', 'geoStructureScore', 'geoSemanticScore', 'brandVisibilityRate',
        'firstRecommendationRate', 'averageBrandPosition', 'qualityCitationRate'
      ], 'overview', transformations),
      keywordOpportunityScore: finiteNumber(raw.keyword?.opportunityScore, 'overview.keywordOpportunityScore', transformations),
      dataHealthScore: finiteNumber(health.collectedAnswerValidity, 'overview.dataHealthScore', transformations),
      scoreChange: finiteNumber(raw.overview?.dailyDelta, 'overview.scoreChange', transformations),
      scoreChangeDirection: Number(raw.overview?.dailyDelta) >= 0 ? 'up' : 'down',
      scoreComponents: []
    },
    answer: {
      summary: {
        totalQuestions: integer(health.expectedQuestions, 'answer.summary.totalQuestions', transformations),
        collectedAnswers: integer(health.collectedAnswers, 'answer.summary.collectedAnswers', transformations),
        validAnswers: integer(health.validAnswers, 'answer.summary.validAnswers', transformations),
        brandedAnswers: null,
        firstRecommendations: null
      },
      metrics: normalizeMetricObject(raw.answer, [
        'platformAccessibilityRate', 'questionCollectionCompleteness', 'collectedAnswerValidity',
        'brandMentionRate', 'firstRecommendationRate', 'averageBrandPosition'
      ], 'answer.metrics', transformations),
      answerTypes: array(raw.answer?.answerTypes).map((item, index) => ({
        id: `answer-type-${index + 1}`,
        label: item.label,
        count: null,
        rate: finiteNumber(item.value, `answer.answerTypes[${index}].rate`, transformations, { percent: true })
      })),
      platformComparison: array(raw.answer?.platformComparison).map((item, index) => ({
        platformId: platformLabelToId.get(item.label) ?? normalizeGeoDashboardPlatform(item.label).id,
        accessibilityRate: null,
        completenessRate: null,
        validityRate: null,
        brandMentionRate: finiteNumber(item.mention, `answer.platformComparison[${index}].brandMentionRate`, transformations, { percent: true }),
        firstRecommendationRate: finiteNumber(item.first, `answer.platformComparison[${index}].firstRecommendationRate`, transformations, { percent: true }),
        averageBrandPosition: null
      })),
      brandPositions: [],
      recommendationLevels: { primary: null, secondary: null, weak: null, softPlacement: null, noRecommendation: null },
      records: []
    },
    citation: {
      summary: {
        totalCitations: integer(raw.citation?.totalCitations, 'citation.summary.totalCitations', transformations),
        validCitations: null,
        qualityCitations: null,
        uniqueDomains: array(raw.citation?.sourceDomains).length
      },
      metrics: normalizeMetricObject(raw.citation, [
        'qualityRate', 'officialRate', 'thirdPartyRate', 'communityRate', 'rankingReviewRate', 'indexedRate'
      ], 'citation.metrics', transformations),
      sourceTypes: [
        { id: 'official', rate: raw.citation?.officialRate },
        { id: 'thirdParty', rate: raw.citation?.thirdPartyRate },
        { id: 'community', rate: raw.citation?.communityRate },
        { id: 'unknown', rate: 0 }
      ],
      contentTypes: [],
      sourceDomains: array(raw.citation?.sourceDomains).map((item) => ({
        domain: item.domain,
        count: item.value,
        rate: null,
        sourceType: item.tone === 'violet' ? 'community' : item.tone === 'ice' ? 'official' : 'thirdParty',
        qualityLevel: item.tone,
        indexed: true,
        status: 'active'
      })),
      indexStatus: { indexed: raw.citation?.indexedRate, pending: null, missing: null, inaccessible: null },
      abnormalSources: array(raw.citation?.abnormalSources).map((item) => ({ ...item, domain: item.source })),
      records: []
    },
    keyword: {
      summary: {
        totalKeywords: array(raw.keyword?.topKeywords).length,
        opportunityKeywords: array(raw.keyword?.topKeywords).length,
        newKeywordCount: array(raw.keyword?.newKeywords).length,
        decliningKeywordCount: array(raw.keyword?.decliningKeywords).length
      },
      metrics: {
        opportunityScore: finiteNumber(raw.keyword?.opportunityScore, 'keyword.metrics.opportunityScore', transformations),
        averageCommercialValue: finiteNumber(raw.keyword?.commercialValue, 'keyword.metrics.averageCommercialValue', transformations),
        averageBrandOpportunity: null,
        highPriorityCount: array(raw.keyword?.topKeywords).filter((item) => item.score >= 80).length
      },
      topKeywords: array(raw.keyword?.topKeywords).map((item, index) => ({
        keywordId: `mock-keyword-${index + 1}`,
        keyword: item.keyword,
        normalizedKeyword: item.keyword,
        sourceKeyword: item.keyword,
        candidateKeyword: item.keyword,
        platformId: 'all',
        date: reportDate,
        commercialValue: item.score,
        aiTriggerType: 'unknown',
        brandOpportunity: item.score,
        optimizationDirection: raw.keyword?.optimizationDirection,
        sceneType: 'unknown',
        trend: item.trend >= 0 ? 'up' : 'down',
        trendValue: item.trend,
        priority: item.score >= 85 ? 'high' : 'medium',
        status: 'active'
      })),
      newKeywords: array(raw.keyword?.newKeywords),
      decliningKeywords: array(raw.keyword?.decliningKeywords),
      triggerTypes: array(raw.keyword?.triggerTypes),
      sceneTypes: [],
      opportunityGroups: [],
      records: []
    },
    dataHealth: {
      platformAccessibility: healthMetric(health.availablePlatformCount, health.expectedPlatformCount, health.platformAccessibilityRate, '平台可访问率'),
      questionCollectionCompleteness: healthMetric(health.collectedQuestions, health.expectedQuestions, health.questionCollectionCompleteness, '问题采集完整率'),
      collectedAnswerValidity: healthMetric(health.validAnswers, health.collectedAnswers, health.collectedAnswerValidity, '已采集回答有效率'),
      overallStatus: health.status ?? 'unknown'
    },
    trends,
    alerts: array(raw.alerts).map((item) => ({
      id: item.id,
      level: item.tone === 'warning' ? 'warning' : 'info',
      category: 'dashboard',
      title: item.label,
      message: item.detail,
      metricId: null,
      platformId: null,
      questionId: null,
      date: reportDate,
      status: 'active'
    })),
    recommendations: array(raw.recommendations).map((item, index) => ({
      id: `mock-recommendation-${index + 1}`,
      priority: 'medium',
      category: 'mock',
      title: `Mock建议${index + 1}`,
      rationale: 'V1.2锁定演示内容',
      action: item,
      relatedMetric: null,
      relatedKeywords: [],
      relatedPlatforms: [],
      status: 'active'
    })),
    diagnostics: { adapterMode: 'legacy-mock', unknownPlatforms: [] }
  };
}

function healthMetric(numerator, denominator, rate, label) {
  return {
    numerator: Number(numerator ?? 0),
    denominator: Number(denominator ?? 0),
    rate: Number(rate ?? 0),
    previousRate: null,
    change: null,
    status: 'healthy',
    affectedPlatforms: [],
    affectedQuestions: [],
    reason: label,
    recommendation: null
  };
}

function normalizeContractData(raw, options, transformations) {
  const metadataRaw = raw.metadata ?? {};
  const reportDate = isoDate(readAliasedField(metadataRaw, 'reportDate'), 'metadata.reportDate', transformations);
  const geoDataDate = isoDate(readAliasedField(metadataRaw, 'geoDataDate'), 'metadata.geoDataDate', transformations);
  const derivedLag = daysBetween(geoDataDate, reportDate);
  const suppliedLag = finiteNumber(metadataRaw.lagDays, 'metadata.lagDays', transformations);
  const lagDays = suppliedLag ?? derivedLag;
  if (suppliedLag == null && derivedLag != null) {
    transformations.push({ type: 'metadata-derivation', path: 'metadata.lagDays', from: null, to: derivedLag });
  }

  const platforms = array(raw.platforms).map((platform, index) => normalizePlatformEntry(platform, index, transformations));
  const unknownPlatforms = platforms.filter((platform) => !platform.known).map((platform) => platform.originalId);

  const answerRaw = raw.answer ?? {};
  const citationRaw = raw.citation ?? {};
  const keywordRaw = raw.keyword ?? {};
  const healthRaw = raw.dataHealth ?? {};

  const trends = array(raw.trends).flatMap((item, index) => {
    if (Array.isArray(item.points)) {
      return item.points.map((point, pointIndex) => normalizeTrendPoint({ ...point, ...item, points: undefined }, `trends[${index}].points[${pointIndex}]`, transformations));
    }
    return [normalizeTrendPoint(item, `trends[${index}]`, transformations)];
  });

  return {
    schemaVersion: raw.schemaVersion,
    datasetId: raw.datasetId ?? options.datasetId ?? 'geo-dashboard-fixture',
    datasetVersion: raw.datasetVersion ?? options.datasetVersion ?? '1.0.0',
    source: {
      type: raw.source?.type ?? options.mode ?? 'fixture',
      name: raw.source?.name ?? 'GEO Dashboard Fixture',
      fileName: raw.source?.fileName ?? null,
      generatedAt: raw.source?.generatedAt ?? null,
      importedAt: raw.source?.importedAt ?? new Date().toISOString(),
      producer: raw.source?.producer ?? 'ActiveTheory GEO Dashboard',
      sourceVersion: raw.source?.sourceVersion ?? '1.0.0',
      checksum: raw.source?.checksum ?? null,
      notes: array(raw.source?.notes)
    },
    metadata: {
      reportDate,
      geoDataDate,
      fiveASnapshotDate: isoDate(readAliasedField(metadataRaw, 'fiveASnapshotDate'), 'metadata.fiveASnapshotDate', transformations),
      brandMindSnapshotDate: isoDate(readAliasedField(metadataRaw, 'brandMindSnapshotDate'), 'metadata.brandMindSnapshotDate', transformations),
      lagDays,
      timezone: metadataRaw.timezone ?? 'Asia/Shanghai',
      dateAlignmentStatus: metadataRaw.dateAlignmentStatus ?? alignmentStatus(lagDays),
      competitorSetVersion: metadataRaw.competitorSetVersion ?? null,
      questionSetVersion: metadataRaw.questionSetVersion ?? null,
      platformSetVersion: metadataRaw.platformSetVersion ?? null,
      dataWindowStart: isoDate(metadataRaw.dataWindowStart, 'metadata.dataWindowStart', transformations),
      dataWindowEnd: isoDate(metadataRaw.dataWindowEnd, 'metadata.dataWindowEnd', transformations)
    },
    platforms,
    overview: normalizeOverview(raw.overview ?? {}, transformations),
    answer: normalizeAnswer(answerRaw, transformations),
    citation: normalizeCitation(citationRaw, transformations),
    keyword: normalizeKeyword(keywordRaw, reportDate, transformations),
    dataHealth: normalizeDataHealth(healthRaw, transformations),
    trends,
    alerts: array(raw.alerts).map((item, index) => ({
      id: item.id ?? `alert-${index + 1}`,
      level: item.level ?? 'info',
      category: item.category ?? 'data-quality',
      title: item.title ?? '数据提示',
      message: item.message ?? '',
      metricId: item.metricId ?? null,
      platformId: item.platformId ?? null,
      questionId: item.questionId ?? null,
      date: isoDate(item.date ?? reportDate, `alerts[${index}].date`, transformations),
      status: item.status ?? 'active'
    })),
    recommendations: array(raw.recommendations).map((item, index) => typeof item === 'string' ? {
      id: `recommendation-${index + 1}`,
      priority: 'medium',
      category: 'data-quality',
      title: `数据质量建议${index + 1}`,
      rationale: '源数据明确提供',
      action: item,
      relatedMetric: null,
      relatedKeywords: [],
      relatedPlatforms: [],
      status: 'active'
    } : {
      id: item.id ?? `recommendation-${index + 1}`,
      priority: item.priority ?? 'medium',
      category: item.category ?? 'data-quality',
      title: item.title ?? '数据质量建议',
      rationale: item.rationale ?? '',
      action: item.action ?? '',
      relatedMetric: item.relatedMetric ?? null,
      relatedKeywords: array(item.relatedKeywords),
      relatedPlatforms: array(item.relatedPlatforms),
      status: item.status ?? 'active'
    }),
    diagnostics: { ...(raw.diagnostics ?? {}), adapterMode: 'contract', unknownPlatforms }
  };
}

function normalizeOverview(raw, transformations) {
  const result = normalizeMetricObject(raw, [
    'finalScore', 'geoStructureScore', 'geoSemanticScore', 'brandVisibilityRate',
    'firstRecommendationRate', 'averageBrandPosition', 'qualityCitationRate',
    'keywordOpportunityScore', 'dataHealthScore', 'scoreChange'
  ], 'overview', transformations);
  return {
    ...result,
    scoreChangeDirection: raw.scoreChangeDirection ?? (result.scoreChange >= 0 ? 'up' : 'down'),
    scoreComponents: array(raw.scoreComponents).map((component, index) => ({
      id: component.id ?? `component-${index + 1}`,
      label: component.label ?? component.id ?? `Component ${index + 1}`,
      value: finiteNumber(component.value, `overview.scoreComponents[${index}].value`, transformations),
      weight: finiteNumber(component.weight, `overview.scoreComponents[${index}].weight`, transformations),
      contribution: finiteNumber(component.contribution, `overview.scoreComponents[${index}].contribution`, transformations),
      sourceMetric: component.sourceMetric ?? null,
      status: component.status ?? 'active'
    }))
  };
}

function normalizeAnswer(raw, transformations) {
  const summary = raw.summary ?? {};
  const metrics = raw.metrics ?? raw;
  return {
    summary: Object.fromEntries(['totalQuestions', 'collectedAnswers', 'validAnswers', 'brandedAnswers', 'firstRecommendations'].map((field) => [field, integer(summary[field], `answer.summary.${field}`, transformations, 0)])),
    metrics: normalizeMetricObject(metrics, ['platformAccessibilityRate', 'questionCollectionCompleteness', 'collectedAnswerValidity', 'brandMentionRate', 'firstRecommendationRate', 'averageBrandPosition'], 'answer.metrics', transformations),
    answerTypes: array(raw.answerTypes).map((item, index) => ({ id: item.id ?? `answer-type-${index + 1}`, label: item.label ?? item.id, count: integer(item.count, `answer.answerTypes[${index}].count`, transformations), rate: finiteNumber(item.rate ?? item.value, `answer.answerTypes[${index}].rate`, transformations, { percent: true }) })),
    platformComparison: array(raw.platformComparison).map((item, index) => {
      const normalized = normalizeGeoDashboardPlatform(readAliasedField(item, 'platformId') ?? item.platformId);
      return {
        platformId: normalized.id,
        accessibilityRate: finiteNumber(item.accessibilityRate, `answer.platformComparison[${index}].accessibilityRate`, transformations, { percent: true }),
        completenessRate: finiteNumber(item.completenessRate, `answer.platformComparison[${index}].completenessRate`, transformations, { percent: true }),
        validityRate: finiteNumber(item.validityRate, `answer.platformComparison[${index}].validityRate`, transformations, { percent: true }),
        brandMentionRate: finiteNumber(readAliasedField(item, 'brandMentionRate'), `answer.platformComparison[${index}].brandMentionRate`, transformations, { percent: true }),
        firstRecommendationRate: finiteNumber(readAliasedField(item, 'firstRecommendationRate'), `answer.platformComparison[${index}].firstRecommendationRate`, transformations, { percent: true }),
        averageBrandPosition: finiteNumber(readAliasedField(item, 'averageBrandPosition'), `answer.platformComparison[${index}].averageBrandPosition`, transformations)
      };
    }),
    brandPositions: array(raw.brandPositions),
    recommendationLevels: { primary: 0, secondary: 0, weak: 0, softPlacement: 0, noRecommendation: 0, ...(raw.recommendationLevels ?? {}) },
    records: array(raw.records).map((record, index) => ({ ...record, platformId: normalizeGeoDashboardPlatform(readAliasedField(record, 'platformId')).id, date: isoDate(record.date, `answer.records[${index}].date`, transformations) }))
  };
}

function normalizeCitation(raw, transformations) {
  const summary = raw.summary ?? {};
  const metrics = raw.metrics ?? raw;
  return {
    summary: Object.fromEntries(['totalCitations', 'validCitations', 'qualityCitations', 'uniqueDomains'].map((field) => [field, integer(readAliasedField(summary, field), `citation.summary.${field}`, transformations, 0)])),
    metrics: normalizeMetricObject(metrics, ['qualityRate', 'officialRate', 'thirdPartyRate', 'communityRate', 'rankingReviewRate', 'indexedRate'], 'citation.metrics', transformations),
    sourceTypes: array(raw.sourceTypes),
    contentTypes: array(raw.contentTypes),
    sourceDomains: array(raw.sourceDomains).map((item) => ({ ...item, count: finiteNumber(item.count ?? item.value, 'citation.sourceDomains.count', transformations), rate: finiteNumber(item.rate, 'citation.sourceDomains.rate', transformations, { percent: true }) })),
    indexStatus: { indexed: 0, pending: 0, missing: 0, inaccessible: 0, ...(raw.indexStatus ?? {}) },
    abnormalSources: array(raw.abnormalSources),
    records: array(raw.records).map((record, index) => ({ ...record, platformId: normalizeGeoDashboardPlatform(readAliasedField(record, 'platformId')).id, date: isoDate(record.date, `citation.records[${index}].date`, transformations), sourceType: readAliasedField(record, 'sourceType') ?? 'unknown', contentType: readAliasedField(record, 'contentType') ?? 'other' }))
  };
}

function normalizeKeyword(raw, reportDate, transformations) {
  const summary = raw.summary ?? {};
  const metrics = raw.metrics ?? raw;
  const normalizeItem = (item, index, path) => ({
    ...item,
    keywordId: item.keywordId ?? `${path}-${index + 1}`,
    keyword: readAliasedField(item, 'keyword') ?? '',
    normalizedKeyword: item.normalizedKeyword ?? readAliasedField(item, 'keyword') ?? '',
    sourceKeyword: item.sourceKeyword ?? readAliasedField(item, 'keyword') ?? '',
    candidateKeyword: item.candidateKeyword ?? readAliasedField(item, 'keyword') ?? '',
    platformId: normalizeGeoDashboardPlatform(readAliasedField(item, 'platformId') ?? 'all').id,
    date: isoDate(item.date ?? reportDate, `${path}[${index}].date`, transformations),
    commercialValue: finiteNumber(readAliasedField(item, 'commercialValue'), `${path}[${index}].commercialValue`, transformations),
    aiTriggerType: readAliasedField(item, 'aiTriggerType') ?? 'unknown',
    brandOpportunity: finiteNumber(readAliasedField(item, 'brandOpportunity'), `${path}[${index}].brandOpportunity`, transformations),
    optimizationDirection: readAliasedField(item, 'optimizationDirection') ?? null,
    sceneType: item.sceneType ?? 'unknown',
    trend: item.trend ?? 'flat',
    trendValue: finiteNumber(item.trendValue ?? item.trend, `${path}[${index}].trendValue`, transformations, { fallback: 0 }),
    priority: item.priority ?? 'medium',
    status: item.status ?? 'active'
  });
  return {
    summary: Object.fromEntries(['totalKeywords', 'opportunityKeywords', 'newKeywordCount', 'decliningKeywordCount'].map((field) => [field, integer(summary[field], `keyword.summary.${field}`, transformations, 0)])),
    metrics: {
      opportunityScore: finiteNumber(metrics.opportunityScore, 'keyword.metrics.opportunityScore', transformations),
      averageCommercialValue: finiteNumber(metrics.averageCommercialValue ?? readAliasedField(metrics, 'commercialValue'), 'keyword.metrics.averageCommercialValue', transformations),
      averageBrandOpportunity: finiteNumber(metrics.averageBrandOpportunity, 'keyword.metrics.averageBrandOpportunity', transformations),
      highPriorityCount: integer(metrics.highPriorityCount, 'keyword.metrics.highPriorityCount', transformations)
    },
    topKeywords: array(raw.topKeywords).map((item, index) => normalizeItem(item, index, 'keyword.topKeywords')),
    newKeywords: array(raw.newKeywords),
    decliningKeywords: array(raw.decliningKeywords),
    triggerTypes: array(raw.triggerTypes),
    sceneTypes: array(raw.sceneTypes),
    opportunityGroups: array(raw.opportunityGroups),
    records: array(raw.records).map((item, index) => normalizeItem(item, index, 'keyword.records'))
  };
}

function normalizeDataHealth(raw, transformations) {
  const normalize = (metric, path) => ({
    numerator: finiteNumber(metric?.numerator, `${path}.numerator`, transformations),
    denominator: finiteNumber(metric?.denominator, `${path}.denominator`, transformations),
    rate: finiteNumber(metric?.rate, `${path}.rate`, transformations, { percent: true }),
    previousRate: finiteNumber(metric?.previousRate, `${path}.previousRate`, transformations, { percent: true }),
    change: finiteNumber(metric?.change, `${path}.change`, transformations),
    status: metric?.status ?? 'missing',
    affectedPlatforms: array(metric?.affectedPlatforms),
    affectedQuestions: array(metric?.affectedQuestions),
    reason: metric?.reason ?? null,
    recommendation: metric?.recommendation ?? null
  });
  const platformAccessibility = normalize(raw.platformAccessibility, 'dataHealth.platformAccessibility');
  const questionCollectionCompleteness = normalize(raw.questionCollectionCompleteness, 'dataHealth.questionCollectionCompleteness');
  const collectedAnswerValidity = normalize(raw.collectedAnswerValidity, 'dataHealth.collectedAnswerValidity');
  const statuses = [platformAccessibility.status, questionCollectionCompleteness.status, collectedAnswerValidity.status];
  const overallStatus = statuses.includes('critical') || statuses.includes('missing')
    ? 'critical'
    : statuses.includes('warning') ? 'warning' : 'healthy';
  return { platformAccessibility, questionCollectionCompleteness, collectedAnswerValidity, overallStatus: raw.overallStatus ?? overallStatus };
}

function normalizeTrendPoint(item, path, transformations) {
  const platform = normalizeGeoDashboardPlatform(readAliasedField(item, 'platformId') ?? item.platform);
  const questionId = readAliasedField(item, 'questionId');
  const comparisonKey = createGeoDashboardComparisonKey(platform.id || null, questionId);
  return {
    seriesId: item.seriesId ?? comparisonKey ?? `${path}-unmatched`,
    metricId: item.metricId ?? 'finalScore',
    platformId: platform.id || null,
    questionId: questionId ?? null,
    question: readAliasedField(item, 'question') ?? questionId ?? null,
    date: isoDate(item.date, `${path}.date`, transformations),
    value: finiteNumber(item.value, `${path}.value`, transformations),
    comparable: item.comparable !== false && Boolean(comparisonKey),
    comparisonKey
  };
}

export function adaptGeoDashboardData(rawData, options = {}) {
  const transformations = [];
  const sourceCopy = clone(rawData);
  const dataset = sourceCopy?.byPlatform && !sourceCopy.schemaVersion
    ? legacyMockToContract(sourceCopy, options, transformations)
    : normalizeContractData(sourceCopy ?? {}, options, transformations);
  const validation = validateGeoDashboardData(dataset, { mode: options.mode });
  const gate = evaluateGeoDashboardDataGate(validation);
  return {
    dataset,
    validation,
    gate,
    warnings: validation.warnings,
    errors: validation.errors,
    transformations,
    fallbackUsed: false,
    fallbackReason: null
  };
}
