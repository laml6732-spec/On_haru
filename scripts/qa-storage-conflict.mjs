// Browser storage safety regression. Only isolated, synthetic records are used.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
const bin=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!bin)throw Error('Chromium is required');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const URL=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const key='kona.legacy.v1.dayframe',date='2026-11-22';
const ensure=(ok,message)=>{if(!ok)throw Error(message)};
const ctx=await browser.newContext({serviceWorkers:'block',timezoneId:'Pacific/Honolulu'});
try{
 const first=await ctx.newPage(),second=await ctx.newPage(),errors=[];
 for(const page of [first,second]){
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(URL,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof save==='function'&&typeof day==='function');
 }
 const firstWrite=await first.evaluate(d=>{day(d).headline='TAB_A_PROTECTED';return save()},date);
 ensure(firstWrite===true,'First tab failed to save');
 const staleWrite=await second.evaluate(d=>{day(d).headline='TAB_B_MUST_NOT_OVERWRITE';return save()},date);
 ensure(staleWrite===false,'Stale second tab write was not blocked');
 const diskAfterConflict=await first.evaluate(k=>JSON.parse(window.localStorage.getItem(k)).days['2026-11-22'].headline,key);
 ensure(diskAfterConflict==='TAB_A_PROTECTED','Conflicting save overwrote the original record');
 await second.reload({waitUntil:'domcontentloaded'});
 await second.waitForFunction(()=>typeof save==='function');
 ensure(await second.evaluate(d=>day(d).headline,date)==='TAB_A_PROTECTED','Reload failed to recover latest data');
 const freshWrite=await second.evaluate(d=>{day(d).headline='TAB_B_AFTER_RELOAD';return save()},date);
 ensure(freshWrite===true,'Fresh tab could not save');
 ensure(await second.evaluate(k=>JSON.parse(window.localStorage.getItem(k)).days['2026-11-22'].headline,key)==='TAB_B_AFTER_RELOAD','Fresh save was not persisted');
 await second.evaluate(k=>{const data=JSON.parse(window.localStorage.getItem(k));data.version=9999;window.localStorage.setItem(k,JSON.stringify(data))},key);
 await second.reload({waitUntil:'domcontentloaded'});
 await second.waitForFunction(()=>typeof storageRecovery!=='undefined');
 const forward=await second.evaluate(k=>({protected:storageRecovery.active,version:JSON.parse(window.localStorage.getItem(k)).version}),key);
 ensure(forward.protected&&forward.version===9999,'Future-version records were overwritten or accepted');
 ensure(!errors.length,'Unexpected page JavaScript errors: '+errors.join(' | '));
 console.log('PASS: cross-tab collision, reload recovery, future-schema preservation');
}finally{await ctx.close();await browser.close()}
