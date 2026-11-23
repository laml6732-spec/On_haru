// P0: real manage-plan UI selection for recurring schedule changes.
// Isolated localhost Chromium + fabricated records only, NEVER production.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
const URL='http://127.0.0.1:8080/legacy/';
const OUT='test-results/recurring-links';
await fs.mkdir(OUT,{recursive:true});
const binary=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!binary)throw Error('Chromium unavailable');
const browser=await chromium.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
try{
 const page=await ctx.newPage();page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.clock.setFixedTime(new Date('2026-11-21T10:15:00-10:00'));
 await page.goto(URL,{waitUntil:'domcontentloaded'});
 if(await page.locator('#tutorialChooseEn').isVisible().catch(()=>false))await page.locator('#tutorialChooseEn').click();
 if(await page.locator('#welcomeSkip').isVisible().catch(()=>false))await page.locator('#welcomeSkip').click();
 const closeOverlay=()=>page.evaluate(()=>{document.getElementById('launchScreen')?.remove();for(const n of ['tutorialModal','welcomeModal']){const e=document.getElementById(n);if(e){e.hidden=true;e.style.display='none'}}});
 await closeOverlay();
 const setup=()=>page.evaluate(()=>{
   db.events=[{id:'qa-series',title:'QA RECURRING',start:'09:00',end:'10:00',repeat:'daily',days:[],since:'2026-11-16',until:'2026-11-30',category:'personal',base:false}];
   db.tasks=[];db.days={};db.overrides={};db.skip={};
   const past=day('2026-11-19');past.eventNotes['qa-series']='QA earlier entry';
   const future=day('2026-11-20');
   future.eventNotes['qa-series']='QA future event note';
   future.eventNoteTitles={'qa-series':'QA future title'};
   future.eventMoods={'qa-series':{energy:3,happiness:5}};
   future.eventNoteTags={'qa-series':['prayer']};
   future.eventInfo={'qa-series':{speaker:'QA speaker'}};
   future.quickCaptureEntries=[{id:'qa-future-capture',date:'2026-11-20',time:'09:25',title:'QA capture title',text:'QA future capture body',scheduleId:'qa-series',scheduleTitle:'QA RECURRING',scheduleTime:'09:00–10:00',tags:[]}];
   future.sessions=[{id:'qa-session',kind:'prayer',eventId:'qa-series',note:'QA future session note',seconds:240,start:'09:00'}];
   future.timeNotes={'09':{'qa-series':{text:'QA future time note'}}};
   future.legacyMergedIds=['qa-series'];
   future.unifiedNotesSaved=['qa-series'];
   future.important=['qa-series'];
   db.overrides['qa-series|2026-11-22']={title:'QA later override',start:'11:00',end:'12:00',category:'personal'};
   db.skip['qa-series|2026-11-23']=true;
   check('2026-11-20','morning');
   if(!save())throw Error('Synthetic fixture save failed');
   changeDate('2026-11-20');nav('schedule',{sub:'events'});
 });
 // Avoid variable shadowing of the module-level 'check' within the page function.
 await setup().catch(e=>{throw new Error('Setup failed: '+e)});
 try{
  await page.locator('#eventManageList .record-item').filter({hasText:'QA RECURRING'}).click();
  await page.locator('#choiceList button').filter({hasText:'Edit recurring event'}).click();
  await page.locator('#eventTitle').fill('QA UPDATED SERIES');
  await page.locator('#eventStart').fill('10:00');
  await page.locator('#eventEnd').fill('11:30');
  await page.locator('#eventSave').click();
  const choices=await page.locator('#choiceList button').allTextContents();
  check(choices.length===2,'Recurring-edit scope choices not offered: '+choices.join(' | '));
  await page.screenshot({path:OUT+'/recurring-scope-choices.png',animations:'disabled'});
  await page.locator('#choiceList button').first().click(); // 'from this date onward', NOT entire series
  const state=await page.evaluate(()=>{
   const old=db.events.find(x=>x.id==='qa-series'),next=db.events.find(x=>x.id!=='qa-series');
   const past=day('2026-11-19'),future=day('2026-11-20');
   return {old,newEvent:next,pastNote:past.eventNotes['qa-series'],
    futureNote:future.eventNotes[next?.id],oldFutureNote:future.eventNotes['qa-series'],
    title:future.eventNoteTitles[next?.id],mood:future.eventMoods[next?.id],tags:future.eventNoteTags[next?.id],
    speaker:future.eventInfo[next?.id]?.speaker,capture:future.quickCaptureEntries[0],
    sessionEventId:future.sessions[0].eventId,timeNote:future.timeNotes['09'][next?.id],
    oldTimeNote:future.timeNotes['09']['qa-series'],
    merged:future.legacyMergedIds,unified:future.unifiedNotesSaved,important:future.important,
    overrideKeys:Object.keys(db.overrides),skipKeys:Object.keys(db.skip),
    pastDisplay:dayEvents('2026-11-19').map(x=>x.title),futureDisplay:dayEvents('2026-11-20').map(x=>x.title)};
  });
  const id=state.newEvent?.id;
  check(!!id&&id!=='qa-series','Split did not create a new future series');
  check(state.old.until==='2026-11-19','Historical series range was not preserved');
  check(state.newEvent.since==='2026-11-20','New series begins on wrong date');
  check(state.pastNote==='QA earlier entry'&&state.pastDisplay.includes('QA RECURRING'),'Historical records were altered');
  check(state.futureNote==='QA future event note'&&state.oldFutureNote===undefined,'Future event note was lost or orphaned');
  check(state.title==='QA future title'&&state.speaker==='QA speaker','Future title/speaker did not migrate');
  check(!!state.mood&&state.tags?.[0]==='prayer','Future mood/tags did not migrate');
  check(state.capture.scheduleId===id&&state.capture.text==='QA future capture body','Future Capture body must stay linked to new schedule');
  check(state.capture.scheduleTitle==='QA UPDATED SERIES','Future Capture event title must match new schedule');
  check(state.capture.scheduleTime==='10:00–11:30','Future Capture time must match new schedule');
  check(state.sessionEventId===id,'Future session did not follow new schedule');
  check(state.timeNote?.text==='QA future time note'&&state.oldTimeNote===undefined,'Future time-note link did not migrate');
  check(state.merged.includes(id)&&!state.merged.includes('qa-series'),'Legacy merge marker stale');
  check(state.unified.includes(id)&&!state.unified.includes('qa-series'),'Unified record marker stale');
  check(state.important.includes(id)&&!state.important.includes('qa-series'),'Important event state stale');
  check(state.overrideKeys.includes(id+'|2026-11-22')&&!state.overrideKeys.includes('qa-series|2026-11-22'),'Date override not migrated');
  check(state.skipKeys.includes(id+'|2026-11-23')&&!state.skipKeys.includes('qa-series|2026-11-23'),'Skipped occurrence not migrated');
  check(state.futureDisplay.includes('QA UPDATED SERIES'),'Selected-day UI shows wrong series');
  await page.reload({waitUntil:'domcontentloaded'});
  await closeOverlay();
  const persisted=await page.evaluate(()=>({next:db.events.find(x=>x.id!=='qa-series')?.id,capture:db.days['2026-11-20']?.quickCaptureEntries?.[0],old:db.days['2026-11-19']?.eventNotes?.['qa-series']}));
  check(persisted.next===id&&persisted.capture.scheduleId===id&&persisted.old==='QA earlier entry','Reload lost split links');
  results.push({case:'P-03/P-15/E-05 recurring split scope and linked records',ok:true});
  console.log('PASS recurring edit scope, history, all linked records, reload');
 }catch(err){results.push({case:'P-03/P-15/E-05 recurring split scope and linked records',ok:false,error:String(err)});console.error('FAIL recurring',err)}
 check(errors.length===0,'Unexpected page JS errors: '+errors.join('; '));
 await fs.writeFile(OUT+'/report.json',JSON.stringify({results,errors},null,2));
 if(results.some(x=>!x.ok))process.exitCode=1;
}finally{await ctx.close();await browser.close()}
