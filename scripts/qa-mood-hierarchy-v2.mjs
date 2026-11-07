import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const folder='test-results/mood-hierarchy-v2';
await fs.mkdir(folder,{recursive:true});
const executablePath=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(v=>v&&existsSync(v));
if(!executablePath)throw Error('Chromium not installed');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const snapshot=async(page,name)=>{
 await page.screenshot({path:folder+'/'+name+'.png',animations:'disabled'});
 if(name==='390-light-en-recorded'||name==='390-dark-en-recorded'||name==='390-light-en-empty'){
  const b64=(await page.screenshot({type:'jpeg',quality:46,animations:'disabled'})).toString('base64');
  console.log('SHOT_BEGIN '+name);
  for(let i=0;i<b64.length;i+=4000)console.log('SHOT '+b64.slice(i,i+4000));
  console.log('SHOT_END '+name);
 }
};
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark'])for(const lang of ['en','ko']){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,timezoneId:'Pacific/Honolulu',locale:lang==='ko'?'ko-KR':'en-US',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(9500);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
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
    const d=day('2026-11-05');
    d.checkins.morning={morningEnergy:3,morningHappiness:4,moodTime:'08:25'};
    d.checkins.noon={mood:compactMoodValue(2,3),moodTime:'12:15'};
    d.checkins.evening={eveningEnergy:5,eveningHappiness:2,moodTime:'18:40'};
    d.checkins.night={nightEnergy:4,nightHappiness:5,moodTime:'21:15'};
    day('2026-11-04').checkins.night={nightEnergy:2,nightHappiness:5};
    day('2026-11-02').checkins.morning={morningEnergy:2,morningHappiness:4};
   },theme);
   const baseline=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-archive').click();
   await page.locator('.archive-mood-view-switch button').last().click();
   const panel=page.locator('.archive-mood-panel');
   const detail=panel.locator('.archive-mood-detail'),heading=panel.locator('.archive-mood-heading');
   const cards=detail.locator('.archive-mood-entry-grid .archive-mood-item');
   if(await cards.count()!==4)throw Error('Expected four first-class mood cards');
   const scoreLabels=await cards.locator('.archive-mood-rating-row').allInnerTexts();
   if(scoreLabels.length!==4||scoreLabels.some(x=>!(/\/5/.test(x))))throw Error('Scores missing from one or more mood cards: '+scoreLabels);
   const dailyLink=await detail.locator('.archive-mood-open-daily').evaluate(el=>{
    const st=getComputedStyle(el);return {background:st.backgroundColor,underline:st.textDecorationLine,box:st.boxShadow};
   });
   if(!['transparent','rgba(0, 0, 0, 0)'].includes(dailyLink.background)||!dailyLink.underline.includes('underline'))throw Error('Daily Review link is too visually dominant: '+JSON.stringify(dailyLink));
   const structure=await page.evaluate(()=>{
    const bounds=s=>document.querySelector(s).getBoundingClientRect();
    const selected=bounds('.archive-mood-detail'),week=bounds('.archive-mood-heading'),legend=bounds('.archive-mood-trend-key');
    const selectedBtn=document.querySelector('.archive-mood-view-switch>button[aria-pressed="true"]');
    const style=getComputedStyle(selectedBtn), card=document.querySelector('.archive-mood-entry-grid .archive-mood-item'),name=card.querySelector('.archive-mood-feeling-name');
    const textColor=getComputedStyle(name).color,backColor=getComputedStyle(card).backgroundColor;
    const channel=v=>v.split(/[,()]/).map(x=>parseFloat(x)).filter(Number.isFinite).slice(0,3);
    const luminance=color=>{const a=channel(color).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2]};
    const contrast=(x,y)=>{const [a,b]=[luminance(x),luminance(y)].sort((a,b)=>b-a);return (a+.05)/(b+.05)};
    const bar=document.querySelector('.archive-mood-month-label').getBoundingClientRect();
    const arrows=[...document.querySelectorAll('.archive-mood-heading .archive-mood-arrow')].map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,disabled:x.disabled}});
    return {detailY:selected.y,weekY:week.y,legendY:legend.y,detailFraction:selected.y/innerHeight,
      selectedBeforeWeek:selected.y<week.y,contrast:contrast(textColor,backColor),
      switchBackground:style.backgroundColor,switchColor:style.color,
      centerDifference:Math.abs((arrows[0].x+arrows[1].x+arrows[1].w)/2-(bar.x+bar.width/2)),
      navSizes:arrows.map(x=>[x.w,x.h]),futureDisabled:arrows[1].disabled,
      overflow:document.documentElement.scrollWidth-innerWidth};
   });
   row.structure=structure;
   if(!structure.selectedBeforeWeek||structure.detailFraction>.34)throw Error('Selected-day hierarchy failed '+JSON.stringify(structure));
   if(structure.contrast<4.5)throw Error('Mood primary text contrast below 4.5:1 '+structure.contrast);
   if(structure.centerDifference>1.5)throw Error('Calendar header not centered '+structure.centerDifference);
   if(!structure.futureDisabled)throw Error('Forward arrow must be disabled at today');
   if(structure.navSizes.flat().some(x=>x<43.9)||structure.overflow>1)throw Error('Touch or horizontal overflow failure '+JSON.stringify(structure));
   if(await panel.locator('.archive-mood-trend-key .archive-mood-trend-key-item').count()!==2)throw Error('Mood and Energy graph keys must both be visible');
   await snapshot(page,width+'-'+theme+'-'+lang+'-recorded');
   await panel.locator('.archive-mood-calendar-toggle').click();
   if(await panel.locator('.archive-mood-month-grid [data-mood-date="2026-11-06"]').isDisabled()!==true)throw Error('Future mood day is selectable');
   await panel.locator('.archive-mood-month-grid [data-mood-date="2026-11-03"]').click();
   const empty=panel.locator('.archive-mood-empty-state');
   if(!await empty.isVisible())throw Error('Unrated day not handled');
   if(await empty.locator('.archive-mood-open-checkin').count()!==1)throw Error('Empty state needs exactly one primary Check-in CTA');
   if(await empty.locator('.archive-mood-recent-link').count()!==1)throw Error('Recent mood secondary link absent');
   if(await panel.locator('.archive-mood-open-daily').count())throw Error('Empty state should not show Daily Review CTA');
   await snapshot(page,width+'-'+theme+'-'+lang+'-empty');
   await empty.locator('.archive-mood-recent-link').click();
   if(!await panel.locator('.archive-mood-detail h3').innerText().then(x=>x.includes(lang==='ko'?'11':'November')))throw Error('Recent mood day navigation failed');
   // The last interval may have fewer than 7 new days; forward must clamp to today.
   await panel.locator('.archive-mood-calendar-toggle').click();
   await panel.locator('.archive-mood-arrow').last().click();
   const range=await panel.locator('.archive-mood-trend-date').evaluateAll(xs=>xs.map(x=>x.dataset.moodDate));
   if(range[6]!=='2026-11-05')throw Error('Cannot return to current partial 7-day interval: '+range);
   await panel.locator('.archive-mood-trend-date[data-mood-date="2026-11-05"]').click();
   await page.evaluate(()=>{day('2026-11-05').checkins={}});
   await page.locator('.archive-mood-view-switch button').first().click();
   await page.locator('.archive-mood-view-switch button').last().click();
   const todayCta=panel.locator('.archive-mood-open-checkin');
   if(!await todayCta.isVisible())throw Error('Check-in today CTA absent on empty today');
   if(await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'))!==baseline)throw Error('Mood browsing wrote to real localStorage');
   await todayCta.click();
   if(!await page.locator('#page-checkin').evaluate(x=>x.classList.contains('active')))throw Error('Empty state did not open Check-in tab');
   if(errors.length)throw Error('Page JS errors '+errors.join(' | '));
   row.passed=true;
   console.log('MOOD_HIERARCHY_PASS '+JSON.stringify({width,theme,lang,detailFraction:Math.round(structure.detailFraction*100)/100,contrast:Math.round(structure.contrast*100)/100,centerDifference:Math.round(structure.centerDifference*100)/100,fourCards:true,twoSeriesKey:true,emptyCta:true,latestMood:true,dataIntact:true}));
  }catch(e){row.passed=false;row.error=String(e);row.pageErrors=errors;console.error('MOOD_HIERARCHY_FAIL '+width+' '+theme+' '+lang+' '+e);await page.screenshot({path:folder+'/'+width+'-'+theme+'-'+lang+'-FAILED.png'}).catch(()=>{})}
  finally{results.push(row);await context.close()}
 }
}finally{await browser.close();await fs.writeFile(folder+'/report.json',JSON.stringify(results,null,2))}
if(results.some(x=>!x.passed))process.exitCode=1;
