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
 const iconCorners=await page.evaluate(async icons=>{const results=[];for(const icon of icons){const bitmap=await createImageBitmap(await(await fetch(icon.src)).blob());const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const corners=[[0,0],[bitmap.width-1,0],[0,bitmap.height-1],[bitmap.width-1,bitmap.height-1]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));const transparent=corners.every(p=>p[3]===0);const opaqueNonBlack=corners.every(p=>p[3]===255&&Math.max(...p.slice(0,3))>30);results.push({src:icon.src,width:bitmap.width,height:bitmap.height,corners,cornerMode:transparent?'transparent':opaqueNonBlack?'opaque-nonblack':'mixed-or-black',ok:transparent||opaqueNonBlack});}return results;},manifest.icons);report.iconCorners=iconCorners;report.checks.push({name:'PWA icons have transparent or nonblack opaque corners',ok:iconCorners.every(i=>i.ok)});
 const release=await page.locator('meta[name="kona-release"]').getAttribute('content');report.release=release;const cachesList=await page.evaluate(()=>caches.keys());report.checks.push({name:'Current release cache',ok:cachesList.includes('kona-legacy-shell-'+release)});
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.tabs [data-page="capture"]');await page.locator('.tabs [data-page="capture"]').click();report.checks.push({name:'Offline shell and saved memo',ok:(await page.locator('.capture-recent-body').first().innerText()).includes('QA offline persistence')});await page.screenshot({path:dir+'/offline-390.png'});
 report.checks.push({name:'No local asset 404',ok:report.missing.length===0});
}catch(e){report.checks.push({name:'PWA flow',ok:false,details:String(e)})}finally{await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify(report,null,2));if(report.errors.length||report.checks.some(c=>!c.ok))process.exitCode=1;