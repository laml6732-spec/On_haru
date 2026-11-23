// Historical filename retained. Mood is now shown as provenance in
// Check-ins and Archive records, not through a retired Archive Mood switch.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const artifacts=process.env.ONHARU_ARTIFACTS||'test-results/archive-mood-tooltip';
await fs.mkdir(artifacts,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chrome browser missing');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const row={width,theme,passed:false};
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce',serviceWorkers:'block',locale:'en-US',timezoneId:'Pacific/Honolulu'});
  const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();await page.locator('#welcomeSkip').click();
   const seeded=await page.evaluate(t=>{
    document.getElementById('launchScreen')?.remove();const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
    document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
    date='2026-11-05';
    const v=day(date);v.checkins.morning={note:'QA-MOOD-MORNING',morningEnergy:3,morningHappiness:4,moodTime:'08:15'};
    v.checkins.night={note:'QA-MOOD-NIGHT',nightEnergy:2,nightHappiness:5,moodTime:'21:15'};
    return reviewArchiveRecords().filter(r=>r.date===date&&r.kind==='check').map(r=>({phase:r.phase,energy:r.energy,happiness:r.happiness,feeling:r.feeling}));
   },theme);
   if(!seeded.some(r=>r.phase==='morning'&&r.energy===3&&r.happiness===4))throw Error('Morning rating lost before render');
   if(!seeded.some(r=>r.phase==='night'&&r.energy===2&&r.happiness===5))throw Error('End-of-day rating lost before render');
   const baseline=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-archive').click();
   if(await page.locator('.archive-mood-view-switch').count())throw Error('Retired Mood switch unexpectedly returned');
   await page.locator('#archive-search .archive-records-search-button').click();
   const search=page.locator('#archive-search-input');await search.fill('QA-MOOD-');
   const rows=page.locator('#archive-search-results .archive-search-result');
   if(await rows.count()!==2)throw Error('Both recorded check-ins must remain searchable in Archive');
   if(await page.locator('#archive-search-results>.review-date-header').count()!==1)throw Error('Check-ins are not grouped under their date');
   const details=await rows.evaluateAll(nodes=>nodes.map(el=>{
    const head=el.querySelector('.archive-result-head'),emoji=head?.querySelector('.archive-checkin-emoji'),label=head?.querySelector('.archive-checkin-label'),feeling=head?.querySelector('.archive-checkin-feeling'),text=el.querySelector('.archive-search-preview');
    return {phase:label?.textContent,mood:feeling?.textContent,emoji:emoji?.textContent,note:text?.textContent,aria:el.getAttribute('aria-label')};
   }));
   if(!details.every(r=>r.phase&&r.mood&&r.emoji&&r.note?.includes('QA-MOOD-')&&r.aria))throw Error('Mood/time source missing in Archive: '+JSON.stringify(details));
   if(!details.some(r=>r.phase.includes('Morning'))||!details.some(r=>r.phase.includes('Day wrap-up')))throw Error('Phase identity lost: '+JSON.stringify(details));
   const feeling=rows.first().locator('.archive-checkin-feeling');
   const contrast=await feeling.evaluate(el=>({color:getComputedStyle(el).color,fontSize:parseFloat(getComputedStyle(el).fontSize),width:el.getBoundingClientRect().width}));
   if(contrast.width<=0||contrast.fontSize<10)throw Error('Mood label not legible');
   await rows.first().click();
   if(await rows.first().getAttribute('aria-expanded')!=='true')throw Error('Archive mood note not expandable');
   if(await page.locator('#archive-search-results .archive-record-extra').first().isVisible()!==true)throw Error('Expanded note actions not visible');
   if(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)>1)throw Error('Archive horizontal overflow');
   if(await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'))!==baseline)throw Error('Browsing archived feelings changed saved records');
   if(errors.length)throw Error('Page errors: '+errors.join('; '));
   await page.screenshot({path:artifacts+'/'+width+'-'+theme+'-archive-checkins.png',animations:'disabled'});
   row.passed=true;row.details=details;row.seeds=seeded;
   console.log('MOOD_ARCHIVE_PASS '+width+' '+theme+' phases, emotion labels, expanded record, read-only storage');
  }catch(e){row.error=String(e);console.error('MOOD_ARCHIVE_FAIL '+width+' '+theme+' '+e)}
  finally{report.push(row);await ctx.close()}
 }
}finally{await browser.close();await fs.writeFile(artifacts+'/report.json',JSON.stringify(report,null,2))}
if(report.some(x=>!x.passed))process.exitCode=1;
