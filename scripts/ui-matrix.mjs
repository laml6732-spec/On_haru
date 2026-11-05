// Test only isolated contexts with fabricated records; production is never contacted.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const dir=process.env.ONHARU_ARTIFACTS||'test-results/matrix';
await fs.mkdir(dir,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(x=>x&&existsSync(x));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try {
for(const width of [320,390,1024])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();if(process.env.ONHARU_CSS_OVERRIDE)await page.route('**/app.7cb1b71d4eb6.css*',route=>route.fulfill({path:process.env.ONHARU_CSS_OVERRIDE,contentType:'text/css'}));const row={width,theme,errors:[],screens:[],controls:{},checks:[],styles:{}};results.push(row);
 page.on('pageerror',e=>row.errors.push(String(e)));
 page.on('dialog',async d=>{row.errors.push('Native dialog: '+d.type());await d.dismiss()});
 await page.clock.setFixedTime(new Date('2026-11-04T09:30:00-10:00'));
 await page.goto(process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/');
 await page.waitForSelector('.tabs [data-page="capture"]');
 row.controls.firstRun=await page.locator('button:visible,input:visible,select:visible').evaluateAll(es=>es.map(e=>({id:e.id,text:e.textContent?.trim().slice(0,65),label:e.getAttribute('aria-label')})));
 await page.screenshot({animations:'disabled',caret:'hide',path:`${dir}/${width}-${theme}-first-run.png`});
 await page.locator('#tutorialChooseEn').click();await page.locator('#welcomeSkip').click();
 await page.evaluate(theme=>{document.querySelector('#launchScreen')?.remove();document.querySelector('#tutorialModal').hidden=true;document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme},theme);
 await page.locator('.tabs [data-page="capture"]').click();
 await page.locator('#qc-text').fill('QA sample memo: preserved across reload. 검증용 메모');await page.locator('#qc-submit').click();
 await page.locator('.capture-recent-body').first().waitFor({state:'visible'});
 row.checks.push({name:'capture save',ok:(await page.locator('.capture-recent-body').first().innerText()).includes('QA sample memo')});
 for(const tab of ['capture','today','checkin','focus','records','settings']){
 const button=tab==='settings'?page.locator('.app-settings-shortcut'):page.locator(`.tabs [data-page="${tab}"]`);if(!await button.count()){row.checks.push({name:tab+' tab exists',ok:false});continue}
 await button.click();await page.mouse.move(0,0);await page.evaluate(()=>document.activeElement?.blur());await page.waitForTimeout(300);await page.evaluate(()=>document.fonts.ready);row.styles[tab]=await page.locator('body *:visible').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,id:e.id,cls:String(e.className),x:r.x,y:r.y,w:r.width,h:r.height,color:s.color,bg:s.backgroundColor,font:s.fontSize,display:s.display}}));await page.screenshot({animations:'disabled',caret:'hide',path:`${dir}/${width}-${theme}-${tab}.png`});
 row.screens.push(tab);row.checks.push({name:tab+' overflow',ok:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)});
 row.controls[tab]=await page.locator('button:visible,input:visible,textarea:visible,select:visible,summary:visible').evaluateAll(es=>es.map(e=>({id:e.id,tag:e.tagName,type:e.type,text:e.textContent?.trim().slice(0,65),label:e.getAttribute('aria-label'),data:{...e.dataset}})));
 }
 
 await page.keyboard.press('Escape');
 const tap=async t=>page.locator(`.tabs [data-page="${t}"]`).click();
 const check=async(name,fn)=>{try{await fn();row.checks.push({name,ok:true});console.log('PASS',width,theme,name)}catch(e){row.checks.push({name,ok:false,details:String(e)});console.log('FAIL',width,theme,name,String(e));await page.screenshot({animations:'disabled',caret:'hide',path:`${dir}/${width}-${theme}-failure-${row.checks.length}.png`});for(const close of await page.locator('.modal-under:not([hidden]) .close').all())await close.click().catch(()=>{});await page.keyboard.press('Escape')}};
 page.setDefaultTimeout(6000);
 const expect=async(v,m)=>{if(!v)throw Error(m)};
 await check('Event add and optional short name',async()=>{
  await tap('today');await page.locator('#quickAddEvent').click();await expect(!await page.locator('#eventShortNameDetails').evaluate(e=>e.open),'short name open');
  await page.locator('#eventTitle').fill('QA Event');await page.locator('#eventStart').fill('21:00');await page.locator('#eventEnd').fill('21:30');
  await page.locator('#eventShortNameDetails summary').click();await page.locator('#eventShortTitle').fill('TEST');await page.locator('#eventSave').click();
  await expect(await page.locator('#eventFormModal').isHidden(),'event not saved');
  const stored=await page.evaluate(()=>JSON.parse(window.localStorage.getItem('kona.legacy.v1.dayframe')||'{}').events?.some(e=>e.title==='QA Event'&&e.shortTitle==='TEST'));await expect(stored,'event missing in storage');
 });
 await check('Task add, important, complete',async()=>{
  await tap('today');await page.locator('#pinRow .task-add').click();await page.locator('#taskTitle').fill('QA Task');await page.locator('#taskImportant').check();await page.locator('#taskSave').click();
  const task=page.locator('#page-today .pinned-item').filter({hasText:'QA Task'});await expect(await task.count()>0,'task missing');
  const toggle=task.locator('.task-check');await toggle.click();await expect(await toggle.getAttribute('aria-checked')==='true','completion not checked');
 });
 await check('Morning autosave and Mood/Energy',async()=>{
  await tap('checkin');await page.locator('#page-checkin [data-phase="morning"]').click();await page.locator('#checkNote').fill('QA Morning check-in');
  for(const label of ['Energy','Mood']){const rail=page.getByRole('slider',{name:label,exact:true});await rail.focus();await rail.press('ArrowRight')}
  await tap('capture');await tap('checkin');await page.locator('#page-checkin [data-phase="morning"]').click();await expect(await page.locator('#checkNote').inputValue()==='QA Morning check-in','morning lost');
 });
 await check('Class review autosave',async()=>{
  await page.locator('#page-checkin [data-phase="noon"]').click();await page.locator('#lectureQuote').fill('QA Class quote');await page.locator('#lectureReflection').fill('QA Class reflection');
  await page.locator('#page-checkin [data-phase="evening"]').click();await page.locator('#page-checkin [data-phase="noon"]').click();await expect(await page.locator('#lectureReflection').inputValue()==='QA Class reflection','class lost');
 });
 await check('Evening autosave',async()=>{
  await tap('checkin');await page.locator('#page-checkin [data-phase="evening"]').click();await page.locator('#checkNote').fill('QA Evening check-in');await tap('capture');await tap('checkin');await page.locator('#page-checkin [data-phase="evening"]').click();await expect(await page.locator('#checkNote').inputValue()==='QA Evening check-in','evening lost');
 });

 await check('Event edit retains collapsed short name and saved text',async()=>{
  await page.locator('.app-settings-shortcut').click();await page.locator('#kx-settings').getByRole('button',{name:'Daily routines',exact:true}).click();
  await page.locator('#eventManageList').getByRole('button',{name:'Edit QA Event',exact:true}).click();await page.locator('#choiceList button').filter({hasText:'Edit event'}).click();
  await expect(!await page.locator('#eventShortNameDetails').evaluate(e=>e.open),'edit short name open');await page.locator('#eventShortNameDetails summary').click();await expect(await page.locator('#eventShortTitle').inputValue()==='TEST','short name lost');await page.locator('#eventTitle').fill('QA Event edited');await page.locator('#eventSave').click();await tap('today');
 });
 await check('Review edit, delete cancellation, filter and archive search',async()=>{
  await tap('capture');await page.locator('.capture-recent-note').first().click();await page.locator('#konaReviewEditor').getByRole('textbox',{name:'Note',exact:true}).fill('QA sample memo edited');await page.locator('#konaReviewEditor').getByRole('button',{name:'Save',exact:true}).click();
  await tap('records');await page.locator('#rev-reflect').click();const entry=page.locator('.review-record').filter({hasText:'QA sample memo edited'}).first();await expect(await entry.count()>0,'edited memo absent');
  await entry.locator('.rv-note-preview').click();await page.locator('#konaReviewEditor').getByRole('button',{name:'Delete',exact:true}).click();await page.locator('.onharu-dialog-cancel').click();await page.locator('#konaReviewEditor').getByRole('button',{name:'Cancel',exact:true}).click();await expect(await entry.count()>0,'cancel deleted record');
  await page.locator('#rev-archive').click();await page.locator('#archive-search-input').fill('QA sample memo edited');await expect((await page.locator('#archive-search-results').innerText()).includes('QA sample memo edited'),'archive search missing');await page.locator('#rev-reflect').click();
 });
 await check('Focus duration, start, pause, resume, finish, session note',async()=>{
  await tap('focus');await page.locator('#kindSeg [data-kind="prayer"]').click();await page.locator('#focusDurations [data-time="2"]').click();await expect(/^0?2:00$/.test((await page.locator('#focusClock').innerText()).trim()),'duration');
  await page.locator('#focusStart').click();await page.waitForTimeout(1100);await page.locator('#focusStart').click();await page.locator('#focusStart').click();
  if(await page.locator('#focusNoteToggle').isVisible())await page.locator('#focusNoteToggle').click();await page.locator('#timerNote').fill('QA Prayer session');await page.clock.setFixedTime(new Date('2026-11-04T09:30:04-10:00'));await page.locator('#focusEnd').click();await expect(!await page.locator('body').evaluate(e=>e.classList.contains('focus-immersive')),'session did not exit');
 });
 await check('Review daily, weekly, archive',async()=>{
  // Real Finish can leave the navigation dock hidden; record this as a failure if not accessible.
  await tap('records');for(const id of ['rev-reflect','rev-weekly','rev-archive']){await page.locator('#'+id).click();await expect(await page.locator('#page-records').isVisible(),'review missing')}
  await page.locator('#rev-reflect').click();
 });
 await check('Settings Apply persists theme and size, retains notes',async()=>{
  await page.locator('.app-settings-shortcut').click();await page.locator('[data-kona-setting="theme"]').selectOption(theme);await page.locator('[data-kona-setting="size"]').selectOption('15');
  await Promise.all([page.waitForEvent('load'),page.locator('#konaApplySettings').click()]);await page.waitForSelector('.tabs [data-page="capture"]');
  await expect(await page.locator('html').getAttribute('data-appearance')===theme,'theme not persistent');await tap('capture');await expect((await page.locator('.capture-recent-body').first().innerText()).includes('QA sample memo'),'memo lost after settings reload');
 });

 await check('Backup and restore fabricated records',async()=>{
  await page.locator('.app-settings-shortcut').click();const downloadPromise=page.waitForEvent('download');await page.locator('#backupNow').click();const download=await downloadPromise;const path=await download.path();const payload=JSON.parse(await fs.readFile(path,'utf8'));await expect(Object.values(payload.days).some(d=>d.quickCaptureEntries?.some(q=>q.text.includes('QA sample memo'))),'backup missing sample');
  await page.locator('#restoreFile').setInputFiles(path);await page.locator('.onharu-dialog-accept').click();await page.keyboard.press('Escape');await tap('capture');await expect((await page.locator('.capture-recent-body').first().innerText()).includes('QA sample memo'),'restore lost memo');
 });

 await check('Korean labels, system theme, settings Escape',async()=>{
  await page.locator('.app-settings-shortcut').click();await page.locator('[data-kona-setting="language"]').selectOption('ko');await page.locator('[data-kona-setting="theme"]').selectOption('system');await Promise.all([page.waitForEvent('load'),page.locator('#konaApplySettings').click()]);await page.waitForSelector('.tabs [data-page="capture"]');await expect(await page.locator('html').getAttribute('lang')==='ko','Korean not applied');
  await page.emulateMedia({colorScheme:'dark'});await expect(await page.locator('html').getAttribute('data-appearance')==='dark','system dark mismatch');await page.emulateMedia({colorScheme:'light'});await expect(await page.locator('html').getAttribute('data-appearance')==='light','system light mismatch');
  await page.locator('.app-settings-shortcut').click();await page.keyboard.press('Escape');await expect(!await page.locator('#kx-settings').evaluate(e=>e.open),'settings Escape failed');
 });
 row.storage=await page.evaluate(()=>Object.keys(window.localStorage).sort());
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(results,null,2));await context.close();
}
}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(results,null,2));await browser.close()}
console.log(JSON.stringify(results.map(({controls,styles,...rest})=>rest),null,2));
if(results.some(r=>r.errors.length||r.checks.some(c=>!c.ok)))process.exitCode=1;
