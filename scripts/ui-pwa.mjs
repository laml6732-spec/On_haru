import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const dir='test-results/pwa';await fs.mkdir(dir,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});const page=await context.newPage();page.setDefaultTimeout(8000);
const report={checks:[],errors:[],missing:[]};const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(r.status()===404&&r.url().startsWith(url))report.missing.push(r.url())});
try{
 await page.goto(url);await page.waitForSelector('.tabs [data-page="capture"]');await page.locator('#tutorialChooseEn').click();await page.locator('#welcomeSkip').click();
 await page.locator('#qc-text').fill('QA offline persistence');await page.locator('#qc-submit').click();await page.locator('.capture-recent-body').first().waitFor({state:'visible'});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);const manifest=await page.evaluate(async()=>await (await fetch('manifest.webmanifest')).json());report.checks.push({name:'PWA manifest and icons',ok:manifest.display==='standalone'&&manifest.icons.length===2});
 const release=await page.locator('meta[name="kona-release"]').getAttribute('content');report.release=release;const cachesList=await page.evaluate(()=>caches.keys());report.checks.push({name:'Current release cache',ok:cachesList.includes('kona-legacy-shell-'+release)});
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.tabs [data-page="capture"]');await page.locator('.tabs [data-page="capture"]').click();report.checks.push({name:'Offline shell and saved memo',ok:(await page.locator('.capture-recent-body').first().innerText()).includes('QA offline persistence')});await page.screenshot({path:dir+'/offline-390.png'});
 report.checks.push({name:'No local asset 404',ok:report.missing.length===0});
}catch(e){report.checks.push({name:'PWA flow',ok:false,details:String(e)})}finally{await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify(report,null,2));if(report.errors.length||report.checks.some(c=>!c.ok))process.exitCode=1;
