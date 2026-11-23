// Real browser P0 journeys: isolated test profiles, synthetic records and localhost only.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const OUT='test-results/p0-journeys';
await fs.mkdir(OUT,{recursive:true});
const BASE=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
if(!/^http:\/\/(127\.0\.0\.1|localhost):8080\/legacy\/$/.test(BASE))throw Error('Safety guard: this suite may only run on localhost:8080/legacy/');
const binary=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!binary)throw Error('Chromium not installed');
const browser=await chromium.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const result={url:BASE,checks:[],errors:[]};
const DAY='2026-11-21',OTHER='2026-11-20',KEY='kona.legacy.v1.dayframe';
const need=(yes,message)=>{if(!yes)throw Error(message)};
async function check(name,run){
 try{await run();result.checks.push({name,status:'PASS'});console.log('PASS',name)}
 catch(error){result.checks.push({name,status:'FAIL',error:String(error)});console.error('FAIL',name,String(error))}
}
async function init(context){
 const p=await context.newPage();p.setDefaultTimeout(8000);
 p.on('pageerror',error=>result.errors.push(String(error)));
 await p.clock.setFixedTime(new Date('2026-11-21T10:15:00-10:00'));
 await p.goto(BASE,{waitUntil:'domcontentloaded'});
 if(await p.locator('#tutorialChooseEn').isVisible().catch(()=>false))await p.locator('#tutorialChooseEn').click();
 if(await p.locator('#welcomeSkip').isVisible().catch(()=>false))await p.locator('#welcomeSkip').click();
 await p.evaluate(()=>{
   document.getElementById('launchScreen')?.remove();
   for(const id of ['tutorialModal','welcomeModal']){const e=document.getElementById(id);if(e){e.hidden=true;e.style.display='none'}}
 });
 return p;
}
let first, second, offline;
try {
 first=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Pacific/Honolulu',locale:'en-US',serviceWorkers:'block',acceptDownloads:true,reducedMotion:'reduce'});
 const p=await init(first);
 await p.evaluate(dayString=>{
   db.events=[];db.tasks=[];db.days={};db.checks={};db.skip={};db.overrides={};
   changeDate(dayString);
   save();nav('today');
 },DAY);
 let eventId=null,memoId=null;
 await check('P-01: create a schedule through Plan and persist after reload',async()=>{
   await p.locator('#quickAddEvent').click();
   await p.locator('#eventTitle').fill('QA SAFE SCHEDULE');
   await p.locator('#eventStart').fill('09:00');await p.locator('#eventEnd').fill('11:00');
   await p.locator('#eventSince').fill(DAY);
   await p.locator('#eventSave').click();
   const event=await p.evaluate(()=>db.events.find(e=>e.title==='QA SAFE SCHEDULE'));
   need(!!event&&event.start==='09:00'&&event.end==='11:00','Plan schedule not saved with exact date/time');
   eventId=event.id;
   await p.reload({waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>typeof day==='function');
   await p.evaluate(d=>{document.getElementById('launchScreen')?.remove();changeDate(d);nav('today')},DAY);
   need(await p.evaluate(id=>db.events.some(e=>e.id===id&&e.title==='QA SAFE SCHEDULE'),eventId),'Created schedule was lost on reload');
 });
 await check('C-01/E-01: new Capture memo links to the exact selected schedule ID',async()=>{
   await p.locator('.tabs [data-page="capture"]').click();
   need((await p.locator('#captureScheduleLink > summary').innerText()).includes('QA SAFE SCHEDULE'),'Active schedule not shown in Capture');
   await p.locator('#qc-note-title').fill('QA title');
   await p.locator('#qc-text').fill('QA SCHEDULE NOTE CONTENT');
   await p.locator('#qc-submit').click();
   const memo=await p.evaluate(()=>day('2026-11-21').quickCaptureEntries.at(-1));
   need(memo?.scheduleId===eventId&&memo.text==='QA SCHEDULE NOTE CONTENT','Memo saved against wrong schedule');
   memoId=memo.id;
 });
 await check('E-01: Plan and linked Capture note agree with Daily and Archive',async()=>{
   const records=p.locator('.tabs [data-page="records"]');
   await records.click();
   await p.locator('#rev-reflect').click();
   const daily=p.locator('#new-reflect-page .review-record').filter({hasText:'QA SCHEDULE NOTE CONTENT'});
   need(await daily.count()===1,'Linked note missing or duplicated in Daily');
   need((await p.locator('#new-reflect-page').innerText()).includes('QA SAFE SCHEDULE'),'Daily did not show the linked schedule');
   need(await p.locator('#datePicker').inputValue()===DAY,'Daily changed the target date');
   await p.locator('#rev-archive').click();
   if(!await p.locator('#archive-search-input').isVisible())await p.locator('#archive-search .archive-records-search-button').click();
   await p.locator('#archive-search-input').fill('QA SCHEDULE NOTE CONTENT');
   const entry=p.locator('#archive-search-results .archive-search-result').filter({hasText:'QA SCHEDULE NOTE CONTENT'});
   need(await entry.count()===1,'Archive missing or duplicated the Capture note');
   need(await entry.getAttribute('data-record-id')==='q-'+memoId,'Archive record ID did not match Capture');
   need(await entry.getAttribute('data-record-date')===DAY,'Archive record date did not match Capture');
   need((await entry.locator('.review-schedule-label').innerText()).includes('QA SAFE SCHEDULE'),'Archive did not show the linked schedule');
 });
 await check('P-02: modifying the schedule keeps its ID and all linked memo content',async()=>{
   await p.locator('.tabs [data-page="today"]').click();
   await p.locator('#konaScheduleMore > summary').click();
   await p.locator('#konaScheduleMore [data-go="schedule"]').click();
   await p.locator('#page-schedule .subtabs [data-schedulesub="events"]').click();
   await p.locator('#eventManageList .record-item').filter({hasText:'QA SAFE SCHEDULE'}).click();
   await p.locator('#choiceList button').filter({has:p.getByText('Edit',{exact:true})}).click();
   await p.locator('#eventTitle').fill('QA UPDATED SCHEDULE');
   await p.locator('#eventSave').click();
   const s=await p.evaluate(({eventId,memoId})=>({
      event:db.events.find(x=>x.id===eventId),memo:day('2026-11-21').quickCaptureEntries.find(x=>x.id===memoId)
   }),{eventId,memoId});
   need(s.event?.title==='QA UPDATED SCHEDULE'&&s.memo?.scheduleId===eventId&&s.memo.text==='QA SCHEDULE NOTE CONTENT','Linked note or schedule changed unexpectedly during edit');
 });
 await check('P-02: exiting schedule delete options preserves original schedule',async()=>{
   await p.locator('#eventManageList .record-item').filter({hasText:'QA UPDATED SCHEDULE'}).click();
   await p.locator('#choiceList button').filter({has:p.getByText('Delete scope',{exact:true})}).click();
   need(await p.locator('#choiceList').isVisible(),'Delete choices did not open');
   await p.keyboard.press('Escape');
   need(await p.evaluate(id=>db.events.some(e=>e.id===id),eventId),'Escape deleted schedule unexpectedly');
 });
 await check('P-15/E-05: moving and deleting a schedule preserves the original dated note',async()=>{
   const next='2026-11-22';
   const schedule=p.locator('#eventManageList .record-item').filter({hasText:'QA UPDATED SCHEDULE'});
   await schedule.click();
   await p.locator('#choiceList button').filter({has:p.getByText('Edit',{exact:true})}).click();
   await p.locator('#eventSince').fill(next);
   await p.locator('#eventSave').click();
   const moved=await p.evaluate(({eventId,day,next})=>({
     prior:dayEvents(day).some(e=>e.id===eventId),
     next:dayEvents(next).some(e=>e.id===eventId)
   }),{eventId,day:DAY,next});
   need(!moved.prior&&moved.next,'Schedule was not moved to the new date');
   await p.locator('#datePicker').fill(next);
   await schedule.click();
   await p.locator('#choiceList button').filter({has:p.getByText('Delete scope',{exact:true})}).click();
   await p.locator('#choiceList button').getByText('Delete',{exact:true}).click();
   need(!(await p.evaluate(id=>db.events.some(e=>e.id===id),eventId)),'Delete did not remove selected schedule');
   const notes=await p.evaluate(id=>Object.entries(db.days).flatMap(([d,v])=>(v.quickCaptureEntries||[]).filter(x=>x.id===id).map(x=>({date:d,text:x.text}))),memoId);
   need(notes.length===1&&notes[0].date===DAY&&notes[0].text==='QA SCHEDULE NOTE CONTENT','Schedule move or deletion erased, moved or duplicated its memo');
   await p.locator('.tabs [data-page="records"]').click();
   await p.locator('#rev-reflect').click();
   need(!(await p.locator('#new-reflect-page').innerText()).includes('QA SCHEDULE NOTE CONTENT'),'Memo appeared under the new schedule date');
   await p.locator('#datePicker').fill(DAY);
   const note=p.locator('#new-reflect-page .review-record').filter({hasText:'QA SCHEDULE NOTE CONTENT'});
   need(await note.count()===1,'Orphaned memo became invisible in Daily Review');
   need((await note.innerText()).includes('no longer scheduled'),'Daily presented an unavailable schedule as active');
   await note.locator('.rv-note-preview').click();
   const editor=p.locator('#konaReviewEditor');
   await editor.locator('.kona-note-schedule > summary').click();
   const missing=editor.locator('.kona-note-schedule select');
   need(await missing.inputValue()===eventId,'Editor lost the historical link');
   need((await missing.locator('option:checked').innerText()).includes('no longer scheduled'),'Schedule selector did not identify the saved historical link');
   await missing.selectOption('');
   await editor.getByRole('button',{name:'Cancel',exact:true}).click();
   need(await p.evaluate(id=>day(date).quickCaptureEntries.find(q=>q.id===id).scheduleId,memoId)===eventId,'Cancel changed the stored schedule link');
   await p.screenshot({path:OUT+'/orphan-memo-review.png',animations:'disabled'});
   await p.locator('#rev-archive').click();
   if(!await p.locator('#archive-search-input').isVisible())await p.locator('#archive-search .archive-records-search-button').click();
   await p.locator('#archive-search-input').fill('QA SCHEDULE NOTE CONTENT');
   const archive=p.locator('#archive-search-results .archive-search-result').filter({hasText:'QA SCHEDULE NOTE CONTENT'});
   need(await archive.count()===1&&await archive.getAttribute('data-record-date')===DAY,'Archive lost the original memo date');
   need(await archive.getAttribute('data-record-id')==='q-'+memoId,'Archive created a new memo after schedule deletion');
   need((await archive.locator('.review-schedule-label').innerText()).includes('no longer scheduled'),'Archive presented an unavailable schedule as active');
   await p.locator('#rev-reflect').click();
 });
 await check('C-02/R-02: Review edit updates the same Capture ID without duplication',async()=>{
   const record=p.locator('#new-reflect-page .review-record').filter({hasText:'QA SCHEDULE NOTE CONTENT'}).first();
   await record.locator('.rv-note-preview').click();
   const editor=p.locator('#konaReviewEditor');
   await editor.waitFor({state:'visible'});
   await editor.getByRole('textbox',{name:'Note',exact:true}).fill('QA UPDATED FROM REVIEW');
   await editor.getByRole('button',{name:'Save',exact:true}).click();
   const matches=await p.evaluate(id=>day('2026-11-21').quickCaptureEntries.filter(x=>x.id===id),memoId);
   need(matches.length===1&&matches[0].text==='QA UPDATED FROM REVIEW','Review edit generated a copy or failed to save');
   await p.locator('#rev-archive').click();
   if(!await p.locator('#archive-search-input').isVisible())await p.locator('#archive-search .archive-records-search-button').click();
   await p.locator('#archive-search-input').fill('QA UPDATED FROM REVIEW');
   need((await p.locator('#archive-search-results').innerText()).includes('QA UPDATED FROM REVIEW'),'Archive index did not reflect latest edited memo');
 });
 await check('P-15: relink the same note to a replacement or switch to a personal note',async()=>{
   const go=name=>p.locator('.tabs [data-page="'+name+'"]').click();
   await go('today');
   await p.locator('#quickAddEvent').click();
   await p.locator('#eventTitle').fill('QA REPLACEMENT SCHEDULE');
   await p.locator('#eventStart').fill('09:00');
   await p.locator('#eventEnd').fill('11:00');
   await p.locator('#eventSince').fill(DAY);
   await p.locator('#eventSave').click();
   const replacement=await p.evaluate(()=>db.events.find(e=>e.title==='QA REPLACEMENT SCHEDULE').id);
   const card=p.locator('#new-reflect-page .review-record').filter({hasText:'QA UPDATED FROM REVIEW'});
   const capture=()=>p.evaluate(id=>day(date).quickCaptureEntries.find(q=>q.id===id),memoId);
   await go('records');
   await p.locator('#rev-reflect').click();
   for(const link of [replacement,'']){
     await card.locator('.rv-note-preview').click();
     const editor=p.locator('#konaReviewEditor');
     await editor.locator('.kona-note-schedule > summary').click();
     await editor.locator('.kona-note-schedule select').selectOption(link);
     await editor.getByRole('button',{name:'Save',exact:true}).click();
     const memo=await capture();
     need(memo.id===memoId&&memo.text==='QA UPDATED FROM REVIEW'&&memo.scheduleId===link,'Relink changed the note body or ID');
   }
   await p.locator('#rev-archive').click();
   if(!await p.locator('#archive-search-input').isVisible())await p.locator('#archive-search .archive-records-search-button').click();
   await p.locator('#archive-search-input').fill('QA UPDATED FROM REVIEW');
   const entry=p.locator('#archive-search-results .archive-search-result').filter({hasText:'QA UPDATED FROM REVIEW'});
   need(await entry.count()===1&&await entry.locator('.review-schedule-label').count()===0,'Personal note retained the removed schedule in Archive');
 });
 await check('N-01/N-02/N-13: selected date remains consistent across Plan, Capture, Check-in and Daily',async()=>{
   await p.evaluate(d=>changeDate(d),OTHER);
   for(const tab of ['today','capture','checkin','records']){
     await p.locator('.tabs [data-page="'+tab+'"]').click();
     const actual=await p.evaluate(()=>date);
     need(actual===OTHER,tab+' unexpectedly changed selected date to '+actual);
   }
   await p.evaluate(d=>changeDate(d),DAY);
   await p.locator('.tabs [data-page="capture"]').click();
   need(await p.evaluate(id=>day('2026-11-21').quickCaptureEntries.some(x=>x.id===id&&x.text.startsWith('QA ')),memoId),'Selected date changed stored memo content');
 });

 second=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Pacific/Honolulu',locale:'en-US',serviceWorkers:'block'});
 const c=await init(second);
 await c.evaluate(()=>{db.days={};db.events=[];changeDate('2026-11-19');save();nav('checkin')});
 await check('K-01/K-02/K-03/K-12: three check-ins are stored only on selected past date',async()=>{
   for(const [phase,content] of [['morning','QA SELECTED MORNING'],['noon','QA SELECTED NOON'],['evening','QA SELECTED EVENING']]){
      await c.locator('#page-checkin [data-phase="'+phase+'"]').click();
      await c.locator('#checkNote').fill(content);
      need(await c.evaluate(({p,t})=>db.days['2026-11-19']?.checkins?.[p]?.note===t,{p:phase,t:content}),'Check-in did not persist on target date '+phase);
   }
   const data=await c.evaluate(()=>({
       past:db.days['2026-11-19']?.checkins,
       today:db.days['2026-11-21']?.checkins||{}
   }));
   need(data.past.morning.note==='QA SELECTED MORNING'&&data.past.noon.note==='QA SELECTED NOON'&&data.past.evening.note==='QA SELECTED EVENING','Phase notes crossed');
   need(!Object.values(data.today).some(x=>String(x?.note||'').startsWith('QA SELECTED')),'Past day input wrote into today');
   await c.reload({waitUntil:'domcontentloaded'});
   await c.waitForFunction(()=>typeof day==='function');
   need(await c.evaluate(()=>db.days['2026-11-19']?.checkins?.evening?.note)==='QA SELECTED EVENING','Check-in lost after reload');
 });
 await check('K-02: scheduled class fields persist, no class is created on an empty day',async()=>{
   await c.evaluate(()=>{
     db.events.push({id:'qa-noon-lecture',title:'QA Class Session',category:'lecture',since:'2026-11-19',until:'2026-11-19',start:'12:00',end:'13:00',repeat:'none'});
     save();changeDate('2026-11-19');nav('checkin');
   });
   await c.locator('#page-checkin [data-phase="noon"]').click();
   need(await c.locator('#lectureQuote').isVisible(),'Class note field not visible on scheduled class day');
   await c.locator('#lectureQuote').fill('QA CLASS QUOTE SAVED');
   await c.locator('#lectureReflection').fill('QA CLASS REFLECTION SAVED');
   need(await c.evaluate(()=>db.days['2026-11-19']?.checkins?.noon?.lectureQuote)==='QA CLASS QUOTE SAVED','Class quote absent from scheduled day');
   await c.evaluate(()=>changeDate('2026-11-20'));
   await c.locator('#page-checkin [data-phase="noon"]').click();
   need(!(await c.locator('#lectureNoteCard').isVisible()),'A class form was forced on a day without class');
   need(!await c.evaluate(()=>Boolean(db.days['2026-11-20']?.checkins?.noon?.lectureQuote)),'Phantom class record created on an empty day');
   await c.reload({waitUntil:'domcontentloaded'});
   const saved=await c.evaluate(()=>db.days['2026-11-19']?.checkins?.noon);
   need(saved?.lectureQuote==='QA CLASS QUOTE SAVED'&&saved?.lectureReflection==='QA CLASS REFLECTION SAVED','Class note was lost on reload');
 });
 await check('K-11: legacy night and evening records can be read and edited independently',async()=>{
   await c.evaluate(()=>{
     const v=day('2026-11-18');
     v.checkins.evening={note:'QA LEGACY EVENING'};
     v.checkins.night={note:'QA LEGACY NIGHT'};
     save();changeDate('2026-11-18');nav('records');
   });
   await c.locator('#rev-reflect').click();
   const text=await c.locator('#page-records').innerText();
   need(text.includes('QA LEGACY EVENING')&&text.includes('QA LEGACY NIGHT'),'Legacy evening or night record was hidden');
   const edits=[['evening','QA LEGACY EVENING EDITED'],['night','QA LEGACY NIGHT EDITED']];
   for(const [phase,body] of edits){
     const card=c.locator('#new-reflect-page .rv-daily-check-'+phase);
     need(await card.count()===1,'Legacy '+phase+' card missing or duplicated');
     await card.locator('.rv-daily-check-name').click();
     const editor=c.locator('#konaReviewEditor');
     await editor.getByRole('textbox',{name:'Note',exact:true}).fill(body);
     await editor.getByRole('button',{name:'Save',exact:true}).click();
     need((await card.innerText()).includes(body),'Legacy '+phase+' edit not reflected in Daily');
   }
   await c.reload({waitUntil:'domcontentloaded'});
   await c.evaluate(()=>{document.getElementById('launchScreen')?.remove();changeDate('2026-11-18')});
   await c.locator('.tabs [data-page="records"]').click();
   await c.locator('#rev-reflect').click();
   for(const [phase,body] of edits){
     const card=c.locator('#new-reflect-page .rv-daily-check-'+phase);
     need(await card.count()===1&&(await card.innerText()).includes(body),'Legacy '+phase+' did not survive reload as one record');
   }
   await c.screenshot({path:OUT+'/legacy-evening-night.png',animations:'disabled'});
 });
 await check('D-01: denied check-in autosave retains original record and allows retry (IME separately unverified)',async()=>{
   await c.evaluate(()=>{changeDate('2026-11-19');nav('checkin')});
   await c.locator('#page-checkin [data-phase="morning"]').click();
   const previous=await c.evaluate(k=>window.localStorage.getItem(k),KEY);
   await c.evaluate(k=>{
     window.__qaWrite=Storage.prototype.setItem;
     Storage.prototype.setItem=function(a,b){if(a===k)throw new DOMException('Test quota','QuotaExceededError');return window.__qaWrite.call(this,a,b)};
   },KEY);
   try{
     await c.locator('#checkNote').fill('QA UNSAVED DRAFT');
     need(await c.evaluate(k=>window.localStorage.getItem(k),KEY)===previous,'Failed autosave changed disk record');
     need(await c.locator('#checkNote').inputValue()==='QA UNSAVED DRAFT','Failed autosave erased typed draft');
     need((await c.locator('#checkState').innerText()).includes('Not saved'),'UI falsely acknowledged failed autosave');
   }finally{
     await c.evaluate(()=>{if(window.__qaWrite){Storage.prototype.setItem=window.__qaWrite;delete window.__qaWrite}});
   }
   await c.locator('#checkFlowRetry').click();
   need(await c.evaluate(()=>day('2026-11-19').checkins.morning.note)==='QA UNSAVED DRAFT','Retry did not persist the draft');
 });
 await check('D-03: cross-feature records survive reload without duplication',async()=>{
   await c.reload({waitUntil:'domcontentloaded'});
   const d=await c.evaluate(()=>db.days['2026-11-19']?.checkins);
   need(d?.morning?.note==='QA UNSAVED DRAFT'&&d?.noon?.note==='QA SELECTED NOON'&&d?.evening?.note==='QA SELECTED EVENING','Saved check-in disappeared on reload');
 });
 await check('E-04: edit a check-in in Review and reopen it with mood and phase order intact',async()=>{
   const d='2026-11-19';
   await c.evaluate(()=>document.getElementById('launchScreen')?.remove());
   await c.locator('#datePicker').fill(d);
   await c.locator('.tabs [data-page="checkin"]').click();
   await c.locator('#page-checkin [data-phase="morning"]').click();
   await c.locator('#checkNote').fill('QA CHECK-IN JOURNEY');
   await c.locator('#moodGrid [data-dimension=energy] input.kona-slim-rail').press('End');
   await c.locator('#moodGrid [data-dimension=happiness] input.kona-slim-rail').press('End');
   await c.locator('.tabs [data-page="records"]').click();
   await c.locator('#rev-reflect').click();
   const daily=c.locator('#new-reflect-page');
   const morning=daily.locator('.rv-daily-check-morning');
   const feeling=await morning.locator('.review-feeling-value').innerText();
   need(feeling!=='Choose mood','Test mood did not appear in Daily');
   await morning.locator('.rv-daily-check-name').click();
   const editor=c.locator('#konaReviewEditor');
   await editor.getByRole('textbox',{name:'Note',exact:true}).fill('QA CHECK-IN EDITED IN DAILY');
   await editor.getByRole('button',{name:'Save',exact:true}).click();
   need(await morning.locator('.review-feeling-value').innerText()===feeling,'Editing the body changed its mood');
   await c.reload({waitUntil:'domcontentloaded'});
   await c.evaluate(()=>document.getElementById('launchScreen')?.remove());
   await c.locator('#datePicker').fill(d);
   await c.locator('.tabs [data-page="checkin"]').click();
   await c.locator('#page-checkin [data-phase="morning"]').click();
   need(await c.locator('#checkNote').inputValue()==='QA CHECK-IN EDITED IN DAILY','Check-in source did not reflect Daily edit after reload');
   await c.locator('.tabs [data-page="records"]').click();
   await c.locator('#rev-reflect').click();
   const order=await daily.locator('.rv-daily-checkin').evaluateAll(cards=>cards.map(card=>['morning','noon','evening'].find(phase=>card.classList.contains('rv-daily-check-'+phase))));
   need(order.join(',')==='morning,noon,evening','Daily check-in phase order changed');
   need(await morning.locator('.review-feeling-value').innerText()===feeling,'Reopened Daily did not preserve mood');
   need((await morning.innerText()).includes('QA CHECK-IN EDITED IN DAILY'),'Reopened Daily did not preserve edited body');
 });
 await check('D-13: browser origin storage is isolated between 127.0.0.1 and localhost',async()=>{
   const other=await second.newPage();other.on('pageerror',e=>result.errors.push(String(e)));
   const alternate=BASE.replace('127.0.0.1','localhost');
   await other.goto(alternate,{waitUntil:'domcontentloaded'});
   const source=await c.evaluate(k=>window.localStorage.getItem(k),KEY);
   const otherValue=await other.evaluate(k=>window.localStorage.getItem(k),KEY);
   need(typeof source==='string'&&source.includes('QA SELECTED NOON'),'Source records missing');
   need(!otherValue?.includes('QA SELECTED NOON'),'Other origin automatically received private records');
   await other.close();
 });

 offline=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Pacific/Honolulu',serviceWorkers:'allow'});
 const o=await init(offline);
 await check('D-16/E-10: new memo and edit survive offline reload and reconnection',async()=>{
   await o.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:15000});
   await o.locator('.tabs [data-page="capture"]').click();
   await offline.setOffline(true);
   try{
     await o.reload({waitUntil:'domcontentloaded'});
     await o.waitForSelector('#qc-text',{timeout:13000});
     await o.locator('.tabs [data-page="capture"]').click();
     await o.locator('#qc-text').fill('QA CREATED WHILE OFFLINE');
     await o.locator('#qc-submit').click();
     need((await o.locator('.capture-recent-body').first().innerText()).includes('QA CREATED WHILE OFFLINE'),'Offline local save failed');
     const before=await o.evaluate(()=>day(date).quickCaptureEntries.at(-1).id);
     await o.locator('.tabs [data-page="records"]').click();
     await o.locator('#rev-reflect').click();
     const record=o.locator('#new-reflect-page .review-record').filter({hasText:'QA CREATED WHILE OFFLINE'});
     await record.getByRole('button',{name:/Change note/}).first().click();
     const editor=o.locator('#konaReviewEditor');
     await editor.getByRole('textbox',{name:'Note',exact:true}).fill('QA EDITED WHILE OFFLINE');
     await editor.getByRole('button',{name:'Save',exact:true}).click();
     await o.reload({waitUntil:'domcontentloaded'});
     const memo=await o.evaluate(()=>day(date).quickCaptureEntries.at(-1));
     need(memo.id===before&&memo.text==='QA EDITED WHILE OFFLINE','Offline reload lost edited body or original memo ID');
   }finally{await offline.setOffline(false)}
   await o.reload({waitUntil:'domcontentloaded'});
   await o.locator('.tabs [data-page="capture"]').click();
   need((await o.locator('.capture-recent-body').first().innerText()).includes('QA EDITED WHILE OFFLINE'),'Edited offline memo did not survive reconnection');
   await o.screenshot({path:OUT+'/offline-reconnected.png',animations:'disabled'});
 });
 await check('A-12: no unhandled browser errors in P0 journeys',async()=>{
   need(result.errors.length===0,result.errors.join('; '));
 });
}finally{
 await fs.writeFile(OUT+'/report.json',JSON.stringify(result,null,2));
 for(const ctx of [first,second,offline])if(ctx)await ctx.close().catch(()=>{});
 await browser.close();
}
if(result.checks.some(x=>x.status==='FAIL'))process.exitCode=1;
