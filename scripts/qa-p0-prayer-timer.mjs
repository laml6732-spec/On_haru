// Focus/Prayer P0 safety: start-pause-resume, reload, explicit cancel vs save.
// Synthetic records, fresh localhost browser profile; no production writes.
import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
const OUT='test-results/p0-prayer-timer';
await fs.mkdir(OUT,{recursive:true});
const bin=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!bin)throw Error('Chromium missing');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const reports=[],errors=[];
const need=(v,m)=>{if(!v)throw Error(m)};
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Pacific/Honolulu',locale:'en-US',serviceWorkers:'block',reducedMotion:'reduce'});
try{
 const p=await ctx.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(String(e)));
 await p.clock.setFixedTime(new Date('2026-11-21T10:15:00-10:00'));
 const clear=async()=>{await p.evaluate(()=>{document.getElementById('launchScreen')?.remove();for(const id of ['tutorialModal','welcomeModal']){const n=document.getElementById(id);if(n){n.hidden=true;n.style.display='none'}}})};
 await p.goto('http://127.0.0.1:8080/legacy/',{waitUntil:'domcontentloaded'});
 if(await p.locator('#tutorialChooseEn').isVisible().catch(()=>false))await p.locator('#tutorialChooseEn').click();
 if(await p.locator('#welcomeSkip').isVisible().catch(()=>false))await p.locator('#welcomeSkip').click();
 await clear();
 await p.evaluate(()=>{
  db.events=[];db.tasks=[];db.days={};db.checks={};db.skip={};db.overrides={};
  changeDate('2026-11-21');save();nav('focus',{kind:'prayer'});
 });
 const run=async(name,fn)=>{try{await fn();reports.push({name,ok:true});console.log('PASS',name)}catch(err){reports.push({name,ok:false,error:String(err)});console.error('FAIL',name,err)}};
 await run('F-15: exiting setup does not create a prayer-completed record',async()=>{
  need(await p.evaluate(()=>!sess.started),'Unexpected active timer');
  need(await p.evaluate(()=>!(day('2026-11-21').sessions||[]).length),'Unexpected prayer record');
  await p.locator('.tabs [data-page="today"]').click();
  need(await p.evaluate(()=>!sess.started&&(day('2026-11-21').sessions||[]).length===0),'Leaving setup created a prayer log');
  await p.locator('.tabs [data-page="focus"]').click();
 });
 await run('F-02/F-14: start, pause, resume and restore exact session after reload',async()=>{
  await p.locator('#focusDurations [data-time="5"]').click();
  await p.locator('#focusStart').click();
  need(await p.evaluate(()=>sess.started&&sess.running&&sess.kind==='prayer'),'Prayer was not started');
  await p.evaluate(()=>{sess.runStart=Date.now()-6500;storeActiveSession();updateClock()});
  await p.locator('#focusStart').click();
  const paused=await p.evaluate(()=>({started:sess.started,running:sess.running,paused:sess.paused,elapsed:elapsed()}));
  need(paused.started&&!paused.running&&paused.paused&&paused.elapsed>=6000,'Pause lost tracked duration');
  await p.locator('#focusStart').click();
  need(await p.evaluate(()=>sess.started&&sess.running&&!sess.paused),'Resume did not start timer');
  await p.evaluate(()=>{sess.runStart=Date.now()-2000;storeActiveSession()});
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof sess!=='undefined');await clear();
  await p.locator('.tabs [data-page="focus"]').click();
  const resumed=await p.evaluate(()=>({running:sess.running,started:sess.started,start:sess.startDate,acc:sess.acc,sessionId:sess.sessionId,elapsed:elapsed()}));
  need(resumed.running&&resumed.started&&resumed.start==='2026-11-21'&&resumed.elapsed>=8000,'Reload did not restore active prayer time');
  need((await p.evaluate(()=>db.days['2026-11-21']?.sessions?.length||0))===0,'Unfinished timer was logged as completed');
 });
 await run('F-15: cancelling confirmation keeps timer; confirming discards without log',async()=>{
  need(!(await p.locator('#focusCancel').isVisible()),'Immersive focus should not expose the legacy cancel control');
  await p.locator('#focusMore').click();
  need(await p.locator('#choiceList button').count()===1,'Session More menu must offer cancel');
  await p.locator('#choiceList button').first().click();
  const dialog=p.locator('.onharu-native-replacement');
  await dialog.locator('.onharu-dialog-cancel').click();
  need(await p.evaluate(()=>sess.started),'Cancel confirmation dismissal discarded active session');
  need(!(await p.locator('#focusCancel').isVisible()),'Immersive focus should not expose the legacy cancel control');
  await p.locator('#focusMore').click();
  need(await p.locator('#choiceList button').count()===1,'Session More menu must offer cancel');
  await p.locator('#choiceList button').first().click();
  await dialog.locator('.onharu-dialog-accept').click();
  need(await p.evaluate(()=>!sess.started),'Confirmed cancellation left timer running');
  need((await p.evaluate(()=>db.days['2026-11-21']?.sessions?.length||0))===0,'Cancelled timer created a completed session');
  const storage=await p.evaluate(()=>window.localStorage.getItem('kona.legacy.v1.dayframe-active-session-v1'));
  need(storage===null,'Cancelled active timer persisted unexpectedly');
 });
 await run('F-15/D-03: explicit finish saves exactly one session and survives reload',async()=>{
  await p.locator('#focusStart').click();
  need(await p.evaluate(()=>sess.started),'Second prayer timer not started');
  await p.evaluate(()=>{sess.runStart=Date.now()-12000;storeActiveSession()});
  await p.locator('#focusEnd').click();
  const saved=await p.evaluate(()=>day('2026-11-21').sessions.filter(x=>x.kind==='prayer'));
  need(saved.length===1&&saved[0].seconds>=12,'Explicit completed prayer did not save once');
  need(await p.evaluate(()=>!sess.started),'Timer remained active after saved finish');
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof sess!=='undefined');await clear();
  const reload=await p.evaluate(()=>({session:db.days['2026-11-21']?.sessions?.filter(x=>x.kind==='prayer'),active:sess.started}));
  need(reload.session.length===1&&reload.session[0].id===saved[0].id&&!reload.active,'Saved prayer duplicated or missing after reload');
 });
 await run('A-12: timer journey has no uncaught page errors',async()=>need(errors.length===0,errors.join('; ')));
 await fs.writeFile(OUT+'/report.json',JSON.stringify({reports,errors},null,2));
 if(reports.some(x=>!x.ok))process.exitCode=1;
}finally{await ctx.close();await browser.close()}
