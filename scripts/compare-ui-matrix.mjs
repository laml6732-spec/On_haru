import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const before=JSON.parse(await fs.readFile('test-results/before/report.json'));
const after=JSON.parse(await fs.readFile('test-results/after/report.json'));
const report={configurations:[],screenshots:[],regressions:[],existingFailures:[]};
for(const a of after){const b=before.find(r=>r.width===a.width&&r.theme===a.theme);assert.ok(b);const label=`${a.width}-${a.theme}`;
 let identical;try{assert.deepEqual(a.styles,b.styles);identical=true}catch{identical=false;report.regressions.push(label+' rendered styles/geometry differ')}
 report.configurations.push({label,stylesIdentical:identical,checks:a.checks.length,passed:a.checks.filter(c=>c.ok).length,errors:a.errors});
 for(const c of a.checks.filter(c=>!c.ok)){const existing=b.checks.some(x=>x.name===c.name&&!x.ok);(existing?report.existingFailures:report.regressions).push({configuration:label,...c})}
 for(const screen of ['first-run',...a.screens]){const filename=`${label}-${screen}.png`;const x=await fs.readFile('test-results/before/'+filename),y=await fs.readFile('test-results/after/'+filename);const identical=x.equals(y);report.screenshots.push({filename,identical});if(!identical)report.regressions.push(filename+' requires visual review')}
}
await fs.writeFile('test-results/comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(report.regressions.length||report.existingFailures.length||after.length!==6)process.exitCode=1;
