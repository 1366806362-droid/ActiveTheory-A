import {
  GEO_DASHBOARD_CORE_MODULES,
  GEO_DASHBOARD_SCHEMA_VERSION,
  isGeoDashboardSourceType
} from './geoDashboardDataContract.js';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HEALTH_KEYS = Object.freeze([
  'platformAccessibility',
  'questionCollectionCompleteness',
  'collectedAnswerValidity'
]);

function issue(severity, code, path, message, details = null) {
  return { severity, code, path, message, details };
}

function isValidIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(String(value ?? ''))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function checkRate(warnings, value, path) {
  if (value == null) return;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    warnings.push(issue('warning', 'RATE_OUT_OF_RANGE', path, `${path}应位于0～100。`, value));
  }
}

function checkHealthMetric(errors, warnings, metric, path) {
  if (!metric || typeof metric !== 'object') {
    errors.push(issue('error', 'HEALTH_METRIC_MISSING', path, `${path}缺失，三项数据健康指标必须独立存在。`));
    return;
  }
  const { numerator, denominator, rate } = metric;
  if (Number.isFinite(denominator) && denominator < 0) {
    errors.push(issue('error', 'NEGATIVE_DENOMINATOR', `${path}.denominator`, '关键分母不能为负数。', denominator));
  }
  if (Number.isFinite(numerator) && Number.isFinite(denominator) && numerator > denominator) {
    warnings.push(issue('warning', 'NUMERATOR_EXCEEDS_DENOMINATOR', path, '分子大于分母，保留原值但需复核。', { numerator, denominator }));
  }
  checkRate(warnings, rate, `${path}.rate`);
  if (['warning', 'critical', 'missing'].includes(metric.status)) {
    warnings.push(issue(
      'warning',
      'HEALTH_METRIC_STATUS',
      `${path}.status`,
      `${path} 数据状态为 ${metric.status}。`,
      { reason: metric.reason ?? null }
    ));
  }
}

