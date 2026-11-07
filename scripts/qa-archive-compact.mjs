import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';

const target=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const out='test-results/archive-compact';
await fs.mkdir(out,{recursive:true});
const binary=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(x=>x&&existsSync(x));
if(!binary)throw Error('Chromium is required');
const browser=await chromium.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report=[];
const shot=async(page,id)=>{
  await page.screenshot({path:out+'/'+id+'.png',animations:'disabled'});
  if(id==='390-light-archive'){
    const b64=(await page.screenshot({type:'jpeg',quality:42,animations:'disabled'})).toString('base64');
    console.log('SHOT_BEGIN '+id);
    for(let i=0;i<b64.length;i+=4000)console.log('SHOT '+b64.slice(i,i+4000));
    console.log('SHOT_END '+id);
  }
};
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const result={width,theme};
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(target,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   await page.evaluate(t=>{
     document.getElementById('launchScreen')?.remove();
     const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
     document.documentElement.dataset.appearance=t;
     document.documentElement.style.colorScheme=t;
     date='2026-11-05';
     for(const d of ['2026-11-05','2026-11-04']){
       const event=dayEvents(d).find(x=>x?.id)||dayEvents(d)[0],data=day(d);
       data.quickCaptureEntries=[...(data.quickCaptureEntries||[]),{
         id:'qa-archive-compact-'+d,time:'11:30',createdAt:d+'T20:30:00Z',
         title:'Compact archive sample',text:'QA-ARCHIVE-COMPACT linked note '+d,
         scheduleId:event?.id||'',scheduleTitle:event?.title||'',tags:[]
       }];
       if(d==='2026-11-05'){
         data.quickCaptureEntries.push({id:'qa-free-note',time:'12:20',title:'Personal note',text:'Independent archive note',scheduleId:'',tags:[]});
         data.sessions=[...(data.sessions||[]),{id:'qa-prayer-compact',start:'13:00',seconds:300,kind:'prayer',task:'Prayer',note:'Focus reflection'}];
       }
     }
   },theme);
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-archive').click();
   const state=await page.evaluate(()=>{
     const q=s=>document.querySelector(s),r=e=>{const x=e.getBoundingClientRect();return {top:x.top,left:x.left,right:x.right,bottom:x.bottom,width:x.width,height:x.height}};
     const search=q('#archive-search-input'),f=q('.archive-search-row>.archive-filter-disclosure>summary'),
           saved=q('.archive-toolbar .review-saved-filters'),status=q('.archive-toolbar #archive-search-status'),
           first=q('#archive-search-results .archive-search-result');
     return {search:r(search),filter:r(f),saved:r(saved),status:r(status),first:r(first),
       toolbarCount:q('.archive-toolbar')?.childElementCount,
       noOverflow:document.documentElement.scrollWidth<=innerWidth+1,
       selected:q('.review-saved-filters button[aria-pressed="true"]')?.textContent,
       count:status.textContent.trim(),firstRecordFraction:Number((r(first).top/innerHeight).toFixed(3))};
   });
   Object.assign(result,state);
   console.log('ARCHIVE_LAYOUT '+JSON.stringify({width,theme,search:state.search,filter:state.filter,saved:state.saved,status:state.status,firstRecordFraction:state.firstRecordFraction}));
   await shot(page,width+'-'+theme+'-archive');
   if(Math.abs(state.search.top-state.filter.top)>5)throw Error('Search/Filters not on the same row');
   if(Math.abs((state.saved.top+state.saved.bottom)/2-(state.status.top+state.status.bottom)/2)>6)throw Error('Saved tabs/count not vertically centered');
   if(state.toolbarCount!==2)throw Error('Saved toolbar must contain tabs and count only');
   if(!state.noOverflow)throw Error('Archive page overflows');
   if(state.selected!=='All')throw Error('All records not initially selected');
   if(width<600&&state.firstRecordFraction>0.48)throw Error('First Archive record starts too low: '+state.firstRecordFraction);
   if(await page.locator('.archive-filter-disclosure').evaluate(e=>e.open))throw Error('Filters should start collapsed');
   await page.locator('#archive-search-input').fill('QA-ARCHIVE-COMPACT');
   const results=page.locator('#archive-search-results .archive-search-result');
   if(await results.count()!==2)throw Error('Search results mismatch');
   const disclosure=page.locator('#archive-search .archive-filter-disclosure');
   await disclosure.locator('summary').click();
   if(!await disclosure.evaluate(e=>e.open))throw Error('Filter panel did not expand');
   await page.locator('.archive-filter-row select[aria-label="Type"]').selectOption('note');
   const fresh=page.locator('#archive-search .archive-filter-disclosure');
   if(!await fresh.evaluate(e=>e.open))throw Error('Filter panel collapsed unexpectedly');
   if(await results.count()!==2)throw Error('Type filtering changed matched records');
   const filtersLayout=await page.evaluate(()=>{
     const search=document.querySelector('#archive-search-input').getBoundingClientRect();
     const controls=document.querySelector('#archive-search .archive-filter-row').getBoundingClientRect();
     return {searchTop:search.top,controlsTop:controls.top,overflow:document.documentElement.scrollWidth-innerWidth};
   });
   if(filtersLayout.controlsTop<filtersLayout.searchTop+35||filtersLayout.overflow>1)throw Error('Expanded filter layout overlaps search or overflows');
   await shot(page,width+'-'+theme+'-filters');
   await page.locator('.archive-search-row .archive-filter-disclosure>summary').click();
   await page.locator('.review-saved-filters button').filter({hasText:'Starred'}).click();
   if(await page.locator('.review-saved-filters button').filter({hasText:'Starred'}).getAttribute('aria-pressed')!=='true')throw Error('Saved state lost after rerender');
   await page.locator('.review-saved-filters button').filter({hasText:'All'}).click();
   if(await results.count()!==2)throw Error('All records did not restore search');
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
   if(await page.locator('.archive-mood-panel').count()!==1)throw Error('Mood subview missing');
   await shot(page,width+'-'+theme+'-mood');
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Records'}).click();
   if(await results.count()!==2)throw Error('Returning from Mood lost search');
   if(!await page.locator('.archive-search-input-wrap #archive-search-input').isVisible())throw Error('Search input lost after navigation');
   await page.locator('#rev-weekly').click();
   await page.locator('.weekly-compact-header').waitFor();
   await page.locator('#rev-archive').click();
   if(await results.count()!==2)throw Error('Weekly/Archive switch lost data');
   if(errors.length)throw Error('Page errors: '+errors.join(' / '));
   result.ok=true;
   console.log('ARCHIVE_COMPACT_PASS '+JSON.stringify({width,theme,firstRecordFraction:state.firstRecordFraction,searchFilterAligned:true,savedCountAligned:true,overflow:0}));
  }catch(e){
   result.ok=false;result.error=String(e);result.pageErrors=errors;
   console.error('ARCHIVE_COMPACT_FAIL '+width+' '+theme+' '+e);
   await page.screenshot({path:out+'/'+width+'-'+theme+'-error.png'}).catch(()=>{});
  }finally{report.push(result);await context.close()}
 }
}finally{await browser.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2))}
if(report.some(x=>!x.ok))process.exitCode=1;
