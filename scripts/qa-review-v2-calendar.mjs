import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
const base=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const out='test-results/review-v2-calendar';
await fs.mkdir(out,{recursive:true});
const chrome=[process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/google-chrome',chromium.executablePath()].find(x=>x&&existsSync(x));
if(!chrome)throw Error('Chromium not found');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report=[];
try{
for(const width of [320,390,1024])for(const theme of ['light','dark'])for(const lang of ['en','ko']){
 const ctx=await browser.newContext({viewport:{width,height:880},isMobile:width<600,hasTouch:width<600,locale:lang==='ko'?'ko-KR':'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await ctx.newPage();page.setDefaultTimeout(16000);
 const errors=[];page.on('pageerror',err=>errors.push(String(err)));
 const row={width,theme,lang};
 try{
  await page.clock.setFixedTime(new Date('2026-10-22T15:20:00-10:00'));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator(lang==='ko'?'#tutorialChooseKo':'#tutorialChooseEn').click();
  await page.locator('#welcomeSkip').click();
  await page.evaluate(theme=>{
   document.getElementById('launchScreen')?.remove();
   const tutorial=document.getElementById('tutorialModal');if(tutorial){tutorial.hidden=true;tutorial.style.display='none'}
   document.documentElement.dataset.appearance=theme;
   date='2026-10-22';calendarMonth='2026-10';
   for(const [d,e,h] of [['2026-10-20',2,4],['2026-10-21',3,4],['2026-10-22',4,2],['2026-10-23',1,2],['2026-10-24',5,4]]){
    const record=day(d);
    record.checkins.night={nightEnergy:e,nightHappiness:h,moodTime:'21:10',note:'Rating '+d};
   }
   const record=day('2026-10-22');
   db.events.push({id:'test-event',title:'Morning Class',since:'2026-10-22',until:'',repeat:'none',days:[],start:'08:00',end:'09:00'});
   record.quickCaptureEntries=[
    {id:'caplinked',title:'From class',text:'Learned something new',createdAt:'2026-10-23T00:00:00Z',time:'08:50',date:'2026-10-22',scheduleId:'test-event',scheduleTitle:'Morning Class',tags:[]},
    {id:'capunlinked',title:'Personal thought',text:'An independent note',createdAt:'2026-10-23T05:00:00Z',time:'19:00',date:'2026-10-22',scheduleId:'',scheduleTitle:'Personal note',tags:[]}
   ];
   record.sessions=[{id:'sess1',start:'14:20',seconds:120,kind:'prayer',note:'A quiet prayer',task:'Quiet prayer',eventId:''}];
   record.reflectionNotes={insight:'Reflection on the day',action:'Make a note'};
  },theme);
  await page.locator('.tabs [data-page="records"]').click();
  await page.evaluate(()=>changeDate('2026-10-22'));
  const tabs=await page.locator('#new-review-switch button').evaluateAll(xs=>xs.map(x=>x.id));
  if(tabs.join('|')!=='rev-reflect|rev-weekly|rev-archive')throw Error('Unexpected tabs: '+tabs);
  if(!await page.locator('#new-reflect-page #viewCal').isVisible())throw Error('Daily color calendar is hidden');
  const range=page.locator('#viewCal .review-calendar-range-option');
  if(await range.count()!==3)throw Error('7 days / Month / Hide options missing');
  if(await range.filter({hasText:lang==='ko'?'7일':'7 days'}).getAttribute('aria-pressed')!=='true')
    throw Error('Default view is not recent 7 days');
  const weekDates=await page.locator('#monthCalendar .daycell').evaluateAll(xs=>xs.map(x=>x.dataset.reviewDate));
  if(weekDates.length!==7 || weekDates[0]!=='2026-10-16' || weekDates[6]!=='2026-10-22')
    throw Error('Rolling 7-day window incorrect: '+weekDates);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('7 days horizontal overflow');
  await page.screenshot({path:out+'/'+width+'-'+theme+'-'+lang+'-7days.png'});
  await page.locator('#calPrev').click();
  const shifted=await page.locator('#monthCalendar .daycell').evaluateAll(xs=>xs.map(x=>x.dataset.reviewDate));
  if(shifted[0]!=='2026-10-09'||shifted[6]!=='2026-10-15')throw Error('Previous 7 days failed '+shifted);
  await page.locator('#calNext').click();
  if(await page.locator('#monthCalendar .daycell').last().getAttribute('data-review-date')!=='2026-10-22')throw Error('Next 7 days failed');
  if(await page.locator('#calendarMode').isVisible())throw Error('Entries / Mood toggle still shown');
  const day=page.locator('#monthCalendar .daycell[data-review-date="2026-10-22"]');
  if(!await day.count())throw Error('Calendar date 22 absent');
  if(!await day.evaluate(el=>el.classList.contains('onharu-mood-tone')))throw Error('25-color day not filled');
  const pair=await day.evaluate(el=>[el.dataset.moodEnergy,el.dataset.moodRating]);
  if(pair.join('/')!=='4/2')throw Error('Wrong pair '+pair);
  await range.filter({hasText:lang==='ko'?'한 달':'Month'}).click();
  const monthDates=await page.locator('#monthCalendar .daycell').evaluateAll(xs=>xs.map(x=>x.dataset.reviewDate));
  if(monthDates.length<28||!monthDates.includes('2026-10-24'))throw Error('Full month view incomplete');
  await page.screenshot({path:out+'/'+width+'-'+theme+'-'+lang+'-month.png'});
  const blank=page.locator('#monthCalendar .daycell[data-review-date="2026-10-18"]');
  if(await blank.evaluate(el=>el.classList.contains('onharu-mood-tone')))throw Error('Empty date colored');
  await range.filter({hasText:lang==='ko'?'접기':'Hide'}).click();
  if(await page.locator('#monthCalendar').isVisible() || await page.locator('#viewCal > .calendar-toolbar:not(.review-calendar-mode)').isVisible())
    throw Error('Hide does not collapse calendar');
  if(!await range.first().isVisible())throw Error('Calendar reopen controls disappeared');
  if(!await page.locator('#new-reflect-page .rv-journal-main textarea').isVisible())
    throw Error('Reflection editor not reachable when calendar hidden');
  await page.screenshot({path:out+'/'+width+'-'+theme+'-'+lang+'-hidden.png'});
  await range.filter({hasText:lang==='ko'?'7일':'7 days'}).click();
  if(await page.locator('#monthCalendar .daycell').count()!==7)throw Error('Reopen 7 days failed');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Daily horizontal overflow');
  await page.screenshot({path:out+'/'+width+'-'+theme+'-'+lang+'-daily.png'});
  await page.locator('#rev-weekly').click();
  if(!await page.locator('#new-reflect-page .rv-journal-main textarea').isVisible())throw Error('Weekly editor not available');
  const sources=page.locator('#new-reflect-page .review-weekly-source');
  if(!await sources.count())throw Error('Weekly source disclosure absent');
  if(await sources.getAttribute('open')!==null)throw Error('Weekly source expanded by default');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Weekly horizontal overflow');
  await page.screenshot({path:out+'/'+width+'-'+theme+'-'+lang+'-weekly.png'});
  await page.locator('#rev-archive').click();
  if(!await page.locator('#archive-search-input').isVisible())throw Error('Archive search hidden');
  if(await page.locator('.archive-mood-view-switch').count())throw Error('Nested Mood switcher still visible');
  const cat=await page.locator('.archive-category-option').evaluateAll(xs=>xs.map(x=>x.dataset.archiveCategory));
  if(cat.join('|')!=='all|records|practice')throw Error('Wrong categories '+cat);
  await page.locator('[data-archive-category="records"]').click();
  const link=page.locator('#archive-search-results [data-record-id="q-caplinked"]');
  const unlinked=page.locator('#archive-search-results [data-record-id="q-capunlinked"]');
  const practice=page.locator('#archive-search-results [data-record-id="s-sess1"]');
  if(!await link.count()||!await unlinked.count())throw Error('Records not showing both linked and unlinked notes');
  if(await practice.count())throw Error('Practice session leaked into Records');
  const filter=page.locator('.archive-filter-disclosure');
  await filter.locator('summary').click();
  const scheduleFilter=page.locator('.archive-filter-row select').first();
  const opts=await scheduleFilter.locator('option').evaluateAll(xs=>xs.map(x=>x.value));
  if(opts.join('|')!=='all|linked|unlinked')throw Error('Wrong schedule filter '+opts);
  await scheduleFilter.selectOption('linked');
  if(!await link.count()||await unlinked.count())throw Error('Linked filter incorrect');
  await page.locator('.archive-filter-row select').first().selectOption('unlinked');
  if(await link.count()||!await unlinked.count())throw Error('Unlinked filter incorrect');
  await page.locator('.archive-filter-row select').first().selectOption('all');
  await page.locator('[data-archive-category="practice"]').click();
  if(!await practice.count()||await link.count()||await unlinked.count())throw Error('Practice filter incorrect');
  await page.screenshot({path:out+'/'+width+'-'+theme+'-'+lang+'-archive.png'});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Archive horizontal overflow');
  if(errors.length)throw Error('Browser errors: '+errors.join(' | '));
  row.ok=true;console.log('REVIEW_V2_PASS',JSON.stringify(row));
 }catch(e){
  row.ok=false;row.error=String(e);
  console.error('REVIEW_V2_FAIL',JSON.stringify(row));
  await page.screenshot({path:out+'/'+width+'-'+theme+'-'+lang+'-FAIL.png'}).catch(()=>{});
 }finally{report.push(row);await ctx.close()}
}
}finally{await browser.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2))}
if(report.some(row=>!row.ok))process.exitCode=1;
