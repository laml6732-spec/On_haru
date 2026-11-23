// Historical filename retained for the workflow. Mood is now shown in
// Check-ins and their Archive records, not a separate Archive Mood toggle.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chromium missing');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const artifacts=process.env.ONHARU_ARTIFACTS||'test-results/archive-mood-tooltip';
await fs.mkdir(artifacts,{recursive:true});
const ensure=(ok,message)=>{if(!ok)throw Error(message)};
const report=[],recordDate='2026-11-04';
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(8500);page.on('pageerror',e=>errors.push(String(e)));
  const row={width,theme,passed:false};
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   const seeded=await page.evaluate(t=>{
    document.getElementById('launchScreen')?.remove();
    const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
    document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
    date='2026-11-04';
    const v=day(date);
    v.checkins.morning={note:'QA-MORNING-MOOD',moodTime:'08:30',morningEnergy:3,morningHappiness:4};
    v.checkins.night={note:'QA-NIGHT-MOOD',moodTime:'21:15',nightEnergy:4,nightHappiness:2};
    return save();
   },theme);
   ensure(seeded,'Synthetic check-in fixture could not be persisted');
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-reflect').click();
   await page.locator('#new-reflect-page .rv-seven-day[aria-label^="2026-11-04"]').click();
   const morning=page.locator('#new-reflect-page .review-v3-section[data-daypart="checkins"]');
   ensure(await morning.count()===1,'Daily check-in section missing');
   ensure((await morning.innerText()).includes('QA-MORNING-MOOD'),'Morning check-in not shown in Daily');
   ensure((await page.locator('#new-reflect-page').innerText()).includes('QA-NIGHT-MOOD'),'End-of-day check-in missing in Daily');
   await page.screenshot({path:artifacts+'/'+width+'-'+theme+'-daily-checkins.png',animations:'disabled'});
   await page.locator('#rev-archive').click();
   const results=page.locator('#archive-search-results');
   const checkRows=results.locator('.archive-checkin-class-group .archive-search-result');
   ensure(await checkRows.count()===2,'Archive must display both check-in records in a single group');
   ensure(await results.locator('.archive-checkin-emoji').count()===2,'Check-in emoji indicators missing');
   ensure(await results.locator('.archive-checkin-label').count()===2,'Check-in phase labels missing');
   ensure((await results.innerText()).includes('QA-MORNING-MOOD')&&(await results.innerText()).includes('QA-NIGHT-MOOD'),'Check-in note provenance missing');
   const first=checkRows.first();await first.click();
   ensure(await checkRows.first().getAttribute('aria-expanded')==='true','Check-in record cannot expand');
   await checkRows.first().click();
   ensure(await checkRows.first().getAttribute('aria-expanded')==='false','Check-in record cannot collapse');
   await page.locator('#archive-search .archive-records-search-button').click();
   await page.locator('#archive-search-input').fill('QA-NIGHT-MOOD');
   ensure(await results.locator('.archive-search-result').count()===1,'Archive search should find the End-of-day record only');
   const saved=await page.evaluate(d=>{
    const data=JSON.parse(localStorage.getItem('kona.legacy.v1.dayframe')||'{}');
    return {morning:data.days?.[d]?.checkins?.morning,night:data.days?.[d]?.checkins?.night};
   },recordDate);
   ensure(saved.morning?.note==='QA-MORNING-MOOD'&&saved.night?.note==='QA-NIGHT-MOOD','Read-only Archive changed persisted check-ins');
   ensure(saved.morning.morningEnergy===3&&saved.night.nightHappiness===2,'Read-only Archive changed mood ratings');
   ensure(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,'Archive overflow');
   ensure(!errors.length,'Browser JavaScript errors: '+errors.join(' | '));
   row.passed=true;
   await page.screenshot({path:artifacts+'/'+width+'-'+theme+'-archive-checkins.png',animations:'disabled'});
   console.log('MOOD_RECORD_PASS '+width+'/'+theme+' Daily/Archive check-in mood provenance, expand, search, no writes');
  }catch(e){row.error=String(e);row.errors=errors;console.error('MOOD_RECORD_FAIL '+width+'/'+theme+' '+String(e))}
  finally{report.push(row);await ctx.close()}
 }
}finally{await browser.close()}
await fs.writeFile(artifacts+'/report.json',JSON.stringify(report,null,2));
if(report.some(r=>!r.passed))process.exitCode=1;