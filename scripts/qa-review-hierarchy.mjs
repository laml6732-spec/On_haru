// Current Review IA: Daily includes inline Weekly; Archive lists real records
// grouped by date, with search, filters, star, expand and edit. Isolated fixtures.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const out=process.env.ONHARU_ARTIFACTS||'test-results/review-hierarchy';
await fs.mkdir(out,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chromium unavailable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const all=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(8500);page.on('pageerror',e=>errors.push(String(e)));
  const result={width,theme,ok:false};
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();await page.locator('#welcomeSkip').click();
   const fixture=await page.evaluate(t=>{
    document.getElementById('launchScreen')?.remove();const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
    document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
    date='2026-11-05';
    for(const [d,id] of [['2026-11-05','qa-today'],['2026-11-04','qa-yesterday']]){
     const event=dayEvents(d).find(e=>e.id&&e.title);
     if(!event)throw Error('Test fixture needs scheduled event on '+d);
     const entry=day(d);
     entry.quickCaptureEntries=[...(entry.quickCaptureEntries||[]),{
      id,time:'14:43',date:d,createdAt:d+'T20:43:00Z',title:'QA-AH title',
      text:'QA-ARCHIVE-HIERARCHY '+id+' detailed record for search, filters and archive expansion.',
      scheduleId:event.id,scheduleTitle:event.title,tags:[]}];
     if(d==='2026-11-05'){
      entry.quickCaptureEntries.push({id:'qa-independent',date:d,time:'12:44',title:'Independent note',text:'QA-PERSONAL-SAMPLE',scheduleId:'',tags:[]});
      entry.sessions=[...(entry.sessions||[]),{id:'qa-prayer',start:'12:46',at:'12:56',seconds:600,kind:'prayer',task:'QA prayer',note:'QA-PRACTICE-SAMPLE'}];
     }
    }
    return {groupCount:2,scheduleCount:2,personalCount:1,practiceCount:1};
   },theme);
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-reflect').click();
   const inline=page.locator('#new-reflect-page .rv-weekly-inline-details');
   await inline.locator('summary').first().waitFor();
   const range=await inline.locator('summary').first().innerText();
   if(!range.includes('Weekly reflection')||!range.includes('11/'))throw Error('Inline Weekly reflection not discoverable');
   result.weekly={summary:range};
   await page.locator('#rev-archive').click();
   const rows=page.locator('#archive-search-results .archive-search-result');
   if(!await page.locator('#archive-search-results .archive-prayer-result').filter({hasText:'QA-PRACTICE-SAMPLE'}).count())throw Error('Prayer source missing from Archive');
   if(!await rows.filter({hasText:'QA-PERSONAL-SAMPLE'}).count())throw Error('Personal note missing from Archive');
   if(await page.locator('#archive-search-results .review-schedule-label').count()<2)throw Error('Schedule provenance missing from Archive rows');
   const disclosure=page.locator('#archive-search .archive-filter-disclosure');
   await disclosure.waitFor();if(await disclosure.evaluate(el=>el.open))throw Error('Filter popover should default closed');
   if(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)>1)throw Error('Archive initially overflows viewport');
   await page.screenshot({path:out+'/'+width+'-'+theme+'-archive.png',animations:'disabled'});
   await page.locator('#archive-search .archive-records-search-button').click();
   const search=page.locator('#archive-search-input');await search.fill('QA-ARCHIVE-HIERARCHY');
   if(await rows.count()!==2)throw Error('Search must find both linked synthetic records');
   const heads=page.locator('#archive-search-results>.review-date-header');
   if(await heads.count()!==2)throw Error('Archive must group synthetic records by both dates');
   const header=await heads.first().innerText();
   if(!header.includes('1 record'))throw Error('Archive date group count missing');
   // Current record row holds source metadata above a compact preview.
   const first=rows.first();
   const order=await first.evaluate(el=>[...el.children].map(x=>x.className));
   if(order[0]!=='archive-result-head'||order[1]!=='archive-search-preview')throw Error('Metadata and preview order changed: '+order);
   await page.locator('#archive-search .archive-records-search-back').click();
   // Search terms stay applied when closing the search field, and filters are now visible.
   await disclosure.locator('summary').click();
   if(!await disclosure.evaluate(el=>el.open))throw Error('Archive filters did not open');
   const type=page.locator('#archive-search .archive-filter-row select[aria-label="Type"]');
   await type.selectOption('schedule');
   if(await rows.count()!==2)throw Error('Schedule filter removed linked records');
   const period=page.locator('#archive-search .archive-filter-row select[aria-label="Period"]');
   await period.selectOption('date');
   const picked=page.locator('#archive-search .review-archive-context input[type=date]');
   await picked.fill('2026-11-04');await picked.dispatchEvent('change');
   if(await rows.count()!==1)throw Error('Date + schedule + search intersection failed');
   if(await page.locator('#archive-search .archive-records-condition-strip').count()!==1)throw Error('Active filter status missing');
   await page.screenshot({path:out+'/'+width+'-'+theme+'-filtered.png',animations:'disabled'});
   const archiveRow=rows.first();
   await archiveRow.click();
   if(await archiveRow.getAttribute('aria-expanded')!=='true')throw Error('Archive note cannot expand');
   const expanded=page.locator('#archive-search-results .archive-record-expanded');
   if(!await expanded.locator('.archive-record-extra').isVisible())throw Error('Expanded record action missing');
   await expanded.locator('.archive-record-extra button').filter({hasText:'Edit'}).click();
   const detail=page.locator('#archive-search-results .review-record');
   await detail.waitFor();
   if(!(await detail.innerText()).includes('QA-ARCHIVE-HIERARCHY'))throw Error('Expanded record has no full text');
   await page.locator('#archive-search .archive-back').click();
   if(await rows.count()!==1)throw Error('Back navigation lost combined filters');
   // Saved filter and star must remain functional, without any permanent test data.
   const mark=page.locator('#archive-search-results .archive-save-toggle').first();
   await mark.click();if(await page.locator('#archive-search-results .archive-save-toggle').first().getAttribute('aria-pressed')!=='true')throw Error('Star action did not persist');
   await page.locator('#archive-search .archive-records-star-button').click();
   if(await page.locator('#archive-search .archive-records-star-button').getAttribute('aria-pressed')!=='true')throw Error('Saved-filter selection missing');
   if(await rows.count()!==1)throw Error('Saved-filter did not preserve matching note');
   await page.locator('#archive-search .archive-records-star-button').click();
   if(await rows.count()!==1)throw Error('All-records view did not restore filtered note');
   if(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)>1)throw Error('Archive horizontal overflow after interactions');
   if(errors.length)throw Error('JavaScript exceptions '+errors.join('; '));
   result.ok=true;result.archive={dateGroups:2,search:true,combinedFilters:true,detail:true,savedFilter:true};result.fixture=fixture;
   console.log('PASS '+width+'/'+theme+' inline Weekly, Archive provenance/search/filters/expand/star');
  }catch(e){result.error=String(e);console.error('FAIL '+width+'/'+theme+' '+e)}
  all.push(result);await ctx.close();
 }
}finally{await browser.close()}
await fs.writeFile(out+'/report.json',JSON.stringify(all,null,2));
if(all.some(x=>!x.ok))process.exitCode=1;
