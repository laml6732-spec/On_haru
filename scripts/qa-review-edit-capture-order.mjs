// QA: Review edit persistence, phase ordering and Capture's task double tap.
// Fresh isolated browser contexts and fabricated records only; no live user data.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const dir='test-results/review-edit-capture-order';
await fs.mkdir(dir,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('Chromium is missing');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const reports=[];
const ensure=(v,label,details)=>{if(!v)throw Error(label+(details?' · '+JSON.stringify(details):''))};
const fixtures=()=>{
 date='2026-11-21';
 db.events=[];
 const v=day(date);
 v.checkins??={};v.sessions??=[];v.quickCaptureEntries??=[];v.timeNotes??={};db.tasks??=[];
 v.checkins.morning={note:'QA morning original',morningEnergy:4,morningHappiness:4,moodTime:'19:40'};
 v.checkins.noon={note:'QA midday original',noonEnergy:3,noonHappiness:3,moodTime:'07:15',lectureQuote:'QA class quote original',lectureReflection:'QA class reflection',classResponse:'QA class response'};
 v.checkins.evening={note:'QA reflection original',eveningEnergy:2,eveningHappiness:5,moodTime:'11:32'};
 v.headline='QA Anchor original';
 v.sessions.push({id:'qa-prayer-session',kind:'prayer',task:'QA intercession',note:'QA session original',start:'14:00',seconds:120});
 v.quickCaptureEntries.push({id:'qa-review-capture',title:'QA Capture title',text:'QA capture original',time:'10:15',createdAt:'2026-11-21T20:15:00Z',tags:[],scheduleId:''});
 v.timeNotes['15']??={};v.timeNotes['15'].free={text:'QA free note original',tags:[]};
 db.tasks.push({id:'qa-double-important',title:'QA Double tap task',since:date,until:date,due:date,repeat:'none',category:'personal',important:false});
 save();render();
};
const selectPage=async(page,name)=>{await page.locator('.tabs [data-page="'+name+'"]').click({force:true});await page.waitForTimeout(120)};
const edit=async(page,clickTarget,field,edited,checkValue)=>{
 await clickTarget.click();
 const modal=page.locator('#konaReviewEditor');
 await modal.waitFor({state:'visible'});
 const editFields=modal.locator('.sheet > label > textarea');
 const entry=field==='Memorable words'?editFields.first():editFields.last();
 const initiallyFocused = await entry.evaluate(field => new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve(document.activeElement === field)));
 }));
 ensure(initiallyFocused, 'Review editor focus moved away from the primary input', field);
 await entry.fill(edited);
 ensure(await entry.inputValue()===edited, 'Edit input did not receive the typed value', field);
 await modal.locator('.rv-edit-actions button.solid').click();
 await modal.waitFor({state:'detached'});
 const value=await page.evaluate(checkValue);
 ensure(value===edited,'Edit did not persist in storage',{field,value,expected:edited});
};
try {
 for(const cfg of [{width:320,theme:'light',lang:'en'},{width:390,theme:'dark',lang:'ko'},{width:390,theme:'light',lang:'en'},{width:1024,theme:'light',lang:'en'}]){
  const row={...cfg,ok:false,steps:[],errors:[]};reports.push(row);
  const ctx=await browser.newContext({viewport:{width:cfg.width,height:844},isMobile:cfg.width<600,hasTouch:cfg.width<600,locale:cfg.lang==='ko'?'ko-KR':'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await ctx.newPage();page.setDefaultTimeout(6000);page.on('pageerror',err=>row.errors.push(String(err)));
  try{
   await page.clock.setFixedTime(new Date('2026-11-21T10:15:00-10:00'));
   await page.goto(process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/',{waitUntil:'domcontentloaded'});
   const choose=page.locator(cfg.lang==='ko'?'#tutorialChooseKo':'#tutorialChooseEn');
   if(await choose.isVisible().catch(()=>false))await choose.click();
   const skip=page.locator('#welcomeSkip');if(await skip.isVisible().catch(()=>false))await skip.click();
   await page.evaluate(theme=>{
    document.getElementById('launchScreen')?.remove();
    const tutorial=document.getElementById('tutorialModal');
    if(tutorial){tutorial.hidden=true;tutorial.style.display='none'}
    document.documentElement.dataset.appearance=theme;
    document.documentElement.style.colorScheme=theme;
   },cfg.theme);
   await page.evaluate(fixtures);
   await selectPage(page,'records');
   const reflect=page.locator('#rev-reflect');if(await reflect.count())await reflect.click({force:true});
   const section=page.locator('#new-reflect-page .rv-timegroup[data-daypart="checkins"]');
   await section.waitFor({state:'visible'});
   const anchorDate=await page.locator('#new-reflect-page .rv-anchor-date').first().innerText();
   ensure(anchorDate.includes(cfg.lang==='ko'?'(토)':'(Sat)'),'Daily anchor weekday must follow UI language',anchorDate);
   row.steps.push('localized-anchor-weekday');
   const phaseOrder=await section.locator('.rv-daily-checkin').evaluateAll(nodes=>nodes.map(x=>[...x.classList].find(z=>z.startsWith('rv-daily-check-')&&z!=='rv-daily-check-header')).filter(Boolean));
   ensure(phaseOrder.join('|')==='rv-daily-check-morning|rv-daily-check-noon|rv-daily-check-evening','Wrong check-in ordering',phaseOrder);
   const firstSection=await page.locator('#new-reflect-page .rv-timeline>.rv-timegroup').first().getAttribute('data-daypart');
   ensure(firstSection==='checkins','Check-ins should precede other records',firstSection);
   row.steps.push('phase-order');
   await page.screenshot({path:`${dir}/${cfg.width}-${cfg.theme}-${cfg.lang}-order.png`,animations:'disabled',caret:'hide'});
   const x=page.locator('#new-reflect-page');
   await edit(page,x.locator('.rv-daily-check-morning .rv-daily-check-name'),'Note','QA morning updated',()=>day(date).checkins.morning.note);
   row.steps.push('morning-edit');
   await edit(page,x.locator('.rv-daily-check-noon .rv-daily-check-name'),'Note','QA midday updated',()=>day(date).checkins.noon.note);
   row.steps.push('midday-edit');
   await edit(page,x.locator('.rv-daily-check-evening .rv-daily-check-name'),'Note','QA reflection updated',()=>day(date).checkins.evening.note);
   row.steps.push('reflection-edit');
   await edit(page,x.locator('.rv-daily-class-group .rv-daily-book-heading').first(),'Memorable words','QA class quote updated',()=>day(date).checkins.noon.lectureQuote);
   row.steps.push('class-edit');
   await edit(page,x.locator('.review-session-record .rv-note-preview').first(),'Note','QA session updated',()=>day(date).sessions.find(x=>x.id==='qa-prayer-session').note);
   row.steps.push('session-edit');
   await edit(page,x.locator('.review-record').filter({hasText:'QA capture original'}).first().locator('.rv-note-preview'),'Note','QA captured updated',()=>day(date).quickCaptureEntries.find(q=>q.id==='qa-review-capture').text);
   row.steps.push('capture-edit');
   await edit(page,x.locator('.review-record').filter({hasText:'QA free note original'}).first().locator('.rv-daily-inferred-title'),'Note','QA free updated',()=>day(date).timeNotes['15'].free.text);
   row.steps.push('free-edit');
   await edit(page,x.locator('.rv-reference-anchor').first(),'Note','QA anchor updated',()=>day(date).headline);
   row.steps.push('anchor-edit');
   await selectPage(page,'capture');
   const task=page.locator('#page-capture .capture-task-row').filter({hasText:'QA Double tap task'}).locator('.task-title');
   await task.waitFor({state:'visible'});
   await task.dblclick({force:true});
   let important=await page.evaluate(()=>db.tasks.find(t=>t.id==='qa-double-important')?.important);
   ensure(important===true,'Capture double click did not apply importance ink',important);
   // An important task intentionally moves above the composer, so follow it.
   const marked=page.locator('#page-capture #konaPriorityTask .pinned-title').filter({hasText:'QA Double tap task'});
   await marked.waitFor({state:'visible'});
   ensure(await marked.evaluate(n=>n.classList.contains('important')),'Important task lost highlight class');
   row.steps.push('double-click-important');
   await marked.dblclick({force:true});
   important=await page.evaluate(()=>db.tasks.find(t=>t.id==='qa-double-important')?.important);
   ensure(important===false,'Second double click did not remove important flag',important);
   row.steps.push('double-click-unmark');
   const unmarked=page.locator('#page-capture .capture-task-row').filter({hasText:'QA Double tap task'}).locator('.task-title');
   await unmarked.waitFor({state:'visible'});
   await unmarked.click({force:true});
   await page.waitForTimeout(390);
   ensure(await page.locator('#taskFormModal').isVisible(),'Single click must still edit task');
   row.steps.push('single-click-edit');
   ensure(row.errors.length===0,'Browser runtime errors',row.errors);
   row.ok=true;console.log('REVIEW_CAPTURE_QA_PASS',cfg.width,cfg.theme,cfg.lang,row.steps.join(','));
  }catch(error){
   row.error=String(error);
   console.error('REVIEW_CAPTURE_QA_FAIL',cfg.width,cfg.theme,cfg.lang,'completed='+row.steps.join(','),row.error,row.errors);
   await page.screenshot({path:`${dir}/${cfg.width}-${cfg.theme}-${cfg.lang}-failed.png`,animations:'disabled'}).catch(()=>{});
  }finally{await ctx.close()}
 }
}finally{await browser.close()}
await fs.writeFile(dir+'/report.json',JSON.stringify(reports,null,2));
if(reports.some(x=>!x.ok))process.exitCode=1;
