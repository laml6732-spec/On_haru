// Isolated visual/functional QA for Prayer request history aggregation.
// Synthetic data only; no production logins, API writes, or real prayer notes.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const out='test-results/prayer-records-checkboxes';
await fs.mkdir(out,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chromium is required');
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const assert=(test,label,actual)=>{if(!test)throw Error(label+(actual===undefined?'':' · '+JSON.stringify(actual)))};
try{
 for(const {width,theme,lang} of [
  {width:320,theme:'light',lang:'ko'}, {width:320,theme:'dark',lang:'ko'},
  {width:390,theme:'light',lang:'ko'}, {width:390,theme:'dark',lang:'ko'},
  {width:390,theme:'light',lang:'en'}, {width:1024,theme:'light',lang:'en'}
 ]){
  const result={width,theme,lang,ok:false,checks:[],errors:[]};results.push(result);
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:lang==='ko'?'ko-KR':'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(6500);
  page.on('pageerror',e=>result.errors.push(String(e)));
  page.on('dialog',d=>d.dismiss());
  const check=(test,label,actual)=>{assert(test,label,actual);result.checks.push(label)};
  try{
   await page.clock.setFixedTime(new Date('2026-11-23T10:15:00-10:00'));
   await page.goto(process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/',{waitUntil:'domcontentloaded'});
   const choose=page.locator(lang==='ko'?'#tutorialChooseKo':'#tutorialChooseEn');
   if(await choose.isVisible().catch(()=>false))await choose.click();
   const skip=page.locator('#welcomeSkip');
   if(await skip.isVisible().catch(()=>false))await skip.click();
   await page.evaluate(appearance=>{
     document.getElementById('launchScreen')?.remove();
     for(const id of ['tutorialModal','welcomeModal']){const n=document.getElementById(id);if(n){n.hidden=true;n.style.display='none'}}
     document.documentElement.dataset.appearance=appearance;
     document.documentElement.style.colorScheme=appearance;
     db.prayers=[
      {id:'qa-family',title:'QA Family prayer',note:'',since:'2026-11-01',answered:null,lastPrayed:'2026-11-23',count:5,
       responseLogs:[{id:'qa-response-1',date:'2026-11-22',text:'QA response grace and gratitude'}]},
      {id:'qa-community',title:'QA Community prayer',note:'QA legacy answer note',since:'2026-10-10',answered:'2026-11-20',lastPrayed:'2026-11-20',count:2,responseLogs:[]}
     ];
     const dayRecord=day('2026-11-23');dayRecord.sessions=[
      {id:'qa-prayer-note-linked',kind:'prayer',prayerId:'qa-family',task:'QA Family prayer',personalPrayer:false,note:'QA family note during prayer',start:'09:30',seconds:300},
      {id:'qa-prayer-note-personal',kind:'prayer',prayerId:'',task:'QA Personal prayer',personalPrayer:true,note:'QA personal note from morning prayer',start:'08:10',seconds:180},
      {id:'qa-prayer-empty',kind:'prayer',prayerId:'qa-family',task:'QA Family prayer',note:'',start:'07:40',seconds:30},
      {id:'qa-focus-unrelated',kind:'focus',task:'QA unrelated',note:'QA unrelated focus memo',start:'06:30',seconds:300}
     ];
     date='2026-11-23';render();
   },theme);
   const tab=page.locator('.tabs [data-page="focus"]');
   await tab.click({force:true});
   if(await page.locator('#kindSeg button[data-kind="prayer"]').isVisible())await page.locator('#kindSeg button[data-kind="prayer"]').click({force:true});
   await page.locator('#focusLibraryOpen').click({force:true});
   const library=page.locator('#focusLibraryModal');
   await library.waitFor({state:'visible'});
   const all=library.locator('.prayer-filter').filter({hasText:lang==='ko'?'전체':'All'});
   check(await all.count()===1,'Original All prayer topic tab preserved');
   check(await library.locator('.prayer-link-row').count()===2,'Original prayer list preserved');
   await library.locator('.prayer-filter').filter({hasText:lang==='ko'?'기록 모아보기':'Records'}).click();
   const options=library.locator('.prayer-record-type');
   check(await options.count()===2,'Two independent checkboxes');
   check((await options.locator('input:checked').count())===2,'Both options checked by default');
   const feed=library.locator('.prayer-record-feed-item');
   check(await feed.count()===4,'One feed: response+legacy answer+two prayer notes; no unrelated/empty session',await feed.allTextContents());
   const kinds=await feed.locator('.prayer-record-feed-kind').allTextContents();
   check(kinds.filter(s=>s.includes(lang==='ko'?'응답':'Response')).length===2,'Two response records appear',kinds);
   check(kinds.filter(s=>s.includes(lang==='ko'?'기도 메모':'Prayer note')).length===2,'Linked and personal prayer notes appear',kinds);
   const top=await feed.first().innerText();
   check(top.includes('QA family note during prayer'),'Newest prayer memo appears first',top);
   check(await feed.filter({hasText:'QA personal note from morning prayer'}).count()===1,'Personal prayer note is included');
   const layout=await library.evaluate(el=>{
    const root=el.querySelector('.prayer-box'),items=[...el.querySelectorAll('.prayer-record-type')];
    const b=root.getBoundingClientRect(),input=el.querySelector('.prayer-search').getBoundingClientRect();
    return {bounds:{left:b.left,right:b.right},input:{left:input.left,right:input.right},types:items.map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,height:e.getBoundingClientRect().height})),viewport:innerWidth,scrollWidth:el.scrollWidth};
   });
   check(layout.types.every(x=>x.height>=43&&x.left>=0&&x.right<=width+1),'Checkbox hit areas fit viewport',layout);
   await page.screenshot({path:`${out}/${width}-${theme}-${lang}-both.png`,animations:'disabled',caret:'hide'});
   const response=options.filter({hasText:lang==='ko'?'응답·감사':'Response'});
   const memo=options.filter({hasText:lang==='ko'?'기도 메모':'Prayer notes'});
   await memo.locator('input').uncheck();
   check(await feed.count()===2,'Response only view',await feed.allTextContents());
   await memo.locator('input').check();
   await response.locator('input').uncheck();
   check(await feed.count()===2,'Memo only view',await feed.allTextContents());
   await memo.locator('input').uncheck();
   check(await feed.count()===0,'Both unchecked has no visible records');
   check(await library.locator('.prayer-empty').isVisible(),'Both unchecked communicates how to proceed');
   await response.locator('input').check();
   await memo.locator('input').check();
   check(await feed.count()===4,'Both checked restores every record');
   const search=library.locator('.prayer-search');
   await search.fill('personal note');
   check(await feed.count()===1,'Search must match memo body');
   await search.fill('legacy answer');
   check(await feed.count()===1,'Search must match historical answer text');
   await search.fill('QA Family');
   check(await feed.count()===2,'Search matches prayer title across both record types');
   await search.fill('');
   const entry=feed.filter({hasText:'QA response grace and gratitude'});
   await entry.click();
   check(await library.locator('.prayer-detail-title').innerText()==='QA Family prayer','Tapping answer opens its original prayer');
   await library.locator('.prayer-back').click();
   check(await feed.count()===4,'Returning from detail keeps filtered record list');
   await feed.filter({hasText:'QA personal note from morning prayer'}).click();
   check(await page.locator('#sessionNoteModal').isVisible(),'Tapping prayer memo opens original session-note editor');
   check((await page.locator('#sessionMemo').inputValue())==='QA personal note from morning prayer','Session note editor shows original content');
   const snapshot=await page.evaluate(()=>({response:db.prayers.find(p=>p.id==='qa-family').responseLogs[0].text,memo:day('2026-11-23').sessions.find(s=>s.id==='qa-prayer-note-personal').note}));
   check(snapshot.response==='QA response grace and gratitude'&&snapshot.memo==='QA personal note from morning prayer','Filtering never changes persisted records',snapshot);
   check(result.errors.length===0,'No JavaScript runtime errors',result.errors);
   result.ok=true;
   console.log('PRAYER_RECORDS_PASS',width,theme,lang,result.checks.length);
  }catch(err){
   result.error=String(err);
   console.log('PRAYER_RECORDS_FAIL',width,theme,lang,result.error,result.errors);
   await page.screenshot({path:`${out}/${width}-${theme}-${lang}-failed.png`,animations:'disabled'}).catch(()=>{});
  }finally{await context.close()}
 }
}finally{await browser.close()}
await fs.writeFile(out+'/report.json',JSON.stringify(results,null,2));
if(results.some(x=>!x.ok))process.exitCode=1;
