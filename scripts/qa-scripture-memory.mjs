import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const base=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const out=path.resolve('test-results/scripture-memory');
fs.mkdirSync(out,{recursive:true});
const exe=process.env.CHROME_PATH||undefined;
const browser=await chromium.launch({headless:true,...(exe?{executablePath:exe}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const check=(label,condition)=>{if(!condition)throw new Error(label);};
async function sample(width,theme){
 const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme,timezoneId:'Pacific/Honolulu',isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/legacy/nlt?*',async route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Sample test passage. Do not memorize synthetic text.</p>'}));
 try{
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   await page.locator('.tabs [data-page="capture"]').waitFor({state:'visible'});
   const nav=await page.locator('.tabs button[data-page]').allTextContents();
   const norm=nav.map(x=>x.trim());
   check('Five live tabs',norm.length===5);
   check('Live tab order',JSON.stringify(norm)==JSON.stringify(['Write','Check-in','Plan','Focus','Review']));
   await page.locator('#sm-write-cue').waitFor({state:'visible'});
   check('Correct placement',await page.locator('#sm-write-cue').evaluate(e=>e.previousElementSibling?.id==='qc-v2'));
   const from=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   await page.screenshot({path:path.join(out,width+'-'+theme+'-write.png'),animations:'disabled'});
   await page.locator('#sm-write-cue').click();
   await page.locator('#sm-overlay').waitFor({state:'visible'});
   check('Focus selected after Write',await page.locator('.tabs [data-page="focus"]').evaluate(e=>e.classList.contains('active')));
   await page.locator('.sm-verse').waitFor({state:'visible'});
   check('Remote text rendered', (await page.locator('.sm-verse').allTextContents()).join(' ').includes('Sample test passage'));
   await page.screenshot({path:path.join(out,width+'-'+theme+'-read.png'),animations:'disabled'});
   await page.getByRole('button',{name:'Recall',exact:true}).click();
   check('Hidden before reveal',await page.locator('.sm-verse').count()===0);
   await page.getByRole('button',{name:'Check recall'}).click();
   await page.getByRole('button',{name:'I remembered'}).click();
   const attempt=await page.evaluate(()=>JSON.parse(localStorage.getItem('kona.scripture-memory.v1')));
   check('Attempt persisted',attempt.passages['1-corinthians-13-4-5'].attempts.length===1);
   check('Recall not automatically memorized',attempt.passages['1-corinthians-13-4-5'].status==='learning');
   await page.getByRole('button',{name:'Mark as memorized'}).click();
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kona.scripture-memory.v1')));
   check('Mark memorized persisted',saved.passages['1-corinthians-13-4-5'].status==='memorized');
   check('No journal data overwritten',await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'))===from);
   await page.locator('.sm-back').click();
   await page.locator('#sm-overlay').waitFor({state:'hidden'});
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-archive').click();
   await page.locator('#sm-library-entry').waitFor({state:'visible'});
   await page.locator('#sm-library-entry').click();
   check('Catalog 100 rows',await page.locator('.sm-list-row').count()===100);
   await page.screenshot({path:path.join(out,width+'-'+theme+'-library.png'),animations:'disabled'});
   await page.getByRole('button',{name:'Memorized',exact:true}).click();
   check('Memorized one row',await page.locator('.sm-list-row').count()===1);
   await page.getByRole('button',{name:'All',exact:true}).click();
   await page.locator('.sm-search').fill('John');
   check('Search filters',await page.locator('.sm-list-row').count()>0&&await page.locator('.sm-list-row').count()<100);
   const dims=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
   check('No viewport overflow',dims.scrollWidth<=dims.clientWidth+2);
   check('No JS errors',errors.length===0);
   results.push({width,theme,pass:true,nav:norm,errors});
 }catch(e){results.push({width,theme,pass:false,error:String(e),errors});throw e}
 finally{await context.close()}
}
try{for(const [width,theme] of [[320,'light'],[390,'dark'],[1024,'light']])await sample(width,theme)}
finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));
if(results.some(x=>!x.pass))process.exit(1);
