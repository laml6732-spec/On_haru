import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const folder='test-results/weekly-compact';
await fs.mkdir(folder,{recursive:true});
const chrome=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(x=>x&&existsSync(x));
if(!chrome)throw new Error('Chromium is required');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const reports=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T17:20:00-10:00'));
   await page.goto('http://127.0.0.1:8080/legacy/',{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   await page.evaluate(theme=>{
    document.getElementById('launchScreen')?.remove();
    const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
    document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme;
    db.settings.zone='Pacific/Honolulu';date='2026-11-05';
    for(const d of ['2026-11-05','2026-11-04']){
     const data=day(d);
     data.quickCaptureEntries=[{
      id:'qa-week-compact-'+d,time:'14:43',createdAt:d+'T23:43:00Z',
      title:'Sample moment',text:'A meaningful day to remember. This text must be visible above the fold.',
      scheduleId:'',tags:[],laterReflections:[{text:'A later thought',createdAt:'2026-11-06T03:20:00.000Z'}]
     }];
    }
   },theme);
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-weekly').click();
   await page.locator('#new-reflect-page .weekly-compact-header').waitFor();
   const stats=await page.evaluate(()=>{
    const el=document.querySelector('#new-reflect-page .review-weekly-records .review-record')||
             document.querySelector('#new-reflect-page .review-weekly-records .review-plan-note');
    const head=document.querySelector('#new-reflect-page .weekly-compact-header');
    const meta=document.querySelector('#new-reflect-page .weekly-compact-meta');
    return{
      firstRecordTop:el?Math.round(el.getBoundingClientRect().top):null,
      viewportHeight:innerHeight,
      firstRecordFraction:el?Number((el.getBoundingClientRect().top/innerHeight).toFixed(3)):null,
      dateNavHidden:getComputedStyle(document.querySelector('.pagehead .datecontrol')).display==='none',
      compactNavigation:!!head,summaryInline:!!meta,
      oldHeading:!!document.querySelector('#new-reflect-page .rv-head h2'),
      redundantMomentsHeading:!!document.querySelector('#new-reflect-page .review-weekly-records .review-section-heading'),
      overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
      followupLocalDate:reviewFollowupLocalDate('2026-11-06T03:20:00.000Z')
    };
   });
   if(!stats.compactNavigation||!stats.summaryInline||!stats.dateNavHidden)throw Error('Compact weekly structure or header visibility failed');
   if(stats.oldHeading||stats.redundantMomentsHeading)throw Error('Repeated Weekly headings remain');
   if(stats.followupLocalDate!=='2026-11-05')throw Error('UTC follow-up local date failed');
   if(stats.firstRecordTop===null)throw Error('Sample weekly record not visible');
   if(width<600&&stats.firstRecordFraction>0.4)throw Error('First record starts below 40% of viewport: '+stats.firstRecordFraction);
   if(stats.overflow>0)throw Error('Horizontal page overflow: '+stats.overflow);
   if(await page.locator('#new-reflect-page .weekly-jump-current').count())throw Error('This week should be hidden for current week');
   await page.locator('#new-reflect-page .weekly-nav-arrow').first().click();
   if(await page.locator('#new-reflect-page .weekly-jump-current').count()!==1)throw Error('This week action missing for past week');
   await page.locator('#new-reflect-page .weekly-jump-current').click();
   await page.screenshot({path:folder+'/'+width+'-'+theme+'-weekly.png',animations:'disabled'});
   await page.locator('#rev-archive').click();
   const archiveHidden=await page.locator('.pagehead .datecontrol').evaluate(el=>getComputedStyle(el).display==='none');
   if(!archiveHidden)throw Error('Archive retains Daily date stepper');
   const result={width,theme,...stats,archiveDateNavHidden:archiveHidden,errors};
   reports.push(result);console.log('WEEKLY_COMPACT '+JSON.stringify(result));
  }catch(error){
   reports.push({width,theme,error:String(error),errors});console.error('WEEKLY_COMPACT_FAIL '+width+' '+theme+' '+error);
   await page.screenshot({path:folder+'/'+width+'-'+theme+'-failed.png'}).catch(()=>{});
  }finally{await context.close()}
 }
}finally{await browser.close();await fs.writeFile(folder+'/report.json',JSON.stringify(reports,null,2))}
if(reports.some(r=>r.error||r.errors?.length))process.exitCode=1;
