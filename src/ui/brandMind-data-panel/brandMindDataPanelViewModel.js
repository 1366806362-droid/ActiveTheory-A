import {
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  deepFreeze
} from '../../v2/contracts/brandUniverseContract.js';

const ALLOWED_ASSOCIATION_STATUSES = Object.freeze([
  'CORE',
  'GROWING',
  'STABLE',
  'WEAKENING',
  'EMERGING',
  'LOST'
]);
const RELATIONSHIP_LIMIT = 5;
const OPPORTUNITY_LIMIT = 3;
const DIAGNOSTIC_RULE_VERSION = 'V2_BRAND_MIND_PANEL_DEMO_RULES_1';
const PRODUCT_RULE_VERSION = 'V2_BRAND_MIND_PANEL_PRODUCT_RULES_1';

export const BRAND_MIND_CORE_STATUS_RULES = Object.freeze({
  shiftingCoreChange: 0.06,
  shiftingAssociationChange: 0.06,
  concentratedMinimum: 0.68,
  distributedMaximum: 0.55,
  stableMinimum: 0.72
});

export const BRAND_MIND_OPPORTUNITY_RULES = Object.freeze({
  strengthenStrengthMinimum: 0.7,
  strengthenConfidenceMinimum: 0.8,
  growthChangeMinimum: 0.04,
  defendChangeMaximum: -0.01,
  defendStrengthMinimum: 0.4,
  historyConfidenceMinimum: 0.7
});

export function buildBrandMindDataPanelViewModel(snapshot) {
  const metadata = snapshot?.metadata ?? {};
  const brandMind = snapshot?.brandMind ?? null;
  const associationRows = buildAssociationRows(brandMind?.associations);
  const relationshipRows = buildRelationshipRows(brandMind, associationRows);
  const coreMetrics = buildCoreMetrics(brandMind?.core, associationRows);
  const mindDrift = buildMindDrift(brandMind, associationRows);
  const coreStatus = buildCoreStatus(coreMetrics, associationRows, mindDrift.available);
  const sourceIdentity = getSourceIdentity(snapshot);

  return deepFreeze({
    header: {
      title: '品牌心智数据表',
      subtitle: 'Brand Mind Data',
      brand: cleanString(metadata.brandId) ?? '未提供',
      snapshotDate: formatSnapshotDate(metadata.capturedAt),
      snapshotId: cleanString(metadata.snapshotId) ?? '未提供',
      sourceType: metadata.sourceType ?? 'UNKNOWN',
      sourceIdentity: getSourceIdentity(snapshot),
      sampleSize: null,
      sampleSizeLabel: '未提供',
      verification: getSnapshotVerification(snapshot),
      isMock: metadata.sourceType === SOURCE_TYPES.MOCK,
      isPartial: metadata.sourceType === SOURCE_TYPES.PARTIAL
    },
    coreMetrics,
    coreStatus,
    associationRows,
    relationshipRows,
    mindDrift,
    opportunityInsights: buildOpportunityInsights(associationRows, mindDrift.available, sourceIdentity),
    diagnostics: buildDiagnostics(coreMetrics, associationRows, mindDrift),
    dataQuality: buildDataQuality(brandMind, snapshot),
    rules: {
      version: DIAGNOSTIC_RULE_VERSION,
      productVersion: PRODUCT_RULE_VERSION,
      status: 'EXPERIMENTAL',
      note: '诊断仅解释当前数据结构；MOCK / SYNTHETIC 不代表生产结论。'
    }
  });
}

