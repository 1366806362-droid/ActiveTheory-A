const baseFixture = {
  schemaVersion: '1.0.0',
  datasetId: 'geo-dashboard-fixture-valid',
  datasetVersion: '2026.08.04.1',
  source: {
    type: 'fixture',
    name: 'GEO Dashboard V1.3 Contract Fixture',
    fileName: 'geoDashboardDataFixtures.js',
    generatedAt: '2026-08-04T09:00:00+08:00',
    importedAt: '2026-08-04T09:05:00+08:00',
    producer: 'ActiveTheory GEO Data Contract',
    sourceVersion: '1.0.0',
    checksum: null,
    notes: ['轻量本地Fixture，不代表正式生产数据。']
  },
  metadata: {
    '报告日期': '2026-08-04',
    'GEO数据日期': '2026-08-03',
    fiveASnapshotDate: '2026-08-02',
    brandMindSnapshotDate: '2026-08-01',
    timezone: 'Asia/Shanghai',
    competitorSetVersion: 'fixture-competitors-v1',
    questionSetVersion: 'fixture-questions-v1',
    platformSetVersion: 'fixture-platforms-v1',
    dataWindowStart: '2026-07-28',
    dataWindowEnd: '2026-08-03'
  },
  platforms: [
    ['全部平台', 80, 76, 72, '97.5%', '95%', '94.7%', 1],
    ['豆包', 20, 20, 19, '100%', '100%', '95%', 0.25],
    ['DeepSeek', 20, 19, 18, '100%', '95%', '94.7%', 0.25],
    ['Kimi', 20, 18, 17, '95%', '90%', '94.4%', 0.25],
    ['通义千问', 20, 19, 18, '95%', '95%', '94.7%', 0.25]
  ].map(([平台, expectedQuestionCount, collectedQuestionCount, validAnswerCount, accessibilityRate, questionCollectionCompleteness, collectedAnswerValidity, weight]) => ({
    平台,
    enabled: true,
    expectedQuestionCount,
    collectedQuestionCount,
    validAnswerCount,
    accessibilityRate,
    questionCollectionCompleteness,
    collectedAnswerValidity,
    weight,
    status: 'healthy'
  })),
  overview: {
    finalScore: '84.6',
    geoStructureScore: 87.2,
    geoSemanticScore: 81.9,
    brandVisibilityRate: '78.5%',
    firstRecommendationRate: '61.2%',
    averageBrandPosition: 2.1,
    qualityCitationRate: '74.3%',
    keywordOpportunityScore: 86.1,
    dataHealthScore: 95.1,
    scoreChange: 2.4,
    scoreChangeDirection: 'up',
    scoreComponents: [
      { id: 'structure', label: '结构', value: 87.2, weight: 0.3, contribution: 26.16, sourceMetric: 'geoStructureScore', status: 'active' },
      { id: 'semantic', label: '语义', value: 81.9, weight: 0.25, contribution: 20.48, sourceMetric: 'geoSemanticScore', status: 'active' },
      { id: 'visibility', label: '品牌可见', value: 78.5, weight: 0.25, contribution: 19.63, sourceMetric: 'brandVisibilityRate', status: 'active' },
      { id: 'citation', label: '引用质量', value: 74.3, weight: 0.2, contribution: 14.86, sourceMetric: 'qualityCitationRate', status: 'active' }
    ]
  },
  answer: {
    summary: { totalQuestions: 80, collectedAnswers: 76, validAnswers: 72, brandedAnswers: 57, firstRecommendations: 44 },
    metrics: {
      platformAccessibilityRate: '97.5%',
      questionCollectionCompleteness: '95%',
      collectedAnswerValidity: '94.7%',
      '品牌提及率': '78.5%',
      '首位推荐率': '61.2%',
      '平均品牌位置': '2.1'
    },
    answerTypes: [
      { id: 'direct', label: '直接推荐', count: 29, rate: 40.3 },
      { id: 'comparison', label: '对比提及', count: 22, rate: 30.6 },
      { id: 'scenario', label: '场景建议', count: 14, rate: 19.4 },
      { id: 'unmentioned', label: '未提及', count: 7, rate: 9.7 }
    ],
    platformComparison: [
      { 平台: '豆包', accessibilityRate: 100, completenessRate: 100, validityRate: 95, 品牌提及率: 84, 首位推荐率: 67, 平均品牌位置: 1.8 },
      { 平台: 'Deep Seek', accessibilityRate: 100, completenessRate: 95, validityRate: 94.7, 品牌提及率: 77, 首位推荐率: 59, 平均品牌位置: 2.2 },
      { 平台: 'Kimi', accessibilityRate: 95, completenessRate: 90, validityRate: 94.4, 品牌提及率: 76, 首位推荐率: 60, 平均品牌位置: 2.3 },
      { 平台: 'Qwen', accessibilityRate: 95, completenessRate: 95, validityRate: 94.7, 品牌提及率: 77, 首位推荐率: 58, 平均品牌位置: 2.2 }
    ],
    brandPositions: [{ position: 1, count: 44, rate: 61.2 }, { position: 2, count: 18, rate: 25 }, { position: 3, count: 10, rate: 13.8 }],
    recommendationLevels: { primary: 44, secondary: 18, weak: 5, softPlacement: 5, noRecommendation: 0 },
    records: [{ recordId: 'A-001', date: '2026-08-03', 平台: '豆包', 问题ID: 'Q-001', 问题: '品牌推荐问题', answerType: 'direct', isValid: true, brandMentioned: true, brandPosition: 1, isFirstRecommendation: true, recommendationLevel: 'primary', mentionedBrands: ['示例品牌'], mentionedProducts: [], rawReference: 'fixture://answer/A-001' }]
  },
  citation: {
    summary: { totalCitations: 462, validCitations: 441, qualityCitations: 328, uniqueDomains: 37 },
    metrics: { qualityRate: '74.3%', officialRate: '36%', thirdPartyRate: '45%', communityRate: '19%', rankingReviewRate: '29%', indexedRate: '90.5%' },
    sourceTypes: [{ id: 'official', count: 166, rate: 36 }, { id: 'thirdParty', count: 208, rate: 45 }, { id: 'community', count: 88, rate: 19 }, { id: 'unknown', count: 0, rate: 0 }],
    contentTypes: [{ id: 'ranking', count: 67 }, { id: 'review', count: 67 }, { id: 'report', count: 82 }, { id: 'media', count: 91 }, { id: 'officialArticle', count: 112 }, { id: 'communityPost', count: 43 }, { id: 'other', count: 0 }],
    sourceDomains: [
      { domain: 'brand.com', count: 104, rate: 22.5, sourceType: 'official', qualityLevel: 'high', indexed: true, status: 'active' },
      { domain: '36kr.com', count: 73, rate: 15.8, sourceType: 'thirdParty', qualityLevel: 'high', indexed: true, status: 'active' },
      { domain: 'zhihu.com', count: 61, rate: 13.2, sourceType: 'community', qualityLevel: 'medium', indexed: true, status: 'active' },
      { domain: 'sspai.com', count: 48, rate: 10.4, sourceType: 'thirdParty', qualityLevel: 'high', indexed: true, status: 'active' },
      { domain: 'weixin.qq.com', count: 39, rate: 8.4, sourceType: 'thirdParty', qualityLevel: 'medium', indexed: true, status: 'active' }
    ],
    indexStatus: { indexed: 418, pending: 12, missing: 25, inaccessible: 7 },
    abnormalSources: [{ domain: 'stale-source.example', count: 3, severity: 'medium', abnormalReason: '内容过期' }],
    records: [{ citationId: 'C-001', date: '2026-08-03', 平台: 'DeepSeek', 问题ID: 'Q-001', url: 'https://brand.com/example', domain: 'brand.com', title: '官方资料', 来源类型: 'official', 内容类型: 'officialArticle', isRanking: false, isReview: false, isOfficial: true, isIndexed: true, qualityLevel: 'high', abnormalReason: null }]
  },
  keyword: {
    summary: { totalKeywords: 126, opportunityKeywords: 43, newKeywordCount: 4, decliningKeywordCount: 2 },
    metrics: { opportunityScore: 86.1, averageCommercialValue: 80.4, averageBrandOpportunity: 78.2, highPriorityCount: 4 },
    topKeywords: [
      ['K-001', 'AI品牌推荐', 94, 'directAnswer', 91, '构建可引用证据', 'comparison', 8.2, 'high'],
      ['K-002', '智能营销平台对比', 91, 'comparisonTriggered', 87, '补强对比事实', 'comparison', 5.7, 'high'],
      ['K-003', 'GEO优化服务', 88, 'recommendationTriggered', 84, '增强品牌入口', 'service', 10.4, 'high'],
      ['K-004', '品牌AI可见率', 84, 'citationTriggered', 79, '提高权威引用', 'measurement', 4.8, 'medium'],
      ['K-005', '生成式搜索排名', 81, 'scenarioTriggered', 76, '扩充场景问答', 'scenario', 3.1, 'medium']
    ].map(([keywordId, 关键词, 商业价值, AI触发类型, 品牌机会, 优化方向, sceneType, trendValue, priority]) => ({ keywordId, 关键词, normalizedKeyword: 关键词, sourceKeyword: 关键词, candidateKeyword: 关键词, 平台: '全部', date: '2026-08-03', 商业价值, AI触发类型, 品牌机会, 优化方向, sceneType, trend: trendValue >= 0 ? 'up' : 'down', trendValue, priority, status: 'active' })),
    newKeywords: ['AI品牌证据链', '生成式搜索监测', '多平台首位推荐', 'AI引用质量'],
    decliningKeywords: ['传统SEO排名工具', '关键词密度检测'],
    triggerTypes: [{ label: '直接回答', value: 30 }, { label: '引用触发', value: 25 }, { label: '推荐触发', value: 25 }, { label: '场景触发', value: 20 }],
    sceneTypes: [{ id: 'comparison', count: 45 }, { id: 'service', count: 38 }, { id: 'scenario', count: 43 }],
    opportunityGroups: [{ id: 'high', count: 4 }, { id: 'medium', count: 18 }, { id: 'low', count: 21 }],
    records: [{ keywordId: 'KR-001', 关键词: 'AI品牌推荐', normalizedKeyword: 'AI品牌推荐', sourceKeyword: '品牌推荐', candidateKeyword: 'AI品牌推荐', 平台: '豆包', date: '2026-08-03', 商业价值: '94', AI触发类型: 'directAnswer', 品牌机会: '91', 优化方向: '构建可引用证据', sceneType: 'comparison', trend: 'up', trendValue: 8.2, priority: 'high', status: 'active' }]
  },
  dataHealth: {
    platformAccessibility: { numerator: 4, denominator: 4, rate: '97.5%', previousRate: 96.2, change: 1.3, status: 'healthy', affectedPlatforms: [], affectedQuestions: [], reason: '全部目标平台可访问', recommendation: null },
    questionCollectionCompleteness: { numerator: 76, denominator: 80, rate: '95%', previousRate: 93.8, change: 1.2, status: 'healthy', affectedPlatforms: ['kimi'], affectedQuestions: ['Q-019', 'Q-020'], reason: '少量问题超时', recommendation: '复核超时问题' },
    collectedAnswerValidity: { numerator: 72, denominator: 76, rate: '94.7%', previousRate: 94.1, change: 0.6, status: 'healthy', affectedPlatforms: [], affectedQuestions: [], reason: '有效回答稳定', recommendation: null },
    overallStatus: 'healthy'
  },
  trends: [
    ['doubao', 'Q-001', '品牌推荐问题', '2026-08-01', 82.1],
    ['doubao', 'Q-001', '品牌推荐问题', '2026-08-02', 83.4],
    ['doubao', 'Q-001', '品牌推荐问题', '2026-08-03', 84.6],
    ['deepseek', 'Q-001', '品牌推荐问题', '2026-08-01', 79.2],
    ['deepseek', 'Q-001', '品牌推荐问题', '2026-08-02', 80.1],
    ['deepseek', 'Q-001', '品牌推荐问题', '2026-08-03', 81.3]
  ].map(([平台, 问题ID, 问题, date, value]) => ({ seriesId: `${平台}-${问题ID}`, metricId: 'finalScore', 平台, 问题ID, 问题, date, value })),
  alerts: [{ id: 'fixture-info', level: 'info', category: 'data-quality', title: 'Fixture数据', message: '当前为本地标准Fixture。', metricId: null, platformId: null, questionId: null, date: '2026-08-04', status: 'active' }],
  recommendations: [{ id: 'fixture-recommendation', priority: 'low', category: 'data-quality', title: '保持日期对齐', rationale: '当前数据日期相差1天', action: '继续监控日期血缘', relatedMetric: 'metadata.lagDays', relatedKeywords: [], relatedPlatforms: [], status: 'active' }],
  diagnostics: { fixture: 'valid' }
};

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

