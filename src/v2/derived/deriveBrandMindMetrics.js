import { deepFreeze } from '../contracts/brandUniverseContract.js';

export const BRAND_MIND_DERIVATION_VERSION = 'V2_1_BRAND_MIND_DERIVED_1';

export const BRAND_MIND_DERIVATION_RULES = Object.freeze({
  shiftingCoreChange: 0.06,
  shiftingAssociationChange: 0.06,
  concentratedMinimum: 0.68,
  distributedMaximum: 0.55,
  stableMinimum: 0.72,
  strengthenStrengthMinimum: 0.7,
  strengthenConfidenceMinimum: 0.8,
  growthChangeMinimum: 0.04,
  defendChangeMaximum: -0.01,
  defendStrengthMinimum: 0.4,
  historyConfidenceMinimum: 0.7
});

export function deriveBrandMindMetrics(snapshot) {
  const brandMind = snapshot?.brandMind;
  if (!brandMind) return deepFreeze({ available: false, version: BRAND_MIND_DERIVATION_VERSION });

  const associations = (Array.isArray(brandMind.associations) ? brandMind.associations : []).map((association) => ({
    id: association.id,
    strength: unit(read(association.strength) ?? read(association.weight)),
    confidence: unit(read(association.confidence)),
    changeVsLast: signed(read(association.changeVsLast)),
    sourceStatus: typeof association.status === 'string' ? association.status : null
  }));
  const historyAvailable = brandMind.history?.available === true;
  const core = {
    concentration: unit(read(brandMind.core?.concentration)),
    stability: unit(read(brandMind.core?.stability)),
    changeVsLast: signed(read(brandMind.core?.changeVsLast))
  };

  const coreStatus = deriveCoreStatus(core, associations, historyAvailable);
  const derivedAssociations = associations.map((association) => ({
    ...association,
    driftStatus: historyAvailable ? deriveDriftStatus(association) : null
  }));

  return deepFreeze({
    available: true,
    version: BRAND_MIND_DERIVATION_VERSION,
    coreStatus,
    associations: Object.fromEntries(derivedAssociations.map((association) => [
      association.id,
      {
        sourceStatus: association.sourceStatus,
        driftStatus: association.driftStatus
      }
    ])),
    opportunitySignals: deriveOpportunitySignals(derivedAssociations, historyAvailable),
    diagnosticSignals: deriveDiagnosticSignals(core, derivedAssociations, historyAvailable),
    driftSummary: {
      available: historyAvailable,
      changedAssociationCount: historyAvailable
        ? derivedAssociations.filter((item) => item.changeVsLast !== null).length
        : null,
      categories: historyAvailable
        ? countStatuses(derivedAssociations)
        : null,
      orderedAssociationIds: historyAvailable
        ? derivedAssociations
          .filter((item) => item.changeVsLast !== null)
          .sort((left, right) => (
            Math.abs(right.changeVsLast) - Math.abs(left.changeVsLast)
            || left.id.localeCompare(right.id)
          ))
          .map((item) => item.id)
        : []
    }
  });
}

function deriveCoreStatus(core, associations, historyAvailable) {
  if (core.concentration === null || core.stability === null) return 'NOT_PROVIDED';
  const significantChanges = historyAvailable
    ? associations.filter((item) => (
      item.sourceStatus !== 'CORE'
      && item.changeVsLast !== null
      && Math.abs(item.changeVsLast) >= BRAND_MIND_DERIVATION_RULES.shiftingAssociationChange
    )).length
    : 0;
  if (historyAvailable && (
    Math.abs(core.changeVsLast ?? 0) >= BRAND_MIND_DERIVATION_RULES.shiftingCoreChange
    || significantChanges >= 2
  )) return 'SHIFTING';
  if (core.concentration >= BRAND_MIND_DERIVATION_RULES.concentratedMinimum) return 'CONCENTRATED';
  if (core.concentration < BRAND_MIND_DERIVATION_RULES.distributedMaximum) return 'DISTRIBUTED';
  if (core.stability >= BRAND_MIND_DERIVATION_RULES.stableMinimum) return 'STABLE';
  return 'SHIFTING';
}

