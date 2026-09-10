// Optional motion evidence from the same real runtime; no synthetic frame interpolation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const out=path.resolve(__dirname,'..','art/earth-v12');
(async()=>{
  const url=JSON.parse(fs.readFileSync(path.join(out,'runtime-report.json'),'utf8')).cases.find(c=>c.name==='EARTH_V12_HOME').url.replace('&earthFreeze=1','').replace('&earthAudit=1','');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});
  const errors=[],frames=[];let begin,end;
  try{
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.goto(url,{waitUntil:'networkidle'});await page.mouse.move(800,450);await page.waitForTimeout(2200);
    const cdp=await context.newCDPSession(page);
    cdp.on('Page.screencastFrame',event=>{
      frames.push(Buffer.from(event.data,'base64'));
      void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
    });
    begin=Date.now();
    await cdp.send('Page.startScreencast',{format:'jpeg',quality:95,maxWidth:1600,maxHeight:900,everyNthFrame:4});
    for(const [x,y] of [[720,440],[800,450],[880,460],[800,450],[720,440],[800,450]]){
      await page.mouse.move(x,y,{steps:35});await page.waitForTimeout(850);
    }
    await cdp.send('Page.stopScreencast');end=Date.now();
  }finally{await context.close();await browser.close()}
  assert.equal(errors.length,0);
  const seconds=(end-begin)/1000,destination=path.join(out,'EARTH_V12_ORBITAL.mp4');
  assert.ok(frames.length>30);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(frames.length/seconds),'-i','pipe:0',
    '-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',destination],{input:Buffer.concat(frames)});
  fs.writeFileSync(path.join(out,'motion-report.json'),JSON.stringify({url,destination,seconds,frames:frames.length,errors,
    note:'CDP screencast uses the installed FFmpeg. Performance is measured separately without recording.'},null,2));
  console.log(destination);
})().catch(e=>{console.error(e);process.exitCode=1});
