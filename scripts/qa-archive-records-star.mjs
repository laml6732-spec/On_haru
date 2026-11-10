import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const target=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const dir='test-results/archive-records-star';
await fs.mkdir(dir,{recursive:true});
const binary=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(x=>x&&existsSync(x));
if(!binary)throw Error('Chromium not found');
const browser=await chromium.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const failures=[];
for(const width of [320,360,390,1024])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.clock.setFixedTime(new Date('2026-11-09T09:30:00-10:00'));
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.locator('#tutorialChooseEn').click();
  await page.locator('#welcomeSkip').click();
  await page.evaluate(t=>{
   document.getElementById('launchScreen')?.remove();
   const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
   document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
   for(const d of ['2026-11-09','2026-11-08','2026-11-07']){
    const v=day(d);v.quickCaptureEntries=[];v.headline='';
   }
   const v=day('2026-11-09');v.headline='A quiet moment with God';
   v.quickCaptureEntries=[
    {id:'qa-star-record',time:'17:30',createdAt:'2026-11-10T03:30:00Z',title:'Evening',text:'QA STAR EVENING NOTE '.repeat(12),scheduleId:'',tags:[]},
    {id:'qa-unstarred-record',time:'09:10',createdAt:'2026-11-09T19:10:00Z',title:'Morning',text:'QA MORNING NOTE '.repeat(12),scheduleId:'',tags:[]}
   ];
   v.important=[...(v.important||[]).filter(x=>x!=='qa-star-record'),'qa-star-record'];
   day('2026-11-08').headline='Anchor only: no records';
   day('2026-11-07').quickCaptureEntries=[{id:'qa-old',time:'12:10',createdAt:'2026-11-07T22:10:00Z',title:'Earlier',text:'QA OLDER NOTE '.repeat(12),scheduleId:'',tags:[]}];
  },theme);
  await page.locator('.tabs [data-page="records"]').click();
  await page.locator('#rev-archive').click();
  const q=page.locator('#archive-search');
  await q.locator('.archive-records-star-button').waitFor();
  if(await q.locator('.archive-mood-view-switch,.archive-mood-panel').count())throw Error('Archive should show Records directly without a Mood selector');
  if(!await q.locator('.archive-search-row').isVisible())throw Error('Records controls should be visible immediately');
  if(!await page.locator('.tabs [data-page="checkin"]').count())throw Error('Check-in tab must remain available');
  if(await q.locator('.review-saved-filters').count())throw Error('Redundant All/Saved tabs remain');
  const star=q.locator('.archive-records-star-button');
  if(await star.getAttribute('aria-pressed')!=='false')throw Error('Star filter should default off');
  if((await star.locator('.archive-star-name').textContent()).trim()!=='All'||(await star.locator('.archive-star-count').textContent()).trim()!=='3')throw Error('Default toggle should read All 3');
  if((await star.locator('.archive-star-icon').count())!==0)throw Error('No star icon should appear in All mode');
  if(await q.locator('.archive-record-anchor').count()!==2)throw Error('Anchor + anchor-only day not visible');
  if(await q.locator('.archive-record-anchor-label').count()!==0)throw Error('Daily highlight must not display an Anchor label');
  if((await q.locator('.archive-record-anchor').first().innerText()).trim()!=='A quiet moment with God')throw Error('Highlight should contain only its original text');
  const dayHead=page.locator('#archive-search-results .review-date-header');
  if(await dayHead.count()!==3)throw Error('Wrong number of visible days');
  if(!(await dayHead.nth(1).innerText()).includes('Nov 8'))throw Error('Anchor-only date missing or out of order');
  if((await dayHead.nth(1).innerText()).includes('0 records'))throw Error('Anchor-only day showed count');
  const cards=page.locator('#archive-search-results .archive-search-result');
  if(await cards.count()!==3)throw Error('Missing records in combined timeline');
  if(!(await cards.first().innerText()).includes('QA STAR EVENING'))throw Error('Records not ordered newest first');
  await cards.first().click();await cards.nth(1).click();
  if(await page.locator('.archive-record-expanded').count()!==2)throw Error('Two simultaneous expansions not supported');
  if(theme==='dark'){
   const tone=await page.locator('.archive-record-expanded').first().evaluate(el=>{
    const outer=getComputedStyle(el),preview=getComputedStyle(el.querySelector('.archive-search-preview'));
    return {background:outer.backgroundColor,text:preview.color};
   });
   if(tone.background!=='rgb(33, 53, 43)')throw Error('Dark expanded record has incorrect gray background: '+tone.background);
   const highlightStyle=await page.locator('.archive-record-anchor').first().evaluate(el=>({background:getComputedStyle(el).backgroundImage,border:getComputedStyle(el).borderLeftWidth}));
   if(!highlightStyle.background.includes('linear-gradient')||highlightStyle.border!=='4px')throw Error('Daily highlight style lost: '+JSON.stringify(highlightStyle));
   const savedMarkBg=await page.locator('.archive-save-toggle[aria-pressed="true"]').first().evaluate(el=>getComputedStyle(el).backgroundColor);
   if(savedMarkBg!=='rgba(0, 0, 0, 0)')throw Error('Dark saved star tile not transparent: '+savedMarkBg);

   const c=tone.text.match(/[0-9]+/g)?.map(Number)||[];
   if(c.length<3||Math.min(...c.slice(0,3))<170)throw Error('Dark expanded record text has inadequate contrast: '+tone.text);
  }

  if(await page.locator('#archive-search-results .archive-record-extra:not([hidden])').count()!==2)throw Error('Expanded metadata not displayed');
  const firstText=await page.locator('.archive-record-expanded').first().innerText();
  if((firstText.match(/17:30/g)||[]).length!==1)throw Error('Time should appear exactly once per expanded note: '+firstText);
  await star.click();
  if(await q.locator('.archive-records-star-button').getAttribute('aria-pressed')!=='true')throw Error('Star filter did not activate');
  if((await q.locator('.archive-star-name').textContent()).trim()!=='Starred'||(await q.locator('.archive-star-count').textContent()).trim()!=='1')throw Error('Selected toggle should read ★ Starred 1');
  if(await cards.count()!==1)throw Error('Starred results should contain one record');
  if(await dayHead.count()!==1)throw Error('Other days should be hidden under Starred');
  if(!await q.locator('.archive-records-condition-strip').isVisible())throw Error('Active filter strip missing');
  await q.locator('.archive-condition-clear').click();
  if(await cards.count()!==3)throw Error('Clear all did not restore all records');
  // Capture the compact browsing state rather than the already expanded QA rows.
  if(await page.locator('.archive-record-expanded').count()===2){
   await cards.first().click();await cards.nth(1).click();
   if(await page.locator('.archive-record-expanded').count()!==0)throw Error('Could not collapse both notes');
  }
  await page.screenshot({path:dir+'/'+width+'-'+theme+'-default.png',animations:'disabled'});
  await q.locator('.archive-records-search-button').click();
  if(!await page.locator('#archive-search-input').isVisible())throw Error('Search did not open');
  await page.locator('#archive-search-input').fill('QA MORNING');
  await q.locator('.archive-records-search-back').click();
  if(!await q.locator('.archive-records-search-button').isVisible())throw Error('Search toolbar did not return');
  if(await cards.count()!==1)throw Error('Closing search should preserve query');
  await q.locator('.archive-condition-clear').click();
  const filters=q.locator('.archive-filter-disclosure');
  await filters.locator('summary').click();
  if(!await filters.evaluate(e=>e.open))throw Error('Advanced filters did not expand');
  if(!await q.locator('.archive-records-filter-popover').isVisible())throw Error('Filter popover invisible');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>1)throw Error('Horizontal overflow '+overflow+' px');
  await page.screenshot({path:dir+'/'+width+'-'+theme+'.png',animations:'disabled'});
  if(errors.length)throw Error('Runtime errors: '+errors.join('; '));
  console.log('PASS',width,theme);
 }catch(e){
  failures.push({width,theme,error:String(e),runtime:errors});
  await page.screenshot({path:dir+'/'+width+'-'+theme+'-FAIL.png'}).catch(()=>{});
  console.error('FAIL',width,theme,e);
 }finally{await context.close()}
}
await browser.close();await fs.writeFile(dir+'/result.json',JSON.stringify({failures},null,2));
if(failures.length)process.exitCode=1;
