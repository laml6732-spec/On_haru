import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const artifacts=process.env.ONHARU_ARTIFACTS||'test-results/checkin-archive-touch';
await fs.mkdir(artifacts,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chromium not installed');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const cases=[];
const failures=[];
try{
 for(const width of [320,390,1024]) for(const theme of ['light','dark']){
   const label=width+'-'+theme,errors=[],results={label};
   const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block',reducedMotion:'reduce',locale:'en-US',timezoneId:'Pacific/Honolulu'});
   const page=await context.newPage();page.setDefaultTimeout(8500);
   page.on('pageerror',e=>errors.push(String(e)));
   try{
     await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
     await page.goto(url,{waitUntil:'domcontentloaded'});
     await page.locator('.tabs [data-page="checkin"]').waitFor();
     await page.locator('#tutorialChooseEn').click();
     await page.locator('#welcomeSkip').click();
     await page.evaluate(t=>{
       document.getElementById('launchScreen')?.remove();
       const tour=document.getElementById('tutorialModal');if(tour){tour.hidden=true;tour.style.display='none'}
       document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
     },theme);
     await page.locator('.tabs [data-page="checkin"]').click();
     const details=page.locator('#checkTimeDetails');
     await details.locator('summary').click();
     const time=page.locator('#checkRecordedTime');
     if(!(await time.isVisible()))throw Error('Recorded-time input not visible when disclosure expands');
     const rect=await time.boundingBox();
     if(!rect||rect.height<43.9)throw Error('Time input height <44px: '+JSON.stringify(rect));
     if(rect.x<0||rect.x+rect.width>width+1)throw Error('Time input outside viewport');
     const inputType=await time.getAttribute('type');
     if(inputType!=='time')throw Error('Time input behavior changed');
     results.checkin={input:rect,inputType,disclosureOpen:await details.evaluate(el=>el.open)};
     await page.screenshot({path:artifacts+'/'+label+'-checkin-time.png',animations:'disabled'});
     await details.locator('summary').click();
     if(await details.evaluate(el=>el.open))throw Error('Time disclosure did not collapse');
     await page.locator('.tabs [data-page="records"]').click();
     await page.locator('#rev-archive').click();
     const moodToggle=page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).first();
     await moodToggle.click();
     const measures=await page.evaluate(()=>{
       const el=s=>document.querySelector(s);
       const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};
       const days=[...document.querySelectorAll('#archive-search .archive-mood-day')];
       const widths=days.map(e=>rect(e).w),heights=days.map(e=>rect(e).h);
       const weekday=el('#archive-search .archive-mood-weekdays'),grid=el('#archive-search .archive-mood-grid');
       const navs=[...document.querySelectorAll('#archive-search .archive-mood-arrow')];
       return{days:days.length,minHeight:Math.min(...heights),minWidth:Math.min(...widths),
         weekdaySize:parseFloat(getComputedStyle(weekday).fontSize),
         legendSize:parseFloat(getComputedStyle(el('#archive-search .archive-mood-legend')).fontSize),
         gridColumns:getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
         navHeights:navs.map(e=>rect(e).h),navWidths:navs.map(e=>rect(e).w),
         overflow:document.documentElement.scrollWidth-window.innerWidth,
         offscreen:days.filter(e=>{const r=rect(e);return r.x<0||r.x+r.w>innerWidth+1}).length
       };
     });
     if(measures.days<28||measures.days>31)throw Error('Expected full month of days: '+JSON.stringify(measures));
     if(measures.minHeight<47.9)throw Error('Mood day height <48px: '+JSON.stringify(measures));
     if(measures.weekdaySize<11.4||measures.legendSize<12.4)throw Error('Weekday or legend text still too small');
     if(measures.gridColumns!==7)throw Error('Mood 7-column grid changed');
     if(measures.navHeights.some(h=>h<43.9)||measures.navWidths.some(w=>w<43.9))throw Error('Mood month arrows too small');
     if(measures.overflow>1||measures.offscreen)throw Error('Mood calendar overflows the viewport');
     const date=page.locator('#archive-search .archive-mood-day').nth(4),dateValue=await date.getAttribute('data-mood-date');
     await date.click();
     if(await page.locator('#archive-search .archive-mood-day[data-mood-date="'+dateValue+'"]').getAttribute('aria-pressed')!=='true')throw Error('Selecting a Mood date failed');
     const prev=page.locator('#archive-search .archive-mood-arrow').first();
     await prev.click();
     if(await page.locator('#archive-search .archive-mood-day').count()<28)throw Error('Month navigation lost day buttons');
     results.archive={...measures,dateClickPassed:true,monthClickPassed:true};
     await page.screenshot({path:artifacts+'/'+label+'-archive-mood.png',animations:'disabled'});
     await page.locator('.tabs [data-page="focus"]').click();
     results.focus=await page.evaluate(()=>{
       const root=document.querySelector('#page-focus');
       const rect=e=>{const b=e.getBoundingClientRect();return{width:b.width,height:b.height,x:b.x,y:b.y}};
       const presets=[...root.querySelectorAll('#focusDurations button')].filter(e=>rect(e).width>0&&rect(e).height>0);
       const timerToggle=root.querySelector('#quietTimerToggle');
       const tools=root.querySelector('#listeningTools');
       const toggleVisible=timerToggle&&rect(timerToggle).width>0&&rect(timerToggle).height>0&&!tools.hidden;
       return {presets:presets.map(e=>({text:e.textContent.trim(),...rect(e)})),
          toggleVisible, toggle:toggleVisible?rect(timerToggle):null,
          overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};
     });
     if(results.focus.presets.length!==5)throw Error('Focus duration presets missing: '+JSON.stringify(results.focus));
     if(results.focus.presets.some(x=>x.width<43.9||x.height<43.9))throw Error('Focus duration touch targets under 44px: '+JSON.stringify(results.focus));
     if(results.focus.toggleVisible&&(results.focus.toggle.height<43.9))throw Error('Focus timer toggle under 44px: '+JSON.stringify(results.focus));
     if(results.focus.overflow>1)throw Error('Focus content horizontal overflow');
     await page.locator('#focusDurations button').filter({hasText:'5'}).first().click();
     if(!(await page.locator('#focusClock').textContent())?.includes('05:00'))throw Error('Focus duration selection not reflected in timer');
     await page.screenshot({path:artifacts+'/'+label+'-focus-presets.png',animations:'disabled'});
     if(errors.length)throw Error('JS page exceptions: '+errors.join('; '));
     cases.push({...results,passed:true});
     console.log('PASS '+label+' Check-in / Archive Mood interactions + layout');
   }catch(e){
     const err={label,error:String(e),errors};failures.push(err);cases.push({...results,passed:false,error:String(e)});
     console.error('FAIL '+label+' '+String(e));
   }finally{await context.close()}
 }
}finally{await browser.close()}
const report={url,results:cases,failures,summary:{configs:cases.length,passed:cases.filter(x=>x.passed).length,failed:failures.length}};
await fs.writeFile(artifacts+'/report.json',JSON.stringify(report,null,2));
console.log('CHECKIN_ARCHIVE_TOUCH_SUMMARY '+JSON.stringify(report.summary));
if(failures.length)process.exitCode=1;