const warningFixtureData = copy(baseFixture);
warningFixtureData.datasetId = 'geo-dashboard-fixture-warning';
warningFixtureData.metadata['GEO数据日期'] = '2026-07-30';
warningFixtureData.platforms.push({ 平台: 'Moonshot Preview', enabled: true, expectedQuestionCount: 5, collectedQuestionCount: 6, validAnswerCount: 5, accessibilityRate: '88%', questionCollectionCompleteness: '120%', collectedAnswerValidity: '83.3%', weight: 0, status: 'warning' });
warningFixtureData.trends.push({ seriesId: 'unmatched-trend', metricId: 'brandMentionRate', 平台: '豆包', 问题: '缺少问题ID的趋势点', date: '2026-08-03', value: 70.1 });
delete warningFixtureData.citation.records;
warningFixtureData.diagnostics.fixture = 'warning';

const invalidFixtureData = copy(baseFixture);
invalidFixtureData.schemaVersion = '9.9.9';
invalidFixtureData.datasetId = 'geo-dashboard-fixture-invalid';
invalidFixtureData.metadata['报告日期'] = 'not-a-date';
invalidFixtureData.dataHealth.questionCollectionCompleteness.denominator = -5;
invalidFixtureData.diagnostics.fixture = 'invalid';

export const validFixture = Object.freeze(baseFixture);
export const warningFixture = Object.freeze(warningFixtureData);
export const invalidFixture = Object.freeze(invalidFixtureData);

export const geoDashboardDataFixtures = Object.freeze({
  valid: validFixture,
  warning: warningFixture,
  invalid: invalidFixture
});

export function getGeoDashboardFixture(name = 'valid') {
  return copy(geoDashboardDataFixtures[name] ?? geoDashboardDataFixtures.valid);
}
