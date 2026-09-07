import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createFiveAScene } from '../../scenes/fiveAScene.js';
import { createFiveAStageRendererAdapter, FIVE_A_RENDERER_STAGE_IDS as IDS } from './fiveAStageRendererAdapter.js';
import { createFiveAStagesDemoSnapshot, resolveFiveAStagesDemo } from '../runtime/fiveAStagesDemo.js';
import { createV2ConsumerProvider } from '../runtime/consumerProvider.js';
import { buildVisualBindingPlan } from '../binding/bindingPlanner.js';
import { buildFiveADataPanelViewModel } from '../../ui/fiveA-data-panel/fiveADataPanelViewModel.js';
import { CANONICAL_FIVE_A_MOCK } from '../mock/canonicalFixtures.js';

globalThis.window = { location: { search: '' } };
globalThis.document = { createElement: () => ({ getContext: () => ({ clearRect() {}, fillText() {} }) }) };
const results = [];
function test(name, run) { try { run(); results.push({name,status:'pass'}); } catch (e) { results.push({name,status:'fail',error:e.stack}); } }
function pipeline(snapshot) {
  const consumer = createV2ConsumerProvider({fiveASnapshot:snapshot}).getFiveA();
  const visual = consumer.buildVisualState();
  return { consumer, visual, plan:buildVisualBindingPlan(visual), panel:buildFiveADataPanelViewModel(snapshot,consumer.derivedMetrics) };
}
const cases = Object.fromEntries(['balanced','contrast','partial'].map(name=>[name,pipeline(createFiveAStagesDemoSnapshot(name))]));
const scene = createFiveAScene();
const adapter = createFiveAStageRendererAdapter(scene.resolveStageRendererTarget);
function tick() { scene.update({cameraOffset:{x:0,y:0,z:0,targetY:0}},0,12,1); }
function actual() { return adapter.getReport().renderer; }
function layout() { return Object.fromEntries(IDS.map(id=> {const node=scene.group.getObjectByName(`FiveAStageNode${id}`); return [id,{position:node.position.toArray(),rotation:node.rotation.toArray()}];})); }
tick();
const original = actual();
const originalLayout = layout();
const gpu = scene.group.getObjectByName('FiveAStageGpuParticleSpheres');
const resources = {geometry:gpu.geometry.uuid,material:gpu.material.uuid,count:gpu.geometry.attributes.position.count};
const evidence = {};
for (const [name, run] of Object.entries(cases)) {
  adapter.apply(run.plan);tick();
  evidence[name] = {canonical:run.consumer.snapshot.fiveA.stages,panel:run.panel.stageRows,visualState:run.visual.fiveA.stages,binding:run.plan.fiveA.stages,execution:adapter.getReport()};
}
for (const id of IDS) {
  test(`${id} resolves stable target independent of registry lookup order`,()=>assert.equal(scene.resolveStageRendererTarget(id).stageId,id));
  test(`${id} scale and energy reach actual matrix and uniforms`,()=>{
    const real=evidence.contrast.execution.renderer[id];
    const visual=cases.contrast.visual.fiveA.stages[id];
    assert.ok(Math.abs(real.pointScale/original[id].pointScale-visual.scale)<1e-6);
    assert.ok(Math.abs(real.opacity/original[id].opacity-visual.energy)<1e-6);
    assert.ok(Math.abs(Math.hypot(...real.matrix.slice(0,3))/Math.hypot(...original[id].matrix.slice(0,3))-visual.scale)<1e-12);
  });
  test(`${id} isolated population/strength change is monotonic and leaves other four intact`,()=>{
    const low=structuredClone(cases.balanced.consumer.snapshot);
    low.fiveA.stages[id].population.value=10; low.fiveA.stages[id].strength.value=20;
    const high=structuredClone(low); high.fiveA.stages[id].population.value=100000;high.fiveA.stages[id].strength.value=90;
    const a=pipeline(low),b=pipeline(high);
    adapter.apply(a.plan);tick();const before=actual();
    adapter.apply(b.plan);tick();const after=actual();
    assert.ok(a.panel.stageRows.find(r=>r.stageId===id).population<b.panel.stageRows.find(r=>r.stageId===id).population);
    assert.ok(a.visual.fiveA.stages[id].scale<b.visual.fiveA.stages[id].scale);
    assert.ok(after[id].pointScale>before[id].pointScale);assert.ok(after[id].opacity>before[id].opacity);
    for(const other of IDS.filter(key=>key!==id)) assert.deepEqual(after[other],before[other]);
  });
  test(`${id} panel / visual / binding / renderer share canonical identity`,()=>{
    for(const run of Object.values(evidence)) {
      const row=run.panel.find(row=>row.stageId===id);
      assert.equal(row.population,run.canonical[id].population.value);
      for(const property of ['scale','energy']) {
        const entry=run.binding.find(e=>e.stageId===id&&e.sourcePath.endsWith('.'+property));
        assert.equal(entry.value,run.visualState[id][property]);
        assert.equal(run.execution.renderer[id].binding[property],entry.value);
      }
    }
  });
}
test('no A6 or Opportunity renderer target',()=>{assert.equal(scene.resolveStageRendererTarget('A6'),null);assert.equal(scene.resolveStageRendererTarget('O'),null);assert.deepEqual(IDS,['A1','A2','A3','A4','A5']);});
test('T1 T2 T3 switching and repeated plans are exact without extra animation ticks',()=>{
  adapter.apply(cases.balanced.plan);tick();adapter.apply(cases.contrast.plan);const contrast=actual();
  for(let i=0;i<200;i++){adapter.apply(cases.partial.plan);adapter.apply(cases.balanced.plan);adapter.apply(cases.contrast.plan);}
  assert.deepEqual(actual(),contrast);adapter.apply(cases.contrast.plan);assert.deepEqual(actual(),contrast);
});
test('animation updates do not compound binding',()=>{tick();const before=actual();for(let i=0;i<100;i++)tick();assert.deepEqual(actual(),before);});
test('stage position and rotation remain owned by art',()=>assert.deepEqual(layout(),originalLayout));
test('geometry, material and particle count are unchanged',()=>assert.deepEqual({geometry:gpu.geometry.uuid,material:gpu.material.uuid,count:gpu.geometry.attributes.position.count},resources));
test('four transition facts and binding values remain unchanged',()=>{for(const run of Object.values(cases)){assert.deepEqual(run.consumer.snapshot.fiveA.transitions,CANONICAL_FIVE_A_MOCK.fiveA.transitions);assert.deepEqual(run.plan.fiveA.transitions,cases.balanced.plan.fiveA.transitions);}});
test('Opportunity remains independent and untouched',()=>{for(const run of Object.values(cases))assert.deepEqual(run.consumer.snapshot.fiveA.opportunityPool,CANONICAL_FIVE_A_MOCK.fiveA.opportunityPool);});
test('missing strength uses safe energy fallback, not business zero',()=>{
  const partial=evidence.partial;
  assert.equal(partial.canonical.A2.strength.value,null);
  assert.equal(partial.execution.renderer.A2.binding.energy,0.15);
  assert.ok(partial.execution.metadata.entries.find(e=>e.stageId==='A2'&&e.channel==='FIVEA_STAGE_ENERGY').missing);
});
test('missing confidence remains traceable',()=>{assert.equal(evidence.partial.canonical.A4.confidence.value,null);assert.ok(evidence.partial.execution.metadata.sourceMissingPaths.includes('fiveA.stages.A4.activity'));});
test('MOCK / PARTIAL and SYNTHETIC lineage survive apply',()=>{assert.equal(evidence.balanced.execution.metadata.sourceType,'MOCK');assert.equal(evidence.partial.execution.metadata.sourceType,'PARTIAL');assert.equal(evidence.partial.execution.metadata.lineage.verificationStatus,'SYNTHETIC');});
function invalid(change){const plan=structuredClone(cases.balanced.plan);change(plan);const before=adapter.getReport();assert.throws(()=>adapter.apply(plan));assert.deepEqual(adapter.getReport(),before);}
test('wrong target aborts all five writes',()=>invalid(p=>{p.fiveA.stages.find(e=>e.stageId==='A5').targetId='A4';}));
test('duplicate channel aborts atomically',()=>invalid(p=>p.fiveA.stages.push({...p.fiveA.stages[0]})));
test('unsupported channel aborts atomically',()=>invalid(p=>{p.fiveA.stages[0].channel='UNSUPPORTED';}));
for(const value of [NaN,Infinity,99]) test(`illegal ${value} rejected before writes`,()=>invalid(p=>{p.fiveA.stages.find(e=>e.stageId==='A5').value=value;}));
test('reordered entries and reversed target acquisition preserve mapping',()=>{
  const other=createFiveAStageRendererAdapter(scene.resolveStageRendererTarget,{stageIds:[...IDS].reverse()});
  const plan=structuredClone(cases.contrast.plan);plan.fiveA.stages.reverse();other.apply(plan);tick();
  for(const id of IDS)assert.deepEqual(other.getReport().renderer[id],evidence.contrast.execution.renderer[id]);other.dispose();
});
test('late write failure rolls every touched stage back',()=>{
  let fail=true;const values=Object.fromEntries(IDS.map(id=>[id,{scale:1,energy:1}]));
  const other=createFiveAStageRendererAdapter(id=>({stageId:id,read:()=>({binding:{...values[id]}}),write(v){values[id]={...v};if(id==='A4'&&fail){fail=false;throw new Error('injected failure');}}}));
  assert.throws(()=>other.apply(cases.contrast.plan));for(const id of IDS)assert.deepEqual(values[id],{scale:1,energy:1});assert.equal(other.getReport().metadata,null);other.dispose();
});
test('invalid capability scope / missing stable target rejected',()=>{assert.throws(()=>createFiveAStageRendererAdapter(()=>null));assert.throws(()=>createFiveAStageRendererAdapter(scene.resolveStageRendererTarget,{stageIds:['A6']}));});
test('panel presentation does not change source or binding',()=>{const before=adapter.getReport().metadata;scene.setPanelPresentationOpen(true);tick();scene.setPanelPresentationOpen(false);tick();assert.deepEqual(adapter.getReport().metadata,before);});
test('adapter disposal restores all stage art values',()=>{adapter.dispose();tick();for(const id of IDS)assert.deepEqual(scene.resolveStageRendererTarget(id).read(),original[id]);adapter.dispose();assert.equal(adapter.getReport().renderer,null);assert.throws(()=>adapter.apply(cases.balanced.plan));});
test('scene disposal invalidates targets; reopening gives fresh targets',()=>{
  const target=scene.resolveStageRendererTarget('A1');scene.dispose();assert.throws(()=>target.read());
  const fresh=createFiveAScene();const other=createFiveAStageRendererAdapter(fresh.resolveStageRendererTarget);other.apply(cases.partial.plan);assert.equal(other.getReport().renderer.A2.binding.energy,0.15);other.dispose();fresh.dispose();
});
test('production and default entry do not activate demo',()=>{assert.equal(resolveFiveAStagesDemo('?v2FiveAState=contrast',false),null);assert.equal(resolveFiveAStagesDemo('?scene=fivea',true),null);assert.throws(()=>createFiveAStagesDemoSnapshot('unknown'));});
test('fixtures are deterministic',()=>assert.deepEqual(createFiveAStagesDemoSnapshot('contrast'),createFiveAStagesDemoSnapshot('contrast')));
test('adapter has no render loop or business computations',()=>{const source=readFileSync(new URL('./fiveAStageRendererAdapter.js',import.meta.url),'utf8');for(const forbidden of ['requestAnimationFrame','WebGLRenderer','document.','normalizeDataPoint','deriveFiveA'])assert.ok(!source.includes(forbidden));});
test('runtime exclusive scope and single provider; disposal precedes scene destruction',()=>{
  const source=readFileSync(new URL('../../engine/index.js',import.meta.url),'utf8');assert.equal((source.match(/createV2ConsumerProvider\(/g)||[]).length,1);assert.ok(source.includes('stagesDemo ? null : resolveFiveAA3Demo'));
  assert.equal((source.match(/createFiveAStageRendererAdapter\(/g)||[]).length,1);assert.ok(source.indexOf('stagesAdapter?.dispose()')<source.indexOf('sceneManager.dispose()'));
});
const summary={passed:results.filter(r=>r.status==='pass').length,failed:results.filter(r=>r.status==='fail').length,results};
console.log(JSON.stringify(summary,null,2));
if(process.argv.includes('--report')){const folder=new URL('../../../art/v2-3b-fivea-stages/',import.meta.url);mkdirSync(folder,{recursive:true});writeFileSync(new URL('stage-values.json',folder),JSON.stringify({summary,evidence},null,2));}
if(summary.failed)process.exitCode=1;
