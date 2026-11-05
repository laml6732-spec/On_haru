// Extended UI flows in newly-created browser contexts. No production data.
import fs from 'node:fs/promises';import {existsSync} from 'node:fs';import {chromium} from 'playwright-core';
const dir='test-results/extra';await fs.mkdir(dir,{recursive:true});const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});const report=[];
try{for(const width of [320,390,1024])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',colorScheme:theme});const page=await context.newPage();page.setDefaultTimeout(7000);const row={width,theme,checks:[],errors:[]};report.push(row);page.on('pageerror',e=>row.errors.push(String(e)));
 const test=async(name,fn)=>{try{await fn();row.checks.push({name,ok:true});console.log('PASS',width,theme,name)}catch(e){row.checks.push({name,ok:false,details:String(e)});console.log('FAIL',width,theme,name,String(e));await page.screenshot({path:`${dir}/${width}-${theme}-failure-${row.checks.length}.png`});}};
 const expect=(ok,message)=>{if(!ok)throw Error(message)};const tap=t=>page.locator(`.tabs [data-page="${t}"]`).click();
 await page.goto(process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/');await page.waitForSelector('#tutorialChooseEn');await page.locator('#tutorialChooseEn').click();
 await test('Guided practice Capture, Check-in, sliders, Task, Review and finish',async()=>{
  await page.locator('#welcomeContinue').click();await page.locator('#qc-text').fill('PRACTICE_ONLY_NOTE');await page.locator('#qc-submit').click();await page.locator('#tourNext').click();
  await page.locator('#checkNote').fill('PRACTICE_ONLY_MORNING');await page.locator('#tourNext').click();
  for(const label of ['Energy','Mood']){const slider=page.getByRole('slider',{name:label,exact:true});await slider.focus();await slider.press('ArrowRight');await slider.press('Tab')}
  await page.locator('#tourNext').click();await page.locator('#pinRow .task-add').click();await page.locator('#taskTitle').fill('PRACTICE_ONLY_TASK');await page.locator('#taskSave').click();await page.locator('#tourNext').click();await page.locator('#tourNext').click();await page.locator('#tourNext').click();await page.locator('#tourNext').click();
  expect(await page.locator('#guidedTour').isHidden(),'guide still open');expect(!await page.evaluate(()=>Object.keys(window.localStorage).some(k=>String(window.localStorage.getItem(k)).includes('PRACTICE_ONLY_'))),'practice leaked to storage');
 });
 // Independent recovery via the UI so a guided failure doesn't imply prayer failure.
 if(await page.locator('#tourExit').isVisible())await page.locator('#tourExit').click();if(await page.locator('#welcomeSkip').isVisible())await page.locator('#welcomeSkip').click();
 await test('Capture title, emoji More/Less and saved tags',async()=>{
  await tap('capture');await page.locator('#qc-note-title').fill('QA titled note');await page.locator('#qc-text').fill('QA tagged body');await page.locator('#qc-v2 [data-tag="meaning_scripture"]').click();await page.locator('#qc-v2 .kona-tag-tray-toggle').click();await page.locator('#qc-v2 .kona-tag-tray-toggle').click();await page.locator('#qc-submit').click();expect((await page.locator('.capture-recent-note').first().innerText()).includes('QA titled note'),'title missing');
 });
 await test('Prayer add, log, edit and safe delete cancellation',async()=>{
  await tap('focus');await page.locator('#kindSeg [data-kind="prayer"]').click();await page.locator('#focusLibraryOpen').click();await page.locator('#togglePrayerAdd').click();await page.locator('.prayer-add input').fill('QA Prayer request');await page.locator('.prayer-add button').click();
  let item=page.locator('.prayer-item').filter({hasText:'QA Prayer request'});await item.getByRole('button',{name:'Mark prayed today',exact:true}).click();
  await item.getByRole('button',{name:'Prayer request options',exact:true}).click();await page.locator('#choiceList button').filter({hasText:'Edit title'}).click();await page.locator('dialog.onharu-native-replacement input').fill('QA Prayer edited');await page.locator('.onharu-dialog-accept').click();
  item=page.locator('.prayer-item').filter({hasText:'QA Prayer edited'});expect(await item.count()>0,'edited prayer missing');await item.getByRole('button',{name:'Prayer request options',exact:true}).click();await page.locator('#choiceList button').filter({hasText:'Delete request'}).click();await page.locator('.onharu-dialog-cancel').click();expect(await item.count()>0,'delete cancellation failed');await page.locator('#focusLibraryModal .close').click();
 });
 await test('Devotion scripture prompt',async()=>{
  await tap('focus');await page.locator('#kindSeg [data-kind="devotion"]').click();await page.locator('#focusLibraryOpen').click();await page.locator('#focusLibraryList').getByRole('button',{name:'Set Scripture or devotion topic',exact:true}).click();await page.locator('dialog.onharu-native-replacement input').fill('John 10:27');await page.locator('.onharu-dialog-accept').click();expect((await page.locator('#page-focus').innerText()).includes('John 10:27'),'devotion context missing');
 });

 await test('Recurring event category and whole-series edit scope',async()=>{
  await tap('today');await page.locator('#quickAddEvent').click();await page.locator('#eventTitle').fill('QA recurring');await page.locator('#eventStart').fill('21:00');await page.locator('#eventEnd').fill('21:30');await page.locator('#eventRepeatChips button').filter({hasText:'Daily'}).click();await page.locator('#eventSince').fill('2026-11-03');await page.locator('#catChips button').filter({hasText:'Personal time'}).click();await page.locator('#eventSave').click();
  await page.locator('.app-settings-shortcut').click();await page.waitForTimeout(150);await page.locator('#kx-settings').getByRole('button',{name:'Daily routines',exact:true}).click();await page.locator('#eventManageList').getByRole('button',{name:'Edit QA recurring',exact:true}).click();await page.locator('#choiceList button').filter({hasText:'Edit recurring event'}).click();await page.locator('#eventTitle').fill('QA recurring edited');await page.locator('#eventSave').click();await page.locator('#choiceList button').filter({hasText:'Entire recurring series'}).click();expect(await page.evaluate(()=>JSON.parse(window.localStorage.getItem('kona.legacy.v1.dayframe')).events.some(e=>e.title==='QA recurring edited'&&e.repeat==='daily'&&e.category==='personal')),'series edit not persisted');
 });
 await test('Task edit preserves identity',async()=>{
  await tap('today');await page.locator('#pinRow .task-add').click();await page.locator('#taskTitle').fill('QA editable task');await page.locator('#taskSave').click();await page.locator('.app-settings-shortcut').click();await page.waitForTimeout(150);await page.locator('#kx-settings').getByRole('button',{name:'Daily routines',exact:true}).click();await page.locator('[data-schedulesub="tasks"]').click();await page.locator('#taskManageList .record-item').filter({hasText:'QA editable task'}).click();await page.locator('#taskTitle').fill('QA edited task');await page.locator('#taskSave').click();expect(await page.evaluate(()=>JSON.parse(window.localStorage.getItem('kona.legacy.v1.dayframe')).tasks.some(t=>t.title==='QA edited task')),'task edit not persisted');
 });
 await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await context.close();
}}finally{await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close()}
if(report.some(r=>r.errors.length||r.checks.some(c=>!c.ok)))process.exitCode=1;
