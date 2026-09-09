// Actual 10-second Web runtime recording; same geometry and update loop, no frame synthesis.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');const {chromium}=require('playwright');
const out=path.resolve(__dirname,'../art/earth-v13/final');
(async()=>{
  const report=JSON.parse(fs.readFileSync(path.join(out,'runtime-report.json')));
  const url=report.cases.find(c=>c.name==='EARTH_V13_CLOSEUP').url.replace('&earthFreeze=1','');
  const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});
  const frames=[],errors=[];let start,end,initial,final;
  try{
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await p.goto(url,{waitUntil:'networkidle'});await p.mouse.move(800,450);await p.waitForTimeout(1800);
    const state=()=>p.evaluate(async()=>{
      const root=(await import('/src/engine/scenes.js')).getActiveScene().getObjectByName('EarthRoot');
      return root.userData.earthRotation;
    });
    initial=await state();const cdp=await context.newCDPSession(p);
    cdp.on('Page.screencastFrame',e=>{frames.push(Buffer.from(e.data,'base64'));void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
    start=Date.now();await cdp.send('Page.startScreencast',{format:'jpeg',quality:95,maxWidth:1600,maxHeight:900,everyNthFrame:4});
    await p.waitForTimeout(10000);await cdp.send('Page.stopScreencast');end=Date.now();final=await state();
  }finally{await context.close();await browser.close();}
  assert.equal(errors.length,0);assert.ok(frames.length>30);
  const seconds=(end-start)/1000,degrees=Math.abs(final.surfaceAngle-initial.surfaceAngle)*180/Math.PI;
  assert.ok(degrees<1.2,'Unexpected rapid rotation');
  const file=path.join(out,'EARTH_V13_ORBITAL.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(frames.length/seconds),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',file],{input:Buffer.concat(frames)});
  fs.writeFileSync(path.join(out,'motion-report.json'),JSON.stringify({url,seconds,frames:frames.length,degrees,initial,final,errors,recording:'Actual CDP frames; not used for performance metrics'},null,2));console.log(file);
})().catch(e=>{console.error(e);process.exitCode=1});
