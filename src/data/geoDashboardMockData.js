const platformDefinitions = Object.freeze([
  { id: 'all', label: '全部平台', shortLabel: 'ALL' },
  { id: 'doubao', label: '豆包', shortLabel: 'DB' },
  { id: 'deepseek', label: 'DeepSeek', shortLabel: 'DS' },
  { id: 'kimi', label: 'Kimi', shortLabel: 'KM' },
  { id: 'qwen', label: '千问', shortLabel: 'QW' }
]);

const commonMetadata = Object.freeze({
  reportDate: '2026-07-29',
  geoDataDate: '2026-07-28',
  fiveASnapshotDate: '2026-07-27',
  brandMindSnapshotDate: '2026-07-25',
  lagDays: 1,
  status: '数据健康 · 可分析',
  statusTone: 'healthy'
});

const aggregate = Object.freeze({
  overview: {
    finalScore: 82.6,
    geoStructureScore: 86.2,
    geoSemanticScore: 79.8,
    brandVisibilityRate: 76.4,
    firstRecommendationRate: 58.7,
    averageBrandPosition: 2.3,
    qualityCitationRate: 71.8,
    dailyDelta: 3.8
  },
  answer: {
    platformAccessibilityRate: 96.4,
    questionCollectionCompleteness: 92.1,
    collectedAnswerValidity: 94.8,
    brandMentionRate: 76.4,
    firstRecommendationRate: 58.7,
    averageBrandPosition: 2.3,
    answerTypes: [
      { label: '直接推荐', value: 38 },
      { label: '对比提及', value: 31 },
      { label: '场景建议', value: 19 },
      { label: '未提及', value: 12 }
    ],
    platformComparison: [
      { label: '豆包', mention: 82, first: 64 },
      { label: 'DeepSeek', mention: 74, first: 55 },
      { label: 'Kimi', mention: 78, first: 61 },
      { label: '千问', mention: 72, first: 54 }
    ]
  },
  citation: {
    totalCitations: 428,
    officialRate: 34,
    thirdPartyRate: 46,
    communityRate: 20,
    rankingReviewRate: 28,
    qualityRate: 71.8,
    authorityRate: 68.5,
    indexedRate: 88.2,
    sourceDomains: [
      { domain: 'brand.com', value: 92, tone: 'ice' },
      { domain: '36kr.com', value: 67, tone: 'white' },
      { domain: 'zhihu.com', value: 54, tone: 'violet' },
      { domain: 'sspai.com', value: 39, tone: 'cyan' },
      { domain: 'weixin.qq.com', value: 31, tone: 'dim' }
    ],
    abnormalSources: [
      { source: 'content-farm.example', count: 7, severity: 'high' },
      { source: 'stale-review.example', count: 4, severity: 'medium' }
    ]
  },
  keyword: {
    opportunityScore: 84.2,
    commercialValue: 78.6,
    triggerTypes: [
      { label: '品牌对比', value: 31 },
      { label: '购买决策', value: 27 },
      { label: '场景问题', value: 24 },
      { label: '知识问答', value: 18 }
    ],
    brandOpportunity: '高潜力 · 需强化权威引用',
    optimizationDirection: '优先覆盖高商业价值对比词，并补齐官方结构化证据。',
    topKeywords: [
      { keyword: 'AI品牌推荐', score: 94, value: '高', trend: 8.4 },
      { keyword: '智能营销平台对比', score: 91, value: '高', trend: 5.2 },
      { keyword: 'GEO优化服务', score: 88, value: '高', trend: 12.7 },
      { keyword: '生成式搜索排名', score: 83, value: '中高', trend: 4.9 },
      { keyword: '品牌AI可见率', score: 81, value: '中高', trend: 9.1 },
      { keyword: 'AI答案引用优化', score: 79, value: '中高', trend: 3.8 },
      { keyword: '大模型品牌曝光', score: 76, value: '中', trend: 6.3 },
      { keyword: '首位推荐提升', score: 74, value: '中', trend: 2.6 },
      { keyword: '权威来源建设', score: 71, value: '中', trend: 7.5 },
      { keyword: 'AI搜索营销', score: 68, value: '中', trend: -1.8 }
    ],
    newKeywords: ['AI品牌可见率监测', '生成式引擎内容审计', '多平台AI引用'],
    decliningKeywords: ['传统SEO排名工具', '关键词密度检测']
  },
  dataHealth: {
    availablePlatformCount: 4,
    expectedPlatformCount: 4,
    platformAccessibilityRate: 96.4,
    collectedQuestions: 221,
    expectedQuestions: 240,
    questionCollectionCompleteness: 92.1,
    validAnswers: 202,
    collectedAnswers: 213,
    collectedAnswerValidity: 94.8,
    status: 'passed_with_warnings',
    warnings: [
      'Kimi有3组问题返回超时，已从趋势比较中排除。',
      '品牌心智快照较GEO数据早3天，跨模块结论需标注日期差。'
    ]
  },
  alerts: [
    { id: 'a1', tone: 'positive', label: '首位推荐率', detail: '相同平台×问题组合较昨日 +4.6%' },
    { id: 'a2', tone: 'warning', label: '引用异常', detail: '发现7条低权威聚合来源' },
    { id: 'a3', tone: 'neutral', label: '机会词', detail: '新增3个高潜力场景词' }
  ],
  recommendations: [
    '补强「智能营销平台对比」官方证据页的可引用结构。',
    '将高质量第三方测评导向品牌核心能力事实。',
    '优先修复Kimi超时问题组，避免趋势样本继续缩小。'
  ]
});

