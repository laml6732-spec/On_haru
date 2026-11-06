import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
const out='test-results/review-overall';
await fs.mkdir(out,{recursive:true});
const binary=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(x=>x&&existsSync(x));
if(!binary)throw Error('Chromium is required');
const browser=await chromium.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report=[];
const photo=async(page,id)=>{
 await page.screenshot({path:out+'/'+id+'.png',animations:'disabled'});
 if(id.startsWith('390-light-')||id==='390-dark-archive'||id==='390-dark-mood'){
  const b64=(await page.screenshot({type:'jpeg',quality:32,animations:'disabled'})).toString('base64');
  console.log('SHOT_BEGIN '+id);
  for(let i=0;i<b64.length;i+=4000)console.log('SHOT '+b64.slice(i,i+4000));
  console.log('SHOT_END '+id);
 }
};
for(const width of [320,390,1024])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(8000);
 const item={width,theme,views:{},errors:[]};report.push(item);
 page.on('pageerror',e=>item.errors.push(String(e)));
 try {
  await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
  await page.goto('http://127.0.0.1:8080/legacy/',{waitUntil:'domcontentloaded'});
  await page.locator('#tutorialChooseEn').click();
  await page.locator('#welcomeSkip').click();
  await page.evaluate(theme=>{
   document.getElementById('launchScreen')?.remove();
   const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'};
   document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme;
   date='2026-11-05';
   for(const [d,count] of [['2026-11-05',4],['2026-11-04',4],['2026-11-03',3],['2026-11-02',2]]){
    const data=day(d),evt=dayEvents(d).find(e=>e.id)||dayEvents(d)[0];
    data.quickCaptureEntries=[...(data.quickCaptureEntries||[]),...Array.from({length:count},(_,i)=>({
     id:'qa-review-'+d+'-'+i,time:String(9+i).padStart(2,'0')+':20',createdAt:d+'T'+String(19+i).padStart(2,'0')+':20:00Z',
     title:'Sample note '+(i+1),text:'Example reflection '+(i+1)+' about a meaningful conversation, gratitude and what I learned today.',
     scheduleId:evt?.id||'',scheduleTitle:evt?.title||'',tags:[]
    }))];
    data.checkins.morning={moodTime:'08:46',morningEnergy:2+(count%3),morningHappiness:4,note:'Morning check-in sample'};
    data.checkins.evening={moodTime:'20:36',eveningEnergy:3,eveningHappiness:3,note:'Evening check-in sample'};
   }
  },theme);
  await page.locator('.tabs [data-page="records"]').click();
  const inspect=async(selector)=>page.evaluate(selector=>{
   const scope=document.querySelector(selector);if(!scope)return{error:'Missing '+selector};
   const rects=[...scope.querySelectorAll('button,.review-record,.archive-search-result,.weekly-day,.rv-timegroup,.archive-mood-day')]
     .filter(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.height>12&&r.width>25&&c.visibility!=='hidden'&&c.display!=='none';})
     .map(e=>{const r=e.getBoundingClientRect();return{cls:e.className||e.id,text:(e.innerText||'').slice(0,38),top:Math.round(r.top),bottom:Math.round(r.bottom)}})
     .filter(x=>x.bottom>0&&x.top<innerHeight);
   const results=[...scope.querySelectorAll('.archive-search-result,.review-record,.review-plan-note,.archive-mood-item')].filter(e=>{const r=e.getBoundingClientRect();return r.top>0&&r.bottom<innerHeight-75}).length;
   return{visibleRecords:results,visibleWidgets:rects.slice(0,24),height:scope.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth};
  },selector);
  await photo(page,width+'-'+theme+'-daily');
  item.views.daily=await inspect('#new-reflect-page');
  await page.locator('#rev-weekly').click();await photo(page,width+'-'+theme+'-weekly');
  item.views.weekly=await inspect('#new-reflect-page');
  await page.locator('#rev-archive').click();await photo(page,width+'-'+theme+'-archive');
  item.views.archive=await inspect('#archive-search');
  await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
  await photo(page,width+'-'+theme+'-mood');
  item.views.mood=await inspect('#archive-search');
 }catch(e){item.errors.push(String(e));console.log('ERROR '+width+' '+theme+' '+String(e))}
 console.log('VIEW '+JSON.stringify(item));
 await context.close();
}
await browser.close();
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));
if(report.some(x=>x.errors.length))process.exitCode=1;
