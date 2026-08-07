import assert from 'node:assert/strict';
import {
  createDataCenterRegistry,
  RESERVED_DATA_CENTER_IDS
} from './dataCenterRegistry.js';
import { createDataCenterLifecycle } from './dataCenterLifecycle.js';
import { createDataCenterRouter, resolveDataCenterRoute } from './dataCenterRouter.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

function createFakeWindow(href = 'http://127.0.0.1:5173/') {
  const listeners = new Map();
  const root = {
    dataset: {},
    removeAttribute(name) {
      if (name === 'data-active-data-center') delete this.dataset.activeDataCenter;
    }
  };
  const fake = {
    location: { href },
    document: { documentElement: root },
    history: {
      pushState(_state, _title, value) {
        fake.location.href = new URL(value, fake.location.href).href;
      },
      replaceState(_state, _title, value) {
        fake.location.href = new URL(value, fake.location.href).href;
      }
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatch(type) {
      listeners.get(type)?.forEach((handler) => handler());
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    }
  };
  return fake;
}

function createHarness(href = 'http://127.0.0.1:5173/') {
  const events = [];
  const instances = [];
  const makeFactory = (id) => ({
    create() {
      const instance = {
        id,
        destroyed: false,
        destroy() {
          this.destroyed = true;
          events.push(`destroy:${id}`);
        }
      };
      instances.push(instance);
      events.push(`create:${id}`);
      return instance;
    },
    destroy(instance) {
      instance.destroy();
    }
  });
  const registry = createDataCenterRegistry({
    geo: makeFactory('geo'),
    a5: makeFactory('a5'),
    brandMind: makeFactory('brandMind')
  });
  const windowObject = createFakeWindow(href);
  const lifecycle = createDataCenterLifecycle({ registry, windowObject });
  const router = createDataCenterRouter({ registry, lifecycle, windowObject });
  return { events, instances, registry, windowObject, lifecycle, router };
}

test('Registry contains three Data Centers', () => {
  assert.equal(createHarness().registry.list().length, 3);
});

test('Registry ids are unique and stable', () => {
  assert.deepEqual(createHarness().registry.ids, ['geo', 'a5', 'brandMind']);
});

test('Cross-module center is reserved but not registered', () => {
  const registry = createHarness().registry;
  assert.deepEqual(RESERVED_DATA_CENTER_IDS, ['crossModule']);
  assert.equal(registry.has('crossModule'), false);
});

test('GEO registry status is activePrototype', () => {
  assert.equal(createHarness().registry.get('geo').status, 'activePrototype');
});

test('A5 registry status is shell without a data source', () => {
  const entry = createHarness().registry.get('a5');
  assert.equal(entry.status, 'shell');
  assert.equal(entry.dataSource, null);
});

test('Brand Mind registry status is shell without a data source', () => {
  const entry = createHarness().registry.get('brandMind');
  assert.equal(entry.status, 'shell');
  assert.equal(entry.dataSource, null);
});

test('GEO create works through lifecycle', () => {
  const harness = createHarness();
  assert.equal(harness.lifecycle.open('geo').id, 'geo');
});

test('A5 create works through lifecycle', () => {
  const harness = createHarness();
  assert.equal(harness.lifecycle.open('a5').id, 'a5');
});

test('Brand Mind create works through lifecycle', () => {
  const harness = createHarness();
  assert.equal(harness.lifecycle.open('brandMind').id, 'brandMind');
});

test('Lifecycle keeps at most one active instance', () => {
  const harness = createHarness();
  harness.lifecycle.open('geo');
  harness.lifecycle.open('a5');
  assert.equal(harness.lifecycle.getStatus().instanceCount, 1);
});

test('GEO to A5 destroys GEO first', () => {
  const harness = createHarness();
  harness.lifecycle.open('geo');
  harness.lifecycle.open('a5');
  assert.deepEqual(harness.events, ['create:geo', 'destroy:geo', 'create:a5']);
});

test('A5 to Brand Mind destroys A5 first', () => {
  const harness = createHarness();
  harness.lifecycle.open('a5');
  harness.lifecycle.open('brandMind');
  assert.deepEqual(harness.events, ['create:a5', 'destroy:a5', 'create:brandMind']);
});

test('Opening the active center does not duplicate its instance', () => {
  const harness = createHarness();
  const first = harness.lifecycle.open('geo');
  const second = harness.lifecycle.open('geo');
  assert.equal(first, second);
  assert.equal(harness.events.filter((event) => event === 'create:geo').length, 1);
});

test('Destroy returns lifecycle to zero instances', () => {
  const harness = createHarness();
  harness.lifecycle.open('brandMind');
  harness.lifecycle.destroy();
  assert.equal(harness.lifecycle.getStatus().instanceCount, 0);
});

test('Unified GEO route resolves', () => {
  const harness = createHarness();
  assert.equal(resolveDataCenterRoute('http://local/?dataCenter=geo', harness.registry).id, 'geo');
});

test('Unified A5 route resolves', () => {
  const harness = createHarness();
  assert.equal(resolveDataCenterRoute('http://local/?dataCenter=a5', harness.registry).id, 'a5');
});

test('Unified Brand Mind route resolves', () => {
  const harness = createHarness();
  assert.equal(resolveDataCenterRoute('http://local/?dataCenter=brandMind', harness.registry).id, 'brandMind');
});

test('Legacy GEO route remains compatible', () => {
  const harness = createHarness();
  const route = resolveDataCenterRoute('http://local/?geoDashboard=v1', harness.registry);
  assert.equal(route.id, 'geo');
  assert.equal(route.mode, 'legacy');
});

test('Unknown route does not create a center', () => {
  const harness = createHarness('http://local/?dataCenter=unknown');
  harness.router.start();
  assert.equal(harness.lifecycle.getStatus().instanceCount, 0);
});

test('Normal URL starts with zero Data Center instances', () => {
  const harness = createHarness();
  harness.router.start();
  assert.equal(harness.lifecycle.getStatus().instanceCount, 0);
});

test('Router navigate updates URL and opens one center', () => {
  const harness = createHarness();
  harness.router.start();
  harness.router.navigate('a5');
  assert.match(harness.windowObject.location.href, /dataCenter=a5/);
  assert.equal(harness.lifecycle.getActiveDataCenterId(), 'a5');
});

test('Return clears the unified route and destroys the active center', () => {
  const harness = createHarness('http://local/?dataCenter=brandMind&visual=v1');
  harness.router.start();
  harness.router.returnToUniverse();
  assert.equal(new URL(harness.windowObject.location.href).searchParams.has('dataCenter'), false);
  assert.equal(harness.lifecycle.getStatus().instanceCount, 0);
});

test('Popstate synchronizes the center without duplication', () => {
  const harness = createHarness('http://local/?dataCenter=geo');
  harness.router.start();
  harness.windowObject.location.href = 'http://local/?dataCenter=brandMind';
  harness.windowObject.dispatch('popstate');
  assert.equal(harness.lifecycle.getActiveDataCenterId(), 'brandMind');
  assert.equal(harness.lifecycle.getStatus().instanceCount, 1);
});

test('Router dispose releases popstate and active instance', () => {
  const harness = createHarness('http://local/?dataCenter=a5');
  harness.router.start();
  assert.equal(harness.windowObject.listenerCount('popstate'), 1);
  harness.router.dispose();
  assert.equal(harness.windowObject.listenerCount('popstate'), 0);
  assert.equal(harness.lifecycle.getStatus().instanceCount, 0);
});

const failed = results.filter((result) => result.status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
