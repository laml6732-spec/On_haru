import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const folder='test-results/mood-all-phases';
const endpoint=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
await fs.mkdir(folder,{recursive:true});
const executablePath=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('Chromium required');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const result={width,theme};
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(endpoint,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   await page.evaluate(t=>{
    document.getElementById('launchScreen')?.remove();
    const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
    document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
    date='2026-11-05';
    const today=day('2026-11-05');
    today.checkins.morning={moodTime:'08:15',morningEnergy:3,morningHappiness:4};
    today.checkins.noon={moodTime:'12:30',mood:compactMoodValue(2,3),lectureQuote:'Class note also present'};
    today.checkins.evening={moodTime:'18:10',eveningEnergy:4,eveningHappiness:3};
    today.checkins.night={moodTime:'21:00',nightEnergy:5,nightHappiness:4,note:'Reflection at end of day'};
    // Night-only from Daily Reflection must be a valid day on its own.
    day('2026-11-04').checkins.night={nightEnergy:2,nightHappiness:5,note:'Just a reflection'};
    // A class-only Midday and a text-only Night must not produce mood dots.
    day('2026-11-03').checkins.noon={lectureQuote:'Only class notes'};
    day('2026-11-03').checkins.night={note:'Thought without a mood rating'};
    // Old mood object with no phase-specific numeric fields must still show.
    day('2026-11-02').checkins.noon={mood:compactMoodValue(1,2)};
   },theme);
   const baseline=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-archive').click();
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
   const chart=page.locator('.archive-mood-trend');
   if(!await chart.isVisible())throw Error('Expected End-of-day weekly chart');
   if(await chart.locator('.archive-mood-trend-point.mood').count()!==2)throw Error('Only two days have End-of-day mood scores');
   if(await chart.locator('.archive-mood-trend-point.energy').count()!==2)throw Error('Only two days have End-of-day energy scores');
   if(!await chart.locator('.archive-mood-trend-date[data-mood-date="2026-11-03"]').getAttribute('aria-label').then(x=>x.includes('No End-of-day')))throw Error('Class or text-only day created a graph score');
   if(!await chart.locator('.archive-mood-trend-date[data-mood-date="2026-11-02"]').getAttribute('aria-label').then(x=>x.includes('No End-of-day')))throw Error('Legacy Midday incorrectly included in End-of-day graph');
   const daily=page.locator('.archive-mood-detail');
   const visibleText=await daily.innerText();
   if(!['Morning','Midday','Evening','End-of-day'].every(x=>visibleText.includes(x)))throw Error('All four phase details not visible: '+visibleText);
   const layout=await page.evaluate(()=>{
    const d=document.querySelector('.archive-mood-trend-svg').getBoundingClientRect();
    return {viewportOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),chartWidth:d.width,viewportWidth:innerWidth};
   });
   if(layout.viewportOverflow>1)throw Error('Narrow viewport horizontal overflow');
   await page.screenshot({path:folder+'/'+width+'-'+theme+'-four-phases.png',animations:'disabled'});
   await page.locator('.archive-mood-trend-date[data-mood-date="2026-11-04"]').click();
   if(await page.locator('.archive-mood-detail .archive-mood-item').count()!==1)throw Error('Night-only day shows wrong number of entries');
   if(!await page.locator('.archive-mood-detail').innerText().then(s=>s.includes('End-of-day')))throw Error('Night-only day label missing');
   await page.locator('.archive-mood-trend-date[data-mood-date="2026-11-03"]').click();
   if(await page.locator('.archive-mood-detail .archive-mood-item').count())throw Error('Unrated day incorrectly shows mood detail');
   await page.locator('.archive-mood-calendar-toggle').click();
   const fullMonthDay5=page.locator('.archive-mood-month-grid [data-mood-date="2026-11-05"]');
   if(await fullMonthDay5.locator('.archive-mood-dot').count()!==4)throw Error('Full month omits one of four phases');
   const legacyNoon=page.locator('.archive-mood-month-grid [data-mood-date="2026-11-02"] .archive-mood-dot');
   if(await legacyNoon.count()!==1||await legacyNoon.getAttribute('data-phase')!=='noon')throw Error('Month omitted legacy Midday mood');
   if(await page.locator('.archive-mood-month-grid [data-mood-date="2026-11-03"] .archive-mood-dot').count())throw Error('Month rendered unrated class notes as a mood');
   await page.screenshot({path:folder+'/'+width+'-'+theme+'-month.png',animations:'disabled'});
   if(await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'))!==baseline)throw Error('Browsing Mood wrote to localStorage');
   if(errors.length)throw Error('Page JS errors: '+errors.join(' | '));
   result.ok=true;result.layout=layout;
   console.log('MOOD_PHASES_PASS '+JSON.stringify({width,theme,phases,nightOnly:true,noFalseDots:true,legacyNoon:true,storageUnchanged:true,overflow:layout.viewportOverflow}));
  }catch(e){result.ok=false;result.error=String(e);result.pageErrors=errors;
   console.error('MOOD_PHASES_FAIL '+width+' '+theme+' '+e);
   await page.screenshot({path:folder+'/'+width+'-'+theme+'-failed.png'}).catch(()=>{});
  }finally{report.push(result);await context.close()}
 }
}finally{await browser.close();await fs.writeFile(folder+'/report.json',JSON.stringify(report,null,2))}
if(report.some(x=>!x.ok))process.exitCode=1;
