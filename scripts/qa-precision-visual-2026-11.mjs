// Precision UI audit: consultant-grade geometry, rhythm, typography and component consistency.
// Isolated local Chromium only. No actual user storage or production writes.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const dir=process.env.ONHARU_ARTIFACTS||'test-results/precision-visual';
await fs.mkdir(dir,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('No Chromium executable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={source:'isolated synthetic Playwright',url:process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/',configurations:[],failures:[],created:new Date().toISOString()};
const all=[320,390,1024].flatMap(width=>['light','dark'].map(theme=>({width,theme})));
const rounded=n=>Number(Number(n||0).toFixed(1));
const safe=async(page,fn,fallback=null)=>{try{return await fn()}catch(e){return {...fallback,error:String(e)}}};
const view=async(page,name,selectors)=>page.evaluate(({name,selectors})=>{
 const item=selector=>{
  const e=document.querySelector(selector);
  if(!e)return null;
  const s=getComputedStyle(e),r=e.getBoundingClientRect();
  if(r.width===0&&r.height===0)return null;
  return {selector,x:+r.left.toFixed(1),y:+r.top.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),
   fs:Number.parseFloat(s.fontSize),line:Number.parseFloat(s.lineHeight)||null,weight:s.fontWeight,color:s.color,bg:s.backgroundColor,
   padding:s.padding,margin:s.margin,text:e.innerText?.trim().slice(0,70)};
 };
 const r={name,elements:selectors.map(item).filter(Boolean),overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};
 const root=name==='settings'?document.querySelector('#kx-settings'):(name==='mood'?document.querySelector('#archive-search'):document.querySelector('#page-'+name));
 const visible=e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return b.width>0&&b.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
 const interactives=[...root?.querySelectorAll('button,a,input,textarea,select,summary')||[]].filter(visible);
 r.controls=interactives.length;
 r.smallTargets=interactives.filter(e=>{
   const b=e.getBoundingClientRect();return(b.width<40||b.height<40);
 }).slice(0,20).map(e=>{const b=e.getBoundingClientRect();return{el:e.tagName,id:e.id,cls:String(e.className).slice(0,65),text:e.textContent?.trim().slice(0,25),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}});
 r.offscreen=interactives.filter(e=>{const b=e.getBoundingClientRect();return b.left<-1||b.right>innerWidth+1}).slice(0,8).map(e=>({id:e.id,cls:String(e.className).slice(0,40)}));
 r.clipText=[...root?.querySelectorAll('h1,h2,h3,h4,h5,p,span,button,label,small')||[]]
  .filter(visible).filter(e=>{
   const s=getComputedStyle(e);return e.scrollWidth>e.clientWidth+2&&!['auto','scroll'].includes(s.overflowX)&&!['hidden','clip'].includes(s.overflowX)
  }).slice(0,10).map(e=>({id:e.id,cls:String(e.className).slice(0,40),text:e.textContent?.trim().slice(0,30)}));
 return r;
},{name,selectors});
const selectors={
 capture:['#qc-v2','#qc-title','#qc-text','.kona-tag-tray-toggle','.kona-tag-chip[data-tag="meaning_listening"]','.kona-sheep-icon','#qc-submit','.capture-recent-body'],
 today:['#page-today','.kona-plan-earlier','.kona-rich-event','#konaScheduleMore','#todayTasksAdd'],
 checkin:['#page-checkin','#page-checkin h2','#checkRecordedTime','.checkin-slider'],
 focus:['#page-focus','#kindSeg','#focusClock','#focusDurations','#focusStart'],
 records:['#page-records','#rev-reflect','#rev-weekly','#rev-archive','.rv-timegroup','.review-v3-section','.review-fold-inner','.review-plan-note','.review-personal-note','.review-record-meta','.review-class-title','.review-class-time'],
 mood:['.archive-mood-view-switch','.archive-mood-heading','.archive-mood-weekdays','.archive-mood-day','.archive-mood-legend','.archive-mood-detail','.archive-mood-open-daily'],
 settings:['#kx-settings','.app-settings-shortcut','#konaApplySettings','[data-kona-setting="theme"]']
};
const fixture=()=>{date='2026-11-04';const v=day(date),e=dayEvents(date).find(x=>x.title==='Design Class')||dayEvents(date)[0];
 v.quickCaptureEntries=[{id:'qa-plan',time:'18:51',createdAt:'2026-11-05T04:51:00Z',scheduleId:e?.id||'',scheduleTitle:e?.title||'',title:'아파서 못감',text:'오늘은 몸이 좋지 않아서 수업에 참석하지 못했어.'},{id:'qa-personal',time:'19:12',createdAt:'2026-11-05T05:12:00Z',title:'Personal Note',text:'Today I noticed something meaningful.'}];
 v.sessions=[{id:'qa-dev',kind:'devotion',seconds:480,start:'18:58',note:'하나님이 힘내라고 응원해주심'},{id:'qa-prayer',kind:'prayer',seconds:11,start:'19:48',note:''}];
 v.checkins.morning={moodTime:'08:46',morningEnergy:2,morningHappiness:4,note:''};
 v.checkins.evening={moodTime:'20:37',eveningEnergy:4,eveningHappiness:3,note:'기분좋음'};
 v.checkins.noon={classContext:'Design by destiny: Gwen — a long class title to test wrapping',classReviewTime:'20:42',
 lectureQuote:'사탄의 거짓말들을 물리치자',lectureReflection:'1. 내가 옳고 그름을 분별하는 은사가 있음에 감사\n2. 내일의 삶에 적용하기',classResponse:'오늘 배운 것을 기록하기'};
 day('2026-11-02').checkins.morning={moodTime:'08:20',morningEnergy:4};
};
const mark=(row,test,ok,details)=>{
 row.checks.push({test,ok:!!ok,details});
 if(!ok)report.failures.push({config:row.id,test,details});
};
try {
for(const conf of all){
 const id=conf.width+'-'+conf.theme;
 const row={id,width:conf.width,theme:conf.theme,views:{},checks:[],errors:[],screenshots:[]};report.configurations.push(row);
 const ctx=await browser.newContext({viewport:{width:conf.width,height:844},isMobile:conf.width<600,hasTouch:conf.width<600,
  locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const p=await ctx.newPage();p.setDefaultTimeout(7000);
 p.on('pageerror',e=>row.errors.push('page exception: '+String(e)));
 p.on('dialog',async d=>{row.errors.push('unexpected browser dialog '+d.type());await d.dismiss()});
 const screenshot=async name=>{const path=dir+'/'+id+'-'+name+'.png';try{await p.screenshot({path,animations:'disabled',caret:'hide'});row.screenshots.push(path)}catch(e){row.errors.push('screenshot '+name+' '+e)}};
 const nav=async name=>{
  const tab=p.locator('.tabs [data-page="'+name+'"]');await tab.click();await p.waitForTimeout(80);
  await p.evaluate(()=>document.fonts.ready);
 };
 try{
  await p.clock.setFixedTime(new Date('2026-11-04T09:30:00-10:00'));
  await p.goto(report.url,{waitUntil:'domcontentloaded'});
  await p.waitForSelector('.tabs [data-page="capture"]');
  await p.locator('#tutorialChooseEn').click();await p.locator('#welcomeSkip').click();
  await p.evaluate(theme=>{document.querySelector('#launchScreen')?.remove();
   const d=document.querySelector('#tutorialModal');if(d){d.hidden=true;d.style.display='none'}
   document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme},conf.theme);
  for(const tab of ['capture','today','checkin','focus']){
   await nav(tab);
   row.views[tab]=await view(p,tab,selectors[tab]);
   await screenshot(tab);
   mark(row,tab+' visible control bounds',row.views[tab].overflow<=2&&row.views[tab].offscreen.length===0,{overflow:row.views[tab].overflow,offscreen:row.views[tab].offscreen});
  }
  await p.evaluate(fixture);
  await nav('records');await p.locator('#rev-reflect').click();
  row.views.records=await view(p,'records',selectors.records);
  row.views.records.visualRelations=await p.evaluate(()=>{
   const box=x=>{const e=document.querySelector(x);if(!e)return null;const r=e.getBoundingClientRect();return{x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}};
   const timegroup=[...document.querySelectorAll('#new-reflect-page .rv-timegroup')].map(e=>{const r=e.getBoundingClientRect();return{x:+r.x.toFixed(1),y:+r.y.toFixed(1),height:+r.height.toFixed(1)}});
   return {groups:timegroup,planRail:box('.rv-linked-group .review-linked-rail'),planHeading:box('.rv-linked-group .review-event-heading'),
    planNote:box('.review-plan-note'),personal:box('.review-personal-note'),
    classTitle:box('.review-class-title'),classTime:box('.review-class-time'),
    classTimeCount:document.querySelectorAll('.review-class-record time').length,sessionMeta:box('.review-session-record .review-record-meta'),
    sessionNote:box('.review-session-record .rv-note-preview')};
  });
  await screenshot('review-daily');
  mark(row,'Review record ownership/timestamp',!!row.views.records.visualRelations.planNote&&!!row.views.records.visualRelations.personal&&row.views.records.visualRelations.classTimeCount===1,row.views.records.visualRelations);
  await p.locator('#rev-archive').click();
  await p.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
  await p.locator('[data-mood-date="2026-11-04"]').click();
  row.views.mood=await view(p,'mood',selectors.mood);
  await screenshot('review-mood');
  mark(row,'Archive Mood viewport and two check-ins',row.views.mood.overflow<=2&&await p.locator('.archive-mood-item').count()===2,
    {overflow:row.views.mood.overflow,entries:await p.locator('.archive-mood-item').count()});
  await p.locator('.archive-mood-open-daily').click();
  const direct=await p.evaluate(()=>({date,tab:document.getElementById('rev-reflect')?.getAttribute('aria-pressed'),archive:document.getElementById('rev-archive')?.getAttribute('aria-pressed')}));
  mark(row,'Mood to Daily Review',direct.date==='2026-11-04'&&direct.archive!=='true',direct);
  await p.locator('.app-settings-shortcut').click();await p.waitForTimeout(100);
  row.views.settings=await view(p,'settings',selectors.settings);await screenshot('settings');
  mark(row,'Settings within viewport',row.views.settings.overflow<=2&&!row.views.settings.offscreen.length,row.views.settings);
  // Report risks without claiming formal accessibility certification.
  for(const [name,v] of Object.entries(row.views)){
   if(!v?.elements)continue;
   v.designFlags=[];
   if(v.smallTargets?.length)v.designFlags.push(v.smallTargets.length+' visible controls smaller than 40px in one dimension (needs context review)');
   if(v.clipText?.length)v.designFlags.push(v.clipText.length+' potential clipped text nodes (needs screenshot validation)');
   if(name==='mood'){
    const legend=v.elements.find(e=>e.selector==='.archive-mood-legend');
    if(legend?.fs<12)v.designFlags.push('Mood legend font '+legend.fs+'px (readability risk)');
   }
  }
 }catch(e){row.errors.push(String(e));mark(row,'audit completion',false,String(e))}
 finally{await ctx.close()}
 console.log('AUDIT '+id+' '+JSON.stringify({checks:row.checks.map(c=>({test:c.test,ok:c.ok})),small:Object.fromEntries(Object.entries(row.views).map(([k,v])=>[k,v.smallTargets?.length||0])),errors:row.errors}).slice(0,1100));
}
}finally{
 report.summary={configs:report.configurations.length,checks:report.configurations.flatMap(x=>x.checks).length,
  passed:report.configurations.flatMap(x=>x.checks).filter(x=>x.ok).length,failed:report.failures.length,
  browserExceptions:report.configurations.flatMap(x=>x.errors).length};
 await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));
 await browser.close();
}
const sizes=report.configurations.map(row=>{
 const lookup=(v,key)=>row.views[v]?.elements?.find(e=>e.selector===key);
 const group=row.views.records?.visualRelations?.groups||[];
 return {viewport:row.id,
   pageLeft:lookup('today','#page-today')?.x,appWidth:lookup('today','#page-today')?.w,
   writeExpand:lookup('capture','.kona-tag-tray-toggle')&&{w:lookup('capture','.kona-tag-tray-toggle').w,h:lookup('capture','.kona-tag-tray-toggle').h},
   sheep:lookup('capture','.kona-sheep-icon')?.w,
   planMenu:lookup('today','#konaScheduleMore')&&{w:lookup('today','#konaScheduleMore').w,h:lookup('today','#konaScheduleMore').h},
   checkTime:lookup('checkin','#checkRecordedTime')?.h,
   focusCenterDelta:lookup('focus','#focusClock')&&Math.round((lookup('focus','#focusClock').x+lookup('focus','#focusClock').w/2-row.width/2)*10)/10,
   groupGap:group.length>1?Math.round((group[1].y-(group[0].y+group[0].height))*10)/10:null,
   planNoteX:row.views.records?.visualRelations?.planNote?.x,
   personalNoteX:row.views.records?.visualRelations?.personal?.x,
   classTitleFont:lookup('records','.review-class-title')?.fs,
   moodDay:lookup('mood','.archive-mood-day')&&{w:lookup('mood','.archive-mood-day').w,h:lookup('mood','.archive-mood-day').h},
   moodWeekdayFont:lookup('mood','.archive-mood-weekdays')?.fs,
   moodLegendFont:lookup('mood','.archive-mood-legend')?.fs,
   smallCount:Object.fromEntries(Object.entries(row.views).map(([k,v])=>[k,v.smallTargets?.length||0])),
   clipTextCount:Object.fromEntries(Object.entries(row.views).map(([k,v])=>[k,v.clipText?.length||0]))
 }
});
console.log('PRECISION_AUDIT_DETAIL '+JSON.stringify(sizes));
console.log('PRECISION_AUDIT_SUMMARY '+JSON.stringify(report.summary));
if(report.summary.failed||report.summary.browserExceptions)process.exitCode=1;