function buildCoreMetrics(core, associations) {
  const strength = normalizeScore(readValue(core?.strength));
  const concentration = normalizeScore(readValue(core?.concentration));
  const coverage = normalizeUnit(readValue(core?.coverage));
  const stability = normalizeUnit(readValue(core?.stability));
  const confidence = normalizeUnit(readValue(core?.confidence));
  const changeVsLast = normalizeSignedUnit(readValue(core?.changeVsLast));

  return {
    strength,
    strengthLabel: formatDecimal(strength),
    concentration,
    concentrationLabel: formatDecimal(concentration),
    coverage,
    coverageLabel: formatPercent(coverage),
    associationCount: associations.length,
    associationCountLabel: formatInteger(associations.length),
    stability,
    stabilityLabel: formatDecimal(stability),
    confidence,
    confidenceLabel: formatDecimal(confidence),
    changeVsLast,
    changeVsLastLabel: formatSignedPercent(changeVsLast)
  };
}

function buildCoreStatus(core, associations, historyAvailable) {
  if (core.concentration === null || core.stability === null) {
    return {
      code: 'NOT_PROVIDED',
      label: '未提供',
      description: '缺少心智集中度或稳定度，无法判定心智状态。',
      ruleVersion: PRODUCT_RULE_VERSION
    };
  }

  const significantAssociationChanges = historyAvailable
    ? associations.filter((row) => (
      row.status !== 'CORE'
      && row.changeVsLast !== null
      && Math.abs(row.changeVsLast) >= BRAND_MIND_CORE_STATUS_RULES.shiftingAssociationChange
    )).length
    : 0;
  const shifting = historyAvailable && (
    Math.abs(core.changeVsLast ?? 0) >= BRAND_MIND_CORE_STATUS_RULES.shiftingCoreChange
    || significantAssociationChanges >= 2
  );

  if (shifting) {
    return coreStatus('SHIFTING', '迁移中', '核心或多项外围关联正在发生显著变化。');
  }
  if (core.concentration >= BRAND_MIND_CORE_STATUS_RULES.concentratedMinimum) {
    return coreStatus('CONCENTRATED', '集中型', '核心心智集中度较高，主要认知聚合清晰。');
  }
  if (core.concentration < BRAND_MIND_CORE_STATUS_RULES.distributedMaximum) {
    return coreStatus('DISTRIBUTED', '分布型', '核心心智集中度较低，关联认知相对分散。');
  }
  if (core.stability >= BRAND_MIND_CORE_STATUS_RULES.stableMinimum) {
    return coreStatus('STABLE', '稳定型', '心智结构处于稳定区间，未出现显著迁移。');
  }
  return coreStatus('SHIFTING', '迁移中', '稳定度未达到稳定区间，需持续观察心智变化。');
}

function coreStatus(code, label, description) {
  return { code, label, description, ruleVersion: PRODUCT_RULE_VERSION };
}

function buildOpportunityInsights(associations, historyAvailable, sourceIdentity) {
  const insights = [];
  const strengthen = associations
    .filter((row) => (
      row.status === 'CORE'
      && row.strength !== null
      && row.strength >= BRAND_MIND_OPPORTUNITY_RULES.strengthenStrengthMinimum
      && row.confidence !== null
      && row.confidence >= BRAND_MIND_OPPORTUNITY_RULES.strengthenConfidenceMinimum
    ))
    .sort(compareAssociationRows)[0];
  const growth = historyAvailable
    ? associations
      .filter((row) => (
        row.changeVsLast !== null
        && row.changeVsLast >= BRAND_MIND_OPPORTUNITY_RULES.growthChangeMinimum
        && row.confidence !== null
        && row.confidence >= BRAND_MIND_OPPORTUNITY_RULES.historyConfidenceMinimum
      ))
      .sort((left, right) => right.changeVsLast - left.changeVsLast || compareAssociationRows(left, right))[0]
    : null;
  const defend = historyAvailable
    ? associations
      .filter((row) => (
        row.changeVsLast !== null
        && row.changeVsLast <= BRAND_MIND_OPPORTUNITY_RULES.defendChangeMaximum
        && row.strength !== null
        && row.strength >= BRAND_MIND_OPPORTUNITY_RULES.defendStrengthMinimum
        && row.confidence !== null
        && row.confidence >= BRAND_MIND_OPPORTUNITY_RULES.historyConfidenceMinimum
      ))
      .sort((left, right) => left.changeVsLast - right.changeVsLast || compareAssociationRows(left, right))[0]
    : null;

  if (strengthen) {
    insights.push({
      id: `strengthen-${strengthen.id}`,
      type: 'STRENGTHEN',
      title: `强化“${strengthen.association}”核心联想`,
      detail: `强度 ${strengthen.strengthLabel}、置信度 ${strengthen.confidenceLabel}，适合优先验证强化。`
    });
  }
  if (growth) {
    insights.push({
      id: `growth-${growth.id}`,
      type: 'GROWTH',
      title: `放大“${growth.association}”增长信号`,
      detail: `较上期 ${growth.changeVsLastLabel}，可验证其场景与传播驱动。`
    });
  }
  if (defend) {
    insights.push({
      id: `defend-${defend.id}`,
      type: 'DEFEND',
      title: `防御“${defend.association}”认知下滑`,
      detail: `较上期 ${defend.changeVsLastLabel}，需核验下降来源并保护关联。`
    });
  }

  return insights.slice(0, OPPORTUNITY_LIMIT).map((insight) => ({
    ...insight,
    sourceIdentity,
    sourceRule: PRODUCT_RULE_VERSION
  }));
}