const platformAdjustments = Object.freeze({
  doubao: { score: 3.9, visibility: 5.6, first: 5.3, citation: 2.7, health: 1.8, keyword: 2.4 },
  deepseek: { score: -1.8, visibility: -2.4, first: -3.7, citation: 4.1, health: 0.6, keyword: -0.8 },
  kimi: { score: 1.2, visibility: 1.6, first: 2.4, citation: -1.9, health: -4.2, keyword: 1.1 },
  qwen: { score: -2.7, visibility: -4.4, first: -4.6, citation: -2.4, health: 1.1, keyword: -2.6 }
});

const questionIds = Object.freeze([
  'Q-BRAND-001',
  'Q-COMPARE-014',
  'Q-SCENE-022'
]);

const baseTrend = Object.freeze([
  68.2, 69.4, 70.1, 71.8, 71.2, 73.6, 74.9, 76.1, 75.8, 78.4, 79.7, 82.6
]);

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function adjust(value, delta, digits = 1) {
  return Number(clamp(value + delta).toFixed(digits));
}

function createPlatformDataset(platformId, adjustment) {
  const overview = {
    ...aggregate.overview,
    finalScore: adjust(aggregate.overview.finalScore, adjustment.score),
    geoStructureScore: adjust(aggregate.overview.geoStructureScore, adjustment.score * 0.7),
    geoSemanticScore: adjust(aggregate.overview.geoSemanticScore, adjustment.score * 1.1),
    brandVisibilityRate: adjust(aggregate.overview.brandVisibilityRate, adjustment.visibility),
    firstRecommendationRate: adjust(aggregate.overview.firstRecommendationRate, adjustment.first),
    qualityCitationRate: adjust(aggregate.overview.qualityCitationRate, adjustment.citation),
    dailyDelta: Number((aggregate.overview.dailyDelta + adjustment.score * 0.18).toFixed(1))
  };

  return Object.freeze({
    overview,
    answer: {
      ...aggregate.answer,
      platformAccessibilityRate: adjust(
        aggregate.answer.platformAccessibilityRate,
        adjustment.health
      ),
      questionCollectionCompleteness: adjust(
        aggregate.answer.questionCollectionCompleteness,
        adjustment.health * 0.8
      ),
      collectedAnswerValidity: adjust(
        aggregate.answer.collectedAnswerValidity,
        adjustment.health * 0.6
      ),
      brandMentionRate: overview.brandVisibilityRate,
      firstRecommendationRate: overview.firstRecommendationRate
    },
    citation: {
      ...aggregate.citation,
      totalCitations: Math.round(aggregate.citation.totalCitations / 4 + adjustment.citation * 2.4),
      qualityRate: overview.qualityCitationRate,
      authorityRate: adjust(aggregate.citation.authorityRate, adjustment.citation * 0.7),
      indexedRate: adjust(aggregate.citation.indexedRate, adjustment.health * 0.8)
    },
    keyword: {
      ...aggregate.keyword,
      opportunityScore: adjust(aggregate.keyword.opportunityScore, adjustment.keyword),
      commercialValue: adjust(aggregate.keyword.commercialValue, adjustment.keyword * 0.8)
    },
    dataHealth: {
      ...aggregate.dataHealth,
      availablePlatformCount: 1,
      expectedPlatformCount: 1,
      platformAccessibilityRate: adjust(
        aggregate.dataHealth.platformAccessibilityRate,
        adjustment.health
      ),
      questionCollectionCompleteness: adjust(
        aggregate.dataHealth.questionCollectionCompleteness,
        adjustment.health * 0.8
      ),
      collectedAnswerValidity: adjust(
        aggregate.dataHealth.collectedAnswerValidity,
        adjustment.health * 0.6
      )
    },
    alerts: aggregate.alerts.map((alert, index) => ({
      ...alert,
      id: `${platformId}-${alert.id}`,
      detail: index === 0
        ? `相同平台×问题组合较昨日 ${overview.dailyDelta >= 0 ? '+' : ''}${overview.dailyDelta}%`
        : alert.detail
    })),
    recommendations: aggregate.recommendations
  });
}

