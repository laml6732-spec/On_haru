import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const url=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const folder=process.env.ONHARU_ARTIFACTS||'test-results/review-labels';
await fs.mkdir(folder,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
if(!executablePath)throw Error('Chromium unavailable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await ctx.newPage();page.setDefaultTimeout(8500);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const result={width,theme,ok:false};
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   await page.evaluate(theme=>{
    document.getElementById('launchScreen')?.remove();
    const tour=document.getElementById('tutorialModal');
    if(tour){tour.hidden=true;tour.style.display='none'}
    document.documentElement.dataset.appearance=theme;
    document.documentElement.style.colorScheme=theme;
   },theme);
   const baseline=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-reflect').click();
   const daily=await page.evaluate(()=>{
    const parent=document.querySelector('#new-reflect-page');
    if(!parent)throw Error('Daily Review root unavailable');
    const cluster=document.createElement('div');cluster.id='qa-review-provenance';cluster.style.margin='10px 0';
    const linked=document.createElement('article');linked.className='review-record review-plan-note';
    const linkLabel=document.createElement('small');linkLabel.className='review-schedule-label';linkLabel.textContent='Sample linked schedule · a longer title';
    linked.append(linkLabel);
    const personal=document.createElement('article');personal.className='review-record review-personal-note';
    const meta=document.createElement('div');meta.className='review-record-meta';
    const typeLabel=document.createElement('span');typeLabel.className='review-type-label';typeLabel.textContent='Personal note';
    meta.append(typeLabel);personal.append(meta);
    cluster.append(linked,personal);parent.append(cluster);
    const css=getComputedStyle(linkLabel),pCss=getComputedStyle(typeLabel);
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,w:r.width,y:r.y,h:r.height}};
    const before=getComputedStyle(linkLabel,'::before').content;
    const overflow=document.documentElement.scrollWidth-innerWidth;
    return{before,bg:css.backgroundColor,ink:css.color,border:css.borderLeftColor,personalBg:pCss.backgroundColor,personalInk:pCss.color,label:linkLabel.textContent,personal:typeLabel.textContent,linkedRect:rect(linkLabel),personalRect:rect(typeLabel),overflow,children:cluster.children.length};
   });
   if(!['"↳"',"'\u21B3'"].includes(daily.before))throw Error('Linked schedule direction indicator missing '+daily.before);
   if(daily.personal!=='Personal note'||!daily.label.includes('Sample linked schedule'))throw Error('Record label changed');
   if(daily.linkedRect.w<=0||daily.linkedRect.w>width||daily.overflow>1)throw Error('Daily linked badge clipped '+JSON.stringify(daily));
   if(daily.bg===daily.personalBg)throw Error('Linked and Personal labels lack visual distinction');
   if(theme==='dark'&&!daily.bg.includes('48, 72, 57'))throw Error('Dark badge background missing '+daily.bg);
   if(theme==='light'&&!daily.bg.includes('236, 243, 237'))throw Error('Light badge background missing '+daily.bg);
   result.daily=daily;
   await page.locator('#qa-review-provenance').scrollIntoViewIfNeeded();
   await page.screenshot({path:folder+'/'+width+'-'+theme+'-review-daily.png',animations:'disabled'});
   await page.locator('#rev-archive').click();
   const archive=await page.evaluate(()=>{
    const parent=document.querySelector('#archive-search-results');
    if(!parent)throw Error('Archive results root unavailable');
    const article=document.createElement('article');article.className='review-record';article.id='qa-review-archive';
    const badge=document.createElement('small');badge.className='review-schedule-label';badge.textContent='Sample archive link';
    article.append(badge);parent.append(article);
    const css=getComputedStyle(badge),rect=badge.getBoundingClientRect();
    return{before:getComputedStyle(badge,'::before').content,bg:css.backgroundColor,x:rect.x,w:rect.width,overflow:document.documentElement.scrollWidth-innerWidth};
   });
   if(archive.before!==daily.before||archive.bg!==daily.bg||archive.w<=0||archive.overflow>1)throw Error('Archive linked badge regression '+JSON.stringify(archive));
   const after=await page.evaluate(()=>localStorage.getItem('kona.legacy.v1.dayframe'));
   if(after!==baseline)throw Error('Visual inspection changed stored records');
   if(errors.length)throw Error('JS errors '+errors.join('; '));
   result.archive=archive;result.ok=true;
   console.log('PASS '+width+' '+theme+' Review linked badge and Personal label distinct, no record mutation');
  }catch(e){result.error=String(e);console.error('FAIL '+width+' '+theme+' '+e)}
  results.push(result);await ctx.close();
 }
}finally{await browser.close()}
await fs.writeFile(folder+'/report.json',JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