function buildAssociationRows(associations) {
  const safeAssociations = Array.isArray(associations) ? associations : [];
  const weights = safeAssociations.map((association) => readValue(association?.weight));
  const totalWeight = weights.reduce((sum, value) => sum + (value ?? 0), 0);

  return safeAssociations.map((association, index) => {
    const weight = weights[index];
    const explicitStrength = readValue(association?.strength);
    const strength = explicitStrength === null
      ? normalizeScore(weight)
      : normalizeUnit(explicitStrength);
    const explicitShare = normalizeUnit(readValue(association?.share));
    const share = explicitShare ?? (
      weight !== null && totalWeight > 0 ? weight / totalWeight : null
    );
    const confidence = normalizeUnit(readValue(association?.confidence));
    const changeVsLast = normalizeSignedUnit(readValue(association?.changeVsLast));
    const status = ALLOWED_ASSOCIATION_STATUSES.includes(association?.status)
      ? association.status
      : 'NOT_PROVIDED';

    return {
      id: cleanString(association?.id) ?? `association-${index + 1}`,
      association: cleanString(association?.label) ?? '未提供',
      category: cleanString(association?.category) ?? '未提供',
      strength,
      strengthLabel: formatDecimal(strength),
      weight: share,
      weightLabel: formatPercent(share),
      mentions: readValue(association?.mentions),
      mentionsLabel: formatInteger(readValue(association?.mentions)),
      confidence,
      confidenceLabel: formatDecimal(confidence),
      changeVsLast,
      changeVsLastLabel: formatSignedPercent(changeVsLast),
      status,
      available: Boolean(association)
    };
  }).sort(compareAssociationRows).map((row, rankIndex) => ({
    ...row,
    rank: rankIndex + 1,
    isTopAssociation: rankIndex < 2
  }));
}

