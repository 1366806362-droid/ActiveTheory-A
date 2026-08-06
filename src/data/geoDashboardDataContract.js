export const GEO_DASHBOARD_SCHEMA_VERSION = '1.0.0';

export const GEO_DASHBOARD_SOURCE_TYPES = Object.freeze([
  'mock',
  'fixture',
  'json',
  'excel',
  'feishu',
  'api'
]);

export const GEO_DASHBOARD_PLATFORM_IDS = Object.freeze([
  'all',
  'doubao',
  'deepseek',
  'kimi',
  'qwen'
]);

export const GEO_DASHBOARD_CORE_MODULES = Object.freeze([
  'metadata',
  'platforms',
  'overview',
  'answer',
  'citation',
  'keyword',
  'dataHealth',
  'trends',
  'alerts',
  'recommendations'
]);

export const GEO_DASHBOARD_FIELD_ALIASES = Object.freeze({
  reportDate: ['报告日期'],
  geoDataDate: ['GEO数据日期'],
  fiveASnapshotDate: ['5A快照日期'],
  brandMindSnapshotDate: ['品牌心智快照日期'],
  platformId: ['平台', '平台ID'],
  questionId: ['问题ID'],
  question: ['问题'],
  brandMentionRate: ['品牌提及率'],
  firstRecommendationRate: ['首位推荐率'],
  primaryRecommendationRate: ['主推荐率'],
  secondaryRecommendationRate: ['次推荐率'],
  brandRecommendationRate: ['品牌推荐率'],
  softPlacementRate: ['软植入率'],
  averageBrandPosition: ['平均品牌位置'],
  totalCitations: ['引用数量'],
  sourceType: ['来源类型'],
  contentType: ['内容类型'],
  keyword: ['关键词'],
  commercialValue: ['商业价值'],
  aiTriggerType: ['AI触发类型'],
  brandOpportunity: ['品牌机会'],
  optimizationDirection: ['优化方向']
});

const PLATFORM_ALIASES = Object.freeze({
  all: 'all',
  '全部': 'all',
  '全部平台': 'all',
  doubao: 'doubao',
  '豆包': 'doubao',
  deepseek: 'deepseek',
  'deep seek': 'deepseek',
  kimi: 'kimi',
  qwen: 'qwen',
  '千问': 'qwen',
  '通义千问': 'qwen'
});

export const GEO_DASHBOARD_PLATFORM_LABELS = Object.freeze({
  all: '全部平台',
  doubao: '豆包',
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
  qwen: '千问'
});

/**
 * @typedef {'mock'|'fixture'|'json'|'excel'|'feishu'|'api'} GeoDashboardSourceType
 *
 * @typedef {Object} GeoDashboardSource
 * @property {GeoDashboardSourceType} type
 * @property {string} name
 * @property {string|null} fileName
 * @property {string|null} generatedAt
 * @property {string|null} importedAt
 * @property {string} producer
 * @property {string} sourceVersion
 * @property {string|null} checksum
 * @property {string[]} notes
 *
 * @typedef {Object} GeoDashboardDataset
 * @property {'1.0.0'} schemaVersion
 * @property {string} datasetId
 * @property {string} datasetVersion
 * @property {GeoDashboardSource} source
 * @property {Object} metadata
 * @property {Object[]} platforms
 * @property {Object} overview
 * @property {Object} answer
 * @property {Object} citation
 * @property {Object} keyword
 * @property {Object} dataHealth
 * @property {Object[]} trends
 * @property {Object[]} alerts
 * @property {Object[]} recommendations
 * @property {Object} diagnostics
 */

export function readAliasedField(record, fieldName) {
  if (!record || typeof record !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(record, fieldName)) return record[fieldName];
  const alias = GEO_DASHBOARD_FIELD_ALIASES[fieldName]
    ?.find((candidate) => Object.prototype.hasOwnProperty.call(record, candidate));
  return alias ? record[alias] : undefined;
}

export function normalizeGeoDashboardPlatform(value) {
  const raw = value == null ? '' : String(value).trim();
  const lookup = raw.toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
  const id = PLATFORM_ALIASES[lookup] ?? raw;
  return {
    id,
    raw,
    known: GEO_DASHBOARD_PLATFORM_IDS.includes(id),
    displayName: GEO_DASHBOARD_PLATFORM_LABELS[id] ?? raw
  };
}

export function createGeoDashboardComparisonKey(platformId, questionId) {
  if (!platformId || !questionId) return null;
  return `${platformId}::${questionId}`;
}

export function isGeoDashboardSourceType(value) {
  return GEO_DASHBOARD_SOURCE_TYPES.includes(value);
}
