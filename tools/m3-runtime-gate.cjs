const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, process.env.M3_OUTPUT_DIR || 'art/m3-runtime');
const base = process.env.M3_BASE_URL || 'http://127.0.0.1:5180/';
const params = `galaxyV3=1&galaxyHero=${process.env.M3_HERO || 'final_m3'}&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1`;
const candidateFilename = name => process.env.M3_HERO === 'repaired_m3'
  ? name.replace('M3_LDI_FIXED', 'M3_REPAIRED').replace('M3_LDI_PARALLAX', 'M3_REPAIRED_PARALLAX') : name;
async function state(page) {
  return page.evaluate(async () => ({
    time: performance.now(), loop: (await import('/src/engine/loop.js')).getLoopStatus(),
    canvas: document.querySelectorAll('canvas').length,
    galaxy: window.__ACTIVE_THEORY_GALAXY_V3__, earth: window.__ACTIVE_THEORY_EARTH_V2__,
    tour: window.__GALAXY_TOUR_STATUS__, viewport: [innerWidth,innerHeight,devicePixelRatio],
    camera: (await import('/src/engine/camera.js')).getCamera().position.toArray()
  }));
}
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const report = {};
  try {
    for (const [name, extra, screenshot] of [
      ['home', '', 'HOME_M3_LDI_FIXED_RUNTIME.png'],
      ['isolated', '&debugV4Isolated=1&v3UseGpuStars=0&debugV3GpuStars=0&debugV4SupportStars=0&debugV3BusinessNebula=0&debugBusinessLabels=0&earthV2=0&earthV3=0', 'HOME_M3_LDI_FIXED_ISOLATED.png'],
      ['fivea', '&scene=fivea', 'FIVEA_REGRESSION.png'],
      ['brandmind', '&scene=brandmind', 'BRAND_MIND_REGRESSION.png'],
      ['geo', '&scene=geo', 'GEO_REGRESSION.png']
    ]) {
      const page = await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
      const errors=[],warnings=[];
      page.on('pageerror', e=>errors.push(e.message));
      page.on('console', m=>{if(m.type()==='error') errors.push(m.text()); if(m.type()==='warning') warnings.push(m.text());});
      page.on('response', r=>{if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`);});
      const query=new URLSearchParams(params);
      for(const [key,value] of new URLSearchParams(extra.replace(/^&/,''))) query.set(key,value);
      const url=base+'?'+query;
      await page.goto(url,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.__ACTIVE_THEORY_GALAXY_V3__?.heroAsset?.layerCount===5);
      await page.mouse.move(800,450);
      await page.waitForTimeout(2000);
      const before=await state(page);
      await page.waitForTimeout(2000);
      const after=await state(page);
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:path.join(output,candidateFilename(screenshot)),animations:'disabled'});
      const entry={url,errors,warnings,...after,fps:(after.loop.frames-before.loop.frames)*1000/(after.time-before.time)};
      if(name==='isolated') {
        for(const [label,x,y] of [['LEFT',740,430],['CENTER',800,450],['RIGHT',860,470]]) {
          await page.mouse.move(x,y);
          await page.waitForTimeout(500);
          await page.screenshot({path:path.join(output,candidateFilename(`HOME_M3_LDI_PARALLAX_CHECK_${label}.png`))});
        }
      }
      if(name==='fivea'||name==='brandmind') {
        const key=name==='fivea'?'__ACTIVE_THEORY_FIVEA_DATA_PANEL__':'__ACTIVE_THEORY_BRAND_MIND_DATA_PANEL__';
        entry.panelExists=await page.evaluate(k=>!!window[k],key);
        await page.evaluate(k=>window[k].open('browser-gate'),key);
        entry.panelOpened=await page.evaluate(k=>window[k].isOpen(),key);
        await page.keyboard.press('Escape');
        entry.panelClosed=await page.evaluate(k=>!window[k].isOpen(),key);
      }
      report[name]=entry;
      await page.close();
      fs.writeFileSync(path.join(output,'runtime-report.json'),JSON.stringify(report,null,2));
      console.log(JSON.stringify({name,fps:entry.fps,canvas:entry.canvas,raf:entry.loop.activeRafChains,errors,warnings,panelOpened:entry.panelOpened,panelClosed:entry.panelClosed}));
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
