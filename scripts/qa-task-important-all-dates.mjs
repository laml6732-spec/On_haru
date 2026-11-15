// Cross-date Important-task regression; all records are synthetic in isolated browser contexts.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const base=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const out='test-results/task-important-all-dates';
fs.mkdirSync(out,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&fs.existsSync(x));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const res=[];
const fixture={
 version:61,settings:{zone:'Pacific/Honolulu',dtsStart:''},
 days:{
  '2026-11-11':{pins:['weeklyOld|2026-11-11']},
  '2026-11-13':{pins:['singleOld|single','explicitOff|2026-11-13']},
  '2026-11-14':{pins:['dailyOld|2026-11-14']}
 },
 events:[],
 tasks:[
  {id:'dailyOld',title:'QA Important Daily',kind:'task',repeat:'daily',days:[],since:'2026-11-10',until:'2026-11-25',due:''},
  {id:'weeklyOld',title:'QA Important Weekly',kind:'task',repeat:'weekly',days:[3,6],since:'2026-11-10',until:'2026-11-25',due:''},
  {id:'singleOld',title:'QA Important Once',kind:'task',repeat:'none',days:[],since:'2026-11-10',until:'',due:'2026-11-20'},
  {id:'explicitOff',title:'QA Explicit Off',kind:'task',repeat:'daily',days:[],since:'2026-11-10',until:'2026-11-25',due:'',important:false},
  {id:'plainNew',title:'QA Newly Important',kind:'task',repeat:'daily',days:[],since:'2026-11-10',until:'2026-11-25',due:'',important:false}
 ],
 checks:{},skip:{},overrides:{},prayers:[]
};
const assert=(condition,msg)=>{if(!condition)throw new Error(msg)};
for(const [width,theme] of [[320,'light'],[390,'dark'],[1024,'light']]){
 const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme,isMobile:width<600,hasTouch:width<600,timezoneId:'Pacific/Honolulu',serviceWorkers:'block'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const record={width,theme,pass:false};
 try {
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(data=>localStorage.setItem('dayframe',JSON.stringify(data)),fixture);
  await page.reload({waitUntil:'domcontentloaded'});
  const tutorial=page.locator('#tutorialChooseEn');if(await tutorial.isVisible())await tutorial.click();
  const skip=page.locator('#welcomeSkip');if(await skip.isVisible())await skip.click();
  await page.evaluate(()=>{document.querySelector('#launchScreen')?.remove();const modal=document.querySelector('#tutorialModal');if(modal){modal.hidden=true;modal.style.display='none';}});
  await page.locator('.tabs [data-page="today"]').click();
  const at=async d=>{await page.evaluate(value=>{const picker=document.querySelector('#datePicker');picker.value=value;picker.dispatchEvent(new Event('change',{bubbles:true}));},d);await page.waitForTimeout(90)};
  const getState=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dayframe')));
  const pinned=id=>page.locator('#konaPriorityTask .pinned-item').filter({hasText:id});
  const taskRow=id=>page.locator('#page-today #todayTaskList .quicktask[data-task-id="'+id+'"]');
  await at('2026-11-14');
  let state=await getState();
  assert(state.tasks.find(t=>t.id==='dailyOld').important===true,'legacy daily pin migration');
  assert(state.tasks.find(t=>t.id==='weeklyOld').important===true,'legacy weekly pin migration');
  assert(state.tasks.find(t=>t.id==='singleOld').important===true,'legacy once pin migration');
  assert(state.tasks.find(t=>t.id==='explicitOff').important===false,'explicit false beats stale old pin');
  assert(await pinned('QA Important Daily').count()===1,'important daily displayed 14th');
  assert(await pinned('QA Important Weekly').count()===1,'important weekly displayed Saturday');
  assert(await pinned('QA Important Once').count()===1,'important once displayed 14th');
  assert(await pinned('QA Explicit Off').count()===0,'explicit unimportant not highlighted');
  // A fourth important item is allowed because a repeating task may overlap other important dates.
  const fold=page.locator('#page-today #pinRow .task-fold');await fold.click();
  await taskRow('plainNew').locator('.task-title').click();
  await page.locator('#taskImportant').check();
  await page.locator('#taskSave').click();
  state=await getState();
  assert(state.tasks.find(t=>t.id==='plainNew').important===true,'mark important persisted on task');
  assert(await pinned('QA Newly Important').count()===1,'fourth important shown, no data loss');
  const total=await page.locator('#konaPriorityTask .pinned-item').count();
  assert(total===4,'all four important tasks shown: '+total);
  await page.screenshot({path:path.join(out,width+'-'+theme+'-four-important.png'),animations:'disabled'});
  // A per-day completion must not change another day's completion or task priority.
  await taskRow('dailyOld').locator('.task-check').click();
  assert((await getState()).checks['dailyOld|2026-11-14']!==undefined,'daily completion is date-scoped');
  await at('2026-11-15');
  assert(await pinned('QA Important Daily').count()===1,'daily important persists next day');
  assert(await pinned('QA Newly Important').count()===1,'newly important persists next day');
  assert(await pinned('QA Important Weekly').count()===0,'weekly not displayed outside scheduled days');
  assert(await pinned('QA Important Daily').locator('.task-check').getAttribute('aria-checked')==='false','next day completion independent');
  await at('2026-11-18');
  assert(await pinned('QA Important Weekly').count()===1,'weekly important persists on next scheduled Wednesday');
  await at('2026-11-19');
  assert(await pinned('QA Important Once').count()===1,'uncompleted one-off important persists through due period');
  await at('2026-11-15');
  await taskRow('plainNew').locator('.task-title').click();
  assert(await page.locator('#taskImportant').isChecked(),'edit form knows importance on another date');
  await page.locator('#taskImportant').uncheck();
  await page.locator('#taskSave').click();
  await at('2026-11-14');
  assert(await pinned('QA Newly Important').count()===0,'turning off importance removes on original date');
  await at('2026-11-15');
  assert(await pinned('QA Newly Important').count()===0,'turning off importance removes on future date');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.tabs [data-page="today"]').click();
  await at('2026-11-18');
  state=await getState();
  assert(state.tasks.find(t=>t.id==='plainNew').important===false,'explicit off survives reload');
  assert(await pinned('QA Important Weekly').count()===1,'legacy importance survives reload');
  assert(Array.isArray(state.days['2026-11-13'].pins)&&state.days['2026-11-13'].pins.includes('singleOld|single'),'old day pins retained for backup and rollback');
  assert(errors.length===0,'console page errors: '+errors.join('; '));
  record.pass=true;
 }catch(e){record.error=String(e);record.errors=errors;console.error('TASK_IMPORTANCE_FAIL',width,theme,record.error)}
 res.push(record);
 await context.close();
}
await browser.close();
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(res,null,2));
console.log('TASK_IMPORTANCE_RESULTS',JSON.stringify(res));
if(res.some(x=>!x.pass))process.exitCode=1;
