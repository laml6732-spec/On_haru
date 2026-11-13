// Focus night ink, Review source/linkage, two-line highlighted tasks.
// Fabricated records in isolated contexts only: never visits the user's origin.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const output='test-results/focus-review-highlight';
await fs.mkdir(output,{recursive:true});
const exe=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
if(!exe)throw Error('Chromium not available');
const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const reports=[],failures=[];
const check=(r,label,condition,details)=>{r.checks.push({label,pass:!!condition,details});if(!condition){failures.push(r.key+': '+label);console.error('FRH_FAIL',r.key,label,JSON.stringify(details))}};
for(const {width,theme,lang} of [
 {width:320,theme:'light',lang:'ko'},
 {width:390,theme:'dark',lang:'ko'},
 {width:390,theme:'light',lang:'en'},
 {width:1024,theme:'light',lang:'ko'}
]){
 const key=width+'-'+theme+'-'+lang,row={key,checks:[],errors:[]};reports.push(row);
 const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,
  locale:lang==='ko'?'ko-KR':'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(9000);
 page.on('pageerror',e=>row.errors.push(String(e)));
 page.on('dialog',d=>d.dismiss());
 const open=async tab=>{await page.locator('.tabs [data-page="'+tab+'"]').click();await page.waitForTimeout(75)};
 try{
  await page.clock.setFixedTime(new Date('2026-11-12T21:30:00-10:00'));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  const choose=page.locator(lang==='ko'?'#tutorialChooseKo':'#tutorialChooseEn');
  if(await choose.isVisible())await choose.click();
  const skip=page.locator('#welcomeSkip');if(await skip.isVisible())await skip.click();
  await page.evaluate(theme=>{
   document.getElementById('launchScreen')?.remove();
   const tutorial=document.getElementById('tutorialModal');
   if(tutorial){tutorial.hidden=true;tutorial.style.display='none'}
   document.documentElement.dataset.appearance=theme;
   document.documentElement.style.colorScheme=theme;
   date='2026-11-12';
   const v=day(date);
   const t={id:'frh-long-'+theme,title:'Prepare the most important work for tomorrow and review the remaining notes with the team before the meeting',repeat:'daily',days:[],due:date,since:date,until:'',kind:'task'};
   db.tasks.push(t);v.pins??=[];v.pins.push(taskKey(t,date));
   v.sessions??=[];v.sessions.push({id:'frh-prayer-session',kind:'prayer',task:'Intercession for the outreach team',note:'A thought recorded during prayer',start:'20:37',seconds:360,personalPrayer:false});
   v.quickCaptureEntries??=[];v.quickCaptureEntries.push({id:'frh-followup',title:'Meeting note',text:'Original note for the day',time:'20:20',tags:[],scheduleId:'',laterReflections:[{text:'A later reflection on this note',createdAt:'2026-11-13T07:12:00Z'}]});
   save();render();
  },theme);
  // Text-only pink ink must have an INLINE element for each wrapped line.
  await open('today');
  const fold=page.locator('#page-today #pinRow .task-fold');
  if(await fold.count()&&await fold.getAttribute('aria-expanded')!=='true')await fold.click();
  const plan=page.locator('#page-today .pinned-title.important .task-name').first();
  const stats=await plan.evaluate(el=>{
   const ink=el.querySelector('.task-highlight-ink'),range=document.createRange();range.selectNodeContents(ink);
   const outer=getComputedStyle(el),inner=getComputedStyle(ink);
   return {fragments:[...range.getClientRects()].map(r=>({w:r.width,h:r.height})),inkDisplay:inner.display,inkBg:inner.backgroundImage,outerBg:outer.backgroundImage,clamp:outer.webkitLineClamp,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight};
  });
  check(row,'Important title wraps onto two lines',stats.fragments.length===2,stats);
  check(row,'Pink marker painted on line fragments',stats.inkDisplay==='inline'&&stats.inkBg.includes('linear-gradient')&&stats.outerBg==='none',stats);
  check(row,'Clamped title shows both lines',stats.clamp==='2'&&stats.scrollHeight<=stats.clientHeight+2,stats);
  await open('capture');
  const marker=page.locator('#page-capture #konaPriorityTask .pinned-title.important .task-name');
  const capture=await marker.evaluate(el=>{
   const ink=el.querySelector('.task-highlight-ink'),range=document.createRange();range.selectNodeContents(ink);const p=el.closest('#konaPriorityTask');
   return {fragments:range.getClientRects().length,inkBg:getComputedStyle(ink).backgroundImage,outerBg:getComputedStyle(el).backgroundImage,outerHeight:el.getBoundingClientRect().height,parentHeight:p.getBoundingClientRect().height,parentMaxHeight:getComputedStyle(p).maxHeight};
  });
  check(row,'Write pinned two-line title keeps separate highlighted lines',capture.fragments===2&&capture.inkBg.includes('linear-gradient')&&capture.outerBg==='none',capture);
  check(row,'Write important row does not cut the second line',capture.parentHeight>=capture.outerHeight&&capture.parentMaxHeight==='none',capture);
  await page.screenshot({path:output+'/'+key+'-write.png',animations:'disabled'});

  // The app's local wall clock is 21:30, so the immersive Focus theme is night.
  await page.evaluate(()=>{
   sess={...idleSess(),started:true,running:false,paused:true,kind:'prayer',dur:600,acc:100000,runStart:Date.now(),startDate:date,startHM:'21:15',title:'Prayer',note:'A visible nighttime thought',sessionId:'frh-night-'+date,prayerId:'',taskKey:''};
   nav('focus',{kind:'prayer'});
  });
  const toggle=page.locator('#page-focus #focusNoteToggle');
  await toggle.click();
  const focus=await page.evaluate(()=>{
   const sample=id=>{const x=document.getElementById(id),s=getComputedStyle(x);return{visible:!!x.getClientRects().length,text:s.color,bg:s.backgroundColor,border:s.borderColor,value:x.value,placeholder:getComputedStyle(x,'::placeholder').color}};
   const ratio=(a,b)=>{const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)});const x=rgb(a),y=rgb(b);const lum=v=>v[0]*.2126+v[1]*.7152+v[2]*.0722;const a1=lum(x),b1=lum(y);return(Math.max(a1,b1)+.05)/(Math.min(a1,b1)+.05)};
   const t=sample('focusNoteToggle'),n=sample('timerNote');return {theme:document.body.dataset.focusOcean,noteOpen:document.body.classList.contains('focus-note-open'),toggle:t,note:n,toggleContrast:ratio(t.text,t.bg),noteContrast:ratio(n.text,n.bg),placeholderContrast:ratio(n.placeholder,n.bg)};
  });
  check(row,'Focus uses night background at night',focus.theme==='night'&&focus.noteOpen,focus);
  check(row,'Night thought button is readable',focus.toggle.visible&&focus.toggleContrast>=4.5,focus.toggle);
  check(row,'Night thought text is readable',focus.note.visible&&focus.noteContrast>=4.5&&focus.note.value==='A visible nighttime thought',focus.note);
  check(row,'Night thought placeholder meets contrast',focus.placeholderContrast>=4.5,focus);
  await page.screenshot({path:output+'/'+key+'-focus-night.png',animations:'disabled'});

  await open('records');
  await page.locator('#rev-reflect').click();
  const session=page.locator('#page-records .review-session-record').filter({hasText:'A thought recorded during prayer'});
  const source=await session.locator('.review-session-source').first().textContent();
  check(row,'Prayer thought is identified by source, not the session title',source.trim()===(lang==='ko'?'기도 메모':'Prayer note'),source);
  const followup=page.locator('#page-records .review-note-followup').filter({hasText:'A later reflection on this note'});
  const detail=await followup.evaluate(el=>({label:el.querySelector('small')?.textContent||'',border:getComputedStyle(el).borderLeftWidth,margin:getComputedStyle(el).marginLeft,text:el.querySelector('p')?.textContent}));
  check(row,'Later reflection is marked with subordinate return arrow',detail.label.startsWith('↳ ')&&parseFloat(detail.border)>0&&parseFloat(detail.margin)>0,detail);
  check(row,'Later reflection text is unchanged',detail.text==='A later reflection on this note',detail);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  check(row,'No horizontal page overflow',overflow<=2,overflow);
  await page.screenshot({path:output+'/'+key+'-review.png',animations:'disabled'});
 }catch(e){row.errors.push(String(e));console.error('FRH_ABORT',key,String(e))}
 await context.close();
 console.log('FRH_CONFIG',key,JSON.stringify({passed:row.checks.filter(x=>x.pass).length,failed:row.checks.filter(x=>!x.pass).length,errors:row.errors.length}));
}
await browser.close();
const summary={configs:reports.length,checks:reports.reduce((n,r)=>n+r.checks.length,0),passed:reports.reduce((n,r)=>n+r.checks.filter(x=>x.pass).length,0),failed:failures.length,errors:reports.reduce((n,r)=>n+r.errors.length,0),failures};
await fs.writeFile(output+'/report.json',JSON.stringify({summary,reports},null,2));console.log('FRH_SUMMARY',JSON.stringify(summary));
if(summary.failed||summary.errors)process.exitCode=1;
