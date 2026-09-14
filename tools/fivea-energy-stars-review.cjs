const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('art/fivea-energy-stars');
fs.mkdirSync(out, { recursive: true });
const origin = process.env.FIVEA_ENERGY_ORIGIN || 'http://127.0.0.1:5194/';
const home = `${origin}?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1&earthHeroLock=1`;
const scene = `${home}&fiveAOrbital=B&fiveACinematic=B&fiveACinematicReview=1&v2FiveAState=balanced&scene=fivea&v2FiveACapture=1&orbitalReview=1`;
const mode = process.argv[2] || 'prototype';
const report = { mode, errors: [], viewport: [1600, 900], dpr: 1, frames: [] };
const selected = '&fiveAParticleStars=B&fiveAEnergyStars=A';

async function go(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__GALAXY_TOUR_STATUS__?.activeScene === 'FiveAScene' && !window.__GALAXY_TOUR_STATUS__?.transitionTo);
  await page.waitForTimeout(1500);
}
async function position(page, name) {
  return page.evaluate(async objectName => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const active = (await import('/src/engine/scenes.js')).getActiveScene();
    const camera = (await import('/src/engine/camera.js')).getCamera();
    active.updateMatrixWorld(true);
    const p = active.getObjectByName(objectName).getWorldPosition(new THREE.Vector3()).project(camera);
    return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
  }, name);
}
async function shot(page, name) {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file });
  report.frames.push(file);
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    if (mode === 'prototype') {
      for (const [name, query] of [
        ['BEFORE_PARTICLE_STARS', '&fiveAParticleStars=B'],
        ['CANDIDATE_A', '&fiveAParticleStars=B&fiveAEnergyStars=A'],
        ['CANDIDATE_B', '&fiveAParticleStars=B&fiveAEnergyStars=B']
      ]) {
        await go(page, scene + query);
        await shot(page, name);
        const core = await position(page, 'FiveACorePrimaryHitTarget');
        await page.screenshot({ path: path.join(out, `${name}_CORE.png`), clip: { x: Math.max(0, Math.round(core.x - 180)), y: Math.max(0, Math.round(core.y - 180)), width: 360, height: 360 } });
        const satellite = await position(page, 'FiveAOrbitalBodyA3');
        await page.screenshot({ path: path.join(out, `${name}_SATELLITE.png`), clip: { x: Math.max(0, Math.round(satellite.x - 100)), y: Math.max(0, Math.round(satellite.y - 100)), width: 200, height: 200 } });
      }
    } else if (mode === 'capture') {
      await go(page, scene + '&fiveAParticleStars=B');
      await shot(page, 'BEFORE_PARTICLE_STARS');
      await go(page, scene + selected);
      await shot(page, 'FIVEA_ENERGY_STARS_OVERVIEW');
      const core = await position(page, 'FiveACorePrimaryHitTarget');
      await page.screenshot({ path: path.join(out, 'FIVEA_ENERGY_STARS_CORE.png'), clip: { x: Math.round(core.x - 180), y: Math.round(core.y - 180), width: 360, height: 360 } });
      const satellite = await position(page, 'FiveAOrbitalBodyA3');
      await page.screenshot({ path: path.join(out, 'FIVEA_ENERGY_STARS_SATELLITE.png'), clip: { x: Math.round(satellite.x - 100), y: Math.round(satellite.y - 100), width: 200, height: 200 } });
      for (const [kind, state, id, name] of [
        ['stage', 'low', 'A3', 'DATA_LOW'], ['stage', 'high', 'A3', 'DATA_HIGH'],
        ['flow', 'low', 'A3_TO_A4', 'FLOW_LOW'], ['flow', 'high', 'A3_TO_A4', 'FLOW_HIGH'],
        ['stages', 'partial', null, 'PARTIAL']
      ]) {
        await page.evaluate(args => window.__FIVEA_CINEMATIC_REVIEW__.applyFixture(...args), [kind, state, id]);
        await page.waitForTimeout(180);
        await shot(page, name);
        const readback = await page.evaluate(() => window.__FIVEA_CINEMATIC_REVIEW__.read());
        report[name] = { snapshotId: readback.snapshotId, stages: readback.stages, flows: readback.flows };
      }
      await go(page, scene + selected + '&showBloom=0'); await shot(page, 'BLOOM_OFF');
      await go(page, scene + selected); await shot(page, 'BLOOM_ON');
      const hit = await position(page, 'FiveACorePrimaryHitTarget');
      await page.mouse.click(hit.x, hit.y);
      await page.waitForFunction(() => window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());
      await page.waitForTimeout(900); await shot(page, 'FIVEA_ENERGY_STARS_PANEL');
      report.panel = await page.evaluate(() => ({ open: window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen(), viewModel: window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.viewModel }));
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      await page.setViewportSize({ width: 640, height: 360 });
      await go(page, scene + selected); await shot(page, 'FIVEA_ENERGY_STARS_SMALL_READ');
    } else if (mode === 'safety') {
      report.layouts = [];
      for (const [width, height] of [[1366, 768], [1600, 900], [1920, 1080]]) {
        await page.setViewportSize({ width, height });
        await go(page, scene.replace('&v2FiveACapture=1', '') + selected);
        await page.evaluate(() => window.__FIVEA_CINEMATIC_REVIEW__.applyFixture('stage', 'high', 'A5'));
        for (const sampleTime of [0, 54, 108, 162, 216]) {
          await page.evaluate(async time => (await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.setOrbitalSampleTime(time), sampleTime);
          await page.waitForTimeout(80);
          const hit = await position(page, 'FiveACorePrimaryHitTarget');
          await page.mouse.click(hit.x, hit.y);
          await page.waitForFunction(() => window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen());
          await page.waitForTimeout(250);
          const layout = await page.evaluate(async () => {
            const panel = document.querySelector('.fivea-data-panel').getBoundingClientRect();
            const THREE = await import('/node_modules/.vite/deps/three.js');
            const { ORBITAL_STAGES } = await import('/src/scenes/fiveAOrbitalArt.js');
            const active = (await import('/src/engine/scenes.js')).getActiveScene();
            const camera = (await import('/src/engine/camera.js')).getCamera();
            const root = active.getObjectByName('FiveAScene'); root.updateMatrixWorld(true);
            const outside = []; let minimumMargin = Infinity;
            for (const [id, art] of Object.entries(ORBITAL_STAGES)) {
              const object = active.getObjectByName(`FiveAStageNode${id}`);
              const world = object.getWorldPosition(new THREE.Vector3());
              const view = world.clone().applyMatrix4(camera.matrixWorldInverse);
              const screen = world.clone().project(camera);
              const x = (screen.x + 1) * innerWidth / 2, y = (1 - screen.y) * innerHeight / 2;
              const radius = art.size * object.scale.x * 1.14 * root.scale.x * camera.projectionMatrix.elements[5] * innerHeight / 2 / -view.z;
              const margins = [x - radius, panel.left - x - radius, x - 84, panel.left - x - 84, y - radius - 40, innerHeight - y - radius];
              minimumMargin = Math.min(minimumMargin, ...margins);
              if (margins.some(value => value < 0)) outside.push({ id, x, y, radius, margins });
            }
            return { panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom }, viewport: [innerWidth, innerHeight], outside, minimumMargin };
          });
          if (layout.outside.length) throw new Error(`Particle/label envelope outside viewport: ${JSON.stringify(layout.outside)}`);
          report.layouts.push({ width, height, sampleTime, ...layout });
          await page.keyboard.press('Escape'); await page.waitForTimeout(180);
        }
      }
      await page.setViewportSize({ width: 1600, height: 900 });
      await go(page, scene.replace('&v2FiveACapture=1', '') + selected);
      const before = await page.evaluate(async () => (await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.orbital().time);
      const hit = await position(page, 'FiveACorePrimaryHitTarget'); await page.mouse.click(hit.x, hit.y);
      await page.waitForFunction(() => window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen()); await page.waitForTimeout(350);
      const paused = await page.evaluate(async () => (await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.orbital().time);
      await page.mouse.move(1400, 400); await page.mouse.wheel(0, 500); await page.waitForTimeout(350);
      const afterWheel = await page.evaluate(async () => (await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.orbital().time);
      await page.keyboard.press('Escape'); await page.waitForTimeout(350);
      const resumed = await page.evaluate(async () => (await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene').userData.orbital().time);
      report.interaction = { before, paused, afterWheel, resumed };
      report.runtime = await page.evaluate(async () => {
        const sceneObject = (await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('FiveAScene');
        const points = sceneObject.getObjectByName('FiveAOrbitalSurfaceParticles');
        return { loop: await import('/src/engine/loop.js').then(module => module.getLoopStatus()), canvas: document.querySelectorAll('canvas').length,
          particleCount: points.geometry.attributes.position.count, energyVariant: points.material.vertexShader.includes('centerField') ? 'A' : null,
          activeScene: window.__GALAXY_TOUR_STATUS__?.activeScene, panelOpen: window.__ACTIVE_THEORY_FIVEA_DATA_PANEL__.isOpen() };
      });
    }
    await context.close();
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out, `${mode}-report.json`), JSON.stringify(report, null, 2));
  }
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  console.log(`${mode} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
