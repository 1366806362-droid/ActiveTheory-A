// Native Edge default context: no Playwright focus/visibility emulation.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../art/earth-hero-lock/final/visibility-report.json');
const query='galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1&brandMindMemory=1&homeFinalV1=1&earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1&earthHeroLock=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'earth-lock-visibility-'));
 const executable=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
 const child=spawn(executable,['--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling','--window-position=40,40','--window-size=1600,900','about:blank'],{windowsHide:false,stdio:'ignore'});
 let browser;const report={errors:[],method:'Native Edge default context, noDefaults, two real tabs in the same window'};
 try{
  for(let n=0;n<100&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));n++)await wait(100);
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{noDefaults:true});
  const ctx=browser.contexts()[0],cdp=await browser.newBrowserCDPSession();
  const url=(process.env.EARTH_LOCK_BASE||'http://127.0.0.1:5189/')+'?'+query+'&earthNativeVisibilityProbe=1';
  const {targetId}=await cdp.send('Target.createTarget',{url,newWindow:true,width:1600,height:900});
  let p;for(let n=0;n<100&&!p;n++){p=ctx.pages().find(p=>p.url().includes('earthNativeVisibilityProbe=1'));if(!p)await wait(100)}
  assert.ok(p,'Exact native test target must exist');report.targetId=targetId;report.url=p.url();p.on('pageerror',e=>report.errors.push(e.message));await p.bringToFront();
  await p.waitForFunction(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.production);await p.bringToFront();await wait(800);
  const {windowId}=await cdp.send('Browser.getWindowForTarget',{targetId});report.windowId=windowId;
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});await wait(100);
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await wait(500);
  await p.evaluate(()=>{window.__VISIBILITY_EVIDENCE__=[];document.addEventListener('visibilitychange',()=>window.__VISIBILITY_EVIDENCE__.push({state:document.visibilityState,time:performance.now()}))});
  const read=()=>p.evaluate(async()=>({visibility:document.visibilityState,time:window.__ACTIVE_THEORY_EARTH_HYBRID__.time,phase:window.__ACTIVE_THEORY_EARTH_HYBRID__.rotation,mix:window.__ACTIVE_THEORY_EARTH_HYBRID__.mix,canvas:document.querySelectorAll('canvas').length,loop:(await import('/src/engine/loop.js')).getLoopStatus(),events:window.__VISIBILITY_EVIDENCE__}));
  report.before=await read();assert.equal(report.before.visibility,'visible');
  await cdp.send('Target.activateTarget',{targetId});
  const other=await cdp.send('Target.createTarget',{url:'about:blank#earth-lock-background',newWindow:false,background:false});
  const otherWindow=await cdp.send('Browser.getWindowForTarget',{targetId:other.targetId});report.sameWindow=otherWindow.windowId===windowId;assert.ok(report.sameWindow);
  await wait(1500);report.hidden=await read();
  await cdp.send('Target.activateTarget',{targetId});await wait(1200);report.visible=await read();
  const hiddenEvent=report.visible.events.find(e=>e.state==='hidden'),shownEvent=report.visible.events.find(e=>e.state==='visible'&&e.time>hiddenEvent?.time);
  assert.ok(hiddenEvent&&shownEvent,'Native visibilitychange must report both states');report.actualHiddenMs=shownEvent.time-hiddenEvent.time;
  assert.equal(report.visible.visibility,'visible');assert.ok(report.visible.time>=report.before.time);assert.equal(report.visible.mix,0);assert.equal(report.visible.canvas,1);assert.equal(report.visible.loop.activeRafChains,1);
  assert.equal(report.errors.length,0);
  console.log(JSON.stringify(report));
 }finally{fs.writeFileSync(out,JSON.stringify(report,null,2));if(browser){const c=await browser.newBrowserCDPSession();await c.send('Browser.close').catch(()=>{});await browser.close().catch(()=>{})}else child.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
