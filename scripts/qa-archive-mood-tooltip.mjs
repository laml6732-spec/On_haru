// Compatibility filename retained; the Mood calendar now has a permanent, accessible legend.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const artifacts=process.env.ONHARU_ARTIFACTS||'test-results/archive-mood-tooltip';
await fs.mkdir(artifacts,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chrome browser missing');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const row={width,theme,passed:false};
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce',serviceWorkers:'block',locale:'en-US',timezoneId:'Pacific/Honolulu'});
  const page=await context.newPage();page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   await page.evaluate(t=>{
    document.getElementById('launchScreen')?.remove();
    const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
    document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
   },theme);
   const baseline=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-archive').click();
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
   const legend=page.locator('#archive-search .archive-mood-trend-key');
   await legend.waitFor({state:'visible'});
   if(await page.locator('.archive-mood-info').count())throw Error('Deprecated hidden info disclosure still exists');
   if(await legend.locator('.archive-mood-trend-key-item').count()!==2)throw Error('Expected Mood and Energy series key');
   const text=await legend.innerText();
   if(!text.includes('Mood')||!text.includes('Energy'))throw Error('Graph legend incomplete: '+text);
   const geometry=await page.evaluate(()=>{
    const get=s=>document.querySelector(s).getBoundingClientRect();
    const heading=get('.archive-mood-heading'),left=get('.archive-mood-arrow:first-child'),right=get('.archive-mood-arrow:last-child'),title=get('.archive-mood-month-label'),legend=get('.archive-mood-trend-key');
    return {centerError:Math.abs((left.x+right.x+right.width)/2-(title.x+title.width/2)),leftSize:[left.width,left.height],rightSize:[right.width,right.height],legendY:legend.y,overflow:document.documentElement.scrollWidth-innerWidth};
   });
   if(geometry.centerError>1.5)throw Error('Date range is not centered: '+JSON.stringify(geometry));
   if(geometry.leftSize.some(v=>v<43.9)||geometry.rightSize.some(v=>v<43.9))throw Error('Date navigation targets smaller than 44px');
   if(geometry.overflow>1)throw Error('Legend causes horizontal overflow');
   if(!await page.locator('.archive-mood-arrow').last().isDisabled())throw Error('Future navigation button not disabled');
   await page.screenshot({path:artifacts+'/'+width+'-'+theme+'-permanent-legend.png',animations:'disabled'});
   await page.locator('.archive-mood-calendar-toggle').click();
   const monthLegend=page.locator('.archive-mood-visible-legend');
   if(!await monthLegend.isVisible())throw Error('Four-phase legend hidden in full-month view');
   if(await monthLegend.locator('.archive-mood-legend-item').count()!==4)throw Error('Monthly four-phase legend incomplete');
   const shapes=await monthLegend.locator('.archive-mood-legend-shape').evaluateAll(xs=>xs.map(x=>({phase:x.dataset.phase,radius:getComputedStyle(x).borderRadius,transform:getComputedStyle(x).transform})));
   if(shapes.map(x=>x.phase).join('|')!=='morning|noon|evening|night')throw Error('Full month phase order changed');
   if(await page.locator('.archive-mood-month-grid .archive-mood-day').count()!==30)throw Error('Monthly calendar missing');
   await page.locator('.archive-mood-arrow').first().click();
   if(await page.locator('.archive-mood-month-grid .archive-mood-day').count()!==31)throw Error('Previous month navigation failed');
   const after=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   if(after!==baseline)throw Error('Legend/calendar browsing changed user records');
   if(errors.length)throw Error('Page errors: '+errors.join('; '));
   row.passed=true;row.geometry=geometry;
   console.log('MOOD_LEGEND_PASS '+JSON.stringify({width,theme,...geometry,shapePhases:shapes.map(x=>x.phase),storageUnchanged:true}));
  }catch(e){row.error=String(e);console.error('MOOD_LEGEND_FAIL '+width+' '+theme+' '+e)}
  finally{report.push(row);await context.close()}
 }
}finally{await browser.close();await fs.writeFile(artifacts+'/report.json',JSON.stringify(report,null,2))}
if(report.some(x=>!x.passed))process.exitCode=1;
