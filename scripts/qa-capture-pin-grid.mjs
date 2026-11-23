// Current Capture tag disclosure: seven visible tags, 15 total, accessible fold.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chromium missing');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const base=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const dir=process.env.ONHARU_ARTIFACTS||'test-results/pin-grid';
await fs.mkdir(dir,{recursive:true});
const results=[];
const check=(ok,message)=>{if(!ok)throw Error(message)};
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block',reducedMotion:'reduce',locale:'en-US'});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const result={width,theme,pass:false};
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.locator('.tabs [data-page="capture"]').waitFor();
   await page.evaluate(t=>{document.getElementById('launchScreen')?.remove();const modal=document.getElementById('tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t},theme);
   await page.locator('.tabs [data-page="capture"]').click({force:true});
   const more=page.locator('#page-capture #qc-v2 .kona-tag-tray-toggle');
   const all=page.locator('#konaCaptureTagTray .kona-tag-chip');
   const visible=page.locator('#konaCaptureTagTray .kona-tag-chip:visible');
   check(await all.count()===15,'Expected 15 meaning tags');
   check(await visible.count()===7,'Default view must show seven tags');
   check(await more.getAttribute('aria-expanded')==='false','Disclosure initially expanded');
   check((await more.getAttribute('aria-label')||'').length>4,'Disclosure missing accessible name');
   const closed=await more.evaluate(e=>({label:e.textContent.trim(),height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width}));
   check(closed.label==='⌄','Collapsed disclosure label incorrect');
   check(closed.height>=35&&closed.width>=24,'Disclosure target too small');
   await more.click();
   check(await more.getAttribute('aria-expanded')==='true','Disclosure did not expand');
   check((await more.textContent()).trim()==='⌃','Expanded disclosure label incorrect');
   check(await visible.count()===15,'Expanded view must show all 15 tags');
   const geometry=await page.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const root=document.querySelector('#konaCaptureTagTray');
    const tags=[...root.querySelectorAll('.kona-tag-chip')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0);
    const button=document.querySelector('#page-capture #qc-v2 .kona-tag-tray-toggle');
    const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
    const overlaps=[];
    for(let i=0;i<tags.length;i++)for(let j=i+1;j<tags.length;j++)if(intersects(box(tags[i]),box(tags[j])))overlaps.push([i,j]);
    const toggle=box(button),blocked=tags.filter(e=>intersects(box(e),toggle)).map(e=>e.dataset.tag);
    const pin=tags.find(e=>e.dataset.tag==='meaning_remember'),r=box(pin);
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {count:tags.length,overlaps,blocked,toggle,pin:box(pin),pinClickable:hit===pin||pin.contains(hit),overflow:document.documentElement.scrollWidth-innerWidth};
   });
   check(geometry.count===15,'All tags must be displayed');
   check(!geometry.overlaps.length&&!geometry.blocked.length,'Tag or disclosure overlap: '+JSON.stringify(geometry));
   check(geometry.pinClickable,'Pin tag obscured by another control');
   check(geometry.overflow<=1,'Capture content horizontally overflows '+geometry.overflow+'px');
   const pin=page.locator('#konaCaptureTagTray .kona-tag-chip[data-tag="meaning_remember"]');
   await pin.click();
   check(await pin.getAttribute('aria-pressed')==='true','Pin tag cannot be selected');
   await page.screenshot({path:dir+'/'+width+'-'+theme+'-expanded.png',animations:'disabled'});
   await more.click();
   check(await more.getAttribute('aria-expanded')==='false','Disclosure did not collapse');
   check(await visible.count()===7,'Seven-tag default was not restored');
   check(await pin.getAttribute('aria-pressed')==='true','Selected tag state was lost on collapse');
   check(!errors.length,'Browser JavaScript errors: '+errors.join(' | '));
   result.pass=true;result.geometry=geometry;
   console.log('PASS '+width+'/'+theme+' 7↔15 tags, selection, touch geometry, no overflow');
  }catch(e){result.error=String(e);result.errors=errors;console.error('FAIL '+width+'/'+theme+' '+String(e))}
  finally{results.push(result);await ctx.close()}
 }
}finally{await browser.close()}
await fs.writeFile(dir+'/report.json',JSON.stringify(results,null,2));
if(results.some(r=>!r.pass))process.exitCode=1;