export function validateGeoDashboardData(dataset, options = {}) {
  const errors = [];
  const warnings = [];
  const info = [];

  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
    errors.push(issue('error', 'ROOT_MISSING', '$', 'GeoDashboardDataset根对象缺失或类型错误。'));
    return { errors, warnings, info, valid: false };
  }

  if (dataset.schemaVersion !== GEO_DASHBOARD_SCHEMA_VERSION) {
    errors.push(issue('error', 'UNSUPPORTED_SCHEMA_VERSION', 'schemaVersion', `仅支持schemaVersion ${GEO_DASHBOARD_SCHEMA_VERSION}。`, dataset.schemaVersion));
  }

  if (!dataset.datasetId) {
    errors.push(issue('error', 'DATASET_ID_MISSING', 'datasetId', 'datasetId缺失。'));
  }
  if (!dataset.datasetVersion) {
    warnings.push(issue('warning', 'DATASET_VERSION_MISSING', 'datasetVersion', 'datasetVersion缺失。'));
  }
  if (!dataset.source || !isGeoDashboardSourceType(dataset.source.type)) {
    errors.push(issue('error', 'SOURCE_INVALID', 'source.type', 'source.type缺失或不在契约枚举内。'));
  }

  GEO_DASHBOARD_CORE_MODULES.forEach((moduleName) => {
    const value = dataset[moduleName];
    if (value == null) {
      errors.push(issue('error', 'CORE_MODULE_MISSING', moduleName, `核心模块${moduleName}完全缺失。`));
    }
  });

  if (!Array.isArray(dataset.platforms)) {
    errors.push(issue('error', 'PLATFORMS_TYPE_INVALID', 'platforms', 'platforms必须为数组。'));
  } else {
    dataset.platforms.forEach((platform, index) => {
      if (platform?.known === false) {
        warnings.push(issue('warning', 'UNKNOWN_PLATFORM', `platforms[${index}].id`, `未知平台“${platform.originalId ?? platform.id}”已保留原值。`));
      }
      checkRate(warnings, platform?.accessibilityRate, `platforms[${index}].accessibilityRate`);
      checkRate(warnings, platform?.questionCollectionCompleteness, `platforms[${index}].questionCollectionCompleteness`);
      checkRate(warnings, platform?.collectedAnswerValidity, `platforms[${index}].collectedAnswerValidity`);
      if (Number.isFinite(platform?.expectedQuestionCount) && platform.expectedQuestionCount < 0) {
        errors.push(issue('error', 'NEGATIVE_DENOMINATOR', `platforms[${index}].expectedQuestionCount`, '预期问题数不能为负数.'));
      }
      if (Number.isFinite(platform?.collectedQuestionCount)
        && Number.isFinite(platform?.expectedQuestionCount)
        && platform.collectedQuestionCount > platform.expectedQuestionCount) {
        warnings.push(issue('warning', 'NUMERATOR_EXCEEDS_DENOMINATOR', `platforms[${index}]`, '平台采集问题数大于预期问题数。'));
      }
    });
  }

  const metadata = dataset.metadata ?? {};
  ['reportDate', 'geoDataDate', 'fiveASnapshotDate', 'brandMindSnapshotDate', 'dataWindowStart', 'dataWindowEnd']
    .forEach((field) => {
      if (!isValidIsoDate(metadata[field])) {
        errors.push(issue('error', 'DATE_INVALID', `metadata.${field}`, `${field}必须为可解析的YYYY-MM-DD日期。`, metadata[field]));
      }
    });
  if (!metadata.timezone) {
    warnings.push(issue('warning', 'TIMEZONE_MISSING', 'metadata.timezone', 'timezone缺失。'));
  }
  if (['warning', 'stale'].includes(metadata.dateAlignmentStatus)) {
    warnings.push(issue('warning', 'DATE_ALIGNMENT_WARNING', 'metadata.dateAlignmentStatus', `数据日期状态为${metadata.dateAlignmentStatus}。`, metadata.lagDays));
  }
  if (metadata.dateAlignmentStatus === 'missing') {
    errors.push(issue('error', 'DATE_ALIGNMENT_MISSING', 'metadata.dateAlignmentStatus', '报告日期或GEO数据日期缺失。'));
  }

  const overview = dataset.overview ?? {};
  [
    'finalScore',
    'geoStructureScore',
    'geoSemanticScore',
    'brandVisibilityRate',
    'firstRecommendationRate',
    'qualityCitationRate',
    'keywordOpportunityScore',
    'dataHealthScore'
  ].forEach((field) => checkRate(warnings, overview[field], `overview.${field}`));
  if (Array.isArray(overview.scoreComponents) && overview.scoreComponents.length) {
    const suppliedWeights = overview.scoreComponents
      .map((component) => component.weight)
      .filter((weight) => Number.isFinite(weight));
    const weightTotal = suppliedWeights.reduce((total, weight) => total + weight, 0);
    if (suppliedWeights.length && Math.abs(weightTotal - 1) > 0.01) {
      warnings.push(issue('warning', 'WEIGHT_SUM_MISMATCH', 'overview.scoreComponents', '组件权重总和不等于1，Adapter不会擅自改权重。', weightTotal));
    } else if (!suppliedWeights.length) {
      info.push(issue('info', 'SCORE_COMPONENT_WEIGHTS_MISSING', 'overview.scoreComponents', '评分组件未提供正式权重；保留原始评分，不进行权重反推。'));
    }
  } else {
    info.push(issue('info', 'OPTIONAL_SCORE_COMPONENTS_MISSING', 'overview.scoreComponents', '未提供可选评分组件明细。'));
  }

  HEALTH_KEYS.forEach((key) => checkHealthMetric(errors, warnings, dataset.dataHealth?.[key], `dataHealth.${key}`));

  if (Array.isArray(dataset.trends)) {
    dataset.trends.forEach((point, index) => {
      if (!point?.comparable || !point?.comparisonKey) {
        warnings.push(issue('warning', 'TREND_NOT_COMPARABLE', `trends[${index}]`, '趋势点缺少相同平台×问题组合，不参与比较。'));
      }
    });
  } else if (dataset.trends != null) {
    errors.push(issue('error', 'TRENDS_TYPE_INVALID', 'trends', 'trends必须为数组。'));
  }

  [
    ['answer.records', dataset.answer?.records],
    ['citation.records', dataset.citation?.records],
    ['keyword.records', dataset.keyword?.records]
  ].forEach(([path, records]) => {
    if (!Array.isArray(records) || records.length === 0) {
      info.push(issue('info', 'OPTIONAL_RECORDS_MISSING', path, `${path}未提供可选明细。`));
    }
  });

  if (options.mode === 'fixture') {
    info.push(issue('info', 'FIXTURE_IN_USE', 'source.type', '当前使用本地Fixture数据。'));
  }
  if (options.mockFallback) {
    info.push(issue('info', 'MOCK_FALLBACK_IN_USE', 'source.type', '异常Fixture已回退至安全Mock数据。'));
  }

  return { errors, warnings, info, valid: errors.length === 0 };
}

export function evaluateGeoDashboardDataGate(validation) {
  const errors = validation?.errors ?? [];
  const warnings = validation?.warnings ?? [];
  if (errors.length) {
    return { status: 'fail', canRender: false, errorCount: errors.length, warningCount: warnings.length };
  }
  if (warnings.length) {
    return { status: 'warning', canRender: true, errorCount: 0, warningCount: warnings.length };
  }
  return { status: 'pass', canRender: true, errorCount: 0, warningCount: 0 };
}
