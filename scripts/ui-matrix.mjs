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
 const page=await context.newPage();const row={width,theme,errors:[],screens:[],controls:{},checks:[]};results.push(row);
 page.on('pageerror',e=>row.errors.push(String(e)));
 page.on('dialog',async d=>{row.errors.push('Native dialog: '+d.type());await d.dismiss()});
 await page.goto(process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/');
 await page.waitForSelector('.tabs [data-page="capture"]');
 row.controls.firstRun=await page.locator('button:visible,input:visible,select:visible').evaluateAll(es=>es.map(e=>({id:e.id,text:e.textContent?.trim().slice(0,65),label:e.getAttribute('aria-label')})));
 await page.screenshot({path:`${dir}/${width}-${theme}-first-run.png`});
 await page.evaluate(theme=>{document.querySelector('#launchScreen')?.remove();document.querySelector('#tutorialModal').hidden=true;document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme},theme);
 await page.locator('.tabs [data-page="capture"]').click();
 await page.locator('#qc-text').fill('QA sample memo: preserved across reload. 검증용 메모');await page.locator('#qc-submit').click();
 await page.locator('.capture-recent-body').first().waitFor({state:'visible'});
 row.checks.push({name:'capture save',ok:(await page.locator('.capture-recent-body').first().innerText()).includes('QA sample memo')});
 for(const tab of ['capture','today','checkin','focus','records','settings']){
 const button=page.locator(`.tabs [data-page="${tab}"]`);if(!await button.count()){row.checks.push({name:tab+' tab exists',ok:false});continue}
 await button.click();await page.screenshot({path:`${dir}/${width}-${theme}-${tab}.png`});
 row.screens.push(tab);row.checks.push({name:tab+' overflow',ok:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)});
 row.controls[tab]=await page.locator('button:visible,input:visible,textarea:visible,select:visible,summary:visible').evaluateAll(es=>es.map(e=>({id:e.id,tag:e.tagName,type:e.type,text:e.textContent?.trim().slice(0,65),label:e.getAttribute('aria-label'),data:{...e.dataset}})));
 }
 await fs.writeFile(`${dir}/report.json`,JSON.stringify(results,null,2));await context.close();
}
}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(results,null,2));await browser.close()}
console.log(JSON.stringify(results.map(({controls,...rest})=>rest),null,2));
if(results.some(r=>r.errors.length||r.checks.some(c=>!c.ok)))process.exitCode=1;
