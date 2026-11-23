// Current Review IA: Daily has a seven-day selector and inline weekly reflection;
// Archive supports grouped dates, schedule provenance, search and composable filters.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const exe=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
if(!exe)throw Error('Chrome unavailable');
const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const out=process.env.ONHARU_ARTIFACTS||'test-results/review-hierarchy';
await fs.mkdir(out,{recursive:true});
const check=(ok,message)=>{if(!ok)throw Error(message)};
const all=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(8500);page.on('pageerror',e=>errors.push(String(e)));
  const result={width,theme,ok:false};
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   await page.evaluate(t=>{
    document.getElementById('launchScreen')?.remove();
    const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
    document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
    date='2026-11-05';
    for(const [d,id] of [['2026-11-05','qa-today'],['2026-11-04','qa-yesterday']]){
     const evt=dayEvents(d).find(e=>e?.id);
     if(!evt)throw Error('Synthetic fixture has no schedule');
     const v=day(d);
     v.quickCaptureEntries=[...(v.quickCaptureEntries||[]),{
      id,time:'14:43',createdAt:d+'T20:43:00Z',title:'QA-AH title',
      text:'QA-ARCHIVE-HIERARCHY '+id+' long preview for Archive search and record expansion.',
      scheduleId:evt.id,scheduleTitle:evt.title,tags:[]
     }];
     if(d==='2026-11-05'){
      v.quickCaptureEntries.push({id:'qa-independent',time:'12:44',title:'Independent note',text:'QA-PERSONAL-SAMPLE',scheduleId:'',tags:[]});
      v.sessions=[...(v.sessions||[]),{id:'qa-prayer',start:'12:46',seconds:600,kind:'prayer',task:'QA prayer',note:'QA-PRACTICE-SAMPLE'}];
     }
    }
   },theme);
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-reflect').click();
   const dayButtons=page.locator('#new-reflect-page .rv-seven-day');
   check(await dayButtons.count()===7,'Weekly day selector is missing');
   const weekly=page.locator('#new-reflect-page .rv-weekly-inline-details');
   check(await weekly.count()===1,'Inline weekly reflection is absent');
   await weekly.locator('summary').click();
   check(await weekly.evaluate(e=>e.open),'Weekly reflection does not open');
   await page.locator('#new-reflect-page .rv-seven-day[aria-label^="2026-11-04"]').click();
   check(await page.locator('#new-reflect-page .rv-linked-group').filter({hasText:'qa-yesterday'}).count()>=1,'Changing day lost the scheduled note');
   await page.screenshot({path:out+'/'+width+'-'+theme+'-daily-week.png',animations:'disabled'});
   await page.locator('#rev-archive').click();
   const archive=page.locator('#archive-search');
   const rows=page.locator('#archive-search-results .archive-search-result');
   check(await rows.filter({hasText:'QA-PRACTICE-SAMPLE'}).count()===1,'Prayer practice missing from Archive');
   check(await rows.filter({hasText:'QA-PERSONAL-SAMPLE'}).count()===1,'Personal note missing from Archive');
   check(await archive.locator('.archive-records-star-button').count()===1,'Current Archive star toggle missing');
   const initialOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   check(initialOverflow<=1,'Archive overflow before searching: '+initialOverflow);
   await archive.locator('.archive-records-search-button').click();
   const search=archive.locator('#archive-search-input');
   await search.fill('QA-ARCHIVE-HIERARCHY');
   check(await rows.count()===2,'Expected exactly two searched notes');
   const headings=page.locator('#archive-search-results>.review-date-header');
   check(await headings.count()===2,'Search results were not grouped by two dates');
   const dates=await rows.evaluateAll(xs=>xs.map(e=>e.dataset.recordDate));
   check(dates[0]==='2026-11-05'&&dates[1]==='2026-11-04','Archive sorting by date changed: '+dates);
   check(await rows.locator('.review-schedule-label').count()===2,'Scheduled provenance tags missing from Archive rows');
   await archive.locator('.archive-records-search-back').click();
   const disclosure=archive.locator('.archive-filter-disclosure');
   await disclosure.locator('summary').click();
   check(await disclosure.evaluate(e=>e.open),'Archive filters did not expand');
   await archive.locator('.archive-filter-row select[aria-label="Type"]').selectOption('schedule');
   check(await rows.count()===2,'Schedule filter incorrectly dropped linked records');
   await archive.locator('.archive-filter-row select[aria-label="Period"]').selectOption('date');
   const dateField=archive.locator('.review-archive-context input[type=date]');
   await dateField.fill('2026-11-04');await dateField.dispatchEvent('change');
   check(await rows.count()===1,'Combined search, schedule and exact-date filter failed');
   const row=rows.first();
   check((await row.getAttribute('data-record-date'))==='2026-11-04','Wrong date after filtering');
   await row.click();
   check(await rows.first().getAttribute('aria-expanded')==='true','Record preview cannot expand');
   check(await archive.locator('.archive-record-expanded .archive-record-extra').isVisible(),'Record actions missing after expansion');
   await rows.first().click();
   check(await rows.first().getAttribute('aria-expanded')==='false','Record preview cannot collapse');
   const starred=archive.locator('.archive-records-star-button');
   await starred.click();
   check(await archive.locator('.archive-records-star-button').getAttribute('aria-pressed')==='true','Starred filter selection not reflected');
   check(await rows.count()===0,'Unsaved note should be excluded from Starred filter');
   await archive.locator('.archive-records-star-button').click();
   check(await rows.count()===1,'All records did not restore search/filter results');
   await rows.first().scrollIntoViewIfNeeded();
   check(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,'Archive overflows after filtering');
   check(!errors.length,'Browser errors: '+errors.join(' | '));
   await page.screenshot({path:out+'/'+width+'-'+theme+'-archive-filtered.png',animations:'disabled'});
   result.ok=true;result.search=true;result.combinedFilters=true;result.expand=true;
   console.log('PASS '+width+'/'+theme+' Daily weekly access, Archive date groups, search/filter, expand and Starred');
  }catch(e){result.error=String(e);result.errors=errors;console.error('FAIL '+width+'/'+theme+' '+String(e))}
  finally{all.push(result);await ctx.close()}
 }
}finally{await browser.close()}
await fs.writeFile(out+'/report.json',JSON.stringify(all,null,2));
if(all.some(r=>!r.ok))process.exitCode=1;