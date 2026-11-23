// Isolated browser QA for Write > note connection menu; never touches production data.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const out='test-results/capture-connection';
await fs.mkdir(out,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const check=(condition,message)=>{if(!condition)throw Error(message)};
try{
for(const width of [320,390,1024])for(const appearance of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(7000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
    await page.clock.setFixedTime(new Date('2026-11-21T10:15:00-10:00'));
    await page.goto(process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.tabs [data-page="capture"]');
    if(await page.locator('#tutorialChooseEn').isVisible().catch(()=>false)){
      await page.locator('#tutorialChooseEn').click();
      await page.locator('#welcomeSkip').click();
    }
    await page.evaluate(appearance=>{
      document.getElementById('launchScreen')?.remove();
      const tutorial=document.getElementById('tutorialModal');
      if(tutorial){tutorial.hidden=true;tutorial.style.display='none'}
      document.documentElement.dataset.appearance=appearance;
      document.documentElement.style.colorScheme=appearance;
    },appearance);
    await page.locator('.tabs [data-page="capture"]').click({force:true});
    // Fabricate all schedule data in a fresh browser context (never the user's account).
    await page.evaluate(()=>{
      date='2026-11-21';
      db.events=[];
      delete day(date).qcDraft;
      render();
    });
    const summary=page.locator('#captureScheduleLink>summary');
    const text=page.locator('#captureScheduleLink>summary span');
    const menu=page.locator('#captureScheduleMenu');
    check(await menu.count()===1,'Connection menu must initialize once');
    check((await text.innerText()).trim()==='Personal note','No matching event must show Personal note');
    check((await summary.locator('img').getAttribute('src'))?.endsWith('/calendar-note-personal.v1.svg')|| (await summary.locator('img').getAttribute('src'))?.endsWith('calendar-note-personal.v1.svg'),'Personal note must have the plain calendar icon');
    check(await page.locator('#qc-view').count()===0,'The redundant Open control must not exist');
    check(await page.locator('#qc-select').inputValue()==='__auto__','No matching event should preserve default automatic mode');

    await page.evaluate(()=>{
      db.events.push(
        {id:'qa-active',title:'QA Morning prayer',since:date,until:date,start:'09:00',end:'11:00',repeat:'none'},
        {id:'qa-other',title:'QA Other event very long name to check truncation on a narrow screen',since:date,until:date,start:'12:00',end:'13:00',repeat:'none'}
      );
      render();
    });
    check((await text.innerText()).trim()==='QA Morning prayer','Automatic match must display actual event title');
    check((await summary.locator('img').getAttribute('src'))?.endsWith('calendar-note-linked.v1.svg'),'Linked event must show the checked calendar icon');
    check(await page.locator('#qc-select').inputValue()==='__auto__','Auto-picked event must not be marked manual');
    await summary.click();
    check(await menu.isVisible(),'Menu must open on one click');
    check(!(await page.locator('#qc-select').isVisible()),'No nested select can remain visible');
    const menuInfo=await menu.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewport:innerWidth,options:[...el.querySelectorAll('button')].map(x=>x.textContent.trim())};
    });
    check(menuInfo.right<=width+1&&menuInfo.left>=-1,'Menu horizontally clipped: '+JSON.stringify(menuInfo));
    check(menuInfo.options.some(x=>x.includes('Personal note')),'Personal note option missing: '+JSON.stringify(menuInfo)+' HTML='+await menu.innerHTML());
    check(menuInfo.options.some(x=>x.includes('QA Morning prayer')),'Matching event option missing');
    check((await menu.getByRole('menuitemradio',{name:/Personal note/}).locator('img').getAttribute('src'))?.endsWith('calendar-note-personal.v1.svg'),'Menu personal icon must be plain');
    check((await menu.getByRole('menuitemradio',{name:/QA Morning prayer/}).locator('img').getAttribute('src'))?.endsWith('calendar-note-linked.v1.svg'),'Menu linked icon must have checkmark');
    const headerLayout=await page.evaluate(()=>{const a=document.querySelector('#captureScheduleLink>summary').getBoundingClientRect(),b=document.getElementById('qc-submit').getBoundingClientRect();return {scheduleRight:a.right,saveLeft:b.left}});
    check(headerLayout.scheduleRight<=headerLayout.saveLeft+1,'Schedule and Save controls overlap: '+JSON.stringify(headerLayout));
    await page.screenshot({path:`${out}/${width}-${appearance}-menu.png`,animations:'disabled',caret:'hide'});

    await menu.getByRole('menuitemradio',{name:/Personal note/}).click();
    check((await text.innerText()).trim()==='Personal note','Explicit no-link must show Personal note');
    check(await page.locator('#qc-select').inputValue()==='','Explicit Personal note must opt out of auto');
    check((await summary.locator('img').getAttribute('src'))?.endsWith('calendar-note-personal.v1.svg'),'Manual Personal note icon must be plain');
    await page.locator('#qc-text').fill('Draft remains private and linked explicitly');
    check(await page.locator('#qc-select').inputValue()==='','Typing cannot override explicit no-link');
    check(!(await page.locator('#qc-state-group').isVisible()),'Autosave success should not add a visible row');
    check((await page.locator('#qc-state').innerText()).trim().length>0,'Autosave must keep accessible feedback');
    await summary.click();
    await menu.getByRole('menuitemradio',{name:/Use default connection/}).click();
    check((await text.innerText()).trim()==='QA Morning prayer','Return to default should restore current schedule');
    check(await page.locator('#qc-select').inputValue()==='__auto__','Return to default must restore automatic mode');

    await summary.click();
    await menu.getByRole('menuitemradio',{name:/QA Other event/}).click();
    check((await text.innerText()).includes('QA Other event'),'Manually chosen schedule title must show');
    check(await page.locator('#qc-select').inputValue()==='qa-other','Manual schedule not selected');
    check((await summary.locator('img').getAttribute('src'))?.endsWith('calendar-note-linked.v1.svg'),'Manual event uses checked calendar');
    const persisted=await page.evaluate(()=>day(date).qcDraft);
    check(persisted?.eventId==='qa-other'&&persisted.manual===true,'Manual link must persist in draft');
    await page.locator('#qc-submit').click();
    const stored=await page.evaluate(()=>day(date).quickCaptureEntries.at(-1));
    check(stored?.scheduleId==='qa-other','Saved note did not retain user-chosen schedule');
    check(await page.locator('#qc-view').count()===0,'Open must stay removed after final save');
    check(!(await page.locator('#qc-state-group').isVisible()),'Final Saved should not create a permanent extra row');
    check((await page.locator('#toast').innerText()).trim().length>0&&await page.locator('#toast').evaluate(el=>el.classList.contains('show')),'Saving must show short, non-blocking confirmation toast');
    await page.locator('#qc-state').evaluate(el=>el.textContent='Save failed · Retry');
    await page.waitForTimeout(30);
    check(await page.locator('#qc-state-group').isVisible(),'Failed save must remain visible');
    await page.locator('#qc-state').evaluate(el=>el.textContent='');
    await page.waitForTimeout(30);
    check(!(await page.locator('#qc-state-group').isVisible()),'Cleared error should not reserve a blank row');

    await summary.click();
    await page.locator('#qc-text').click({force:true});
    check(!(await menu.isVisible()),'Outside click must close menu');
    check(errors.length===0,'Runtime errors: '+errors.join('; '));
    results.push({width,appearance,ok:true,menuInfo,savedSchedule:stored.scheduleId});
    console.log('CAPTURE_CONNECTION_PASS',width,appearance);
  }catch(error){
    results.push({width,appearance,ok:false,error:String(error),errors});
    console.error('CAPTURE_CONNECTION_FAIL',width,appearance,String(error));
    await page.screenshot({path:`${out}/${width}-${appearance}-failure.png`,animations:'disabled'}).catch(()=>{});
  }finally{await context.close()}
}
}finally{await browser.close()}
await fs.writeFile(out+'/results.json',JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
