// Current compact tag tray: seven default emojis, accessible disclosure, and
// an expanded set of 15. Do not assert retired chevron artwork/pseudo-element px.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('Chromium missing');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const base=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const dir='test-results/pin-grid';await fs.mkdir(dir,{recursive:true});
const results=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block',reducedMotion:'reduce',locale:'en-US'});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.locator('.tabs [data-page="capture"]').waitFor();
   await page.evaluate(t=>{document.getElementById('launchScreen')?.remove();const tour=document.getElementById('tutorialModal');if(tour){tour.hidden=true;tour.style.display='none'}document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t},theme);
   await page.locator('.tabs [data-page="capture"]').click({force:true});
   const more=page.locator('#page-capture #qc-v2 .kona-tag-tray-toggle');
   const chips=page.locator('#konaCaptureTagTray .kona-tag-chip');
   if(await chips.count()!==15)throw Error('Expected 15 available note tags');
   if(await page.locator('#konaCaptureTagTray .kona-tag-chip:visible').count()!==7)throw Error('Seven note tags must be visible by default');
   if(await more.getAttribute('aria-expanded')!=='false')throw Error('Tag tray starts expanded');
   if(!(await more.getAttribute('aria-controls'))?.includes('konaCaptureTagTray'))throw Error('Disclosure is not connected to its tags');
   const sheep=page.locator('#konaCaptureTagTray .kona-tag-chip[data-tag="meaning_listening"]');
   const reference=chips.filter({hasNot:page.locator('.kona-sheep-icon')}).first();
   const appearance=chip=>chip.locator('.kona-tag-symbol').evaluate(el=>{
    const s=getComputedStyle(el);return {background:s.backgroundColor,borderColor:s.borderTopColor,borderWidth:s.borderTopWidth,borderStyle:s.borderTopStyle};
   });
   const resting=await appearance(sheep);
   await sheep.click();
   await reference.click();
   const selected=await appearance(sheep),expected=await appearance(reference);
   if(await sheep.getAttribute('aria-pressed')!=='true'||JSON.stringify(selected)===JSON.stringify(resting)||JSON.stringify(selected)!==JSON.stringify(expected)||selected.borderWidth!=='2px')throw Error('Listening sheep must show the same visible selected ring and background as the other tags: '+JSON.stringify({resting,selected,expected}));
   await page.screenshot({path:dir+'/'+width+'-'+theme+'-sheep-selected.png',animations:'disabled'});
   await sheep.click();
   await reference.click();
   if(await sheep.getAttribute('aria-pressed')!=='false'||JSON.stringify(await appearance(sheep))!==JSON.stringify(resting))throw Error('Listening sheep did not restore its resting appearance');
   const closed=await more.evaluate(el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON(),label:el.getAttribute('aria-label')}));
   if(!closed.label)throw Error('Disclosure has no accessible name');
   if(closed.rect.height<43.9||closed.rect.width<24)throw Error('Disclosure hit target is too small');
   await more.click();
   if(await more.getAttribute('aria-expanded')!=='true')throw Error('Disclosure did not expand');
   if(await page.locator('#konaCaptureTagTray .kona-tag-chip:visible').count()!==15)throw Error('Expanded tray does not show all 15 tags');
   const geom=await page.evaluate(()=>{
    const items=[...document.querySelectorAll('#konaCaptureTagTray .kona-tag-chip')].filter(e=>{const r=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&r.width>0&&r.height>0});
    const toggle=document.querySelector('#page-capture #qc-v2 .kona-tag-tray-toggle');
    const rect=e=>e.getBoundingClientRect(),hit=e=>{const r=rect(e),mid=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return mid===e||e.contains(mid)};
    const overlaps=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=rect(items[i]),b=rect(items[j]);if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>.4&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.4)overlaps.push([items[i].dataset.tag,items[j].dataset.tag])}
    const pin=items.find(e=>e.dataset.tag==='meaning_remember');
    const t=rect(toggle);
    return {visible:items.length,overlaps,pinVisible:!!pin&&hit(pin),toggleHit:hit(toggle),touchHeight:t.height,touchWidth:t.width,toggleOffscreen:t.left<0||t.right>innerWidth+1,overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   if(geom.visible!==15||geom.overlaps.length)throw Error('Expanded tag layout overlaps: '+JSON.stringify(geom));
   if(!geom.pinVisible||!geom.toggleHit)throw Error('Tag or disclosure cannot be tapped: '+JSON.stringify(geom));
   if(geom.touchHeight<43.9||geom.touchWidth<24||geom.toggleOffscreen||geom.overflow)throw Error('Disclosure or page overflows: '+JSON.stringify(geom));
   const pin=page.locator('#konaCaptureTagTray .kona-tag-chip[data-tag="meaning_remember"]');
   await pin.click();
   if(await pin.getAttribute('aria-pressed')!=='true')throw Error('Pin tag cannot be selected');
   await page.screenshot({path:dir+'/'+width+'-'+theme+'-expanded.png',animations:'disabled'});
   await more.click();
   if(await more.getAttribute('aria-expanded')!=='false'||await page.locator('#konaCaptureTagTray .kona-tag-chip:visible').count()!==7)throw Error('Disclosure did not return to seven tags');
   const reopened=await more.boundingBox();
   if(!reopened||reopened.height<43.9)throw Error('Collapsed disclosure lost tap target');
   if(errors.length)throw Error('Page errors: '+errors.join('; '));
   results.push({width,theme,pass:true,geom});console.log('PASS '+width+'/'+theme+' seven tags, expansion, tappability, no overlap');
  }catch(e){results.push({width,theme,pass:false,error:String(e),errors});console.error('FAIL '+width+'/'+theme+' '+e)}
  finally{await ctx.close()}
 }
}finally{await browser.close()}
await fs.writeFile(dir+'/report.json',JSON.stringify(results,null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
