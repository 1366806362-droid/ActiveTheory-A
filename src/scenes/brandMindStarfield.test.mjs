import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STARFIELD_NODES, STARFIELD_PATHS, resolveBrandMindStarfield, energyArcPoint, createBrandMindStarfield } from './brandMindStarfield.js';
import { BRAND_MIND_PRIMARY_INTERACTION_TARGET } from './brandMindScene.js';

function scene(options = {}) {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  const reduced = { matches: false };
  globalThis.document = { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillText() {} }) }) };
  globalThis.window = { matchMedia: () => reduced };
  const value = createBrandMindStarfield({ variant: 'A', background: true, review: false, ...options }, BRAND_MIND_PRIMARY_INTERACTION_TARGET);
  return { value, reduced, release() { value.dispose(); globalThis.document = oldDocument; globalThis.window = oldWindow; } };
}
test('candidate remains opt-in and historical/default queries cannot enable it', () => {
  for (const q of ['', '?scene=brandmind', '?brandMindStarfield=0', '?brandMindCognitiveV11=B', '?brandMindCoreForm=light']) assert.equal(resolveBrandMindStarfield(q), null);
  assert.equal(resolveBrandMindStarfield('?brandMindStarfield=1').variant, 'A');
  assert.equal(resolveBrandMindStarfield('?brandMindStarfield=1&brandMindStarfieldBackground=0').background, false);
});
test('six historical visual identities retain three explicit edges and no invented business map', () => {
  assert.deepEqual(STARFIELD_NODES.map(n => n.id), ['BrandMindAssociationNode1','BrandMindAssociationNode2','BrandMindAssociationNode3','BrandMindAssociationNode4','BrandMindAssociationNode5','BrandMindAssociationNode6']);
  assert.equal(STARFIELD_NODES.every(n => n.associationId === null), true);
  assert.deepEqual(STARFIELD_PATHS.map(p => p.target), ['BrandMindAssociationNode1','BrandMindAssociationNode3','BrandMindAssociationNode5']);
  assert.equal(STARFIELD_PATHS.every(p => p.source === 'BrandMindCoreVolume' && p.relationshipId === null), true);
});
test('energy ribbons are finite genuine three-dimensional geometry within the core', () => {
  const p = new THREE.Vector3(); let minZ = 1, maxZ = -1;
  for (let layer = 0; layer < 9; layer++) for (let i = 0; i <= 100; i++) {
    energyArcPoint(layer, i / 100, .59, p); assert.ok(p.toArray().every(Number.isFinite)); assert.ok(p.length() <= .6);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  assert.ok(maxZ - minZ > .7);
});
test('particles, environment and materials are fixed allocations, not rebuilt per update', () => {
  const f = scene(); try {
    let count = 0; const ids = []; f.value.group.traverse(o => { ids.push(o.uuid); if (o.isPoints) count += o.geometry.attributes.position.count; });
    assert.equal(count, 5188); assert.equal(f.value.readVisualRegistry().particleCount, count);
    for (let i = 0; i < 300; i++) f.value.update({ exposure: .725 }, 1 / 120, i / 120);
    const after = []; f.value.group.traverse(o => after.push(o.uuid)); assert.deepEqual(after, ids);
  } finally { f.release(); }
});
test('node transform and flow endpoint share one stable identity source', () => {
  const f = scene(); try {
    const flow = f.value.group.getObjectByName('BrandMindAssociationPaths').children.find(o => o.isPoints);
    STARFIELD_PATHS.forEach((p, i) => { assert.equal(flow.material.uniforms.uEnds.value[i], f.value.resolveVisualNode(p.target).position); assert.equal(f.value.resolveVisualPath(p.source, p.target).name, p.id); });
    assert.equal(f.value.resolveVisualNode('mock-association-a'), null);
    assert.equal(f.value.resolveVisualPath('BrandMindCoreVolume', 'missing'), null);
    f.value.update({ exposure: 1 }, 1 / 120, 1);
    for (const d of STARFIELD_NODES) assert.ok(f.value.resolveVisualNode(d.id).position.distanceTo(new THREE.Vector3(...d.position)) < .04);
  } finally { f.release(); }
});
test('panel, reduced motion, hidden tabs and inactive scene pause the local clock without catch-up', () => {
  const f = scene(); try {
    const tick = (dt = .02, progress = 1) => f.value.update({ exposure: .725 }, dt, 123, progress);
    tick(); const t = f.value.readVisualRegistry().clock;
    f.value.setPanelPresentationOpen(true); tick(); assert.equal(f.value.readVisualRegistry().clock, t);
    f.value.setPanelPresentationOpen(false); f.reduced.matches = true; tick(); assert.equal(f.value.readVisualRegistry().clock, t);
    f.reduced.matches = false; document.hidden = true; tick(); assert.equal(f.value.readVisualRegistry().clock, t);
    document.hidden = false; tick(.02, 0); assert.equal(f.value.readVisualRegistry().clock, t);
    tick(60); assert.ok(f.value.readVisualRegistry().clock - t <= 1 / 30 + 1e-8);
  } finally { f.release(); }
});
test('core picking keeps existing semantic and matches physical body instead of environment', () => {
  const f = scene(); try {
    f.value.update({ exposure: .725 }, .01, 1);
    const camera = new THREE.PerspectiveCamera(46, 16 / 9, .1, 100); camera.position.set(0, -.06, 3); camera.lookAt(0, -.06, -.82);
    assert.deepEqual(f.value.getPrimaryInteractionTarget({ x: 0, y: 0, camera }), BRAND_MIND_PRIMARY_INTERACTION_TARGET);
    assert.equal(f.value.getPrimaryInteractionTarget({ x: .7, y: .7, camera }), null);
    assert.equal(f.value.group.getObjectByName('BrandMindCoreVolume').geometry.parameters.radius, .59);
  } finally { f.release(); }
});
test('scene disposal is idempotent and disposes all owned geometries/materials/textures once', () => {
  const f = scene(); let actual = 0; const resources = new Set();
  f.value.group.traverse(o => { if (o.geometry) resources.add(o.geometry); if (o.material) { resources.add(o.material); if (o.material.map) resources.add(o.material.map); } });
  for (const r of resources) r.addEventListener('dispose', () => actual++);
  f.value.dispose(); f.value.dispose(); assert.equal(actual, resources.size); assert.equal(f.value.group.children.length, 0);
  assert.equal(f.value.resolveVisualNode(STARFIELD_NODES[0].id), null); f.release();
});
