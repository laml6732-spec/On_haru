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
 await check('P-02: modifying the schedule keeps its ID and all linked memo content',async()=>{
   await p.locator('.tabs [data-page="today"]').click();
   await p.locator('#konaScheduleMore > summary').click();
   await p.locator('#konaScheduleMore [data-go="schedule"]').click();
   await p.locator('#eventManageList button[aria-label="Edit QA SAFE SCHEDULE"]').click();
   await p.locator('#choiceList button').filter({hasText:'Edit event'}).click();
   await p.locator('#eventTitle').fill('QA UPDATED SCHEDULE');
   await p.locator('#eventSave').click();
   const s=await p.evaluate(({eventId,memoId})=>({
      event:db.events.find(x=>x.id===eventId),memo:day('2026-11-21').quickCaptureEntries.find(x=>x.id===memoId)
   }),{eventId,memoId});
   need(s.event?.title==='QA UPDATED SCHEDULE'&&s.memo?.scheduleId===eventId&&s.memo.text==='QA SCHEDULE NOTE CONTENT','Linked note or schedule changed unexpectedly during edit');
 });
 await check('P-02: exiting schedule delete options preserves original schedule',async()=>{
   await p.locator('#eventManageList button[aria-label="Delete QA UPDATED SCHEDULE"]').click();
   need(await p.locator('#choiceList').isVisible(),'Delete choices did not open');
   await p.keyboard.press('Escape');
   need(await p.evaluate(id=>db.events.some(e=>e.id===id),eventId),'Escape deleted schedule unexpectedly');
 });
 await check('P-15/E-05: removing a schedule does not delete its linked Capture memo',async()=>{
   await p.locator('#eventManageList button[aria-label="Delete QA UPDATED SCHEDULE"]').click();
   await p.locator('#choiceList button').getByText('Delete',{exact:true}).click();
   need(!(await p.evaluate(id=>db.events.some(e=>e.id===id),eventId)),'Delete did not remove selected schedule');
   const after=await p.evaluate(id=>day('2026-11-21').quickCaptureEntries.filter(x=>x.id===id),memoId);
   need(after.length===1&&after[0].text==='QA SCHEDULE NOTE CONTENT','Schedule deletion also erased or duplicated its memo');
   await p.locator('.tabs [data-page="records"]').click();
   await p.locator('#rev-reflect').click();
   need((await p.locator('#page-records').innerText()).includes('QA SCHEDULE NOTE CONTENT'),'Orphaned memo became invisible in Daily Review');
   await p.screenshot({path:OUT+'/orphan-memo-review.png',animations:'disabled'});
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
   await p.locator('#archive-search-input').fill('QA UPDATED FROM REVIEW');
   need((await p.locator('#archive-search-results').innerText()).includes('QA UPDATED FROM REVIEW'),'Archive index did not reflect latest edited memo');
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
   need(await p.evaluate(id=>day('2026-11-21').quickCaptureEntries.some(x=>x.id===id&&x.text==='QA UPDATED FROM REVIEW'),memoId),'Selected date changed stored memo content');
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
 await check('K-11: legacy night and evening records remain independently readable',async()=>{
   await c.evaluate(()=>{
     const v=day('2026-11-18');
     v.checkins.evening={note:'QA LEGACY EVENING'};
     v.checkins.night={note:'QA LEGACY NIGHT'};
     save();changeDate('2026-11-18');nav('records');
   });
   await c.locator('#rev-reflect').click();
   const text=await c.locator('#page-records').innerText();
   need(text.includes('QA LEGACY EVENING')&&text.includes('QA LEGACY NIGHT'),'Legacy evening or night record was hidden');
   await c.screenshot({path:OUT+'/legacy-evening-night.png',animations:'disabled'});
 });
 await check('D-01/K-13: denied check-in autosave retains original record and allows retry',async()=>{
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
 await check('D-13: browser origin storage is isolated between 127.0.0.1 and localhost',async()=>{
   const other=await second.newPage();other.on('pageerror',e=>result.errors.push(String(e)));
   const alternate=BASE.replace('127.0.0.1','localhost');
   await other.goto(alternate,{waitUntil:'domcontentloaded'});
   const source=await c.evaluate(k=>window.localStorage.getItem(k),KEY);
   const otherValue=await other.evaluate(k=>window.localStorage.getItem(k),KEY);
   need(typeof source==='string'&&source.includes('QA UNSAVED DRAFT'),'Source records missing');
   need(!otherValue?.includes('QA UNSAVED DRAFT'),'Other origin automatically received private records');
   await other.close();
 });

 offline=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Pacific/Honolulu',serviceWorkers:'allow'});
 const o=await init(offline);
 await check('D-16/E-10: new memo saved offline persists through reconnection',async()=>{
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
   }finally{await offline.setOffline(false)}
   await o.reload({waitUntil:'domcontentloaded'});
   await o.locator('.tabs [data-page="capture"]').click();
   need((await o.locator('.capture-recent-body').first().innerText()).includes('QA CREATED WHILE OFFLINE'),'Offline memo did not survive reconnection');
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
