#!/usr/bin/env node
// Isolated-browser smoke test: no real user profile or production data is reused.
// Run with: npm install --no-save playwright-core@1.56.1
//           ONHARU_URL=http://127.0.0.1:8080/legacy/ node scripts/ui-smoke.mjs
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const dir=process.env.ONHARU_ARTIFACTS||'test-results/onharu-ui';
await fs.mkdir(dir,{recursive:true});
const binaries=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean);
const executablePath=binaries.find(existsSync);
if(!executablePath)throw new Error('Chromium missing. Install Playwright Chromium or set CHROME_PATH.');
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={url,cases:[],pageErrors:[],artifacts:dir};
const contexts=[];
function record(name,ok,details=''){
 report.cases.push({name,ok,details:String(details)});
 console.log((ok?'PASS ':'FAIL ')+name+(details?' — '+details:''));
}
const pageContext=async width=>{
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 contexts.push(context);const page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(String(e)));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
 await page.waitForSelector('.tabs [data-page="capture"]',{timeout:20000});
 await page.evaluate(()=>{document.querySelector('#launchScreen')?.remove();const welcome=document.querySelector('#tutorialModal');if(welcome)welcome.hidden=true;});
 return page;
};
const tap=async(page,tab)=>page.locator('.tabs [data-page="'+tab+'"]').click({force:true});
const png=async(page,name)=>page.screenshot({path:dir+'/'+name+'.png',animations:'disabled'});
const rgb=x=>(x.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
const lum=x=>{const c=rgb(x).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
try{
 const page=await pageContext(390);
 await tap(page,'today');
 await page.locator('#quickAddEvent').click();
 const options=page.locator('#eventShortNameDetails');
 record('New event: short name collapsed',!(await options.evaluate(el=>el.open)));
 await png(page,'01-event-shortname-closed');
 await options.locator('summary').click();
 record('Short name expands',await options.evaluate(el=>el.open));
 await page.locator('#eventShortTitle').fill('TEST');
 record('Short-name input remains usable',await page.locator('#eventShortTitle').inputValue()==='TEST');
 await png(page,'02-event-shortname-expanded');
 await page.locator('#eventFormModal .close').click();
 await page.locator('#quickAddEvent').click();
 record('Short name resets collapsed on reopen',!(await options.evaluate(el=>el.open)));
 await page.locator('#eventFormModal .close').click();
 await tap(page,'capture');
 const toggle=page.locator('#qc-v2 .kona-tag-tray-toggle');
 const start=await toggle.boundingBox();
 await toggle.click();
 const expanded=await toggle.boundingBox();
 record('More keeps its top alignment',!!start&&!!expanded&&Math.abs(start.y-expanded.y)<4,'delta '+Math.round((expanded?.y||0)-(start?.y||0))+'px');
 await png(page,'03-capture-expanded');
 await page.evaluate(()=>{document.documentElement.dataset.appearance='dark';document.documentElement.style.colorScheme='dark'});
 await page.locator('#qc-text').fill('Dark mode note readability smoke test');
 await page.locator('#qc-submit').click();
 const memo=page.locator('#page-capture .capture-recent-body').first();
 await memo.waitFor({state:'visible',timeout:6000});
 const contrastCheck=await memo.evaluate(el=>{const ink=getComputedStyle(el).color;const card=getComputedStyle(el.closest('.capture-recent-note')).backgroundColor;return {ink,card}});
 const ratio=contrast(contrastCheck.ink,contrastCheck.card);
 record('Dark capture note contrast ≥ 4.5:1',ratio>=4.5,ratio.toFixed(2)+':1');
 await png(page,'04-dark-capture-with-note');
 await tap(page,'records');
 await png(page,'05-dark-review');
 const reviewText=await page.locator('#page-records').innerText();
 record('Saved note visible in Review',reviewText.includes('Dark mode note readability smoke test'));
 await page.evaluate(()=>{window.__onharuConfirmed=null;onHaruConfirm('Delete sample?').then(v=>window.__onharuConfirmed=v)});
 await page.locator('dialog.onharu-native-replacement .onharu-dialog-cancel').click();
 await page.waitForFunction(()=>window.__onharuConfirmed!==null);
 record('App confirmation cancel is safe',(await page.evaluate(()=>window.__onharuConfirmed))===false);
 await page.evaluate(()=>{window.__onharuPrompt='pending';onHaruPrompt('New title','old').then(v=>window.__onharuPrompt=v)});
 await page.locator('dialog.onharu-native-replacement input').fill('changed');
 await page.locator('dialog.onharu-native-replacement .onharu-dialog-accept').click();
 await page.waitForFunction(()=>window.__onharuPrompt!=='pending');
 record('App text prompt returns edit',await page.evaluate(()=>window.__onharuPrompt==='changed'));
 const narrow=await pageContext(320);
 await tap(narrow,'capture');
 await narrow.locator('#qc-v2 .kona-tag-tray-toggle').click();
 await png(narrow,'06-capture-320');
 record('320px Capture not horizontally overflowing',await narrow.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 const desktop=await pageContext(1024);await tap(desktop,'today');
 await desktop.locator('#quickAddEvent').click();
 await png(desktop,'07-event-desktop');
 record('1024px event dialog visible',await desktop.locator('#eventFormModal .sheet').isVisible());
}finally{
 await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));
 await Promise.all(contexts.map(c=>c.close()));await browser.close();
}
const errors=report.cases.filter(x=>!x.ok);
if(report.pageErrors.length)console.error('Browser exceptions:',report.pageErrors);
console.log('Result: '+(report.cases.length-errors.length)+'/'+report.cases.length+' passed; screenshots: '+dir);
if(errors.length||report.pageErrors.length)process.exitCode=1;
