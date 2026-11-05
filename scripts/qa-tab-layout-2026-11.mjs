// QA only. Uses isolated Playwright contexts and fabricated records; never opens a real user's storage.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const dir=process.env.ONHARU_ARTIFACTS||'test-results/tab-layout-qa';
const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
await fs.mkdir(dir,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('Chromium unavailable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={url,source:'isolated synthetic Playwright browser contexts',created:new Date().toISOString(),cases:[],errors:[]};
const configs=[...([320,390,1024].flatMap(width=>['light','dark'].map(theme=>({width,theme}))))];
const label=config=>config.width+'-'+config.theme;
const pass=(config,name,ok,details)=>{const item={config:label(config),name,ok:!!ok,details};report.cases.push(item);console.log((ok?'PASS ':'FAIL ')+item.config+' '+name+(details?' — '+JSON.stringify(details).slice(0,320):''));};
const recordError=(config,msg)=>{report.errors.push({config:label(config),message:String(msg)});console.log('ERROR '+label(config)+' '+String(msg));};
const shot=async(page,c,name)=>{try{await page.screenshot({path:dir+'/'+label(c)+'-'+name+'.png',animations:'disabled',fullPage:false,caret:'hide'});}catch(e){recordError(c,'screenshot '+name+': '+e)}};
const nav=async(page,id)=>{await page.locator('.tabs [data-page="'+id+'"]').click();await page.waitForTimeout(100);};
const inspect=async(page,id)=>page.evaluate(id=>{
 const root=document.querySelector('#page-'+id),rect=e=>{const b=e.getBoundingClientRect();return{x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}};
 const controls=[...root?.querySelectorAll('button,input,textarea,select,summary')||[]].filter(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'});
 return {width:innerWidth,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
  displayed:!!root&&getComputedStyle(root).display!=='none',controls:controls.length,
  offscreen:controls.filter(e=>{const r=e.getBoundingClientRect();return r.left < -1||r.right>innerWidth+1}).slice(0,8).map(e=>({id:e.id,cls:String(e.className).slice(0,55),rect:rect(e)})),
  shortTouch:controls.filter(e=>{const r=e.getBoundingClientRect();return r.width<40||r.height<40}).slice(0,12).map(e=>({id:e.id,cls:String(e.className).slice(0,45),rect:rect(e)}))};
},id);
try{
for(const c of configs){
 const ctx=await browser.newContext({viewport:{width:c.width,height:844},isMobile:c.width<600,hasTouch:c.width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await ctx.newPage();page.setDefaultTimeout(7000);
 page.on('pageerror',e=>recordError(c,'Browser exception: '+e));
 page.on('dialog',async d=>{recordError(c,'Unexpected native '+d.type()+' dialog');await d.dismiss()});
 try {
  await page.clock.setFixedTime(new Date('2026-11-04T09:30:00-10:00'));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.tabs [data-page="capture"]');
  await shot(page,c,'first-run');
  await page.locator('#tutorialChooseEn').click();await page.locator('#welcomeSkip').click();
  await page.evaluate(theme=>{document.querySelector('#launchScreen')?.remove();const t=document.querySelector('#tutorialModal');if(t){t.hidden=true;t.style.display='none'}document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme},c.theme);
  const tabs=[['capture','Write'],['today','Plan'],['checkin','Check-in'],['focus','Focus'],['records','Review']];
  const counts={};
  for(const [id,name] of tabs){
   try{await nav(page,id);const m=await inspect(page,id);counts[id]=m;
    pass(c,name+' alignment / horizontal overflow',m.displayed&&m.overflow<=2&&m.offscreen.length===0,m);
    await shot(page,c,id);
   }catch(e){pass(c,name+' alignment',false,String(e))}
  }
  await nav(page,'capture');
  try{
   const toggle=page.locator('#qc-v2 .kona-tag-tray-toggle');
   const start=await toggle.boundingBox();await toggle.click();const end=await toggle.boundingBox();
   const sheep=await page.locator('button.kona-tag-chip[data-tag="meaning_listening"] .kona-sheep-icon').evaluate(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height,visible:r.width>0&&r.height>0}});
   const delta=Math.round((end?.y||0)-(start?.y||0));
   pass(c,'Write emoji expansion and listening sheep',sheep.visible&&Math.abs(delta)<4,{sheep,moreButtonVerticalDelta:delta});
   await shot(page,c,'write-expanded');
  }catch(e){pass(c,'Write emoji expansion and listening sheep',false,String(e))}
  try{
   await page.locator('#qc-text').fill('QA layout note, lorem ipsum 메모 for review');
   await page.locator('#qc-submit').click();
   pass(c,'Write save and recent note',await page.locator('.capture-recent-body').first().innerText().then(s=>s.includes('QA layout note')));
  }catch(e){pass(c,'Write save and recent note',false,String(e))}
  // The fabricated records below modify the in-memory state in this isolated browser only.
  const fixture=await page.evaluate(()=>{
   date='2026-11-04';const d=day(date),events=dayEvents(date),event=events.find(x=>x.title==='Design Class')||events[0];
   d.quickCaptureEntries=[
    {id:'layout-linked',time:'18:51',createdAt:'2026-11-05T04:51:00Z',scheduleId:event?.id||'',scheduleTitle:event?.title||'',title:'아파서 못감',text:'계획에 연결된 테스트 메모'},
    {id:'layout-personal',time:'19:12',createdAt:'2026-11-05T05:12:00Z',title:'Personal Note',text:'독립적인 테스트 메모'}
   ];
   d.sessions=[{id:'layout-dev',kind:'devotion',seconds:480,start:'18:58',note:'묵상 후 남긴 기록'},{id:'layout-prayer',kind:'prayer',seconds:11,start:'19:48',note:''}];
   d.checkins.morning={moodTime:'08:46',morningEnergy:2,morningHappiness:4,note:''};
   d.checkins.evening={moodTime:'20:37',eveningEnergy:4,eveningHappiness:3,note:'기분좋음'};
   d.checkins.noon={classContext:'Design by destiny: Gwen with a long responsive title',classReviewTime:'20:42',lectureQuote:'사탄의 거짓말들을 물리치자',lectureReflection:'1. 오늘 감사한 내용과 길게 이어지는 문장\n2. 다른 내용',classResponse:'아침에 일어나 말씀으로 하루 시작하기'};
   day('2026-11-02').checkins.morning={moodTime:'08:10',morningEnergy:3};
   return {hasPlan:!!event,planTitle:event?.title};
  });
  try{
   await nav(page,'records');await page.locator('#rev-reflect').click();
   const r=await page.evaluate(()=>{
    const root=document.querySelector('#new-reflect-page'),rows=[...root.querySelectorAll('.review-record')];
    return {types:Object.fromEntries(['review-plan-note','review-personal-note','review-session-record','review-check-record','review-class-record'].map(k=>[k,rows.filter(r=>r.classList.contains(k)).length])),classTimes:root.querySelector('.review-class-record')?.querySelectorAll('time').length,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
    emptySession:!!root.querySelector('.review-session-record.review-empty-note')};
   });
   pass(c,'Review five record types and timestamp hierarchy',Object.values(r.types).every(x=>x>=1)&&r.classTimes===1&&r.overflow<=2&&r.emptySession,{...r,fixture});
   await shot(page,c,'review-synthetic');
  }catch(e){pass(c,'Review five record types and timestamp hierarchy',false,String(e))}
  try{
   await page.locator('#rev-archive').click();
   const before=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   const search=page.locator('#archive-search-input');await search.fill('QA layout');
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
   const day=page.locator('[data-mood-date="2026-11-04"]');await day.click();
   const mood=await page.evaluate(()=>{
    const d=document.querySelector('[data-mood-date="2026-11-04"]');
    return {calendarDays:document.querySelectorAll('.archive-mood-day').length,dots:d?.querySelectorAll('.archive-mood-dot').length,morningEvening:document.querySelectorAll('.archive-mood-item').length,energyOnly:document.querySelector('[data-mood-date="2026-11-02"]')?.querySelectorAll('.archive-mood-dot[data-level="0"]').length,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};
   });
   pass(c,'Archive Mood calendar + two Check-ins + energy-only day',mood.calendarDays===30&&mood.dots===2&&mood.morningEvening===2&&mood.energyOnly===1&&mood.overflow<=2,mood);
   await shot(page,c,'archive-mood');
   await page.locator('.archive-mood-arrow').first().click();
   const month=await page.locator('.archive-mood-heading strong').innerText();
   pass(c,'Archive previous month navigation',/October|10월/.test(month),{month});
   await page.locator('.archive-mood-arrow').last().click();
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Records'}).click();
   const restored=await page.locator('#archive-search-input').inputValue();
   const filters=await page.locator('.archive-filter-row').count()>0;
   const after=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   pass(c,'Archive Records search restore / storage unchanged',restored==='QA layout'&&filters&&before===after,{restored,filters,storageSame:before===after});
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
   await page.locator('[data-mood-date="2026-11-04"]').click();
   await page.locator('.archive-mood-open-daily').click();
   const daily=await page.evaluate(()=>({d:date,active:document.getElementById('rev-reflect')?.getAttribute('aria-current'),archive:document.getElementById('rev-archive')?.getAttribute('aria-current')}));
   pass(c,'Mood date opens Daily Review',daily.d==='2026-11-04'&&daily.archive!=='page',daily);
  }catch(e){pass(c,'Archive Mood navigation and search',false,String(e));await shot(page,c,'archive-failure')}
  try{
   await page.locator('.app-settings-shortcut').click();
   await shot(page,c,'settings');
   const setting=await page.evaluate(()=>({open:document.querySelector('#kx-settings')?.open,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)}));
   pass(c,'Settings modal alignment',setting.open&&setting.overflow<=2,setting);
   await page.keyboard.press('Escape');
   pass(c,'Settings Escape',!await page.locator('#kx-settings').evaluate(e=>e.open));
  }catch(e){pass(c,'Settings modal and Escape',false,String(e))}
  // Tab bar must remain accessible at the end of a long Daily Review, not cover the final line.
  try{
   await nav(page,'records');await page.locator('#rev-reflect').click();
   const r=await page.evaluate(()=>{window.scrollTo(0,document.documentElement.scrollHeight);const dock=document.querySelector('.tabs'),area=document.querySelector('#new-reflect-page');const last=[...area.querySelectorAll('.review-record')].at(-1);const b=last?.getBoundingClientRect(),d=dock?.getBoundingClientRect();return {lastBottom:b?.bottom,dockTop:d?.top,scrollY:scrollY,scrollHeight:document.documentElement.scrollHeight,innerHeight,footerGap:d&&b?d.top-b.bottom:null}});
   pass(c,'Review last entry can scroll above dock',r.lastBottom==null||r.footerGap>=-2,r);
  }catch(e){pass(c,'Review footer docking',false,String(e))}
 }catch(e){recordError(c,e)}
 finally{await ctx.close()}
}
}finally{
 report.totals={passed:report.cases.filter(x=>x.ok).length,failed:report.cases.filter(x=>!x.ok).length,errorCount:report.errors.length,total:report.cases.length};
 await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));
 await browser.close();
}
console.log('QA SUMMARY '+JSON.stringify(report.totals));
if(report.totals.failed||report.totals.errorCount)process.exitCode=1;
