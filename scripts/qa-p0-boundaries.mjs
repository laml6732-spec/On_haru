// P0 boundary tests for On_HARU. Synthetic data, isolated Chromium profile; never modifies the live origin.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';

const OUT='test-results/p0-boundaries';
await fs.mkdir(OUT,{recursive:true});
const binary=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!binary)throw new Error('Chromium not installed');
const browser=await chromium.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const URL=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const KEY='kona.legacy.v1.dayframe';
const DATE='2026-11-21';
const assert=(v,message)=>{if(!v)throw Error(message)};
const test=async(name,action)=>{
  try{await action();results.push({name,ok:true});console.log('PASS',name)}
  catch(e){results.push({name,ok:false,error:String(e)});console.error('FAIL',name,String(e))}
};
const context=await browser.newContext({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,
  locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',acceptDownloads:true,reducedMotion:'reduce'
});
const page=await context.newPage();
page.setDefaultTimeout(6500);
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.clock.setFixedTime(new Date('2026-11-21T10:15:00-10:00'));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  if(await page.locator('#tutorialChooseEn').isVisible().catch(()=>false))await page.locator('#tutorialChooseEn').click();
  if(await page.locator('#welcomeSkip').isVisible().catch(()=>false))await page.locator('#welcomeSkip').click();
  await page.evaluate(()=>{
    document.getElementById('launchScreen')?.remove();
    const t=document.getElementById('tutorialModal');if(t){t.hidden=true;t.style.display='none'}
    const w=document.getElementById('welcomeModal');if(w){w.hidden=true;w.style.display='none'}
    changeDate('2026-11-21');
    nav('capture');
    db.events=[];
    delete day('2026-11-21').qcDraft;
    save();render();
  });

  await test('C-04/C-15/E-13: explicit Personal note survives creation of a new schedule',async()=>{
    assert(await page.locator('#qc-select').inputValue()==='__auto__','Empty event list should default to auto mode');
    await page.locator('#captureScheduleLink > summary').click();
    await page.locator('#captureScheduleMenu').getByRole('menuitemradio',{name:/Personal note/}).click();
    assert(await page.locator('#qc-select').inputValue()==='','Explicit unlink should set empty manual selection');
    await page.locator('#qc-text').fill('QA PERSONAL UNLINK NOTE');
    await page.evaluate(()=>{
      db.events.push({id:'qa-new-event',title:'QA New schedule',since:'2026-11-21',until:'2026-11-21',start:'09:00',end:'11:00',repeat:'none'});
      save();render();
    });
    assert(await page.locator('#qc-select').inputValue()==='','New schedule silently restored auto linking');
    assert((await page.locator('#captureScheduleLink > summary').innerText()).includes('Personal note'),'Personal note label disappeared');
    await page.locator('#qc-submit').click();
    const row=await page.evaluate(()=>day('2026-11-21').quickCaptureEntries.at(-1));
    assert(row?.text==='QA PERSONAL UNLINK NOTE'&&row.scheduleId==='','Explicitly unlinked memo was connected or lost');
    await page.screenshot({path:OUT+'/personal-remains-unlinked.png',animations:'disabled'});
  });
  await test('C-03/C-16/E-01: automatic and manual schedule IDs persist in saved notes',async()=>{
    await page.locator('#qc-text').fill('QA AUTO NOTE');
    assert(await page.locator('#qc-select').inputValue()==='__auto__','New note should default to auto');
    assert((await page.locator('#captureScheduleLink > summary').innerText()).includes('QA New schedule'),'Auto match omitted active event');
    await page.locator('#qc-submit').click();
    let row=await page.evaluate(()=>day('2026-11-21').quickCaptureEntries.at(-1));
    assert(row?.scheduleId==='qa-new-event','Auto event ID not persisted');
    await page.evaluate(()=>{
      db.events.push({id:'qa-other',title:'QA Other schedule',since:'2026-11-21',until:'2026-11-21',start:'12:00',end:'13:00',repeat:'none'});
      save();render();
    });
    await page.locator('#captureScheduleLink > summary').click();
    await page.locator('#captureScheduleMenu').getByRole('menuitemradio',{name:/QA Other schedule/}).click();
    await page.locator('#qc-text').fill('QA MANUAL NOTE');
    const draft=await page.evaluate(()=>day('2026-11-21').qcDraft);
    assert(draft?.manual===true&&draft.eventId==='qa-other','Manual draft association lost');
    await page.locator('#qc-submit').click();
    row=await page.evaluate(()=>day('2026-11-21').quickCaptureEntries.at(-1));
    assert(row?.scheduleId==='qa-other','Manual saved schedule ID lost');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof day==='function');
    const restored=await page.evaluate(()=>day('2026-11-21').quickCaptureEntries);
    assert(restored.some(x=>x.text==='QA MANUAL NOTE'&&x.scheduleId==='qa-other'),'Reload lost manual link');
    assert(restored.some(x=>x.text==='QA PERSONAL UNLINK NOTE'&&x.scheduleId===''),'Reload linked Personal note');
  });
  await test('D-14: malformed JSON and missing backup structure do not mutate saved data',async()=>{
    const prior=await page.evaluate(k=>window.localStorage.getItem(k),KEY);
    assert(typeof prior==='string'&&prior.includes('QA PERSONAL UNLINK NOTE'),'Baseline journal was not stored');
    for(const [name,body] of [['malformed','{not json'],['missing-fields','{}']]){
      await page.locator('#restoreFile').setInputFiles({name:name+'.json',mimeType:'application/json',buffer:Buffer.from(body)});
      await page.waitForTimeout(350);
      const after=await page.evaluate(k=>window.localStorage.getItem(k),KEY);
      assert(after===prior,name+' unexpectedly modified records');
    }
  });
  await test('D-08/D-14: restoring future-version backup is refused even after user confirmation',async()=>{
    const original=await page.evaluate(k=>window.localStorage.getItem(k),KEY);
    assert(typeof original==='string','No baseline backup data');
    const future=JSON.parse(original);future.version=99999;
    await page.locator('#restoreFile').setInputFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(future))});
    const dialog=page.locator('.onharu-native-replacement .onharu-dialog-accept');
    await dialog.waitFor({state:'visible'});
    await dialog.click();
    await page.waitForTimeout(350);
    assert(await page.evaluate(k=>window.localStorage.getItem(k),KEY)===original,'Future-version import overwrote original records');
  });
  await test('D-07/C-01: denied Capture save preserves text and prior storage, then retries',async()=>{
    await page.evaluate(()=>{document.getElementById('launchScreen')?.remove();nav('capture');changeDate('2026-11-21')});
    await page.locator('#qc-text').fill('QA QUOTA RETRY NOTE');
    const prior=await page.evaluate(k=>window.localStorage.getItem(k),KEY);
    await page.evaluate(k=>{
      window.__qaSetItemOriginal=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,val){if(key===k)throw new DOMException('Synthetic full disk','QuotaExceededError');return window.__qaSetItemOriginal.call(this,key,val)};
    },KEY);
    try{
      await page.locator('#qc-submit').click();
      assert(await page.locator('#qc-text').inputValue()==='QA QUOTA RETRY NOTE','Failed save erased Capture text');
      assert(await page.evaluate(k=>window.localStorage.getItem(k),KEY)===prior,'Failed save mutated persisted records');
      assert((await page.locator('#qc-state').innerText()).toLowerCase().includes('not saved'),'Failed save falsely announced success');
    }finally{
      await page.evaluate(()=>{if(window.__qaSetItemOriginal){Storage.prototype.setItem=window.__qaSetItemOriginal;delete window.__qaSetItemOriginal}});
    }
    await page.locator('#qc-submit').click();
    const stored=await page.evaluate(()=>day('2026-11-21').quickCaptureEntries);
    assert(stored.some(x=>x.text==='QA QUOTA RETRY NOTE'),'Retry failed to save the retained note');
  });
  await test('N-01/N-02: Capture to Daily Review retains the explicitly selected date',async()=>{
    await page.evaluate(()=>{changeDate('2026-11-21');nav('capture')});
    await page.locator('.tabs [data-page="records"]').click();
    assert(await page.evaluate(()=>date)==='2026-11-21','Review silently changed the selected date');
    assert((await page.locator('#page-records').innerText()).includes('QA QUOTA RETRY NOTE'),'Daily Review omitted previously stored selected-day note');
  });
  await test('A-12: no unexpected JavaScript exceptions',async()=>assert(errors.length===0,errors.join('; ')));
}finally{
  await fs.writeFile(OUT+'/results.json',JSON.stringify({source:URL,checks:results,errors},null,2));
  await page.screenshot({path:OUT+'/final-state.png',animations:'disabled'}).catch(()=>{});
  await context.close();await browser.close();
}
if(results.some(x=>!x.ok))process.exitCode=1;