function buildRelationshipRows(brandMind, associations) {
  const explicitRelationships = Array.isArray(brandMind?.relationships)
    ? brandMind.relationships
    : [];
  const associationById = new Map(associations.map((row) => [row.id, row]));
  const relationshipSource = explicitRelationships.length
    ? explicitRelationships.map((relationship, index) => ({
      id: cleanString(relationship?.id) ?? `relationship-${index + 1}`,
      sourceId: cleanString(relationship?.sourceId),
      targetId: cleanString(relationship?.targetId),
      strength: normalizeUnit(readValue(relationship?.strength)),
      confidence: normalizeUnit(readValue(relationship?.confidence)),
      changeVsLast: normalizeSignedUnit(readValue(relationship?.changeVsLast)),
      corePath: Boolean(relationship?.corePath)
    }))
    : associations.map((association) => ({
      id: `brand-core--${association.id}`,
      sourceId: 'brand-core',
      targetId: association.id,
      strength: association.strength,
      confidence: association.confidence,
      changeVsLast: association.changeVsLast,
      corePath: association.isTopAssociation
    }));

  return relationshipSource
    .filter((relationship) => relationship.sourceId && relationship.targetId)
    .map((relationship) => ({
      ...relationship,
      sourceLabel: resolveNodeLabel(relationship.sourceId, associationById),
      targetLabel: resolveNodeLabel(relationship.targetId, associationById),
      strengthLabel: formatDecimal(relationship.strength),
      confidenceLabel: formatDecimal(relationship.confidence),
      changeVsLastLabel: formatSignedPercent(relationship.changeVsLast)
    }))
    .sort(compareRelationshipRows)
    .slice(0, RELATIONSHIP_LIMIT);
}

function buildMindDrift(brandMind, associations) {
  const historyAvailable = Boolean(brandMind?.history?.available);

  if (!historyAvailable) {
    return {
      available: false,
      status: 'NOT PROVIDED',
      categories: ALLOWED_ASSOCIATION_STATUSES
        .filter((status) => status !== 'CORE')
        .map((status) => ({ status, count: null, countLabel: '未提供' })),
      rows: []
    };
  }

  const categorizedAssociations = associations.map((row) => ({
    ...row,
    driftStatus: deriveDriftStatus(row)
  }));
  const categories = ['EMERGING', 'GROWING', 'STABLE', 'WEAKENING', 'LOST'].map((status) => ({
    status,
    count: categorizedAssociations.filter((row) => row.driftStatus === status).length,
    countLabel: formatInteger(categorizedAssociations.filter((row) => row.driftStatus === status).length)
  }));
  const rows = associations
    .filter((row) => row.changeVsLast !== null)
    .sort((left, right) => (
      Math.abs(right.changeVsLast) - Math.abs(left.changeVsLast)
      || left.id.localeCompare(right.id)
    ))
    .slice(0, 5);

  return { available: true, status: 'SYNTHETIC', categories, rows };
}

function deriveDriftStatus(row) {
  if (row.status !== 'CORE') return row.status;
  if (row.changeVsLast === null) return 'STABLE';
  if (row.changeVsLast >= 0.03) return 'GROWING';
  if (row.changeVsLast <= -0.01) return 'WEAKENING';
  return 'STABLE';
}

function buildDiagnostics(core, associations, mindDrift) {
  const diagnostics = [];
  const strongest = associations[0];
  const fastestGrowing = associations
    .filter((row) => row.changeVsLast !== null && row.changeVsLast > 0)
    .sort((left, right) => right.changeVsLast - left.changeVsLast)[0];
  const weakening = associations
    .filter((row) => row.changeVsLast !== null && row.changeVsLast < 0)
    .sort((left, right) => left.changeVsLast - right.changeVsLast)[0];

  if (core.concentration !== null && core.concentration < 0.55) {
    diagnostics.push({
      id: 'core-concentration',
      level: 'attention',
      title: '核心心智集中度偏低',
      detail: `当前集中度 ${core.concentrationLabel}，关联结构相对分散。`
    });
  } else if (strongest) {
    diagnostics.push({
      id: 'strongest-association',
      level: 'info',
      title: `${strongest.association}为当前首要关联`,
      detail: `关联强度 ${strongest.strengthLabel}，权重 ${strongest.weightLabel}。`
    });
  }
  if (fastestGrowing) {
    diagnostics.push({
      id: 'fastest-growing',
      level: 'positive',
      title: `${fastestGrowing.association}增长最快`,
      detail: `SYNTHETIC 较上期变化 ${fastestGrowing.changeVsLastLabel}。`
    });
  }
  if (weakening) {
    diagnostics.push({
      id: 'weakening-association',
      level: 'warning',
      title: `${weakening.association}关联走弱`,
      detail: `SYNTHETIC 较上期变化 ${weakening.changeVsLastLabel}。`
    });
  }
  if (!mindDrift.available) {
    diagnostics.push({
      id: 'history-missing',
      level: 'warning',
      title: '心智历史对比未提供',
      detail: '当前快照不能判断新增、增长、衰减或消失。'
    });
  }

  return diagnostics.slice(0, 3).map((item) => ({
    ...item,
    sourceRule: DIAGNOSTIC_RULE_VERSION
  }));
}

