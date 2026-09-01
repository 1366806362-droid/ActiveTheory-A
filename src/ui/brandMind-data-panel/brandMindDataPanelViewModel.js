import {
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  deepFreeze
} from '../../v2/contracts/brandUniverseContract.js';
import {
  BRAND_MIND_DERIVATION_VERSION,
  deriveBrandMindMetrics
} from '../../v2/derived/deriveBrandMindMetrics.js';

const ALLOWED_ASSOCIATION_STATUSES = Object.freeze([
  'CORE',
  'GROWING',
  'STABLE',
  'WEAKENING',
  'EMERGING',
  'LOST'
]);
const RELATIONSHIP_LIMIT = 5;
const DIAGNOSTIC_RULE_VERSION = 'V2_BRAND_MIND_PANEL_DEMO_RULES_1';
const PRODUCT_RULE_VERSION = 'V2_BRAND_MIND_PANEL_PRODUCT_RULES_1';

export function buildBrandMindDataPanelViewModel(
  snapshot,
  derivedMetrics = deriveBrandMindMetrics(snapshot)
) {
  const metadata = snapshot?.metadata ?? {};
  const brandMind = snapshot?.brandMind ?? null;
  const associationRows = buildAssociationRows(
    brandMind?.associations,
    derivedMetrics?.associations
  );
  const relationshipRows = buildRelationshipRows(brandMind, associationRows);
  const coreMetrics = buildCoreMetrics(brandMind?.core, associationRows);
  const mindDrift = buildMindDrift(associationRows, derivedMetrics?.driftSummary);
  const coreStatus = presentCoreStatus(derivedMetrics?.coreStatus);
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
      completeness: metadata.completeness ?? 'UNKNOWN',
      lineage: { ...(metadata.lineage ?? {}) },
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
    opportunityInsights: presentOpportunityInsights(
      derivedMetrics?.opportunitySignals,
      associationRows,
      sourceIdentity
    ),
    diagnostics: presentDiagnostics(
      derivedMetrics?.diagnosticSignals,
      coreMetrics,
      associationRows
    ),
    dataQuality: buildDataQuality(brandMind, snapshot),
    rules: {
      version: DIAGNOSTIC_RULE_VERSION,
      productVersion: derivedMetrics?.version ?? BRAND_MIND_DERIVATION_VERSION,
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

const CORE_STATUS_PRESENTATION = Object.freeze({
  STABLE: Object.freeze({ label: '稳定型', description: '心智结构处于稳定区间，未出现显著迁移。' }),
  CONCENTRATED: Object.freeze({ label: '集中型', description: '核心心智集中度较高，主要认知聚合清晰。' }),
  DISTRIBUTED: Object.freeze({ label: '分布型', description: '核心心智集中度较低，关联认知相对分散。' }),
  SHIFTING: Object.freeze({ label: '迁移中', description: '核心或多项外围关联正在发生显著变化。' }),
  NOT_PROVIDED: Object.freeze({ label: '未提供', description: '缺少心智集中度或稳定度，无法判定心智状态。' })
});

function presentCoreStatus(code) {
  const safeCode = Object.hasOwn(CORE_STATUS_PRESENTATION, code) ? code : 'NOT_PROVIDED';
  return {
    code: safeCode,
    ...CORE_STATUS_PRESENTATION[safeCode],
    ruleVersion: BRAND_MIND_DERIVATION_VERSION
  };
}

function presentOpportunityInsights(signals, associations, sourceIdentity) {
  const associationById = new Map(associations.map((row) => [row.id, row]));
  return (Array.isArray(signals) ? signals : []).map((signal) => {
    const row = associationById.get(signal.associationId);
    if (signal.type === 'STRENGTHEN') {
      return {
        id: `strengthen-${signal.associationId}`,
        type: signal.type,
        title: `强化“${row?.association ?? signal.associationId}”核心联想`,
        detail: `强度 ${row?.strengthLabel ?? '未提供'}、置信度 ${row?.confidenceLabel ?? '未提供'}，适合优先验证强化。`
      };
    }
    if (signal.type === 'GROWTH') {
      return {
        id: `growth-${signal.associationId}`,
        type: signal.type,
        title: `放大“${row?.association ?? signal.associationId}”增长信号`,
        detail: `较上期 ${row?.changeVsLastLabel ?? '未提供'}，可验证其场景与传播驱动。`
      };
    }
    return {
      id: `defend-${signal.associationId}`,
      type: signal.type,
      title: `防御“${row?.association ?? signal.associationId}”认知下滑`,
      detail: `较上期 ${row?.changeVsLastLabel ?? '未提供'}，需核验下降来源并保护关联。`
    };
  }).map((insight) => ({
    ...insight,
    sourceIdentity,
    sourceRule: BRAND_MIND_DERIVATION_VERSION
  }));
}

function buildAssociationRows(associations, derivedAssociations) {
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
      driftStatus: derivedAssociations?.[association?.id]?.driftStatus ?? null,
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

function buildMindDrift(associations, driftSummary) {
  if (!driftSummary?.available) {
    return {
      available: false,
      status: 'NOT PROVIDED',
      categories: ALLOWED_ASSOCIATION_STATUSES
        .filter((status) => status !== 'CORE')
        .map((status) => ({ status, count: null, countLabel: '未提供' })),
      rows: []
    };
  }

  const categories = ['EMERGING', 'GROWING', 'STABLE', 'WEAKENING', 'LOST'].map((status) => ({
    status,
    count: driftSummary.categories?.[status] ?? 0,
    countLabel: formatInteger(driftSummary.categories?.[status] ?? 0)
  }));
  const associationById = new Map(associations.map((row) => [row.id, row]));
  const rows = (driftSummary.orderedAssociationIds ?? [])
    .map((id) => associationById.get(id))
    .filter(Boolean)
    .slice(0, 5);

  return { available: true, status: 'SYNTHETIC', categories, rows };
}

function presentDiagnostics(signals, core, associations) {
  const associationById = new Map(associations.map((row) => [row.id, row]));
  return (Array.isArray(signals) ? signals : []).map((signal) => {
    const row = associationById.get(signal.associationId);
    if (signal.type === 'LOW_CORE_CONCENTRATION') return {
      id: 'core-concentration',
      level: 'attention',
      title: '核心心智集中度偏低',
      detail: `当前集中度 ${core.concentrationLabel}，关联结构相对分散。`
    };
    if (signal.type === 'STRONGEST_ASSOCIATION') return {
      id: 'strongest-association',
      level: 'info',
      title: `${row?.association ?? signal.associationId}为当前首要关联`,
      detail: `关联强度 ${row?.strengthLabel ?? '未提供'}，权重 ${row?.weightLabel ?? '未提供'}。`
    };
    if (signal.type === 'FASTEST_GROWING') return {
      id: 'fastest-growing',
      level: 'positive',
      title: `${row?.association ?? signal.associationId}增长最快`,
      detail: `较上期变化 ${row?.changeVsLastLabel ?? '未提供'}。`
    };
    if (signal.type === 'WEAKENING_ASSOCIATION') return {
      id: 'weakening-association',
      level: 'warning',
      title: `${row?.association ?? signal.associationId}关联走弱`,
      detail: `较上期变化 ${row?.changeVsLastLabel ?? '未提供'}。`
    };
    return {
      id: 'history-missing',
      level: 'warning',
      title: '心智历史对比未提供',
      detail: '当前快照不能判断新增、增长、衰减或消失。'
    };
  }).map((item) => ({
    ...item,
    sourceRule: BRAND_MIND_DERIVATION_VERSION
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
