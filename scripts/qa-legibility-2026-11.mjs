// Isolated Playwright regression: legibility changes only, no user data or real account access.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const dir=process.env.ONHARU_ARTIFACTS||'test-results/legibility';
await fs.mkdir(dir,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={release:'legibilityv120261105',configs:[],source:process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/'};
const assert=(row,name,pass,details)=>{row.tests.push({name,pass:!!pass,details});if(!pass)console.error('FAIL',row.id,name,JSON.stringify(details))};
const snapshot=async(page,row,name)=>{
 const path=dir+'/'+row.id+'-'+name+'.png';
 await page.screenshot({path,animations:'disabled',caret:'hide'});
 row.screenshots.push(path);
};
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const row={id:width+'-'+theme,tests:[],errors:[],screenshots:[]};report.configs.push(row);
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await ctx.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>row.errors.push('Page JS '+String(e)));
  page.on('dialog',async d=>{row.errors.push('Unexpected dialog '+d.type());await d.dismiss()});
  try{
   await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
   await page.goto(report.source,{waitUntil:'domcontentloaded'});
   await page.waitForSelector('.tabs [data-page="capture"]');
   assert(row,'Expected release',await page.locator('meta[name="kona-release"]').getAttribute('content')===report.release);
   await page.locator('#tutorialChooseEn').click();
   await page.locator('#welcomeSkip').click();
   await page.evaluate(theme=>{
    document.querySelector('#launchScreen')?.remove();
    const dialog=document.querySelector('#tutorialModal');if(dialog){dialog.hidden=true;dialog.style.display='none'}
    document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme;
   },theme);
   await page.locator('.tabs [data-page="capture"]').click();
   const sheep=page.locator('#page-capture button.kona-tag-chip[data-tag="meaning_listening"]');
   const sheepStyle=await sheep.evaluate(el=>{
    const bg=el.querySelector('.kona-tag-symbol'),img=el.querySelector('img.kona-sheep-icon');
    const b=getComputedStyle(bg),i=getComputedStyle(img),r=bg.getBoundingClientRect(),rI=img.getBoundingClientRect();
    return {background:b.backgroundColor,filter:i.filter,backWidth:r.width,backHeight:r.height,imgWidth:rI.width,imgHeight:rI.height};
   });
   assert(row,'Sheep original art preserved and visible',sheepStyle.imgWidth>=32&&sheepStyle.imgHeight>=32,sheepStyle);
   assert(row,'Sheep contrast filter applied',sheepStyle.filter.includes('contrast(1.28)')&&sheepStyle.filter.includes('saturate(1.16)'),sheepStyle);
   assert(row,'Sheep theme-specific background',sheepStyle.background===(theme==='light'?'rgb(238, 224, 199)':'rgb(70, 82, 70)'),sheepStyle);
   await snapshot(page,row,'write-unselected');
   await sheep.click();
   assert(row,'Sheep click remains functional',await sheep.getAttribute('aria-pressed')==='true');
   const selected=await sheep.locator('.kona-tag-symbol').evaluate(e=>{const s=getComputedStyle(e);return{borderWidth:s.borderTopWidth,borderStyle:s.borderTopStyle}});
   assert(row,'Single selected indicator remains visible',selected.borderStyle==='solid'&&parseFloat(selected.borderWidth)>=1,selected);
   await snapshot(page,row,'write-selected');
   const more=page.locator('.kona-tag-tray-toggle').first();
   if(await more.isVisible())await more.click();
   assert(row,'Write no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.locator('.tabs [data-page="records"]').click();
   await page.locator('#rev-archive').click();
   await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
   const legend=page.locator('.archive-mood-legend');
   await legend.waitFor({state:'visible'});
   const style=await legend.evaluate(e=>{
    const s=getComputedStyle(e),r=e.getBoundingClientRect();
    return{fontSize:s.fontSize,color:s.color,lineHeight:s.lineHeight,width:r.width,height:r.height,bodyScrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,text:e.innerText};
   });
   assert(row,'Archive Mood legend uses readable 12px body',Math.abs(parseFloat(style.fontSize)-12)<.2,style);
   assert(row,'Legend wraps without horizontal overflow',style.bodyScrollWidth<=width+2&&style.height<=65,style);
   assert(row,'Archive Mood legend uses shortened copy',style.text.includes('energy × mood')&&style.text.includes('Ring:'),style);
   assert(row,'Archive Mood legend theme-contrast text',
    style.color===(theme==='light'?'rgb(78, 101, 88)':'rgb(185, 203, 188)'),style);
   await snapshot(page,row,'archive-mood');
   assert(row,'Archive Mood calendar still navigable',await page.locator('.archive-mood-day').count()>=28);
  }catch(e){row.errors.push(String(e))}
  finally{await ctx.close()}
  console.log('LEGIBILITY_QA '+row.id+' '+JSON.stringify({passed:row.tests.filter(t=>t.pass).length,failed:row.tests.filter(t=>!t.pass).map(t=>t.name),errors:row.errors}));
 }
}finally{await browser.close()}
report.summary={configurations:report.configs.length,tests:report.configs.reduce((n,c)=>n+c.tests.length,0),passed:report.configs.reduce((n,c)=>n+c.tests.filter(t=>t.pass).length,0),failures:report.configs.flatMap(c=>c.tests.filter(t=>!t.pass)).length,errors:report.configs.flatMap(c=>c.errors).length};
await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));
console.log('LEGIBILITY_QA_SUMMARY '+JSON.stringify(report.summary));
if(report.summary.failures||report.summary.errors)process.exitCode=1;