function buildDataQuality(brandMind, snapshot) {
  const points = [];
  visitDataPoints(brandMind, (point) => points.push(point));
  const available = points.filter((point) => readValue(point) !== null).length;
  const completeness = points.length ? available / points.length : null;

  return {
    status: snapshot?.metadata?.sourceType === SOURCE_TYPES.MOCK
      ? 'MOCK_STRUCTURE_CHECK'
      : 'NOT PROVIDED',
    productionScore: false,
    metrics: [
      { id: 'completeness', label: '结构完整度', value: completeness, valueLabel: formatPercent(completeness), available: completeness !== null },
      { id: 'consistency', label: '一致性', value: null, valueLabel: '未提供', available: false },
      { id: 'validity', label: '有效性', value: null, valueLabel: '未提供', available: false },
      { id: 'timeliness', label: '及时性', value: null, valueLabel: '未提供', available: false },
      { id: 'verification', label: '数据核验', value: null, valueLabel: getSnapshotVerification(snapshot), available: true }
    ]
  };
}

function getSnapshotVerification(snapshot) {
  const statuses = new Set();
  visitDataPoints(snapshot?.brandMind, (point) => statuses.add(point.verificationStatus));
  if (statuses.has(VERIFICATION_STATUSES.SYNTHETIC)) return 'SYNTHETIC';
  if (statuses.has(VERIFICATION_STATUSES.UNVERIFIED)) return 'UNVERIFIED';
  if (statuses.has(VERIFICATION_STATUSES.ESTIMATED)) return 'ESTIMATED';
  if (statuses.has(VERIFICATION_STATUSES.VERIFIED)) return 'VERIFIED';
  return 'MISSING';
}

function getSourceIdentity(snapshot) {
  return `${snapshot?.metadata?.sourceType ?? 'UNKNOWN'} / ${getSnapshotVerification(snapshot)}`;
}

function resolveNodeLabel(nodeId, associationById) {
  if (nodeId === 'brand-core') return '品牌核心';
  return associationById.get(nodeId)?.association ?? nodeId;
}

function compareAssociationRows(left, right) {
  return (right.strength ?? -1) - (left.strength ?? -1)
    || left.id.localeCompare(right.id);
}

function compareRelationshipRows(left, right) {
  return (right.strength ?? -1) - (left.strength ?? -1)
    || left.id.localeCompare(right.id);
}

function readValue(point) {
  const value = point?.value;
  return Number.isFinite(value) ? value : null;
}

function normalizeScore(value) {
  if (!Number.isFinite(value)) return null;
  return clamp01(value > 1 ? value / 100 : value);
}

function normalizeUnit(value) {
  return Number.isFinite(value) ? clamp01(value) : null;
}

function normalizeSignedUnit(value) {
  return Number.isFinite(value) ? Math.min(Math.max(value, -1), 1) : null;
}

function visitDataPoints(value, callback) {
  if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value, 'value') && Object.hasOwn(value, 'verificationStatus')) {
    callback(value);
    return;
  }
  Object.values(value).forEach((child) => visitDataPoints(child, callback));
}

function formatSnapshotDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? value.slice(0, 10)
    : '未提供';
}

function formatInteger(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '未提供';
}

function formatDecimal(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '未提供';
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '未提供';
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return '未提供';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}
