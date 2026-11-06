import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('Chromium missing');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const base=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const dir='test-results/pin-grid';
await fs.mkdir(dir,{recursive:true});
const results=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block',reducedMotion:'reduce',locale:'en-US'});
  const page=await ctx.newPage(), errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.locator('.tabs [data-page="capture"]').waitFor();
   await page.evaluate(theme=>{
    document.getElementById('launchScreen')?.remove();
    const tour=document.getElementById('tutorialModal');if(tour){tour.hidden=true;tour.style.display='none'}
    document.documentElement.dataset.appearance=theme;
    document.documentElement.style.colorScheme=theme;
   },theme);
   await page.locator('.tabs [data-page="capture"]').click({force:true});
   const more=page.locator('#page-capture #qc-v2 .kona-tag-tray-toggle');
   const tags=page.locator('#konaCaptureTagTray .kona-tag-chip');
   if(await tags.count()!==15)throw Error('Expected 15 tags');
   const collapsed=await page.locator('#konaCaptureTagTray .kona-tag-chip:visible').count();
   if(collapsed!==7)throw Error('Expected seven collapsed tags, got '+collapsed);
   await more.click();
   if(await more.getAttribute('aria-expanded')!=='true')throw Error('More did not expand');
   const data=await page.evaluate(()=>{
    const items=[...document.querySelectorAll('#konaCaptureTagTray .kona-tag-chip')], more=document.querySelector('#page-capture #qc-v2 .kona-tag-tray-toggle');
    const box=el=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const intersect=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.4&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.4;
    const visible=items.filter(el=>getComputedStyle(el).display!=='none'&&box(el).width>0);
    const overlaps=[];
    for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++)if(intersect(box(visible[i]),box(visible[j])))overlaps.push([visible[i].dataset.tag,visible[j].dataset.tag]);
    const btn=box(more), pinEl=items.find(el=>el.dataset.tag==='meaning_remember'), sheepEl=items.find(el=>el.dataset.tag==='meaning_listening');
    const pin=box(pinEl), sheep=box(sheepEl), computed=getComputedStyle(pinEl);
    const centers=items.slice(0,7).map(el=>{const r=box(el);return r.left+r.width/2});
    const spacing=centers.slice(1).map((v,i)=>v-centers[i]);
    const pitch=spacing.reduce((acc,v)=>acc+v,0)/spacing.length;
    const buttonCenterX=(btn.left+btn.right)/2, sheepCenterX=(sheep.left+sheep.right)/2;
    const buttonCenterY=(btn.top+btn.bottom)/2, sheepCenterY=(sheep.top+sheep.bottom)/2;
    const alignment={sheepToButtonGap:btn.left-sheep.right,centerPitchError:Math.abs(buttonCenterX-(sheepCenterX+pitch)),verticalCenterError:Math.abs(buttonCenterY-sheepCenterY),pitch};
    const blocked=visible.filter(el=>intersect(box(el),btn)).map(el=>el.dataset.tag);
    const center=el=>{const r=box(el);return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)};
    return{visibleCount:visible.length,overlaps,blocked,button:btn,pin,sheep,alignment,pinDisplay:computed.display,pinGridRow:computed.gridRowStart,pinGridColumn:computed.gridColumnStart,pinHit:center(pinEl)===pinEl||pinEl.contains(center(pinEl)),moreHit:center(more)===more||more.contains(center(more)),scrollOverflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   if(data.visibleCount!==15)throw Error('Expanded tag count '+data.visibleCount);
   if(data.pinDisplay==='none'||data.pinGridRow!=='2'||data.pinGridColumn!=='2')throw Error('Pin not in row 2 / column 2');
   if(data.pin.width<=0||data.pin.height<=0||!data.pinHit)throw Error('Pin not visible / clickable');
   if(data.button.width<44||data.button.height<44||!data.moreHit)throw Error('More touch target regression');
   if(data.blocked.length||data.overlaps.length)throw Error('Overlapping targets: '+JSON.stringify({blocked:data.blocked,overlaps:data.overlaps}));
   if(data.scrollOverflow)throw Error('Horizontal overflow');
   if(data.alignment.sheepToButtonGap<1.5||data.alignment.sheepToButtonGap>14)throw Error('Toggle gap not aligned: '+JSON.stringify(data.alignment));
   if(data.alignment.centerPitchError>10||data.alignment.verticalCenterError>3)throw Error('Toggle not on same emoji grid: '+JSON.stringify(data.alignment));
   await page.locator('#konaCaptureTagTray .kona-tag-chip[data-tag="meaning_remember"]').click();
   if(await page.locator('#konaCaptureTagTray .kona-tag-chip[data-tag="meaning_remember"]').getAttribute('aria-pressed')!=='true')throw Error('Pin tag cannot be selected');
   await page.screenshot({path:dir+'/'+width+'-'+theme+'-expanded.png',animations:'disabled'});
   await more.click();
   if(await more.getAttribute('aria-expanded')!=='false')throw Error('Less did not collapse');
   results.push({width,theme,pass:!errors.length,errors,geom:data});
   console.log('PASS '+width+'/'+theme+' pin visible, selectable, no overlaps');
  }catch(e){results.push({width,theme,pass:false,error:String(e),errors});console.error('FAIL '+width+'/'+theme+' '+e)}
  finally{await ctx.close()}
 }
}finally{await browser.close()}
await fs.writeFile(dir+'/report.json',JSON.stringify(results,null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
