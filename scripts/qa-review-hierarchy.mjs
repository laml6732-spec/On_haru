import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const out=process.env.ONHARU_ARTIFACTS||'test-results/review-hierarchy';
await fs.mkdir(out,{recursive:true});
const exe=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
if(!exe)throw Error('Chrome not available');
const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const all=[];
try{
  for(const width of [320,390,1024])for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
    const page=await context.newPage();page.setDefaultTimeout(8500);
    const result={width,theme,ok:false},errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    try{
      await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await page.locator('#tutorialChooseEn').click();
      await page.locator('#welcomeSkip').click();
      await page.evaluate(t=>{
        document.getElementById('launchScreen')?.remove();
        const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
        document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
        date='2026-11-05';
        for(const [d,id] of [['2026-11-05','qa-today'],['2026-11-04','qa-yesterday']]){
          const evt=dayEvents(d).find(e=>e?.id)||dayEvents(d)[0];
          const dayData=day(d);
          dayData.quickCaptureEntries=[...(dayData.quickCaptureEntries||[]),{
            id,time:'14:43',createdAt:d+'T20:43:00Z',title:'QA-AH title',
            text:'QA-ARCHIVE-HIERARCHY '+id+' long preview to test search and opening the full detailed record.',
            scheduleId:evt?.id||'',scheduleTitle:evt?.title||'',tags:[]
          }];
        }
      },theme);
      await page.locator('.tabs [data-page="records"]').click();
      await page.locator('#rev-weekly').click();
      const weekHead=page.locator('#new-reflect-page .review-weekly-records .weekly-day>.review-date-header').first();
      await weekHead.waitFor();
      result.weekly=await weekHead.evaluate(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return{bg:c.backgroundColor,width:r.width,date:e.querySelector('.review-date-label')?.textContent,count:e.querySelector('.review-date-count')?.textContent}});
      if(!result.weekly.date||!result.weekly.count)throw Error('Weekly date/count missing');
      await page.screenshot({path:out+'/'+width+'-'+theme+'-weekly.png',animations:'disabled'});
      await page.locator('#rev-archive').click();
      await page.locator('#archive-search-input').waitFor();
      const search=page.locator('#archive-search-input');
      if((await search.getAttribute('placeholder'))!=='Search records…')throw Error('Search placeholder missing');
      const disclosure=page.locator('#archive-search .archive-filter-disclosure');
      await disclosure.waitFor();
      if(await disclosure.evaluate(e=>e.open))throw Error('Filter pane should default to closed');
      const top=await page.locator('#archive-search .archive-saved-filters').count();
      const baseline=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      if(baseline>1)throw Error('Archive overflow on initial view '+baseline);
      await page.screenshot({path:out+'/'+width+'-'+theme+'-archive-collapsed.png',animations:'disabled'});
      // Test combined search + type and period filters, including persistent details state.
      await search.fill('QA-ARCHIVE-HIERARCHY');
      const rows=page.locator('#archive-search-results .archive-search-result');
      if(await rows.count()!==2)throw Error('Expected two QA search results, got '+await rows.count());
      const heads=page.locator('#archive-search-results>.review-date-header');
      if(await heads.count()!==2)throw Error('Expected two date groups');
      const first=await heads.first().evaluate(e=>{const c=getComputedStyle(e);return{bg:c.backgroundColor,date:e.querySelector('.review-date-label')?.textContent,count:e.querySelector('.review-date-count')?.textContent}});
      if(first.bg!==result.weekly.bg)throw Error('Weekly/Archive date header backgrounds differ');
      if(!first.count?.includes('1 record'))throw Error('Archive date count missing');
      const firstRow=rows.first();
      const order=await firstRow.evaluate(e=>[...e.children].map(x=>x.className));
      if(order[0]!=='archive-result-head'||order[1]!=='archive-search-preview')throw Error('Metadata not first '+order);
      const clamp=await firstRow.locator('.archive-search-preview').evaluate(e=>getComputedStyle(e).webkitLineClamp);
      if(clamp!=='2')throw Error('Record preview not two lines: '+clamp);
      await disclosure.locator('summary').click();
      if(!await disclosure.evaluate(e=>e.open))throw Error('Filters cannot expand');
      const type=page.locator('#archive-search .archive-filter-row select[aria-label="Type"]');
      await type.selectOption('note');
      const reopened=page.locator('#archive-search .archive-filter-disclosure');
      if(!await reopened.evaluate(e=>e.open))throw Error('Filter pane collapsed after selecting type');
      if(await rows.count()!==2)throw Error('Type filter incorrectly removed notes');
      const period=page.locator('#archive-search .archive-filter-row select[aria-label="Period"]');
      await period.selectOption('date');
      const picked=page.locator('#archive-search .review-archive-context input[type=date]');
      await picked.fill('2026-11-04');await picked.dispatchEvent('change');
      if(await rows.count()!==1)throw Error('Date+Type+Search intersection failed');
      const chips=page.locator('#archive-search .archive-active-filter-chip');
      if(await chips.count()<2)throw Error('Active filter chips missing');
      await page.screenshot({path:out+'/'+width+'-'+theme+'-archive-filtered.png',animations:'disabled'});
      const firstResult=rows.first();await firstResult.click();
      if(await page.locator('#archive-search-results .review-record').count()!==1)throw Error('Archive detail view not opened');
      const detail=await page.locator('#archive-search-results .review-record').innerText();
      if(!detail.includes('QA-ARCHIVE-HIERARCHY'))throw Error('Full record detail missing');
      await page.locator('#archive-search .archive-back').click();
      if(await rows.count()!==1)throw Error('Archive back did not restore combined filters');
      // Both All records / Saved for later tabs must control their selected states.
      await page.locator('#archive-search .review-saved-filters button').filter({hasText:'Saved for later'}).click();
      const selected=await page.locator('#archive-search .review-saved-filters button').filter({hasText:'Saved for later'}).getAttribute('aria-pressed');
      if(selected!=='true')throw Error('Saved for later tab selection invalid');
      await page.locator('#archive-search .review-saved-filters button').filter({hasText:'All records'}).click();
      if(await rows.count()!==1)throw Error('All records tab did not restore results');
      // Bottom dock must not permanently obscure last result when scrolled into view.
      await rows.last().scrollIntoViewIfNeeded();
      if(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)>1)throw Error('Archive horizontal overflow after interactions');
      if(errors.length)throw Error('Browser JS exceptions: '+errors.join('; '));
      result.archive={dateGroups:2,metadataFirst:true,filterCount:await chips.count(),searchWorked:true,detailWorked:true,overflow:baseline};
      result.ok=true;
      console.log('PASS',width,theme,'Weekly/Archive date headers, search, combined filters, details, saved tab, overflow');
    }catch(e){result.error=String(e);console.error('FAIL',width,theme,String(e))}
    all.push(result);await context.close();
  }
}finally{await browser.close()}
await fs.writeFile(out+'/report.json',JSON.stringify(all,null,2));
if(all.some(x=>!x.ok))process.exitCode=1;
