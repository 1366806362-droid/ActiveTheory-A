const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function tests(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?tests(path.join(dir,e.name)):e.name.endsWith('.test.mjs')?[path.join(dir,e.name)]:[]);}
const results=[];
for(const file of tests(path.join(root,'src'))){
  const run=spawnSync(process.execPath,[file],{cwd:root,encoding:'utf8'});
  let summary;try{summary=JSON.parse(run.stdout);}catch{}
  results.push({file:path.relative(root,file),exitCode:run.status,passed:summary?.passed,failed:summary?.failed,output:run.stdout,stderr:run.stderr});
}
fs.mkdirSync(path.join(root,'art/m3-runtime'),{recursive:true});
fs.writeFileSync(path.join(root,'art/m3-runtime/test-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({suites:results.length,passed:results.reduce((n,r)=>n+(r.passed||0),0),failed:results.filter(r=>r.exitCode!==0||r.failed>0).map(r=>({file:r.file,stderr:r.stderr,output:r.output})),unparsed:results.filter(r=>r.passed===undefined).map(r=>({file:r.file,output:r.output}))}));
if(results.some(r=>r.exitCode!==0||r.failed>0))process.exitCode=1;
