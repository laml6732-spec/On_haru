import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const base = process.env.ONHARU_URL || 'http://127.0.0.1:8080/legacy/';
const folder = 'test-results/review-reflection-trial';
await fs.mkdir(folder, {recursive:true});
const executablePath = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', chromium.executablePath()].find(p => p && existsSync(p));
if (!executablePath) throw Error('Chromium not found');
const browser = await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results = [];
try {
  for (const width of [320,390,1024]) for (const theme of ['light','dark']) for(const lang of ['en','ko']) {
    const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,timezoneId:'Pacific/Honolulu',locale:lang==='en'?'en-US':'ko-KR',serviceWorkers:'block',reducedMotion:'reduce'});
    const page=await context.newPage(); page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    const result={width,theme,lang};
    try {
      await page.clock.setFixedTime(new Date('2026-10-22T15:20:00-10:00'));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.locator(lang==='ko'?'#tutorialChooseKo':'#tutorialChooseEn').click();
      await page.locator('#welcomeSkip').click();
      await page.evaluate((theme) => {
        document.getElementById('launchScreen')?.remove();
        const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
        document.documentElement.dataset.appearance=theme;
        date='2026-10-22';
        for (const [d,e,h] of [['2026-10-20',2,4],['2026-10-21',3,4],['2026-10-22',4,2],['2026-10-23',1,2],['2026-10-24',5,4]]) {
          day(d).checkins.night={nightEnergy:e,nightHappiness:h,moodTime:'21:10',note:'Test check-in for '+d};
        }
        day('2026-10-22').reflectionNotes={insight:'I noticed God in ordinary conversations.',action:'Write a short note of gratitude.'};
      },theme);
      await page.locator('.tabs [data-page="records"]').click();
      await page.evaluate(() => {date='2026-10-22';calendarMonth='2026-10';renderRecords()});
      const tabs=page.locator('#new-review-switch button');
      const ids=await tabs.evaluateAll(buttons=>buttons.map(b=>b.id));
      if(ids.join('|')!=='rev-reflect|rev-weekly|rev-mood|rev-archive') throw Error('Incorrect tabs '+ids);
      const month=page.locator('#new-reflect-page #viewCal');
      if(!await month.isVisible())throw Error('Daily calendar not restored');
      const col=page.locator('#monthCalendar .daycell[data-review-date="2026-10-22"]');
      if(!await col.count()) throw Error('Calendar date missing');
      if(!await col.evaluate(b=>b.classList.contains('onharu-calendar-day-tone')))throw Error('25-tone mood color not applied');
      if(await page.locator('#monthCalendar .daycell[data-review-date="2026-10-18"]').evaluate(b=>b.classList.contains('onharu-calendar-day-tone')))throw Error('Empty day incorrectly colored');
      const editor=page.locator('#new-reflect-page #dailyReflectionEditor');
      if(!await editor.isVisible())throw Error('Daily reflection editor not shown');
      if(!await editor.locator('.rv-journal-main textarea').isVisible())throw Error('Reflection writing field not shown');
      if(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1))throw Error('Daily horizontal overflow');
      await page.screenshot({path:folder+'/'+width+'-'+theme+'-'+lang+'-daily.png',animations:'disabled'});
      await page.locator('#calendarMode button[data-mode="entries"]').click();
      if(await col.evaluate(b=>b.classList.contains('onharu-calendar-day-tone')))throw Error('Entries still shows mood fill');
      await page.locator('#calendarMode button[data-mode="mood"]').click();
      await page.locator('#rev-weekly').click();
      if(!await page.locator('#rev-weekly.on').count())throw Error('Weekly navigation failed');
      const weeklyEditor=page.locator('#new-reflect-page .rv-journal-main textarea');
      if(!await weeklyEditor.isVisible()) throw Error('Weekly reflection editor not shown');
      const sources=page.locator('#new-reflect-page .onharu-weekly-source');
      if(!await sources.count())throw Error('Original weekly record disclosure missing');
      if(await sources.getAttribute('open')!==null)throw Error('Weekly records expanded by default');
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Weekly overflow');
      await page.screenshot({path:folder+'/'+width+'-'+theme+'-'+lang+'-weekly.png',animations:'disabled'});
      await page.locator('#rev-mood').click();
      if(!await page.locator('#rev-mood.on').count())throw Error('Mood navigation not active');
      if(!await page.locator('#archive-search .archive-mood-trend').isVisible())throw Error('End of day trend missing');
      await page.screenshot({path:folder+'/'+width+'-'+theme+'-'+lang+'-mood.png',animations:'disabled'});
      await page.locator('#rev-archive').click();
      if(!await page.locator('#rev-archive.on').count())throw Error('Archive nav not active');
      if(!await page.locator('#archive-search-input').isVisible())throw Error('Archive record search not shown');
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Archive overflow');
      await page.screenshot({path:folder+'/'+width+'-'+theme+'-'+lang+'-archive.png',animations:'disabled'});
      if(errors.length)throw Error('Page errors: '+errors.join(' | '));
      result.ok=true;
      console.log('REVIEW_TRIAL_PASS',JSON.stringify(result));
    }catch(e){
      result.ok=false;result.error=String(e);
      console.error('REVIEW_TRIAL_FAIL',JSON.stringify(result));
      await page.screenshot({path:folder+'/'+width+'-'+theme+'-'+lang+'-FAIL.png'}).catch(()=>{});
    }finally{results.push(result);await context.close()}
  }
}finally{await browser.close();await fs.writeFile(folder+'/report.json',JSON.stringify(results,null,2))}
if(results.some(r=>!r.ok))process.exitCode=1;
