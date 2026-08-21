const path = require('node:path');
const { chromium } = require('playwright');

const base = 'http://127.0.0.1:4173/';
const shared = 'galaxyV3=1&galaxyHero=v4&debugV4Isolated=1&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=0&debugV3Foreground=0';
const outputRoot = path.resolve('art/visual-gate/earth-v2-blue-atmosphere-01');

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
  await page.waitForFunction(() => window.__ACTIVE_THEORY_GALAXY_V3__?.heroAsset?.layerCount === 5);
  if (query.includes('earthV2=1')) {
    await page.waitForFunction(() => window.__ACTIVE_THEORY_EARTH_V2__?.textureStatus === 'ready');
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
    earthV2: window.__ACTIVE_THEORY_EARTH_V2__ ?? null,
    galaxyV3: window.__ACTIVE_THEORY_GALAXY_V3__ ?? null
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
  const results = [
    await inspect(browser, 'no-earth', `?${shared}&earthV2=0`, 'EARTH_V2_OFF.png'),
    await inspect(browser, 'earth-v2', `?${shared}&earthV2=1`, 'EARTH_V2_ON.png')
  ];
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