function deriveOpportunitySignals(associations, historyAvailable) {
  const signals = [];
  const strengthen = associations
    .filter((item) => item.sourceStatus === 'CORE'
      && item.strength >= BRAND_MIND_DERIVATION_RULES.strengthenStrengthMinimum
      && item.confidence >= BRAND_MIND_DERIVATION_RULES.strengthenConfidenceMinimum)
    .sort(compareStrength)[0];
  const growth = historyAvailable ? associations
    .filter((item) => item.changeVsLast >= BRAND_MIND_DERIVATION_RULES.growthChangeMinimum
      && item.confidence >= BRAND_MIND_DERIVATION_RULES.historyConfidenceMinimum)
    .sort((left, right) => right.changeVsLast - left.changeVsLast || compareStrength(left, right))[0] : null;
  const defend = historyAvailable ? associations
    .filter((item) => item.changeVsLast <= BRAND_MIND_DERIVATION_RULES.defendChangeMaximum
      && item.strength >= BRAND_MIND_DERIVATION_RULES.defendStrengthMinimum
      && item.confidence >= BRAND_MIND_DERIVATION_RULES.historyConfidenceMinimum)
    .sort((left, right) => left.changeVsLast - right.changeVsLast || compareStrength(left, right))[0] : null;
  if (strengthen) signals.push({ type: 'STRENGTHEN', associationId: strengthen.id });
  if (growth) signals.push({ type: 'GROWTH', associationId: growth.id });
  if (defend) signals.push({ type: 'DEFEND', associationId: defend.id });
  return signals.slice(0, 3);
}

function deriveDriftStatus(association) {
  if (association.sourceStatus && association.sourceStatus !== 'CORE') {
    return association.sourceStatus;
  }
  if (association.changeVsLast === null) return 'STABLE';
  if (association.changeVsLast >= 0.03) return 'GROWING';
  if (association.changeVsLast <= -0.01) return 'WEAKENING';
  return 'STABLE';
}

function deriveDiagnosticSignals(core, associations, historyAvailable) {
  const signals = [];
  const strongest = [...associations].sort(compareStrength)[0];
  const fastestGrowing = historyAvailable
    ? associations
      .filter((item) => item.changeVsLast !== null && item.changeVsLast > 0)
      .sort((left, right) => right.changeVsLast - left.changeVsLast || compareStrength(left, right))[0]
    : null;
  const weakening = historyAvailable
    ? associations
      .filter((item) => item.changeVsLast !== null && item.changeVsLast < 0)
      .sort((left, right) => left.changeVsLast - right.changeVsLast || compareStrength(left, right))[0]
    : null;

  if (core.concentration !== null && core.concentration < 0.55) {
    signals.push({ type: 'LOW_CORE_CONCENTRATION' });
  } else if (strongest) {
    signals.push({ type: 'STRONGEST_ASSOCIATION', associationId: strongest.id });
  }
  if (fastestGrowing) signals.push({ type: 'FASTEST_GROWING', associationId: fastestGrowing.id });
  if (weakening) signals.push({ type: 'WEAKENING_ASSOCIATION', associationId: weakening.id });
  if (!historyAvailable) signals.push({ type: 'HISTORY_MISSING' });
  return signals.slice(0, 3);
}

function countStatuses(associations) {
  return Object.fromEntries(['EMERGING', 'GROWING', 'STABLE', 'WEAKENING', 'LOST'].map((status) => [
    status,
    associations.filter((item) => item.driftStatus === status).length
  ]));
}

function compareStrength(left, right) {
  return (right.strength ?? -1) - (left.strength ?? -1) || left.id.localeCompare(right.id);
}

function read(point) {
  return Number.isFinite(point?.value) ? point.value : null;
}

function unit(value) {
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(value > 1 ? value / 100 : value, 0), 1);
}

function signed(value) {
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(value, -1), 1);
}
