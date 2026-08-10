import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHeroCinematicHandoff } from './heroCinematicHandoff.js';
import {
  HERO_WHEEL_OWNERSHIP,
  resolveHeroCinematicEntry,
  resolveHeroWheelOwnership
} from './heroCinematicIntegration.js';
import { createHeroScrollController } from './heroScrollController.js';
import { HERO_HANDOFF_CONTRACT } from './heroHandoffContract.js';
import {
  HERO_CINEMATIC_ASSET_MODES,
  resolveHeroCinematicAsset
} from './heroCinematicAssetConfig.js';

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({ name, status: 'pass' });
  } catch (error) {
    results.push({ name, status: 'fail', message: error.message });
  }
}

test('Data Center parameters take priority over Hero parameters', () => {
  assert.equal(resolveHeroCinematicEntry('http://local/?dataCenter=geo&heroCinematic=v2&heroHybrid=1'), null);
});

test('Dashboard parameters take priority over Hero parameters', () => {
  assert.equal(resolveHeroCinematicEntry('http://local/?geoDashboard=v1&heroCinematic=v2'), null);
});

test('Scene parameters take priority over Hero parameters', () => {
  assert.equal(resolveHeroCinematicEntry('http://local/?scene=geo&heroCinematic=v2'), null);
});

test('P1 and Hybrid queries resolve independently', () => {
  assert.equal(resolveHeroCinematicEntry('http://local/?heroCinematic=v2'), 'p1');
  assert.equal(resolveHeroCinematicEntry('http://local/?heroCinematic=v2&heroHybrid=1'), 'hybrid');
});

test('Hybrid owns wheel before handoff', () => {
  assert.equal(resolveHeroWheelOwnership({ currentProgress: 0.5, deltaY: 120 }), HERO_WHEEL_OWNERSHIP.CINEMATIC);
});

test('Universe owns forward wheel after handoff', () => {
  assert.equal(resolveHeroWheelOwnership({ currentProgress: 1, deltaY: 120 }), HERO_WHEEL_OWNERSHIP.UNIVERSE);
});

test('Hybrid can reverse from the Universe start', () => {
  assert.equal(resolveHeroWheelOwnership({ currentProgress: 1, deltaY: -120 }), HERO_WHEEL_OWNERSHIP.CINEMATIC);
});

test('Hybrid retains wheel ownership until handoff is fully complete', () => {
  assert.equal(resolveHeroWheelOwnership({
    currentProgress: 0.975,
    deltaY: 120,
    tourStatus: {
      activeScene: 'HeroScene',
      currentAnchor: 'HERO_START',
      transitionFrom: 'BOOT',
      transitionTo: 'HERO_START'
    }
  }), HERO_WHEEL_OWNERSHIP.CINEMATIC);
});

test('GEO Journey owns wheel outside the Universe start', () => {
  assert.equal(resolveHeroWheelOwnership({
    currentProgress: 1,
    deltaY: -120,
    tourStatus: { activeScene: 'GeoScene', currentAnchor: 'GEO_ACTIVE' }
  }), HERO_WHEEL_OWNERSHIP.GEO);
});

test('Data Center always owns wheel while active', () => {
  assert.equal(resolveHeroWheelOwnership({
    currentProgress: 0.5,
    deltaY: -120,
    dataCenterRoute: 'geo'
  }), HERO_WHEEL_OWNERSHIP.DATA_CENTER);
});

test('Seven standard wheel steps settle from zero to one and back', () => {
  const harness = createControllerHarness();
  for (let index = 0; index < 7; index += 1) harness.controller.applyWheelDelta(120, 0);
  harness.flush();
  assert.equal(harness.controller.getDiagnostics().targetProgress, 1);
  assert.equal(harness.controller.getDiagnostics().currentProgress, 1);
  for (let index = 0; index < 7; index += 1) harness.controller.applyWheelDelta(-120, 0);
  harness.flush();
  assert.equal(harness.controller.getDiagnostics().targetProgress, 0);
  assert.equal(harness.controller.getDiagnostics().currentProgress, 0);
  harness.controller.dispose();
});

test('Owned Hero wheel stops same-target Journey listeners', () => {
  const harness = createControllerHarness();
  const event = createWheelEvent(120);
  harness.target.dispatchWheel(event);
  assert.equal(event.prevented, true);
  assert.equal(event.immediatePropagationStopped, true);
  harness.controller.dispose();
});

test('Unowned wheel remains available to the latest site', () => {
  const harness = createControllerHarness({ shouldHandleWheel: () => false });
  const event = createWheelEvent(120);
  harness.target.dispatchWheel(event);
  assert.equal(event.prevented, false);
  assert.equal(event.immediatePropagationStopped, false);
  harness.controller.dispose();
});

