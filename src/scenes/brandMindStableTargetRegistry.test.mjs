import assert from 'node:assert/strict';
import {
  associationSlotId,
  BRAND_MIND_STABLE_TARGET_REGISTRY_VERSION,
  createBrandMindStableTargetRegistry,
  relationshipSlotId,
  relationshipTargetKey
} from './brandMindStableTargetRegistry.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

function createRegistry() {
  const registry = createBrandMindStableTargetRegistry();
  const nodes = [
    { name: 'node-one' },
    { name: 'node-two' },
    { name: 'node-three' }
  ];
  const paths = [
    { name: 'path-one' },
    { name: 'path-two' }
  ];
  nodes.forEach((node, index) => registry.registerAssociationSlot(associationSlotId(index + 1), node));
  paths.forEach((path, index) => registry.registerRelationshipSlot(relationshipSlotId(index + 1), path));
  return { registry, nodes, paths };
}

test('registry has an explicit version', () => {
  assert.equal(BRAND_MIND_STABLE_TARGET_REGISTRY_VERSION, '1.0.0');
});

test('slot IDs are deterministic and require positive indexes', () => {
  assert.equal(associationSlotId(2), 'brand-mind-association-slot-2');
  assert.equal(relationshipSlotId(2), 'brand-mind-relationship-slot-2');
  assert.throws(() => associationSlotId(0), /positive integer/);
  assert.throws(() => relationshipSlotId(1.5), /positive integer/);
});

test('relationship key retains ordered source and target identity without delimiter collisions', () => {
  assert.notEqual(
    relationshipTargetKey('source→target', 'x'),
    relationshipTargetKey('source', 'target→x')
  );
  assert.notEqual(
    relationshipTargetKey('core', 'association'),
    relationshipTargetKey('association', 'core')
  );
});

test('association targets resolve by associationId rather than incoming array order', () => {
  const { registry, nodes } = createRegistry();
  registry.reconcile({ associations: [{ id: 'c' }, { id: 'a' }, { id: 'b' }] });
  assert.equal(registry.getAssociationTarget('a'), nodes[0]);
  assert.equal(registry.getAssociationTarget('b'), nodes[1]);
  assert.equal(registry.getAssociationTarget('c'), nodes[2]);
});

test('association target mapping survives a reordered source array', () => {
  const { registry, nodes } = createRegistry();
  registry.reconcile({ associations: [{ id: 'b' }, { id: 'a' }] });
  registry.reconcile({ associations: [{ id: 'a' }, { id: 'b' }] });
  assert.equal(registry.getAssociationTarget('a'), nodes[0]);
  assert.equal(registry.getAssociationTarget('b'), nodes[1]);
});

test('missing associations retire safely and release their slot for a new identity', () => {
  const { registry, nodes } = createRegistry();
  registry.reconcile({ associations: [{ id: 'a' }, { id: 'b' }] });
  const next = registry.reconcile({ associations: [{ id: 'b' }, { id: 'c' }] });
  assert.deepEqual(next.retiredAssociationIds, ['a']);
  assert.equal(registry.getAssociationTarget('a'), null);
  assert.equal(registry.getAssociationTarget('b'), nodes[1]);
  assert.equal(registry.getAssociationTarget('c'), nodes[0]);
});

test('unavailable association capacity is explicit rather than silently remapped', () => {
  const { registry } = createRegistry();
  const result = registry.reconcile({ associations: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] });
  assert.deepEqual(result.unavailableAssociationIds, ['d']);
  assert.equal(registry.getAssociationTarget('d'), null);
});

test('relationship paths resolve by sourceId and targetId rather than incoming array order', () => {
  const { registry, paths } = createRegistry();
  registry.reconcile({
    relationships: [
      { sourceId: 'core', targetId: 'b' },
      { sourceId: 'core', targetId: 'a' }
    ]
  });
  assert.equal(registry.getRelationshipTarget('core', 'a'), paths[0]);
  assert.equal(registry.getRelationshipTarget('core', 'b'), paths[1]);
});

test('relationship path mapping survives reordered relationship input', () => {
  const { registry, paths } = createRegistry();
  registry.reconcile({ relationships: [{ sourceId: 'core', targetId: 'b' }, { sourceId: 'core', targetId: 'a' }] });
  registry.reconcile({ relationships: [{ sourceId: 'core', targetId: 'a' }, { sourceId: 'core', targetId: 'b' }] });
  assert.equal(registry.getRelationshipTarget('core', 'a'), paths[0]);
  assert.equal(registry.getRelationshipTarget('core', 'b'), paths[1]);
});

test('missing relationships retire safely and release a path slot', () => {
  const { registry, paths } = createRegistry();
  registry.reconcile({ relationships: [{ sourceId: 'core', targetId: 'a' }, { sourceId: 'core', targetId: 'b' }] });
  const result = registry.reconcile({ relationships: [{ sourceId: 'core', targetId: 'b' }, { sourceId: 'core', targetId: 'c' }] });
  assert.equal(result.retiredRelationshipKeys.length, 1);
  assert.equal(registry.getRelationshipTarget('core', 'a'), null);
  assert.equal(registry.getRelationshipTarget('core', 'b'), paths[1]);
  assert.equal(registry.getRelationshipTarget('core', 'c'), paths[0]);
});

test('unavailable relationship capacity is explicit rather than silently remapped', () => {
  const { registry } = createRegistry();
  const result = registry.reconcile({
    relationships: [
      { sourceId: 'core', targetId: 'a' },
      { sourceId: 'core', targetId: 'b' },
      { sourceId: 'core', targetId: 'c' }
    ]
  });
  assert.equal(result.unavailableRelationshipKeys.length, 1);
  assert.equal(registry.getRelationshipTarget('core', 'c'), null);
});

test('duplicate identities fail before mutating an existing mapping', () => {
  const { registry, nodes } = createRegistry();
  registry.reconcile({ associations: [{ id: 'a' }] });
  assert.throws(() => registry.reconcile({ associations: [{ id: 'a' }, { id: 'a' }] }), /Duplicate associationId/);
  assert.equal(registry.getAssociationTarget('a'), nodes[0]);
});

test('snapshots are serializable and contain no runtime object references', () => {
  const { registry } = createRegistry();
  const result = registry.reconcile({
    associations: [{ id: 'a' }],
    relationships: [{ sourceId: 'core', targetId: 'a' }]
  });
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.deepEqual(result.associationTargets, [{ associationId: 'a', slotId: 'brand-mind-association-slot-1' }]);
  assert.deepEqual(result.relationshipTargets, [{ sourceId: 'core', targetId: 'a', slotId: 'brand-mind-relationship-slot-1' }]);
});

test('disposed registries cannot accept or resolve runtime targets', () => {
  const { registry } = createRegistry();
  registry.dispose();
  assert.throws(() => registry.reconcile(), /disposed/);
  assert.throws(() => registry.getAssociationTarget('a'), /disposed/);
});

const failed = results.filter(({ status }) => status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
