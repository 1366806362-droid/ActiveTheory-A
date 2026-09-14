const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.test.mjs')?[path.join(dir,e.name)]:[]);
const files=walk('src').sort(),reports=[];fs.mkdirSync('art/fivea-v11/tests',{recursive:true});
for(const file of files){
  const p=spawnSync(process.execPath,['--test',file],{encoding:'utf8',maxBuffer:20*1024*1024});
  const output=p.stdout+p.stderr;fs.writeFileSync(path.join('art/fivea-v11/tests',file.replaceAll(/[\\/]/g,'_')+'.txt'),output);
  const custom=[...output.matchAll(/"passed":\s*(\d+)/g)];
  const inventory=output.match(/Renderer target inventory tests: (\d+)\/(\d+) PASS/);
  const value=key=>Number(output.match(new RegExp('^# '+key+' (\\d+)','m'))?.[1]||0);
  const passed=inventory?Number(inventory[1]):custom.length?custom.reduce((n,m)=>n+Number(m[1]),0):value('pass');
  const failed=custom.length?[...output.matchAll(/"failed":\s*(\d+)/g)].reduce((n,m)=>n+Number(m[1]),0):value('fail');
  reports.push({file,exit:p.status,runnerCases:value('tests'),passed,failed,skipped:value('skipped'),countSource:custom.length||inventory?'custom harness named cases':'node:test cases'});
  console.log(file,passed,failed,p.status);
}
const summary={files:files.length,cases:reports.reduce((n,r)=>n+r.passed+r.failed+r.skipped,0),passed:reports.reduce((n,r)=>n+r.passed,0),failed:reports.reduce((n,r)=>n+r.failed,0),skipped:reports.reduce((n,r)=>n+r.skipped,0),runnerCases:reports.reduce((n,r)=>n+r.runnerCases,0),reports};
fs.writeFileSync('art/fivea-v11/tests/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,reports:undefined}));
if(reports.some(r=>r.exit!==0||r.failed))process.exitCode=1;
