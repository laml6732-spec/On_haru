// Preview-only comprehensive button/edge alignment audit.
// No production access, never clears existing user data: each configuration uses a fresh context.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';

const dir='test-results/all-tabs-alignment-preview';
await fs.mkdir(dir,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const base='http://127.0.0.1:8080/legacy/';
const screenshots=process.env.ONHARU_ALL_SCREENSHOTS!=='0';
const groupSelectors=[
 ['dock','.tabs','button'],
 ['checkin-phases','#page-checkin .phases','button'],
 ['focus-kind','#page-focus #kindSeg','button'],
 ['focus-durations','#page-focus #focusDurations','button'],
 ['schedule-subtabs','#page-schedule .subtabs','button'],
 ['review-tabs','#page-records #new-review-switch','button'],
 ['review-week-selector','#page-records .weekly-overview-row','.weekly-period-text,.weekly-reflection-toggle'],
 ['plan-top-actions','#page-today .tl-card>.sectionhead .right','button,summary'],
 ['plan-task-actions','#page-today #pageheadExtra .tasks-overview','button'],
 ['capture-composer-bottom','#page-capture #qc-v2 .qc-bottom','button,summary'],
 ['capture-tags','#page-capture #qc-v2 .kona-capture-tag-row','button']
];
const failures=[];
const pass=(row,name,ok,details)=>{
 row.checks.push({name,ok:!!ok,details});
 if(!ok){failures.push(row.key+': '+name);console.log('ALIGN_FAIL',row.key,name,JSON.stringify(details).slice(0,1600));}
};
const attempt=async(row,name,fn)=>{
 try{await fn();row.actions.push({name,ok:true});return true}
 catch(e){row.actions.push({name,ok:false,error:String(e)});console.log('ALIGN_ACTION_UNAVAILABLE',row.key,name,String(e).slice(0,450));return false}
};
const visible=async loc=>await loc.count()>0 && await loc.first().isVisible();
for(const width of [320,390,1024])for(const theme of ['light','dark']){
 const row={key:width+'-'+theme,width,theme,checks:[],actions:[],states:[],pageErrors:[]};results.push(row);
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();
 page.setDefaultTimeout(4000);
 page.on('pageerror',e=>row.pageErrors.push(String(e)));
 page.on('dialog',d=>d.dismiss());
 const tab=name=>page.locator('.tabs [data-page="'+name+'"]');
 const openTab=async name=>{await tab(name).click();await page.waitForTimeout(90)};
 const state=async(name,scopeSelector)=>{
  await page.evaluate(()=>document.activeElement instanceof HTMLElement&&document.activeElement.blur());
  await page.waitForTimeout(90);
  const stats=await page.evaluate(({scopeSelector,groupSelectors})=>{
   const on=e=>{if(!e||e.closest('[inert],[aria-hidden="true"],[hidden]'))return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>=1&&r.height>=1&&e.getClientRects().length>0;};
   const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}};
   const root=document.querySelector(scopeSelector)||document.querySelector('.app');
   const elements=[...root.querySelectorAll('button,summary,[role="button"]')].filter(on);
   const controlRows=groupSelectors.map(([key,sel,child])=>{
    const holder=document.querySelector(sel);if(!on(holder))return null;
    const bs=[...holder.querySelectorAll(child)].filter(x=>on(x) && !elements.some(y=>x!==y&&x.contains(y)));
    return {key,buttons:bs.map(x=>({id:x.id,cls:String(x.className).slice(0,100),name:(x.getAttribute('aria-label')||x.textContent||'').trim().slice(0,35),...box(x)}))};
   }).filter(Boolean);
   const rects=elements.map(el=>({el,rect:box(el),name:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,42),id:el.id,cls:String(el.className).slice(0,70)}));
   const clipped=rects.filter(z=>z.rect.left<-.8||z.rect.right>innerWidth+.8).map(z=>({id:z.id,name:z.name,x:Math.round(z.rect.x),right:Math.round(z.rect.right)}));
   const overlaps=[];
   for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
    const a=rects[i],b=rects[j];if(a.el.contains(b.el)||b.el.contains(a.el))continue;
    // An opaque, top-layer More menu is expected to cover the plan beneath it.
    // Only flag overlapping peer controls, not a deliberate popover over page content.
    if(!!a.el.closest('#konaScheduleMore .kona-more-panel')!==!!b.el.closest('#konaScheduleMore .kona-more-panel'))continue;
    const x=Math.max(0,Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left));
    const y=Math.max(0,Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top));
    if(x>5&&y>5&&x*y>100)overlaps.push({a:a.id||a.name,b:b.id||b.name,intersection:Math.round(x*y)});
   }
   const groups=controlRows.filter(x=>x.buttons.length>=2).map(x=>{
    const bb=x.buttons,cy=bb.map(z=>z.cy),height=bb.map(z=>z.height);
    return{key:x.key,buttons:bb,centerDelta:Math.round(10*(Math.max(...cy)-Math.min(...cy)))/10,heightDelta:Math.round(10*(Math.max(...height)-Math.min(...height)))/10};
   });
   const icons=[];
   for(const {el,rect,name,id} of rects){
     const children=[...el.children].filter(on);
     const art=children.find(c=>/^(IMG|SVG)$/i.test(c.tagName))||(children.length===1&&children[0].querySelector('img,svg'));
     if(!art || (el.textContent||'').trim().length>0 || children.length>2)continue;
     const ib=box(art);let offset=Math.abs(rect.cy-ib.cy);if(offset>5)icons.push({id,name,offset:Math.round(offset*10)/10});
   }
   const short=rects.filter(x=>x.rect.height<32).map(z=>({id:z.id,name:z.name,height:Math.round(z.rect.height)}));
   return{viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,clipped,overlaps,groups,iconsMisaligned:icons,smallTargets:short.slice(0,25),count:rects.length,
     scope:scopeSelector,rootBox:root?box(root):null};
  },{scopeSelector,groupSelectors});
  const record={name,stats};row.states.push(record);
  const safe=name.replace(/[^a-z0-9-]/gi,'_');
  if(screenshots)await page.screenshot({path:dir+'/'+row.key+'-'+safe+'.png',animations:'disabled',caret:'hide',fullPage:true});
  pass(row,name+' horizontal overflow',stats.scrollWidth<=stats.viewport+2,{width:stats.viewport,scrollWidth:stats.scrollWidth});
  // A visible control must fit the viewport. Exclude offscreen descendants of temporarily inactive modal panels.
  pass(row,name+' controls within viewport',stats.clipped.length===0,stats.clipped);
  pass(row,name+' no overlapping distinct controls',stats.overlaps.length===0,stats.overlaps.slice(0,8));
  const stable=stats.groups.filter(g=>['dock','checkin-phases','focus-kind','schedule-subtabs','review-tabs','plan-task-actions'].includes(g.key));
  pass(row,name+' segmented button center/height alignment',
       stable.every(g=>g.centerDelta<=3&&g.heightDelta<=3),
       stable.map(g=>({key:g.key,centerDelta:g.centerDelta,heightDelta:g.heightDelta})));
  pass(row,name+' icon-only buttons centered',stats.iconsMisaligned.length===0,stats.iconsMisaligned);
  console.log('ALIGN_STATE',row.key,name,JSON.stringify({buttons:stats.count,groups:stats.groups.map(x=>({k:x.key,cy:x.centerDelta,h:x.heightDelta})),overlaps:stats.overlaps.length,clipped:stats.clipped.length,icons:stats.iconsMisaligned.length,overflow:stats.scrollWidth-stats.viewport}));
  return record;
 };
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.tabs [data-page="capture"]');
  if(await visible(page.locator('#tutorialChooseEn')))await page.locator('#tutorialChooseEn').click();
  if(await visible(page.locator('#welcomeSkip')))await page.locator('#welcomeSkip').click();
  await page.evaluate(theme=>{document.getElementById('launchScreen')?.remove();const t=document.getElementById('tutorialModal');if(t){t.hidden=true;t.style.display='none'}document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme},theme);

  await openTab('capture');
  await state('capture-closed','#page-capture');
  await attempt(row,'create isolated QA note',async()=>{
   await page.locator('#qc-text').fill('Alignment audit: checking content and button positions in different states.');
   await page.locator('#qc-submit').click();
   await page.locator('.capture-recent-note').first().waitFor({state:'visible'});
  });
  if(await visible(page.locator('#page-capture .kona-tag-tray-toggle'))){
   await attempt(row,'capture More open',async()=>page.locator('#page-capture .kona-tag-tray-toggle').first().click());
   await state('capture-tags-open','#page-capture');
   await attempt(row,'capture More close',async()=>page.locator('#page-capture .kona-tag-tray-toggle').first().click());
   await state('capture-tags-closed-again','#page-capture');
  }
  if(await visible(page.locator('#captureScheduleLink>summary'))){
   await attempt(row,'capture link open',async()=>page.locator('#captureScheduleLink>summary').click());
   await state('capture-schedule-open','#page-capture');
   await attempt(row,'capture link close',async()=>page.locator('#captureScheduleLink>summary').click());
  }
  if(await visible(page.locator('.capture-recent-note').first())){
   await attempt(row,'saved note edit open',async()=>page.locator('.capture-recent-note').first().click());
   if(await visible(page.locator('#konaReviewEditor')))await state('capture-note-editor-open','#konaReviewEditor');
   await attempt(row,'saved note edit close',async()=>page.locator('#konaReviewEditor').getByRole('button',{name:'Cancel',exact:true}).click());
  }
  await openTab('today');
  await state('plan-closed','#page-today');
  if(await visible(page.locator('#page-today #pinRow .task-add'))){
   await attempt(row,'create isolated task',async()=>{
    await page.locator('#page-today #pinRow .task-add').click();
    await page.locator('#taskTitle').fill('QA task with a longer description to examine alignment');
    await page.locator('#taskImportant').check();
    await page.locator('#taskSave').click();
   });
  }
  if(await visible(page.locator('#page-today #pinRow .task-fold'))){
   // The add-task dialog can leave the list expanded already. Test named states,
   // not an assumed initial toggle direction.
   if(await page.locator('#page-today #pinRow .task-fold').getAttribute('aria-expanded')!=='true')
     await attempt(row,'plan tasks open',async()=>page.locator('#page-today #pinRow .task-fold').click());
   await state('plan-tasks-open','#page-today');
   pass(row,'Plan open state has visible task row',
     await page.locator('#page-today #pinRow .task-fold').getAttribute('aria-expanded')==='true' &&
     await visible(page.locator('#page-today #todayTaskCard .task-name').first()),'open task UI');
   await attempt(row,'plan tasks closed',async()=>page.locator('#page-today #pinRow .task-fold').click());
   await state('plan-tasks-closed-again','#page-today');
   pass(row,'Plan closed state hides list',
     await page.locator('#page-today #pinRow .task-fold').getAttribute('aria-expanded')==='false' &&
     !await visible(page.locator('#page-today #todayTaskCard .task-name').first()),'collapsed task UI');
  }
  if(await visible(page.locator('#page-today #konaScheduleMore>summary'))){
   await attempt(row,'plan More open',async()=>page.locator('#page-today #konaScheduleMore>summary').click());
   await state('plan-more-open','#page-today');
   // The dropdown is allowed to cover schedule content, but never its trigger.
   const menuGeometry=await page.evaluate(()=>{
     const trigger=document.querySelector('#konaScheduleMore>summary');
     const panel=document.querySelector('#konaScheduleMore>.kona-more-panel');
     if(!trigger||!panel)return null;
     const t=trigger.getBoundingClientRect(),p=panel.getBoundingClientRect();
     return {triggerBottom:t.bottom,panelTop:p.top,gap:p.top-t.bottom,panelLeft:p.left,panelRight:p.right,
       peerCount:[...panel.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().height>0).length};
   });
   pass(row,'Plan More panel starts below toggle and fits viewport',
     !!menuGeometry&&menuGeometry.gap>=2&&menuGeometry.panelLeft>=-1&&menuGeometry.panelRight<=width+1,menuGeometry);
   pass(row,'Plan expanded schedule action is available',
     await visible(page.locator('#page-today #konaScheduleMore[open] #kx-timeline-toggle')), 'full timeline within More');
   if(await visible(page.locator('#page-today #kx-timeline-toggle'))){
     await attempt(row,'plan full timeline toggle',async()=>page.locator('#page-today #kx-timeline-toggle').click());
     await state('plan-timeline-open','#page-today');
   }
   if(await page.locator('#konaScheduleMore').getAttribute('open')!==null)
    await attempt(row,'plan More close',async()=>page.locator('#page-today #konaScheduleMore>summary').click());
   await state('plan-more-closed-again','#page-today');
  }
  await openTab('checkin');
  await state('checkin-morning','#page-checkin');
  for(const phase of ['noon','evening','morning']){
   await attempt(row,'checkin phase '+phase,async()=>page.locator('#page-checkin [data-phase="'+phase+'"]').click());
   await state('checkin-'+phase+'-selected','#page-checkin');
  }
  await openTab('focus');
  await state('focus-closed','#page-focus');
  for(const kind of ['prayer','devotion','focus']){
   if(await visible(page.locator('#page-focus #kindSeg [data-kind="'+kind+'"]'))){
    await attempt(row,'focus kind '+kind,async()=>page.locator('#page-focus #kindSeg [data-kind="'+kind+'"]').click());
    await state('focus-'+kind,'#page-focus');
   }
  }
  if(await visible(page.locator('#focusLibraryOpen'))){
   await attempt(row,'focus requests open',async()=>page.locator('#focusLibraryOpen').click());
   if(await visible(page.locator('#focusLibraryModal')))await state('focus-library-open','#focusLibraryModal');
   await attempt(row,'focus requests close',async()=>page.locator('#focusLibraryModal .close').click());
   await state('focus-library-closed-again','#page-focus');
  }
  await openTab('records');
  await page.locator('#rev-reflect').click();
  await state('review-daily','#page-records');
  const reviewToolbar=async stateName=>{
   const m=await page.evaluate(()=>{
     const holder=document.querySelector('#page-records #new-reflect-page .rv-seven-toolbar');
     if(!holder)return null;
     const box=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,cx:(r.left+r.right)/2,top:r.top,bottom:r.bottom}};
     const left=holder.querySelector('.rv-seven-toolbar-left'),mid=holder.querySelector('.rv-seven-toolbar-center'),right=holder.querySelector('.rv-seven-toolbar-right');
     if(!left||!mid||!right)return null;
     const h=box(holder),l=box(left),m=box(mid),r=box(right);
     return{holder:h,left:l,mid:m,right:r,leftGap:m.left-l.right,rightGap:r.left-m.right,
       centerDelta:Math.abs(h.cx-m.cx)};
   });
   pass(row,stateName+' week/record/reflection buttons stay separate and centered',
     !!m&&m.leftGap>=-1&&m.rightGap>=-1&&m.centerDelta<=3,m);
  };
  await reviewToolbar('Review open');
  if(await visible(page.locator('#page-records .review-section-bar').first())){
    await attempt(row,'Review daypart closed',async()=>page.locator('#page-records .review-section-bar').first().click());
    await state('review-daypart-closed','#page-records');
    await reviewToolbar('Review daypart folded');
    await attempt(row,'Review daypart opened',async()=>page.locator('#page-records .review-section-bar').first().click());
    await state('review-daypart-open-again','#page-records');
    await reviewToolbar('Review daypart expanded');
  }
  // Current Review renders Weekly inline below Daily instead of a separate tab.
  // Exercise both the weekly disclosure and its nested More section.
  const weeklyInline=page.locator('#page-records .rv-weekly-inline-details>summary').first();
  if(await visible(weeklyInline)){
    await state('review-weekly-inline-closed','#page-records');
    await attempt(row,'Weekly inline open',async()=>weeklyInline.click());
    await state('review-weekly-inline-open','#page-records');
    const more=page.locator('#page-records .rv-weekly-inline-extra>summary').first();
    if(await visible(more)){
      await attempt(row,'Weekly extra details open',async()=>more.click());
      await state('review-weekly-details-open','#page-records');
      await attempt(row,'Weekly extra details close',async()=>more.click());
      await state('review-weekly-details-closed','#page-records');
    }
    await attempt(row,'Weekly inline close',async()=>weeklyInline.click());
    await state('review-weekly-inline-closed-again','#page-records');
  }
  await page.locator('#rev-archive').click();
  await state('review-archive-closed','#page-records');
  const filters=page.locator('#page-records .archive-filter-disclosure>summary').first();
  if(await visible(filters)){
    await attempt(row,'Archive filter open',async()=>filters.click());
    await state('review-archive-filter-open','#page-records');
    await attempt(row,'Archive filter close',async()=>filters.click());
    await state('review-archive-filter-closed','#page-records');
  }
  await attempt(row,'Settings open',async()=>page.locator('.app-settings-shortcut').click());
  if(await visible(page.locator('#kx-settings .settings-panel-body'))){
   await state('settings-open','#kx-settings');
   const details=page.locator('#kx-settings details>summary').first();
   if(await visible(details)){
     await attempt(row,'Settings subsection open',async()=>details.click());
     await state('settings-details-open','#kx-settings');
     await attempt(row,'Settings subsection closed',async()=>details.click());
     await state('settings-details-closed','#kx-settings');
   }
   await attempt(row,'Settings close',async()=>page.locator('#kx-settings .settings-close').click());
   await state('settings-closed-again','#page-records');
  }
 }catch(e){row.pageErrors.push('Audit exception: '+String(e));console.log('ALIGN_ABORT',row.key,String(e))}
 await context.close();
 console.log('ALIGN_CONFIG',row.key,JSON.stringify({states:row.states.length,pass:row.checks.filter(x=>x.ok).length,fail:row.checks.filter(x=>!x.ok).length,errors:row.pageErrors,actionUnavailable:row.actions.filter(x=>!x.ok)}));
}
await browser.close();
const summary={configs:results.length,states:results.reduce((n,r)=>n+r.states.length,0),checks:results.reduce((n,r)=>n+r.checks.length,0),
 passed:results.reduce((n,r)=>n+r.checks.filter(c=>c.ok).length,0),failed:failures.length,
 errors:results.reduce((n,r)=>n+r.pageErrors.length,0),failures};
await fs.writeFile(dir+'/report.json',JSON.stringify({summary,results},null,2));
console.log('ALIGN_SUMMARY',JSON.stringify(summary).slice(0,7500));
if(failures.length||summary.errors)process.exitCode=1;