test('Handoff prepares latest Universe once and supports reverse blending', () => {
  const videoLayer = { style: {} };
  const universeLayer = { style: {} };
  let prepareCount = 0;
  const handoff = createHeroCinematicHandoff({
    videoLayer,
    threeLayer: universeLayer,
    onPrepareThree: () => { prepareCount += 1; }
  });
  assert.equal(handoff.update(0.88).phase, 'PREPARE_THREE');
  assert.equal(handoff.update(1).state, 'THREE_READY');
  assert.equal(universeLayer.style.visibility, 'visible');
  assert.equal(handoff.update(0.9).state, 'CINEMATIC');
  assert.equal(videoLayer.style.visibility, 'visible');
  assert.equal(prepareCount, 1);
});

test('Controller destroy removes its only wheel listener and RAF', () => {
  const harness = createControllerHarness();
  harness.controller.applyWheelDelta(120, 0);
  assert.equal(harness.target.listenerCount('wheel'), 1);
  harness.controller.dispose();
  assert.equal(harness.target.listenerCount('wheel'), 0);
  assert.equal(harness.pendingFrames(), 0);
});

test('Controller detaches for Data Centers and reattaches for Universe', () => {
  const harness = createControllerHarness();
  assert.equal(harness.controller.getDiagnostics().wheelListenerCount, 1);
  harness.controller.setEnabled(false);
  assert.equal(harness.target.listenerCount('wheel'), 0);
  assert.equal(harness.controller.getDiagnostics().wheelListenerCount, 0);
  harness.controller.setEnabled(true);
  assert.equal(harness.target.listenerCount('wheel'), 1);
  assert.equal(harness.controller.getDiagnostics().wheelListenerCount, 1);
  harness.controller.dispose();
});

test('Integrated Hybrid creates no Three renderer and only one scrubber', () => {
  const source = readFileSync(new URL('./heroCinematicHybrid.js', import.meta.url), 'utf8');
  assert.equal(source.includes('new THREE.WebGLRenderer'), false);
  assert.equal((source.match(/createHeroCinematicScrubber\(/g) ?? []).length, 1);
});

test('Generated handoff contract uses the converted vertical FOV and camera', () => {
  assert.equal(HERO_HANDOFF_CONTRACT.cameraVerticalFovDeg, 34.537989);
  assert.deepEqual(HERO_HANDOFF_CONTRACT.cameraPositionFinal, [14.5, 17.6, -64]);
  assert.equal(HERO_HANDOFF_CONTRACT.cameraQuaternionXYZW.length, 4);
  assert.notEqual(HERO_HANDOFF_CONTRACT.cameraFov, 'TBD');
  assert.notEqual(HERO_HANDOFF_CONTRACT.cameraTargetFinal, 'TBD');
  assert.notEqual(HERO_HANDOFF_CONTRACT.cameraFov, HERO_HANDOFF_CONTRACT.cameraHorizontalFovDeg);
});

test('Cinematic asset slot defaults to the existing placeholder', () => {
  const asset = resolveHeroCinematicAsset({ placeholderSource: '/placeholder.webm' });
  assert.equal(asset.mode, HERO_CINEMATIC_ASSET_MODES.PLACEHOLDER);
  assert.equal(asset.placeholder, true);
  assert.equal(asset.source, '/placeholder.webm');
});

test('Final cinematic mode retains a safe placeholder fallback', () => {
  const asset = resolveHeroCinematicAsset({
    placeholderSource: '/placeholder.webm',
    mode: HERO_CINEMATIC_ASSET_MODES.FINAL
  });
  assert.equal(asset.placeholder, false);
  assert.equal(asset.fallbackSource, '/placeholder.webm');
  assert.match(asset.source, /hero-cinematic-v2-master\.webm$/);
});

function createControllerHarness(controllerOptions = {}) {
  const listeners = new Map();
  const frames = new Map();
  let frameId = 0;
  let now = 0;
  const target = {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
    dispatchWheel(event) {
      for (const callback of listeners.get('wheel') ?? []) {
        callback(event);
        if (event.immediatePropagationStopped) break;
      }
    }
  };
  const windowObject = {
    innerHeight: 1080,
    requestAnimationFrame(callback) {
      const id = ++frameId;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    }
  };
  const performanceObject = { now: () => now };
  const controller = createHeroScrollController({
    target,
    windowObject,
    performanceObject,
    ...controllerOptions
  });
  return {
    controller,
    target,
    pendingFrames: () => frames.size,
    flush() {
      let guard = 0;
      while (frames.size && guard < 240) {
        const current = [...frames.entries()];
        frames.clear();
        now += 1000 / 60;
        current.forEach(([, callback]) => callback(now));
        guard += 1;
      }
      assert.ok(guard < 240, 'Controller did not settle.');
    }
  };
}

function createWheelEvent(deltaY) {
  return {
    deltaY,
    deltaMode: 0,
    prevented: false,
    immediatePropagationStopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopImmediatePropagation() {
      this.immediatePropagationStopped = true;
    }
  };
}

const failed = results.filter((result) => result.status === 'fail');
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
