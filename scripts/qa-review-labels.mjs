import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

// In-memory synthetic fixtures inside fresh private browser contexts only.
// No actual user's localStorage, notes, or production data is accessed.
const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const folder=process.env.ONHARU_ARTIFACTS||'test-results/review-labels';
await fs.mkdir(folder,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('Chromium unavailable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];

try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
   const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',serviceWorkers:'block',reducedMotion:'reduce',timezoneId:'Pacific/Honolulu'});
   const page=await ctx.newPage();page.setDefaultTimeout(9000);
   const caseResult={width,theme,ok:false};
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   try{
     await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
     await page.goto(url,{waitUntil:'domcontentloaded'});
     await page.locator('#tutorialChooseEn').click();
     await page.locator('#welcomeSkip').click();
     await page.evaluate(theme=>{
       document.getElementById('launchScreen')?.remove();
       const dialog=document.getElementById('tutorialModal');
       if(dialog){dialog.hidden=true;dialog.style.display='none'}
       document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme;
     },theme);
     const fixture=await page.evaluate(()=>{
       date='2026-11-04';
       const event=dayEvents(date).find(e=>e.id&&e.title)||dayEvents(date)[0];
       if(!event)throw Error('Synthetic test needs a real in-memory day event');
       const d=day(date);
       d.quickCaptureEntries=[...(d.quickCaptureEntries||[]),{
         id:'qa-unified-schedule-tag',time:'08:51',createdAt:'2026-11-04T18:51:00Z',
         scheduleId:event.id,scheduleTitle:event.title||'Schedule',title:'QA linked title',
         text:'QA linked sample for schedule tag',tags:[]
       }];
       return {date,event:event.title,id:event.id};
     });
     await page.locator('.tabs [data-page="records"]').click();
     await page.locator('#rev-reflect').click();
     // Daily renders event title as its schedule tag, with notes grouped under it.
     const dailyGroup=page.locator('#new-reflect-page .rv-linked-group').filter({hasText:'QA linked sample for schedule tag'}).first();
     await dailyGroup.waitFor();
     const dailyTag=dailyGroup.locator('h5.review-event-heading');
     await dailyTag.waitFor();
     const measure=el=>el.evaluate(node=>{
       const c=getComputedStyle(node),r=node.getBoundingClientRect(),before=getComputedStyle(node,'::before');
       return{text:node.textContent.trim(),bg:c.backgroundColor,color:c.color,radius:c.borderRadius,padding:c.padding,fontSize:c.fontSize,
         weight:c.fontWeight,display:c.display,before:before.content,width:r.width,x:r.x,visible:r.width>0&&r.height>0};
     });
     const daily=await measure(dailyTag);caseResult.daily=daily;
     if(!daily.visible)throw Error('Daily schedule tag not visible');
     await page.screenshot({path:folder+'/'+width+'-'+theme+'-daily.png',animations:'disabled'});
     // Weekly must render a real linked record's schedule tag (not a fabricated DOM node).
     await page.locator('#rev-weekly').click();
     const weeklyNote=page.locator('#new-reflect-page .review-weekly-records .review-plan-note').filter({hasText:'QA linked sample for schedule tag'}).first();
     await weeklyNote.waitFor();
     const weeklyTag=weeklyNote.locator('.review-schedule-label');await weeklyTag.waitFor();
     const weekly=await measure(weeklyTag);caseResult.weekly=weekly;
     await page.screenshot({path:folder+'/'+width+'-'+theme+'-weekly.png',animations:'disabled'});
     // Archive list (not just its detail page) shows the matching tag.
     await page.locator('#rev-archive').click();
     const search=page.locator('#archive-search-input');
     await search.fill('QA linked sample for schedule tag');
     const archiveResult=page.locator('#archive-search-results .archive-search-result').filter({hasText:'QA linked sample for schedule tag'}).first();
     await archiveResult.waitFor();
     const archiveTag=archiveResult.locator('.review-schedule-label');await archiveTag.waitFor();
     const archive=await measure(archiveTag);caseResult.archive=archive;
     await page.screenshot({path:folder+'/'+width+'-'+theme+'-archive.png',animations:'disabled'});
     await archiveResult.click();
     const detailTag=page.locator('#archive-search-results .review-record .review-schedule-label').first();
     await detailTag.waitFor();
     const detail=await measure(detailTag);caseResult.archiveDetail=detail;
     const comparable=['bg','color','radius','padding','fontSize','weight'];
     for(const [name,item] of [['Weekly',weekly],['Archive',archive],['Archive detail',detail]]){
       if(!item.visible)throw Error(name+' tag missing');
       for(const k of comparable)if(item[k]!==daily[k])throw Error(name+' '+k+' differs from Daily: '+item[k]+' != '+daily[k]);
       if(item.before!=='none'&&item.before!=='normal')throw Error(name+' tag contains unwanted arrow: '+item.before);
       if(item.width>width+1||item.x<0)throw Error(name+' tag outside viewport');
     }
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
     if(overflow>1)throw Error('Archive overflows '+overflow+'px');
     if(errors.length)throw Error('Browser errors '+errors.join('; '));
     caseResult.fixture=fixture;caseResult.ok=true;
     console.log('PASS '+width+' '+theme+' Daily/Weekly/Archive tags match (real rendered records)');
   }catch(e){caseResult.error=String(e);console.error('FAIL '+width+' '+theme+' '+e);}
   results.push(caseResult);
   await ctx.close();
 }
}finally{await browser.close();}
await fs.writeFile(folder+'/report.json',JSON.stringify(results,null,2));
if(results.some(x=>!x.ok))process.exitCode=1;
