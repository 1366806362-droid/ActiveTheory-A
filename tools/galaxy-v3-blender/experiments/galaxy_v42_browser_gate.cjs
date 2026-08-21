const path = require('node:path');
const { chromium } = require('playwright');

const base = 'http://127.0.0.1:4173/';
const isolatedQuery = '?galaxyV3=1&galaxyHero=v4&debugV4Isolated=1&v3UseGpuStars=0&debugV3GpuStars=0&debugV3BusinessNebula=0&debugV3Foreground=0';
const starsQuery = '?galaxyV3=1&galaxyHero=v4&debugV4Isolated=1&v3UseGpuStars=1&debugV3GpuStars=1&debugV3BusinessNebula=0&debugV3Foreground=0';
const outputRoot = path.resolve('art/visual-gate/galaxy-hero-v4-plate-01');

async function inspect(browser, name, query, screenshot) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page:${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`http:${response.status()}:${response.url()}`);
  });
  await page.addInitScript(() => {
    window.__wheelListeners = 0;
    window.__drawCalls = 0;
    window.__rafCallbacks = 0;
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'wheel') window.__wheelListeners += 1;
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      if (type === 'wheel') window.__wheelListeners = Math.max(0, window.__wheelListeners - 1);
      return remove.call(this, type, listener, options);
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => raf((time) => {
      window.__rafCallbacks += 1;
      callback(time);
    });
    for (const ctor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!ctor) continue;
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = ctor.prototype[method];
        if (!original) continue;
        ctor.prototype[method] = function(...args) {
          window.__drawCalls += 1;
          return original.apply(this, args);
        };
      }
    }
  });

  await page.goto(base + query, { waitUntil: 'networkidle' });
  if (query.includes('galaxyHero=v4')) {
    await page.waitForFunction(() => window.__ACTIVE_THEORY_GALAXY_V3__?.heroAsset?.layerCount === 5);
  }
  await page.mouse.move(760, 360);
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => ({ draws: window.__drawCalls, frames: window.__rafCallbacks }));
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ draws: window.__drawCalls, frames: window.__rafCallbacks }));
  await page.screenshot({ path: path.join(outputRoot, screenshot) });
  const runtime = await page.evaluate(() => ({
    canvasCount: document.querySelectorAll('canvas').length,
    wheelListeners: window.__wheelListeners,
    status: window.__ACTIVE_THEORY_GALAXY_V3__ ?? null
  }));
  const frames = Math.max(1, after.frames - before.frames);
  await page.close();
  return {
    name,
    url: base + query,
    screenshot: path.join(outputRoot, screenshot),
    fps: Number((frames / 1.5).toFixed(1)),
    averageDrawCalls: Number(((after.draws - before.draws) / frames).toFixed(1)),
    consoleErrors: errors,
    ...runtime
  };
}

(async () => {
  const launchOptions = { headless: true };
  if (process.env.PLAYWRIGHT_BROWSER_PATH) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  } else if (process.platform === 'win32') {
    launchOptions.channel = 'msedge';
  }
  const browser = await chromium.launch(launchOptions);
  const results = [];
  results.push(await inspect(browser, 'default', '', 'V42_DEFAULT_CHECK.png'));
  results.push(await inspect(browser, 'isolated', isolatedQuery, 'V42_ISOLATED.png'));
  results.push(await inspect(browser, 'stars', starsQuery, 'V42_STARS.png'));
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
