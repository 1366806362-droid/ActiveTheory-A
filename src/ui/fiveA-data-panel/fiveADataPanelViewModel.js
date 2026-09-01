import {
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS,
  SOURCE_TYPES,
  VERIFICATION_STATUSES
} from '../../v2/contracts/brandUniverseContract.js';

const STAGE_NAMES = Object.freeze({
  A1: Object.freeze({ english: 'AWARE', chinese: '认知' }),
  A2: Object.freeze({ english: 'APPEAL', chinese: '吸引' }),
  A3: Object.freeze({ english: 'ASK', chinese: '询问' }),
  A4: Object.freeze({ english: 'ACT', chinese: '行动' }),
  A5: Object.freeze({ english: 'ADVOCATE', chinese: '拥护' })
});

const TRANSITION_LABELS = Object.freeze({
  A1_TO_A2: 'A1 → A2',
  A2_TO_A3: 'A2 → A3',
  A3_TO_A4: 'A3 → A4',
  A4_TO_A5: 'A4 → A5'
});

const DIAGNOSTIC_RULE_VERSION = 'V2_PANEL_DEMO_RULES_1';

export function buildFiveADataPanelViewModel(snapshot) {
  const metadata = snapshot?.metadata ?? {};
  const fiveA = snapshot?.fiveA ?? null;
  const stageValues = Object.keys(FIVE_A_STAGES).map((stageId) => (
    finiteOrNull(fiveA?.stages?.[stageId]?.population?.value)
  ));
  const totalStagePopulation = sumFinite(stageValues);
  const maxStagePopulation = Math.max(...stageValues.filter(Number.isFinite), 0);
  const stageRows = Object.keys(FIVE_A_STAGES).map((stageId, index) => (
    createStageRow(
      stageId,
      fiveA?.stages?.[stageId],
      stageValues[index],
      totalStagePopulation,
      maxStagePopulation
    )
  ));
  const transitionRows = FIVE_A_TRANSITIONS.map((transitionId) => (
    createTransitionRow(transitionId, fiveA?.transitions?.[transitionId], stageRows)
  ));
  const lowestTransition = transitionRows
    .filter((row) => row.conversionRate !== null)
    .sort(compareRateThenId)[0] ?? null;
  const bottleneckStageId = lowestTransition?.toStageId ?? null;

  for (const row of stageRows) {
    row.isBottleneck = row.stageId === bottleneckStageId;
  }
  for (const row of transitionRows) {
    row.isBottleneck = row.transitionId === lowestTransition?.transitionId;
  }

  const opportunityPool = createOpportunityPool(
    fiveA?.opportunityPool,
    totalStagePopulation
  );
  const dataQuality = createDataQuality(fiveA);

  return deepFreeze({
    header: {
      title: '5A 数据表',
      subtitle: 'Five A Journey Data',
      brand: cleanString(metadata.brandId) ?? '未提供',
      snapshotDate: formatSnapshotDate(metadata.capturedAt),
      snapshotId: cleanString(metadata.snapshotId) ?? '未提供',
      sourceType: metadata.sourceType ?? 'UNKNOWN',
      sourceIdentity: getSourceIdentity(snapshot),
      sampleSize: null,
      sampleSizeLabel: '未提供',
      verification: getSnapshotVerification(snapshot),
      isMock: metadata.sourceType === SOURCE_TYPES.MOCK
    },
    stageRows,
    transitionRows,
    opportunityPool,
    diagnostics: createDiagnostics(transitionRows, opportunityPool),
    dataQuality,
    rules: {
      version: DIAGNOSTIC_RULE_VERSION,
      status: 'EXPERIMENTAL',
      note: '瓶颈与诊断仅用于 MOCK 面板演示，不构成正式业务规则。'
    }
  });
}

function createStageRow(stageId, stage, population, totalStagePopulation, maxStagePopulation) {
  const stageName = STAGE_NAMES[stageId];
  const strength = finiteOrNull(stage?.strength?.value);
  const confidence = finiteOrNull(stage?.confidence?.value);
  const percentage = population !== null && totalStagePopulation > 0
    ? population / totalStagePopulation
    : null;

  return {
    stageId,
    stageNameEnglish: stageName.english,
    stageNameChinese: stageName.chinese,
    population,
    populationLabel: formatInteger(population),
    populationRelative: population !== null && maxStagePopulation > 0
      ? population / maxStagePopulation
      : null,
    percentage,
    percentageLabel: formatPercent(percentage),
    percentageBasis: 'DEMO_SUM_OF_STAGE_POPULATIONS',
    strength,
    strengthLabel: formatScore(strength),
    confidence,
    confidenceLabel: formatDecimal(confidence),
    changeVsLast: null,
    changeVsLastLabel: '未提供',
    isBottleneck: false,
    available: Boolean(stage)
  };
}

function createTransitionRow(transitionId, transition, stageRows) {
  const [fromStageId, toStageId] = transitionId.split('_TO_');
  const from = stageRows.find((stage) => stage.stageId === fromStageId);
  const to = stageRows.find((stage) => stage.stageId === toStageId);
  const conversionRate = finiteOrNull(transition?.rate?.value);
  const confidence = finiteOrNull(transition?.confidence?.value);
  const dropOffRate = conversionRate === null ? null : clamp01(1 - conversionRate);

  return {
    transitionId,
    label: TRANSITION_LABELS[transitionId],
    fromStageId,
    toStageId,
    inPopulation: from?.population ?? null,
    inPopulationLabel: formatInteger(from?.population),
    outPopulation: to?.population ?? null,
    outPopulationLabel: formatInteger(to?.population),
    transitionVolume: finiteOrNull(transition?.volume?.value),
    conversionRate,
    conversionRateLabel: formatPercent(conversionRate),
    flowStrength: null,
    flowStrengthLabel: '未提供',
    dropOffRate,
    dropOffRateLabel: formatPercent(dropOffRate),
    confidence,
    confidenceLabel: formatDecimal(confidence),
    changeVsLast: null,
    changeVsLastLabel: '未提供',
    isBottleneck: false,
    available: Boolean(transition)
  };
}

