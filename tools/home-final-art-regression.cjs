const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const out=path.resolve(__dirname,'..',process.env.HOME_REGRESSION_OUTPUT||'art/home-final-art');
const base=process.env.HOME_REGRESSION_URL||'http://127.0.0.1:5180/?galaxyV3=1&galaxyHero=repaired_m3&homeArt=final&v3UseGpuStars=1&debugV3GpuStars=1&debugV4SupportStars=1&debugV3BusinessNebula=1&debugV3Foreground=0&earthV2=1&earthV3=1';
function validate(report){
  assert.equal(report.errors.length,0);assert.equal(report.entries.length,3);assert.equal(report.bindings.length,5);
  assert.equal(report.loop.activeRafChains,1);assert.equal(report.loop.canvas,1);
  // Playwright itself installs two hit-target interceptors on the first click.
  // They are test instrumentation, not application-owned duplicate listeners.
  const application=report.listenerDetail.filter(r=>!r.stack.includes('addHitTargetInterceptorListeners'));
  const counts=Object.fromEntries(Object.keys(report.listeners).map(type=>[type,application.filter(r=>r.type===type).length]));
  assert.deepEqual(counts,report.listeners);
  for(const proof of report.bindings){
    assert.deepEqual(proof.stages.execution.stageIds,['A1','A2','A3','A4','A5']);
    for(const [id,actual] of Object.entries(proof.stages.execution.renderer)){
      for(const key of ['scale','energy'])assert.equal(actual.binding[key],proof.stages.binding.find(b=>b.targetId===id&&b.channel===`FIVEA_STAGE_${key.toUpperCase()}`).value);
      assert.ok(actual.pointScale>0&&actual.opacity>0);
    }
    if(proof.flow){
      const actual=proof.flow.execution.renderer[proof.flow.transitionId];
      assert.equal(actual.binding.flowStrength,proof.flow.visual.flowStrength);
      assert.ok(actual.alphas.length>0&&actual.alphas.some(a=>a>0));
    }
  }
  return {entries:report.entries.map(e=>({key:e.key,entry:e.entered.currentChapter,return:e.returned.currentChapter,panelOpened:e.panelOpen,panelClosed:e.panelClosed})),bindings:report.bindings.length,applicationListeners:counts,canvas:report.loop.canvas,raf:report.loop.activeRafChains,errors:report.errors};
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  if(process.argv.includes('--verify-report')){console.log(JSON.stringify(validate(JSON.parse(fs.readFileSync(path.join(out,'interaction-report.json'),'utf8')))));return}
  const b=await chromium.launch({channel:'msedge',headless:true});const report={errors:[],entries:[],bindings:[]};
  try{
    const p=await b.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
    p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
    await p.addInitScript(()=>{
      const registrations=[];const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener=function(type,listener,options){
        const capture=typeof options==='boolean'?options:!!options?.capture;
        if((this===window||this===document)&&!registrations.some(r=>!r.signal?.aborted&&r.target===this&&r.type===type&&r.listener===listener&&r.capture===capture))registrations.push({target:this,type,listener,capture,signal:options?.signal,stack:new Error().stack});
        return add.call(this,type,listener,options);
      };
      EventTarget.prototype.removeEventListener=function(type,listener,options){
        const capture=typeof options==='boolean'?options:!!options?.capture;
        const i=registrations.findIndex(r=>r.target===this&&r.type===type&&r.listener===listener&&r.capture===capture);if(i>=0)registrations.splice(i,1);
        return remove.call(this,type,listener,options);
      };
      window.__HOME_GATE_LISTENERS__=()=>Object.fromEntries(['wheel','pointermove','pointerdown','pointerup'].map(type=>[type,registrations.filter(r=>!r.signal?.aborted&&r.type===type).length]));
      window.__HOME_GATE_LISTENER_DETAIL__=()=>registrations.filter(r=>!r.signal?.aborted&&/pointer|wheel/.test(r.type)).map(r=>({type:r.type,name:r.listener.name,stack:r.stack}));
    });
    await p.goto(base,{waitUntil:'networkidle'});await p.waitForTimeout(2000);
    const status=()=>p.evaluate(()=>({...window.__GALAXY_TOUR_STATUS__}));
    report.initial=await status();report.listeners=await p.evaluate(()=>window.__HOME_GATE_LISTENERS__());
    for(const [key,name,scene,panel] of [
      ['geo','GEONebula','GeoScene',null],['fivea','5ANebula','FiveAScene','__ACTIVE_THEORY_FIVEA_DATA_PANEL__'],
      ['brandmind','BrandMindNebula','BrandMindScene','__ACTIVE_THEORY_BRAND_MIND_DATA_PANEL__']]){
      const earthBefore=base.includes('earthHeroLock=1')?await p.evaluate(()=>({...window.__ACTIVE_THEORY_EARTH_HYBRID__?.rotation})):null;
      const point=await p.evaluate(async name=>{
        const s=(await import('/src/engine/scenes.js')).getActiveScene(),c=(await import('/src/engine/camera.js')).getCamera();
        const T=await import('/node_modules/.vite/deps/three.js');const v=s.getObjectByName(name).getWorldPosition(new T.Vector3()).project(c);return [(v.x+1)*800,(1-v.y)*450];
      },name);
      await p.mouse.move(...point);await p.waitForTimeout(500);
      await p.screenshot({path:path.join(out,`HOVER_${key}.png`)});
      await p.mouse.click(...point);
      await p.waitForFunction(scene=>window.__GALAXY_TOUR_STATUS__?.activeScene===scene&&!window.__GALAXY_TOUR_STATUS__?.transitionTo,scene,{timeout:15000});
      await p.waitForTimeout(2500);
      const entry={key,point,entered:await status()};
      await p.screenshot({path:path.join(out,`ENTRY_${key}.png`)});
      if(panel){
        await p.evaluate(k=>window[k].open('home-final-gate'),panel);entry.panelOpen=await p.evaluate(k=>window[k].isOpen(),panel);
        await p.keyboard.press('Escape');entry.panelClosed=await p.evaluate(k=>!window[k].isOpen(),panel);
        assert.ok(entry.panelOpen&&entry.panelClosed);
      }
      for(let i=0;i<24;i++){
        const s=await status();if(s.activeScene==='HeroScene'&&s.routeIndex===0)break;
        await p.mouse.wheel(0,-500);await p.waitForTimeout(220);
      }
      await p.waitForTimeout(1800);entry.returned=await status();
      if(earthBefore){entry.earthLifecycle={before:earthBefore,after:await p.evaluate(()=>({...window.__ACTIVE_THEORY_EARTH_HYBRID__?.rotation})),mix:await p.evaluate(()=>window.__ACTIVE_THEORY_EARTH_HYBRID__?.mix)};assert.ok(entry.earthLifecycle.after.time>=earthBefore.time);assert.equal(entry.earthLifecycle.mix,0);}
      assert.equal(entry.returned.routeIndex,0);assert.equal(entry.returned.activeScene,'HeroScene');
      report.entries.push(entry);fs.writeFileSync(path.join(out,'interaction-report.json'),JSON.stringify(report,null,2));
    }
    report.listenersAfter=await p.evaluate(()=>window.__HOME_GATE_LISTENERS__());
    report.listenerDetail=await p.evaluate(()=>window.__HOME_GATE_LISTENER_DETAIL__());
    assert.equal(report.listenersAfter.wheel,1);assert.equal(report.listenersAfter.pointermove,1);
    report.loop=await p.evaluate(async()=>({...(await import('/src/engine/loop.js')).getLoopStatus(),canvas:document.querySelectorAll('canvas').length}));
    for(const extra of ['v2FiveAState=contrast',...['A1_TO_A2','A2_TO_A3','A3_TO_A4','A4_TO_A5'].map(id=>`v2FiveATransition=${id}&v2FiveATransitionState=high`)]){
      await p.goto(base+'&scene=fivea&'+extra,{waitUntil:'networkidle'});
      await p.waitForFunction(()=>document.documentElement.dataset.v2FiveAStagesProof);
      const proof=await p.evaluate(()=>({stages:JSON.parse(document.documentElement.dataset.v2FiveAStagesProof),flow:document.documentElement.dataset.v2FiveAFlowProof?JSON.parse(document.documentElement.dataset.v2FiveAFlowProof):null}));
      report.bindings.push({extra,...proof});
    }
    console.log(JSON.stringify(validate(report)));
  }catch(e){report.failure=e.stack;throw e}
  finally{fs.writeFileSync(path.join(out,'interaction-report.json'),JSON.stringify(report,null,2));await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
