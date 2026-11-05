import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const base=process.env.ONHARU_URL||'https://on-haru.laml6732.workers.dev/';const release=(await fs.readFile('public/legacy/index.html','utf8')).match(/name="kona-release" content="([a-z0-9]+)"/)[1];const hash=b=>createHash('sha256').update(b).digest('hex');const report={url:base,release,cases:[]};
for(const [path,source]of [['','index.html'],['app.7cb1b71d4eb6.css','app.7cb1b71d4eb6.css'],['runtime/legacy-controllers.9a6fbb5e22cc.js','runtime/legacy-controllers.9a6fbb5e22cc.js'],['runtime/settings.58b48f87b05a.js','runtime/settings.58b48f87b05a.js'],['sw.js','sw.js']]){
 const local=await fs.readFile('public/legacy/'+source);const url=new URL(path,base);url.searchParams.set('rev',release);url.searchParams.set('verify',release);let res,body;
 for(let attempt=0;attempt<6;attempt++){try{res=await fetch(url,{signal:AbortSignal.timeout(20000)});body=Buffer.from(await res.arrayBuffer());if(res.ok&&hash(body)===hash(local))break}catch{}if(attempt<5)await new Promise(r=>setTimeout(r,10000))}
 const ok=!!res?.ok&&body&&hash(body)===hash(local)&&(!path?new URL(res.url).pathname==='/':true);report.cases.push({path:path||'/',ok,expectedSha256:hash(local),actualSha256:body?hash(body):null,status:res?.status,finalURL:res?.url});console.log(ok?'PASS':'FAIL',path||'/');
}
await fs.mkdir('test-results/live',{recursive:true});await fs.writeFile('test-results/live/static.json',JSON.stringify(report,null,2));if(report.cases.some(c=>!c.ok))process.exitCode=1;
