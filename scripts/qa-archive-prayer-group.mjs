// Verified UI contract: Archive puts the day's reflection before check-ins/class,
// and prayer session header owns its topic while the body holds only the written note.
// All fixtures are synthetic and use isolated Playwright browser contexts.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const base=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const out='test-results/archive-prayer-group';
await fs.mkdir(out,{recursive:true});
const exe=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!exe)throw Error('No Chromium executable');
const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report=[],failures=[];
const verify=(r,name,pass,detail)=>{r.checks.push({name,pass:!!pass,detail});if(!pass){failures.push(r.id+': '+name);console.error('ARCHIVE_PRAYER_FAIL',r.id,name,JSON.stringify(detail))}};
for(const {width,theme,lang} of [
 {width:320,theme:'light',lang:'ko'},
 {width:390,theme:'dark',lang:'ko'},
 {width:390,theme:'light',lang:'en'},
 {width:1024,theme:'light',lang:'ko'}
]){
 const id=width+'-'+theme+'-'+lang,r={id,checks:[],errors:[]};report.push(r);
 const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,
  locale:lang==='ko'?'ko-KR':'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(9000);
 page.on('pageerror',e=>r.errors.push(String(e)));page.on('dialog',d=>d.dismiss());
 try{
  await page.clock.setFixedTime(new Date('2026-11-13T14:20:00-10:00'));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const choose=page.locator(lang==='ko'?'#tutorialChooseKo':'#tutorialChooseEn');
  if(await choose.isVisible())await choose.click();
  const skip=page.locator('#welcomeSkip');if(await skip.isVisible())await skip.click();
  const init=await page.evaluate(({theme})=>{
   document.getElementById('launchScreen')?.remove();
   const tutorial=document.getElementById('tutorialModal');if(tutorial){tutorial.hidden=true;tutorial.style.display='none'}
   document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme;
   date='2026-11-13';
   const d=day(date);
   d.headline='QA anchor must follow the highlighted group';
   d.reflectionNotes={insight:'QA reflection insight to see first',action:'QA next action'};
   d.checkins.morning={note:'QA morning check-in',moodTime:'08:14'};
   d.checkins.noon={note:'QA midday check-in',lectureQuote:'QA class quote',classContext:'QA class topic',classReviewTime:'13:00',moodTime:'12:35'};
   d.checkins.night={note:'QA night check-in',moodTime:'21:10'};
   d.sessions=[
    {id:'qa-prayer-with-note',kind:'prayer',task:'Family and outreach team',note:'QA Prayer Content written during the session',start:'19:30',seconds:420,personalPrayer:false},
    {id:'qa-prayer-without-note',kind:'prayer',task:'Personal prayer',note:'',start:'19:38',seconds:65,personalPrayer:true},
    {id:'qa-focus-with-note',kind:'focus',task:'Review project dashboard',note:'QA focus session memo',start:'19:45',seconds:120}
   ];
   d.quickCaptureEntries=[{id:'qa-personal',text:'QA other personal note',time:'18:40',createdAt:'2026-11-14T04:40:00Z',tags:[],scheduleId:''}];
   const old=day('2026-11-12');old.reflectionNotes={insight:'QA earlier reflection'};
   old.checkins.morning={note:'QA earlier check-in',moodTime:'09:00'};
   const saved=save();render();
   const raw=window.localStorage.getItem('kona.legacy.v1.dayframe');
   return {lang:KonaI18n.language,firstDay:date,sessionCount:d.sessions.length,saved,rawKeyFound:!!raw,stored:JSON.parse(raw||'{}')?.days?.[date]?.sessions?.length,keys:Object.keys(window.localStorage).filter(x=>x.includes('dayframe'))};
  },{theme});
  verify(r,'Chosen UI language preserved',init.lang===lang,init);
  verify(r,'Session fixture persisted',init.stored===3,init);
  await page.locator('.tabs [data-page="records"]').click();
  await page.locator('#rev-archive').click();
  const results=page.locator('#archive-search-results');
  await results.locator('.archive-date-group').first().waitFor();
  const layout=await results.evaluate(root=>{
   const h=[...root.children].find(x=>x.matches('.archive-date-group')&&/13/.test(x.textContent));
   if(!h)return {error:'No day header',html:root.innerHTML.slice(0,500)};
   const group=h.nextElementSibling;
   const ids=[...group?.querySelectorAll('button.archive-search-result')||[]].map(x=>x.dataset.recordId);
   const headings=[...group?.querySelectorAll('h4')||[]].map(x=>x.textContent.trim());
   const anchor=[...root.children].find(x=>x.classList.contains('archive-record-anchor'));
   const other=[...root.children].filter(x=>x.classList.contains('archive-search-result-wrap')).map(x=>x.querySelector('button')?.dataset.recordId);
   return {day:h.textContent,groupClass:group?.className,ids,headings,anchorAfter:!!anchor&&[...root.children].indexOf(anchor)>[...root.children].indexOf(group),other,groupCount:root.querySelectorAll('.archive-checkin-class-group').length};
  });
  verify(r,'Daily reflection and checks/class share the first group',layout.groupClass?.includes('archive-checkin-class-group')&&layout.ids[0]==='daily-reflection'&&layout.ids.includes('check-morning')&&layout.ids.includes('class-noon'),layout);
  verify(r,'Reflections have an explicit heading above check-ins/class',layout.headings.length===2&&layout.headings[0]===(lang==='ko'?'당일 회고':'Daily reflection')&&layout.headings[1]===(lang==='ko'?'체크인 · 수업':'Check-ins · Class notes'),layout.headings);
  verify(r,'Anchor and other notes appear after grouped records',layout.anchorAfter&&layout.other.includes('s-qa-prayer-with-note')&&layout.other.includes('q-qa-personal'),layout);
  verify(r,'Grouped records are not repeated outside the group',!layout.other.some(x=>['daily-reflection','check-morning','class-noon'].includes(x)),layout.other);
  verify(r,'Previous dates retain a separate priority group',layout.groupCount>=2,layout);
  const prayer=results.locator('button.archive-search-result[data-record-id="s-qa-prayer-with-note"]');
  const pray=await prayer.evaluate(el=>({
   header:el.querySelector('.archive-result-head')?.textContent?.trim(),
   origin:el.querySelector('.archive-prayer-origin')?.textContent?.trim(),
   title:el.querySelector('.archive-prayer-topic')?.textContent?.trim(),
   body:el.querySelector('.archive-search-preview')?.textContent,
   genericIcon:el.querySelector('.archive-record-type')?.textContent||'',
   aria:el.getAttribute('aria-label')
  }));
  verify(r,'Prayer and topic share a compact header',pray.origin===(lang==='ko'?'기도':'Prayer')&&pray.title==='· Family and outreach team'&&pray.header.includes(pray.origin+' · Family and outreach team'),pray);
  verify(r,'Prayer body contains only words entered during prayer',pray.body==='QA Prayer Content written during the session'&&!pray.body.includes('Family and outreach team'),pray);
  verify(r,'Prayer result remains accessible without generic pencil icon',pray.genericIcon===''&&pray.aria.includes('Family and outreach team'),pray);
  const empty=await results.locator('button.archive-search-result[data-record-id="s-qa-prayer-without-note"]').evaluate(el=>({
   title:el.querySelector('.archive-prayer-topic')?.textContent||'',
   origin:el.querySelector('.archive-prayer-origin')?.textContent||'',
   preview:el.querySelector('.archive-search-preview')?.textContent??null
  }));
  verify(r,'Untitled prayer has just Prayer in header and no invented body',empty.title===''&&empty.origin===(lang==='ko'?'기도':'Prayer')&&empty.preview===null,empty);
  const focus=await results.locator('button.archive-search-result[data-record-id="s-qa-focus-with-note"]').evaluate(el=>({
   meta:el.querySelector('.archive-search-meta')?.textContent||'',preview:el.querySelector('.archive-search-preview')?.textContent||''
  }));
  verify(r,'Other Focus session retains its existing format',focus.preview==='QA focus session memo'&&focus.meta.includes(lang==='ko'?'포커스':'Focus'),focus);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  verify(r,'No horizontal viewport overflow',overflow<=2,overflow);
  await page.screenshot({path:out+'/'+id+'-archive.png',fullPage:true,animations:'disabled'});

  // Detail view must also show Prayer · topic, with its original note in the body.
  await prayer.click();
  const action=results.locator('.archive-search-result-wrap:has(button.archive-search-result[data-record-id="s-qa-prayer-with-note"]) .archive-record-extra button');
  await action.click();
  const detail=await results.locator('.review-session-record').first().evaluate(el=>({
   meta:el.querySelector('.review-record-meta')?.textContent||'',body:el.querySelector('.rv-note-preview')?.textContent||''
  }));
  verify(r,'Detailed prayer retains heading and note separation',detail.meta.includes(lang==='ko'?'기도':'Prayer')&&detail.meta.includes('Family and outreach team')&&detail.body==='QA Prayer Content written during the session',detail);
  await page.screenshot({path:out+'/'+id+'-prayer-detail.png',animations:'disabled'});
  await page.reload({waitUntil:'domcontentloaded'});
  const persisted=await page.evaluate(()=>({
   note:db.days['2026-11-13']?.sessions?.find(x=>x.id==='qa-prayer-with-note')?.note,
   topic:db.days['2026-11-13']?.sessions?.find(x=>x.id==='qa-prayer-with-note')?.task,
   reflection:db.days['2026-11-13']?.reflectionNotes?.insight,
   archived:reviewArchiveRecords().filter(x=>x.date==='2026-11-13'&&x.kind==='reflection').length
  }));
  verify(r,'Original stored prayer and daily reflection survive reload',persisted.note==='QA Prayer Content written during the session'&&persisted.topic==='Family and outreach team'&&persisted.reflection==='QA reflection insight to see first'&&persisted.archived===1,persisted);
 }catch(e){r.errors.push(String(e));console.error('ARCHIVE_PRAYER_ABORT',id,String(e))}
 await context.close();
 console.log('ARCHIVE_PRAYER_CONFIG',id,JSON.stringify({passed:r.checks.filter(x=>x.pass).length,failed:r.checks.filter(x=>!x.pass).length,errors:r.errors.length}));
}
await browser.close();
const summary={configs:report.length,checks:report.reduce((n,x)=>n+x.checks.length,0),passed:report.reduce((n,x)=>n+x.checks.filter(y=>y.pass).length,0),failures,errors:report.flatMap(x=>x.errors)};
await fs.writeFile(out+'/report.json',JSON.stringify({summary,report},null,2));
console.log('ARCHIVE_PRAYER_SUMMARY',JSON.stringify({configs:summary.configs,checks:summary.checks,passed:summary.passed,failed:failures.length,errors:summary.errors.length}));
if(failures.length||summary.errors.length)process.exitCode=1;
