// Preview-only regression: completed Important + Daily tasks remain promoted.
// Isolated browser contexts and fabricated tasks only; never touch production data.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';

const base='http://127.0.0.1:8080/legacy/';
const output='test-results/important-daily-preview';
await fs.mkdir(output,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[],failures=[];
const check=(row,name,pass,detail)=>{
 row.checks.push({name,pass:!!pass,detail});
 if(!pass){failures.push(row.key+': '+name);console.error('DAILY_PIN_FAIL',row.key,name,JSON.stringify(detail));}
};
const configs=[{width:320,theme:'light'},{width:390,theme:'dark'},{width:1024,theme:'light'}];
for(const {width,theme} of configs){
 const row={key:width+'-'+theme,checks:[],errors:[]};results.push(row);
 const context=await browser.newContext({
  viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,
  locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',
  reducedMotion:'reduce'
 });
 const page=await context.newPage();page.setDefaultTimeout(5500);
 page.on('pageerror',e=>row.errors.push(String(e)));
 page.on('dialog',d=>d.dismiss());
 const open=async name=>{await page.locator('.tabs [data-page="'+name+'"]').click();await page.waitForTimeout(100)};
 const expanded=async()=>{
  const fold=page.locator('#page-today #pinRow .task-fold');
  if(await fold.getAttribute('aria-expanded')!=='true')await fold.click();
 };
 const make=async(title,repeat)=>{
  await open('today');
  const fold=page.locator('#page-today #pinRow .task-fold');
  if(await fold.getAttribute('aria-expanded')==='true')await fold.click();
  await page.locator('#page-today #pinRow .task-add').click();
  await page.locator('#taskTitle').fill(title);
  await page.locator('#taskImportant').check();
  if(repeat!=='none'){
   await page.locator('#taskRepeatChips button').filter({hasText:repeat==='daily'?'Daily':'Weekly'}).click();
  }
  const selected=await page.locator('#taskRepeat').inputValue();
  check(row,title+' repeat type selected',selected===repeat,{expected:repeat,selected});
  await page.locator('#taskSave').click();
  await page.locator('#taskFormModal').waitFor({state:'hidden'});
 };
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('.tabs [data-page="capture"]').waitFor();
  const choose=page.locator('#tutorialChooseEn');
  if(await choose.isVisible())await choose.click();
  const skip=page.locator('#welcomeSkip');
  if(await skip.isVisible())await skip.click();
  await page.evaluate(theme=>{
    document.getElementById('launchScreen')?.remove();
    const tutorial=document.getElementById('tutorialModal');
    if(tutorial){tutorial.hidden=true;tutorial.style.display='none'}
    document.documentElement.dataset.appearance=theme;
    document.documentElement.style.colorScheme=theme;
  },theme);

  const daily='QA Important Daily '+width;
  await make(daily,'daily');
  await open('capture');
  const top=()=>page.locator('#page-capture #konaPriorityTask .pinned-item').filter({hasText:daily});
  check(row,'Daily Important appears above composer before completion',await top().count()===1 && await top().isVisible(),daily);
  const box=top().locator('.task-check');
  const square=await box.evaluate(el=>({marker:getComputedStyle(el,'::before').width,img:el.querySelector('img')!==null,checked:el.getAttribute('aria-checked')}));
  check(row,'Important uses 20px square, not flower',square.marker==='20px'&&!square.img&&square.checked==='false',square);
  await box.click();
  await page.waitForTimeout(160);
  check(row,'Completed Daily Important stays above composer',await top().count()===1 && await top().isVisible(),daily);
  check(row,'Completed Daily Important remains checked',await top().locator('.task-check').getAttribute('aria-checked')==='true','aria-checked');
  check(row,'Daily Important has no duplicate in Write task list',
    await page.locator('#captureTasks .capture-task-row').filter({hasText:daily}).count()===0,daily);
  await page.screenshot({path:output+'/'+row.key+'-daily-complete.png',animations:'disabled',fullPage:true});
  await open('today');await expanded();
  check(row,'Checked Daily Important stays in primary Plan task list',
    await page.locator('#page-today #todayTaskList > .quicktask').filter({hasText:daily}).count()===1,daily);
  check(row,'Checked Daily Important is excluded from Done disclosure',
    await page.locator('#page-today #todayTaskList .done-tasks .quicktask').filter({hasText:daily}).count()===0,daily);

  const once='QA Important Once '+width;
  await make(once,'none');
  await open('capture');
  const onceTop=()=>page.locator('#page-capture #konaPriorityTask .pinned-item').filter({hasText:once});
  check(row,'Pending one-off Important appears at top',await onceTop().count()===1,once);
  await onceTop().locator('.task-check').click();await page.waitForTimeout(140);
  check(row,'Completed one-off Important leaves top',await onceTop().count()===0,once);
  check(row,'Completed one-off is present in Done disclosure',
    await page.locator('#captureTasks .done-tasks .capture-task-row').filter({hasText:once}).count()===1,once);

  const weekly='QA Important Weekly '+width;
  await make(weekly,'weekly');
  await open('capture');
  const weeklyTop=()=>page.locator('#page-capture #konaPriorityTask .pinned-item').filter({hasText:weekly});
  check(row,'Pending weekly Important appears at top',await weeklyTop().count()===1,weekly);
  await weeklyTop().locator('.task-check').click();await page.waitForTimeout(140);
  check(row,'Completed weekly Important leaves top',await weeklyTop().count()===0,weekly);
  check(row,'Completed weekly is present in Done disclosure',
    await page.locator('#captureTasks .done-tasks .capture-task-row').filter({hasText:weekly}).count()===1,weekly);
  check(row,'Completed Daily Important still visible after other changes',await top().count()===1 && await top().locator('.task-check').getAttribute('aria-checked')==='true',daily);
  const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  check(row,'No horizontal overflow',noOverflow<=2,noOverflow);
  await page.screenshot({path:output+'/'+row.key+'-all-types.png',animations:'disabled',fullPage:true});
 }catch(e){row.errors.push(String(e));console.error('DAILY_PIN_ABORT',row.key,String(e));}
 await context.close();
 console.log('DAILY_PIN_CONFIG',row.key,JSON.stringify({passed:row.checks.filter(x=>x.pass).length,failed:row.checks.filter(x=>!x.pass).length,errors:row.errors}));
}
await browser.close();
const summary={configs:results.length,checks:results.reduce((n,r)=>n+r.checks.length,0),failed:failures.length,errors:results.reduce((n,r)=>n+r.errors.length,0),failures};
await fs.writeFile(output+'/report.json',JSON.stringify({summary,results},null,2));
console.log('DAILY_PIN_SUMMARY',JSON.stringify(summary));
if(summary.failed||summary.errors)process.exitCode=1;
