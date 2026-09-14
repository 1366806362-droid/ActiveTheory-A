import test from 'node:test';import assert from 'node:assert/strict';
import {createMeteorClock,HOME_METEOR_PATHS,meteorPathClear,createHomeMeteorAccent} from './homeMeteorAccent.js';
test('seeded HOME cadence is sparse, single-event and deterministic with full smooth duration',()=>{
 const a=createMeteorClock(12),b=createMeteorClock(12);const events=[];let visible=0;
 for(let f=0;f<120*180;f++){const t=f/120,x=a.update(1/120,t,true,false,false);assert.deepEqual(x,b.update(1/120,t,true,false,false));if(x.start)events.push(t);if(x.phase>=0)visible++;}
 assert.ok(events.length>=5&&events.length<=10);for(let i=1;i<events.length;i++)assert.ok(events[i]-events[i-1]>=18&&events[i]-events[i-1]<=30.3);assert.ok(visible/(120*180)<.075);
});
test('hidden, non-HOME, resume gaps and reduced motion never queue catch-up playback',()=>{
 const c=createMeteorClock();assert.equal(c.update(.01,0,true,false,false,true).start,true);
 assert.equal(c.update(.01,1,true,true,false).phase,-1);
 for(const state of [[false,false,false],[true,false,true]])assert.equal(c.update(.01,2,...state,true).phase,-1);
 const resumed=c.update(.01,100,true,false,false);assert.equal(resumed.phase,-1);assert.ok(resumed.remaining>=16.9);
 assert.equal(c.update(.01,101,true,false,false).phase,-1);
});
test('complete path envelope is tested before playback; rejected corridors do not draw',()=>{
 assert.equal(meteorPathClear(HOME_METEOR_PATHS[0],[[0,0,1,1]]),false);assert.equal(meteorPathClear(HOME_METEOR_PATHS[0],[[0,0,.3,.5]]),true);
 const m=createHomeMeteorAccent({exclusions:()=>[[0,0,1,1]]});m.debug.triggerOnce();m.update(.01,0,true);assert.equal(m.mesh.visible,false);m.dispose();
});
