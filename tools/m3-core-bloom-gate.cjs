const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
    page.on('pageerror',error=>{throw error});
    await page.goto('http://127.0.0.1:5180/tools/visual-gate/m3-bloom-check.html');
    await page.waitForFunction(()=>window.auditReady);
    for(const mode of ['OFF','ORIGINAL','CALIBRATED']) {
      await page.evaluate(value=>window.runBloomAudit(value),mode);
      await page.screenshot({path:path.resolve(__dirname,`../art/m3-source-repair/M3_CORE_BLOOM_${mode}.png`)});
    }
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
