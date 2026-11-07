import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const folder='test-results/end-of-day-trend-saved';
await fs.mkdir(folder,{recursive:true});
const executablePath=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(v=>v&&existsSync(v));
if(!executablePath)throw Error('Chromium unavailable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const reports=[];
const snap=async(page,name)=>{
 await page.screenshot({path:folder+'/'+name+'.png',animations:'disabled'});
 if(name==='390-light-en-chart'||name==='390-dark-en-chart'){
  const b64=(await page.screenshot({type:'jpeg',quality:43,animations:'disabled'})).toString('base64');
  console.log('SHOT_BEGIN '+name);
  for(let i=0;i<b64.length;i+=4000)console.log('SHOT '+b64.slice(i,i+4000));
  console.log('SHOT_END '+name);
 }
};
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark'])for(const lang of ['en','ko']){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,timezoneId:'Pacific/Honolulu',locale:lang==='en'?'en-US':'ko-KR',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const row={width,theme,lang};
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator(lang==='ko'?'#tutorialChooseKo':'#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   await page.evaluate(t=>{
    document.getElementById('launchScreen')?.remove();
    const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
    document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
    date='2026-11-05';
    day('2026-11-05').checkins.night={nightEnergy:4,nightHappiness:2,moodTime:'21:00'};
    day('2026-11-04').checkins.night={nightEnergy:3,nightHappiness:5,moodTime:'21:10'};
    day('2026-11-03').checkins.morning={morningEnergy:4,morningHappiness:5,moodTime:'08:00'};
    day('2026-11-02').checkins.night={nightEnergy:2,nightHappiness:3,moodTime:'21:15'};
    day('2026-11-05').quickCaptureEntries=[{id:'qa-save-note',time:'12:30',title:'QA Save',text:'SAVE-FOR-LATER QA note',scheduleId:'',tags:[]}];
   },theme);
   const before=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-archive').click();
   await page.locator('.archive-mood-view-switch button').last().click();
   const trend=page.locator('.archive-mood-trend');
   if(!await trend.isVisible())throw Error('Seven-day End-of-day graph not visible');
   if(await page.locator('.archive-mood-week-grid').count())throw Error('Old multi-phase dot week still shown');
   const points=await page.evaluate(()=>({
    mood:[...document.querySelectorAll('.archive-mood-trend-point.trend-mood circle')].map(x=>({cx:x.getAttribute('cx'),cy:x.getAttribute('cy')})),
    energy:[...document.querySelectorAll('.archive-mood-trend-point.trend-energy rect')].map(x=>({x:x.getAttribute('x'),y:x.getAttribute('y')})),
    moodPath:document.querySelector('.archive-mood-trend-line.trend-mood')?.getAttribute('d'),
    energyPath:document.querySelector('.archive-mood-trend-line.trend-energy')?.getAttribute('d'),
    yaxis:[...document.querySelectorAll('.archive-mood-trend-axis')].map(x=>x.textContent),
    dates:[...document.querySelectorAll('.archive-mood-trend-date')].map(x=>x.dataset.moodDate),
    overflow:document.documentElement.scrollWidth-innerWidth
   }));
   if(points.mood.length!==3||points.energy.length!==3)throw Error('Graph includes morning or wrong score counts: '+JSON.stringify(points));
   if((points.moodPath.match(/M/g)||[]).length!==2||(points.moodPath.match(/L/g)||[]).length!==1)throw Error('Unrated day wrongly interpolated: '+points.moodPath);
   if(!points.energyPath.includes('L'))throw Error('Energy line missing connecting segment');
   if(points.yaxis.join(',')!=='5,3,1')throw Error('1–5 rating axis missing');
   if(points.dates.join(',')!=='2026-10-30,2026-10-31,2026-11-01,2026-11-02,2026-11-03,2026-11-04,2026-11-05')throw Error('Week date range incorrect');
   if(points.overflow>1)throw Error('Horizontal overflow');
   const series=await trend.locator('.archive-mood-trend-key-item').allTextContents();
   if(series.length!==2)throw Error('Graph must explain exactly two series');
   if(!await trend.locator('svg[role="img"]').getAttribute('aria-label').then(v=>v.includes('2026-11-03')&&v.includes('2026-11-05')))throw Error('Graph inaccessible');
   await snap(page,width+'-'+theme+'-'+lang+'-chart');
   const nonEnd=page.locator('.archive-mood-trend-date[data-mood-date="2026-11-03"]');
   if(!await nonEnd.getAttribute('aria-label').then(s=>s.includes(lang==='ko'?'하루 마무리':'No End-of-day')))throw Error('Only Morning day should have no End-of-day graph score');
   await nonEnd.click();
   if(await page.locator('.archive-mood-detail .archive-mood-item').count()!==1)throw Error('Selected-day detail lost Morning check-in');
   if(!await page.locator('.archive-mood-trend-date[data-mood-date="2026-11-03"]').getAttribute('aria-pressed').then(x=>x==='true'))throw Error('Day selection lost');
   await page.locator('.archive-mood-calendar-toggle').click();
   if(await page.locator('.archive-mood-month-grid [data-mood-date="2026-11-03"] .archive-mood-dot').count()!==1)throw Error('Monthly 4-phase history not preserved');
   if(await page.locator('.archive-mood-month-grid [data-mood-date="2026-11-05"] .archive-mood-dot').count()!==1)throw Error('Monthly End-of-day history missing');
   await page.locator('.archive-mood-calendar-toggle').click();
   if(!await trend.isVisible())throw Error('End-of-day graph did not return after month collapse');
   if(await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'))!==before)throw Error('Mood read-only browsing changed localStorage');
   await page.locator('.archive-mood-view-switch button').first().click();
   await page.locator('#archive-search-input').fill('SAVE-FOR-LATER QA');
   const record=page.locator('.archive-search-result-wrap');
   if(await record.count()!==1)throw Error('Expected one Archive test note');
   const star=record.locator('.archive-save-toggle');
   if(await star.getAttribute('aria-pressed')!=='false')throw Error('Note initially marked for later');
   await star.click();
   if(!await page.evaluate(()=>db.days['2026-11-05'].important.includes('qa-save-note')))throw Error('Save for later did not use existing important storage');
   if(await page.locator('.archive-save-toggle').getAttribute('aria-pressed')!=='true')throw Error('Saved state not reflected in the UI');
   await page.locator('.review-saved-filters button').last().click();
   if(await page.locator('.archive-search-result-wrap').count()!==1)throw Error('Saved for later filter did not find marked note');
   await page.locator('.archive-save-toggle').click();
   if(await page.locator('.archive-search-result-wrap').count())throw Error('Unsave did not remove note from saved-only results');
   if(await page.evaluate(()=>db.days['2026-11-05'].important.includes('qa-save-note')))throw Error('Unsave retained important flag');
   if(!await page.locator('#archive-search-results').innerText().then(s=>s.includes(lang==='en'?'☆':'☆')))throw Error('Saved empty state does not explain how to mark records');
   if(errors.length)throw Error('Page errors '+errors.join(' | '));
   row.ok=true;row.graph=points;
   console.log('MOOD_TREND_SAVED_PASS '+JSON.stringify({width,theme,lang,onlyEndOfDay:true,series:2,gapsPreserved:true,monthUnchanged:true,savedToggle:true,storageReadOnly:true}));
  }catch(e){row.ok=false;row.error=String(e);row.errors=errors;console.error('MOOD_TREND_SAVED_FAIL '+width+' '+theme+' '+lang+' '+e);await page.screenshot({path:folder+'/'+width+'-'+theme+'-'+lang+'-FAIL.png'}).catch(()=>{})}
  finally{reports.push(row);await context.close()}
 }
}finally{await browser.close();await fs.writeFile(folder+'/report.json',JSON.stringify(reports,null,2))}
if(reports.some(x=>!x.ok))process.exitCode=1;
