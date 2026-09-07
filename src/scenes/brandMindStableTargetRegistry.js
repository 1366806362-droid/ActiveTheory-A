export const BRAND_MIND_STABLE_TARGET_REGISTRY_VERSION = '1.0.0';

export function createBrandMindStableTargetRegistry() {
  const associationSlots = new Map();
  const relationshipSlots = new Map();
  const associationTargets = new Map();
  const relationshipTargets = new Map();
  let disposed = false;

  function registerAssociationSlot(slotId, target) {
    assertActive();
    registerSlot(associationSlots, slotId, target, 'association');
  }

  function registerRelationshipSlot(slotId, target) {
    assertActive();
    registerSlot(relationshipSlots, slotId, target, 'relationship');
  }

  function reconcile({ associations = [], relationships = [] } = {}) {
    assertActive();
    const associationIds = normalizeAssociationIds(associations);
    const relationshipDefinitions = normalizeRelationships(relationships);
    const associationIdSet = new Set(associationIds);
    const relationshipKeySet = new Set(relationshipDefinitions.map(({ key }) => key));
    const retiredAssociationIds = retireAbsent(associationTargets, associationIdSet);
    const retiredRelationshipKeys = retireAbsent(relationshipTargets, relationshipKeySet);
    const unavailableAssociationIds = allocateMissing(
      associationIds,
      associationTargets,
      associationSlots,
      () => ({})
    );
    const unavailableRelationshipKeys = allocateMissing(
      relationshipDefinitions.map(({ key }) => key),
      relationshipTargets,
      relationshipSlots,
      relationshipParts
    );

    return createSnapshot(associationTargets, relationshipTargets, {
      associationIds,
      relationshipDefinitions,
      unavailableAssociationIds,
      unavailableRelationshipKeys,
      retiredAssociationIds,
      retiredRelationshipKeys
    });
  }

  function getAssociationTarget(associationId) {
    assertActive();
    return associationTargets.get(normalizeId(associationId, 'associationId'))?.target ?? null;
  }

  function getRelationshipTarget(sourceId, targetId) {
    assertActive();
    return relationshipTargets.get(relationshipTargetKey(sourceId, targetId))?.target ?? null;
  }

  function getSnapshot() {
    assertActive();
    return createSnapshot(associationTargets, relationshipTargets, {
      associationIds: [...associationTargets.keys()].sort(),
      relationshipDefinitions: [...relationshipTargets.values()]
        .map(({ sourceId, targetId, key }) => ({ sourceId, targetId, key }))
        .sort((left, right) => left.key.localeCompare(right.key)),
      unavailableAssociationIds: [],
      unavailableRelationshipKeys: [],
      retiredAssociationIds: [],
      retiredRelationshipKeys: []
    });
  }

  function dispose() {
    associationTargets.clear();
    relationshipTargets.clear();
    associationSlots.clear();
    relationshipSlots.clear();
    disposed = true;
  }

  function assertActive() {
    if (disposed) throw new Error('Brand Mind stable target registry is disposed.');
  }

  return Object.freeze({
    version: BRAND_MIND_STABLE_TARGET_REGISTRY_VERSION,
    registerAssociationSlot,
    registerRelationshipSlot,
    reconcile,
    getAssociationTarget,
    getRelationshipTarget,
    getSnapshot,
    dispose
  });
}

export function associationSlotId(index) {
  return `brand-mind-association-slot-${normalizeSlotIndex(index)}`;
}

export function relationshipSlotId(index) {
  return `brand-mind-relationship-slot-${normalizeSlotIndex(index)}`;
}

export function relationshipTargetKey(sourceId, targetId) {
  return JSON.stringify([
    normalizeId(sourceId, 'sourceId'),
    normalizeId(targetId, 'targetId')
  ]);
}

function normalizeAssociationIds(associations) {
  if (!Array.isArray(associations)) throw new Error('associations must be an array.');
  const ids = associations.map((association) => normalizeId(
    typeof association === 'string' ? association : association?.id,
    'associationId'
  ));
  assertUnique(ids, 'associationId');
  return ids.sort();
}

function normalizeRelationships(relationships) {
  if (!Array.isArray(relationships)) throw new Error('relationships must be an array.');
  const definitions = relationships.map((relationship) => {
    const sourceId = normalizeId(relationship?.sourceId, 'sourceId');
    const targetId = normalizeId(relationship?.targetId, 'targetId');
    return { sourceId, targetId, key: relationshipTargetKey(sourceId, targetId) };
  });
  assertUnique(definitions.map(({ key }) => key), 'relationship sourceId + targetId');
  return definitions.sort((left, right) => left.key.localeCompare(right.key));
}

function registerSlot(slots, slotId, target, type) {
  const normalizedSlotId = normalizeId(slotId, `${type} slotId`);
  if (!target || typeof target !== 'object') {
    throw new Error(`${type} slot ${normalizedSlotId} requires a runtime object target.`);
  }
  const existing = slots.get(normalizedSlotId);
  if (existing && existing !== target) {
    throw new Error(`${type} slot ${normalizedSlotId} is already bound to a different runtime target.`);
  }
  slots.set(normalizedSlotId, target);
}

function allocateMissing(keys, targets, slots, targetMetadata) {
  const assignedSlots = new Set([...targets.values()].map(({ slotId }) => slotId));
  const availableSlots = [...slots.keys()].filter((slotId) => !assignedSlots.has(slotId)).sort();
  const unavailable = [];

  keys.forEach((key) => {
    if (targets.has(key)) return;
    const slotId = availableSlots.shift();
    if (!slotId) {
      unavailable.push(key);
      return;
    }
    targets.set(key, { slotId, target: slots.get(slotId), ...targetMetadata(key) });
  });
  return Object.freeze(unavailable);
}

function retireAbsent(targets, activeKeys) {
  const retired = [];
  [...targets.keys()].forEach((key) => {
    if (activeKeys.has(key)) return;
    targets.delete(key);
    retired.push(key);
  });
  return Object.freeze(retired.sort());
}

function createSnapshot(associationTargets, relationshipTargets, {
  associationIds,
  relationshipDefinitions,
  unavailableAssociationIds,
  unavailableRelationshipKeys,
  retiredAssociationIds,
  retiredRelationshipKeys
}) {
  return Object.freeze({
    associationTargets: Object.freeze(associationIds.flatMap((associationId) => {
      const target = associationTargets.get(associationId);
      return target ? [{ associationId, slotId: target.slotId }] : [];
    })),
    relationshipTargets: Object.freeze(relationshipDefinitions.flatMap((definition) => {
      const target = relationshipTargets.get(definition.key);
      return target ? [{ sourceId: definition.sourceId, targetId: definition.targetId, slotId: target.slotId }] : [];
    })),
    unavailableAssociationIds,
    unavailableRelationshipKeys,
    retiredAssociationIds,
    retiredRelationshipKeys
  });
}

function relationshipParts(key) {
  const [sourceId, targetId] = JSON.parse(key);
  return { sourceId, targetId };
}

function normalizeId(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function normalizeSlotIndex(index) {
  if (!Number.isInteger(index) || index < 1) throw new Error('slot index must be a positive integer.');
  return index;
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} is not allowed.`);
}