const byPlatform = Object.freeze({
  all: aggregate,
  ...Object.fromEntries(
    Object.entries(platformAdjustments).map(([id, adjustment]) => [
      id,
      createPlatformDataset(id, adjustment)
    ])
  )
});

const trends = Object.freeze(
  platformDefinitions
    .filter(({ id }) => id !== 'all')
    .flatMap((platform, platformIndex) => questionIds.map((questionId, questionIndex) => ({
      platform: platform.id,
      questionId,
      label: `${platform.label} · ${questionId}`,
      points: baseTrend.map((value, index) => ({
        date: `07-${String(index + 17).padStart(2, '0')}`,
        value: Number(clamp(
          value
            + (platformIndex - 1.5) * 1.7
            + (questionIndex - 1) * 2.1
            + Math.sin((index + questionIndex) * 0.85) * 1.4
        ).toFixed(1))
      }))
    })))
);

export const geoDashboardMockData = Object.freeze({
  metadata: commonMetadata,
  platforms: platformDefinitions,
  overview: aggregate.overview,
  answer: aggregate.answer,
  citation: aggregate.citation,
  keyword: aggregate.keyword,
  dataHealth: aggregate.dataHealth,
  trends,
  alerts: aggregate.alerts,
  recommendations: aggregate.recommendations,
  byPlatform
});

export function getGeoDashboardDataset(platformId = 'all') {
  return geoDashboardMockData.byPlatform[platformId] ?? geoDashboardMockData.byPlatform.all;
}

export function getGeoDashboardTrend(platformId = 'all', range = '30d') {
  const pointLimit = range === '7d' ? 7 : range === '90d' ? 12 : 10;
  const selected = platformId === 'all'
    ? geoDashboardMockData.trends.filter(({ questionId }) => questionId === questionIds[0])
    : geoDashboardMockData.trends.filter(({ platform }) => platform === platformId);

  return selected.map((series) => ({
    ...series,
    points: series.points.slice(-pointLimit)
  }));
}
