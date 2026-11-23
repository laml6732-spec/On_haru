// Daily and Archive display schedule provenance; Weekly reflection is now
// inline in Daily instead of a separate #rev-weekly tab.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const folder=process.env.ONHARU_ARTIFACTS||'test-results/review-labels';
await fs.mkdir(folder,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('Chromium unavailable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',serviceWorkers:'block',reducedMotion:'reduce',timezoneId:'Pacific/Honolulu'});
  const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(String(e)));
  const result={width,theme,ok:false};
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();await page.locator('#welcomeSkip').click();
   const fixture=await page.evaluate(t=>{
    document.getElementById('launchScreen')?.remove();const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
    document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
    date='2026-11-04';const event=dayEvents(date).find(e=>e.id&&e.title);
    if(!event)throw Error('No schedule in synthetic fixture');
    day(date).quickCaptureEntries=[{id:'qa-linked-tag',time:'08:51',createdAt:'2026-11-04T18:51:00Z',date,
      scheduleId:event.id,scheduleTitle:event.title,title:'QA linked title',text:'QA linked sample for schedule tag',tags:[]}];
    return {date,schedule:event.title};
   },theme);
   const baseline=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-reflect').click();
   const dailyGroup=page.locator('#new-reflect-page .rv-linked-group').filter({hasText:'QA linked sample for schedule tag'}).first();
   await dailyGroup.waitFor();
   const dailyTag=dailyGroup.locator('.rv-daily-group-schedule-tag,.review-event-heading,.review-schedule-label').first();
   await dailyTag.waitFor();
   if(!(await dailyTag.innerText()).includes(fixture.schedule))throw Error('Daily schedule provenance missing');
   const dailyText=await dailyGroup.innerText();if(!dailyText.includes('QA linked sample for schedule tag'))throw Error('Daily note missing');
   result.daily={schedule:await dailyTag.innerText(),notes:await dailyGroup.locator('.review-record').count()};
   if(!result.daily.notes)throw Error('Daily record not grouped with schedule');
   // Weekly reflection remains discoverable in the same Daily screen.
   const weekly=page.locator('#new-reflect-page .rv-weekly-inline-details');
   await weekly.locator('summary').first().waitFor();
   if(!(await weekly.locator('summary').first().innerText()).includes('Weekly reflection'))throw Error('Inline weekly reflection missing');
   if(!(await weekly.evaluate(el=>el.open)))await weekly.locator('summary').first().click();
   if(!await weekly.locator('textarea').first().isVisible())throw Error('Inline weekly reflection cannot expand');
   await page.screenshot({path:folder+'/'+width+'-'+theme+'-daily.png',animations:'disabled'});
   // Archive opens in the list mode; tapping Search shows the field.
   await page.locator('#rev-archive').click();
   await page.locator('#archive-search .archive-records-search-button').click();
   const search=page.locator('#archive-search-input');await search.fill('QA linked sample for schedule tag');
   const archiveResult=page.locator('#archive-search-results .archive-search-result').filter({hasText:'QA linked sample for schedule tag'}).first();
   await archiveResult.waitFor();
   const archiveTag=archiveResult.locator('.review-schedule-label');await archiveTag.waitFor();
   if(!(await archiveTag.innerText()).includes(fixture.schedule))throw Error('Archive schedule provenance missing');
   if(await archiveTag.evaluate(el=>{const r=el.getBoundingClientRect();return r.width<=0||r.height<=0}))throw Error('Archive schedule chip hidden');
   result.archive={schedule:await archiveTag.innerText(),ariaLabel:await archiveResult.getAttribute('aria-label')};
   await archiveResult.click();
   if(await page.locator('#archive-search-results .archive-record-expanded').count()!==1)throw Error('Archive record did not expand');
   const edit=page.locator('#archive-search-results .archive-record-expanded .archive-record-extra button').filter({hasText:'Edit'});
   await edit.click();
   const detail=page.locator('#archive-search-results .review-record');
   await detail.waitFor();
   const detailTag=detail.locator('.review-schedule-label');await detailTag.waitFor();
   if(!(await detailTag.innerText()).includes(fixture.schedule))throw Error('Archive detail provenance missing');
   if(!(await detail.innerText()).includes('QA linked sample for schedule tag'))throw Error('Archive detail note missing');
   // Edit opens a modal. Cancel it before returning to the Archive list.
   await page.locator('#konaReviewEditor .rv-edit-actions button').filter({hasText:'Cancel'}).click();
   if(await page.locator('#konaReviewEditor').count())throw Error('Archive edit cancel failed to close');
   await page.locator('#archive-search .archive-back').click();
   if(await page.locator('#archive-search-results .archive-search-result').count()!==1)throw Error('Back navigation lost search result');
   const after=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   if(after!==baseline)throw Error('Read-only Daily/Archive browsing persisted synthetic records');
   if(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)>1)throw Error('Archive horizontal overflow');
   if(errors.length)throw Error('Page JavaScript errors: '+errors.join('; '));
   result.fixture=fixture;result.ok=true;console.log('PASS '+width+' '+theme+' daily provenance, weekly inline, archive list/detail labels');
  }catch(e){result.error=String(e);console.error('FAIL '+width+' '+theme+' '+e)}
  results.push(result);await ctx.close();
 }
}finally{await browser.close()}
await fs.writeFile(folder+'/report.json',JSON.stringify(results,null,2));
if(results.some(x=>!x.ok))process.exitCode=1;
