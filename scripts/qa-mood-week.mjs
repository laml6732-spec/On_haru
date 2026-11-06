import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const folder='test-results/mood-week';
await fs.mkdir(folder,{recursive:true});
const executablePath=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chromium unavailable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const reports=[];
const snap=async(page,name)=>{
 await page.screenshot({path:folder+'/'+name+'.png',animations:'disabled'});
 if(name==='390-light-week'){
  const b64=(await page.screenshot({type:'jpeg',quality:45,animations:'disabled'})).toString('base64');
  console.log('SHOT_BEGIN '+name);
  for(let i=0;i<b64.length;i+=4000)console.log('SHOT '+b64.slice(i,i+4000));
  console.log('SHOT_END '+name);
 }
};
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const report={width,theme};
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
     const d5=day('2026-11-05'),d4=day('2026-11-04'),d30=day('2026-10-30');
     d5.checkins.morning={moodTime:'08:46',morningEnergy:3,morningHappiness:4,note:'Today morning'};
     d5.checkins.evening={moodTime:'20:36',eveningEnergy:4,eveningHappiness:3,note:'Today evening'};
     d4.checkins.morning={moodTime:'07:30',morningEnergy:2,morningHappiness:2,note:'Yesterday morning'};
     d30.checkins.morning={moodTime:'09:10',morningEnergy:4,morningHappiness:5,note:'Last month'};
   },theme);
   const baseline=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-archive').click();
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
   const week=page.locator('.archive-mood-week-grid'),month=page.locator('.archive-mood-month-grid'),toggle=page.locator('.archive-mood-calendar-toggle');
   await week.waitFor();
   if(await month.count())throw Error('Monthly calendar unexpectedly open at start');
   if(await week.locator('.archive-mood-day').count()!==7)throw Error('Seven-day calendar must have exactly seven dates');
   const dates=await week.locator('.archive-mood-day').evaluateAll(xs=>xs.map(x=>x.dataset.moodDate));
   if(dates.join(',')!==['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05'].join(','))throw Error('Week anchor incorrect: '+dates.join(','));
   if(await toggle.getAttribute('aria-expanded')!=='false')throw Error('Month toggle not collapsed initially');
   const title=await page.locator('.archive-mood-heading strong').innerText();
   if(!title.includes('Oct 30')||!title.includes('Nov 5'))throw Error('Week title missing: '+title);
   const detail=page.locator('.archive-mood-detail');
   if(!await detail.innerText().then(x=>x.includes('Morning')&&x.includes('Evening')))throw Error('Selected day details missing');
   const placement=await detail.evaluate(e=>({top:Math.round(e.getBoundingClientRect().top),fraction:Math.round(e.getBoundingClientRect().top/innerHeight*100)/100}));
   report.detail=placement;report.dates=dates;
   if(width<600&&placement.fraction>0.48)throw Error('Mood daily detail starts below 48%: '+placement.fraction);
   if(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)>1)throw Error('Horizontal overflow');
   await snap(page,width+'-'+theme+'-week');
   const info=page.locator('.archive-mood-info');
   await info.locator('summary').click();
   if(!await info.evaluate(e=>e.open))throw Error('Dot tooltip failed');
   if(!await page.locator('.archive-mood-info-tooltip').isVisible())throw Error('Tooltip hidden');
   await info.locator('summary').click();
   await week.locator('[data-mood-date="2026-11-04"]').click();
   if(!await page.locator('.archive-mood-detail>h3').innerText().then(x=>x.includes('November 4')))throw Error('Cannot select another day');
   await page.locator('.archive-mood-arrow').first().click();
   const prior=await page.locator('.archive-mood-week-grid .archive-mood-day').evaluateAll(xs=>xs.map(x=>x.dataset.moodDate));
   if(prior[6]!=='2026-10-29')throw Error('Previous 7 days navigation failed');
   await page.locator('.archive-mood-arrow').last().click();
   if((await page.locator('.archive-mood-week-grid .archive-mood-day').count())!==7)throw Error('Return to original week failed');
   await toggle.click();
   if(await month.locator('.archive-mood-day').count()!==30)throw Error('November monthly calendar missing dates');
   if(await page.locator('.archive-mood-calendar-toggle').getAttribute('aria-expanded')!=='true')throw Error('Monthly toggle state incorrect');
   if(!await page.locator('.archive-mood-heading strong').innerText().then(x=>x.includes('November 2026')))throw Error('Monthly title lost');
   await snap(page,width+'-'+theme+'-month');
   await page.locator('.archive-mood-arrow').first().click();
   if(await page.locator('.archive-mood-month-grid .archive-mood-day').count()!==31)throw Error('Previous month navigation failed');
   await page.locator('.archive-mood-month-grid [data-mood-date="2026-10-30"]').click();
   if(!await page.locator('.archive-mood-detail h3').innerText().then(x=>x.includes('October 30')))throw Error('Month date selection failed');
   await page.locator('.archive-mood-calendar-toggle').click();
   const collapsed=await page.locator('.archive-mood-week-grid .archive-mood-day').evaluateAll(xs=>xs.map(x=>x.dataset.moodDate));
   if(collapsed.length!==7||collapsed[6]!=='2026-10-30')throw Error('Selected date was not carried back to seven-day view');
   const after=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   if(after!==baseline)throw Error('Browsing Mood wrote to stored user records');
   await page.locator('.archive-mood-open-daily').click();
   if(!await page.locator('#rev-reflect').getAttribute('aria-pressed').then(x=>x==='true'))throw Error('Open Daily Review action failed');
   await page.locator('#rev-archive').click();
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Records'}).click();
   if(!await page.locator('#archive-search-input').isVisible())throw Error('Archive Records view lost');
   if(errors.length)throw Error('Page errors '+errors.join(' / '));
   report.ok=true;
   console.log('MOOD_WEEK_PASS '+JSON.stringify({width,theme,detailFraction:placement.fraction,sevenDays:true,fullMonth:true,keyboardInfo:true,dataUnchanged:true}));
  }catch(e){report.ok=false;report.error=String(e);report.pageErrors=errors;console.error('MOOD_WEEK_FAIL '+width+' '+theme+' '+e);await page.screenshot({path:folder+'/'+width+'-'+theme+'-failure.png'}).catch(()=>{})}
  finally{reports.push(report);await context.close()}
 }
}finally{await browser.close();await fs.writeFile(folder+'/report.json',JSON.stringify(reports,null,2))}
if(reports.some(x=>!x.ok))process.exitCode=1;
