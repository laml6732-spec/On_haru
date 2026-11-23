// Verify schedule provenance across Daily, weekly date navigation, and Archive.
// Each case runs with synthetic entries in an isolated browser profile.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chrome browser missing');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const folder=process.env.ONHARU_ARTIFACTS||'test-results/review-labels';
await fs.mkdir(folder,{recursive:true});
const check=(ok,message)=>{if(!ok)throw Error(message)};
const results=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(8500);page.on('pageerror',e=>errors.push(String(e)));
  const result={width,theme,ok:false};
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   const fixture=await page.evaluate(t=>{
    document.getElementById('launchScreen')?.remove();
    const tour=document.getElementById('tutorialModal');if(tour){tour.hidden=true;tour.style.display='none'}
    document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
    date='2026-11-04';
    const event=dayEvents(date).find(e=>e?.id&&e.title);
    if(!event)throw Error('Synthetic fixture requires a scheduled event');
    const d=day(date);
    d.quickCaptureEntries=[...(d.quickCaptureEntries||[]),{
     id:'qa-schedule-provenance',time:'08:51',createdAt:'2026-11-04T18:51:00Z',
     scheduleId:event.id,scheduleTitle:event.title,title:'QA linked title',
     text:'QA linked sample for schedule tag',tags:[]
    }];
    return {date,eventName:KonaI18n.eventLabel(event)};
   },theme);
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-reflect').click();
   const days=page.locator('#new-reflect-page .rv-seven-day');
   check(await days.count()===7,'Weekly day selector is not present');
   await page.locator('#new-reflect-page .rv-seven-day[aria-label^="2026-11-04"]').click();
   const group=page.locator('#new-reflect-page .rv-linked-group').filter({hasText:'QA linked sample for schedule tag'}).first();
   await group.waitFor();
   const dailyLabel=group.locator('.review-schedule-label,.review-event-heading').first();
   await dailyLabel.waitFor();
   check((await dailyLabel.innerText()).includes(fixture.eventName),'Daily linked group lost schedule label');
   const inlineWeek=page.locator('#new-reflect-page .rv-weekly-inline-details');
   check(await inlineWeek.count()===1,'Weekly reflection should be accessible inline in Daily');
   await inlineWeek.locator('summary').click();
   check(await inlineWeek.evaluate(e=>e.open),'Inline weekly reflection does not expand');
   check(await inlineWeek.locator('textarea').count()>=2,'Weekly reflection inputs are missing');
   await page.screenshot({path:folder+'/'+width+'-'+theme+'-daily.png',animations:'disabled'});
   await page.locator('#rev-archive').click();
   await page.locator('#archive-search .archive-records-search-button').click();
   const search=page.locator('#archive-search-input');
   await search.fill('QA linked sample for schedule tag');
   const rows=page.locator('#archive-search-results .archive-search-result');
   check(await rows.count()===1,'Archive search did not return the linked note exactly once');
   const archiveLabel=rows.first().locator('.review-schedule-label');
   await archiveLabel.waitFor();
   check((await archiveLabel.innerText()).includes(fixture.eventName),'Archive lost the original schedule name');
   check((await rows.first().getAttribute('data-record-date'))===fixture.date,'Archive lost the note date');
   await rows.first().click();
   check(await rows.first().getAttribute('aria-expanded')==='true','Archive record cannot be expanded');
   check(await page.locator('#archive-search-results .archive-record-expanded .archive-record-extra').isVisible(),'Expanded record options missing');
   check(await archiveLabel.innerText()===fixture.eventName,'Expanding record changed schedule provenance');
   check(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,'Archive overflows horizontally');
   check(!errors.length,'Browser errors: '+errors.join(' | '));
   await page.screenshot({path:folder+'/'+width+'-'+theme+'-archive.png',animations:'disabled'});
   result.ok=true;result.fixture=fixture;
   console.log('PASS '+width+'/'+theme+' schedule links preserved in Daily and Archive, weekly inline entry');
  }catch(e){result.error=String(e);result.errors=errors;console.error('FAIL '+width+'/'+theme+' '+String(e))}
  finally{results.push(result);await ctx.close()}
 }
}finally{await browser.close()}
await fs.writeFile(folder+'/report.json',JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;