function createOpportunityPool(pool, totalStagePopulation) {
  const volume = finiteOrNull(pool?.volume?.value);
  const strength = finiteOrNull(pool?.strength?.value);
  const confidence = finiteOrNull(pool?.confidence?.value);
  const ratio = volume !== null && totalStagePopulation > 0
    ? volume / totalStagePopulation
    : null;

  return {
    isStage: false,
    volume,
    volumeLabel: formatInteger(volume),
    ratio,
    ratioLabel: formatPercent(ratio),
    ratioBasis: 'DEMO_STAGE_POPULATION_TOTAL',
    strength,
    strengthLabel: formatScore(strength),
    confidence,
    confidenceLabel: formatDecimal(confidence),
    status: volume === null ? 'MISSING' : 'AVAILABLE'
  };
}

function createDiagnostics(transitionRows, opportunityPool) {
  const ranked = transitionRows
    .filter((row) => row.conversionRate !== null)
    .sort(compareRateThenId);
  const diagnostics = ranked.slice(0, 2).map((row, index) => ({
    id: `transition-${row.transitionId}`,
    level: index === 0 ? 'warning' : 'attention',
    title: `${row.label} 流转率偏低`,
    detail: `当前 MOCK 转化率 ${row.conversionRateLabel}，流失率 ${row.dropOffRateLabel}。`,
    sourceRule: DIAGNOSTIC_RULE_VERSION
  }));

  if (opportunityPool.volume !== null) {
    diagnostics.push({
      id: 'opportunity-pool',
      level: 'info',
      title: 'Opportunity Pool 可观测',
      detail: `当前 MOCK 规模 ${opportunityPool.volumeLabel}，占阶段人群合计 ${opportunityPool.ratioLabel}。`,
      sourceRule: DIAGNOSTIC_RULE_VERSION
    });
  }

  return diagnostics.slice(0, 3);
}

function createDataQuality(fiveA) {
  const points = [];
  for (const stageId of Object.keys(FIVE_A_STAGES)) {
    const stage = fiveA?.stages?.[stageId];
    points.push(stage?.population, stage?.strength, stage?.confidence);
  }
  for (const transitionId of FIVE_A_TRANSITIONS) {
    const transition = fiveA?.transitions?.[transitionId];
    points.push(transition?.volume, transition?.rate, transition?.confidence);
  }
  points.push(
    fiveA?.opportunityPool?.volume,
    fiveA?.opportunityPool?.strength,
    fiveA?.opportunityPool?.confidence
  );
  const available = points.filter((point) => finiteOrNull(point?.value) !== null).length;
  const completeness = points.length ? available / points.length : 0;

  return {
    status: 'MOCK_STRUCTURE_CHECK',
    productionScore: false,
    metrics: [
      { id: 'completeness', label: '结构完整度', value: completeness, valueLabel: formatPercent(completeness), available: true },
      { id: 'consistency', label: '一致性', value: null, valueLabel: '未提供', available: false },
      { id: 'validity', label: '有效性', value: null, valueLabel: '未提供', available: false },
      { id: 'timeliness', label: '及时性', value: null, valueLabel: '未提供', available: false }
    ]
  };
}

function getSnapshotVerification(snapshot) {
  const statuses = new Set();
  visitDataPoints(snapshot?.fiveA, (point) => statuses.add(point.verificationStatus));
  if (statuses.has(VERIFICATION_STATUSES.SYNTHETIC)) return 'SYNTHETIC';
  if (statuses.has(VERIFICATION_STATUSES.UNVERIFIED)) return 'UNVERIFIED';
  if (statuses.has(VERIFICATION_STATUSES.ESTIMATED)) return 'ESTIMATED';
  if (statuses.has(VERIFICATION_STATUSES.VERIFIED)) return 'VERIFIED';
  return 'MISSING';
}

function getSourceIdentity(snapshot) {
  const sourceType = snapshot?.metadata?.sourceType ?? 'UNKNOWN';
  const verification = getSnapshotVerification(snapshot);
  return `${sourceType} / ${verification}`;
}

function visitDataPoints(value, callback) {
  if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value, 'verificationStatus') && Object.hasOwn(value, 'value')) {
    callback(value);
    return;
  }
  Object.values(value).forEach((child) => visitDataPoints(child, callback));
}

function compareRateThenId(left, right) {
  return left.conversionRate - right.conversionRate
    || left.transitionId.localeCompare(right.transitionId);
}

function sumFinite(values) {
  return values.reduce((sum, value) => sum + (value ?? 0), 0);
}

function formatSnapshotDate(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return '未提供';
  return value.slice(0, 10);
}

function formatInteger(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '未提供';
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '未提供';
}

function formatScore(value) {
  return Number.isFinite(value) ? value.toFixed(0) : '未提供';
}

function formatDecimal(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '未提供';
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
