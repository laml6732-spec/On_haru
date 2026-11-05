// Theme-aware 25-pair Mood regression test: isolated, fabricated local records only.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
const dir=process.env.ONHARU_ARTIFACTS||'test-results/review-mood-palette';
await fs.mkdir(dir,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const output={base:process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/',release:'moodpalettev120261105',cases:[]};
const colors={light:{morning:'#C7E2D5',evening:'#EECFCE',text:'rgb(40, 60, 57)'},dark:{morning:'#3C796F',evening:'#815E70',text:'rgb(255, 255, 255)'}};
const rgb=h=>'rgb('+[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)).join(', ')+')';
const fixture=()=>{
 date='2026-11-04';
 const v=day(date);v.checkins.morning={moodTime:'08:46',morningEnergy:2,morningHappiness:4,note:'Morning thought'};
 v.checkins.evening={moodTime:'20:37',eveningEnergy:4,eveningHappiness:2,note:'Evening thought'};
 day('2026-11-02').checkins.morning={moodTime:'08:20',morningEnergy:4};
};
const inspect=async page=>page.evaluate(()=>{
 const all=[...document.querySelectorAll('#new-reflect-page .review-check-record .review-feeling-value')];
 const tagged=all.filter(el=>el.classList.contains('onharu-mood-tone'));
 return tagged.map(el=>({
  text:el.textContent.trim(),energy:Number(el.dataset.moodEnergy),mood:Number(el.dataset.moodRating),
  bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color,
  border:getComputedStyle(el).borderColor,
  handler:typeof el.onclick==='function'
 }));
});
const inspectDots=async page=>page.evaluate(()=>{
 return [...document.querySelectorAll('.archive-mood-item .archive-mood-dot')].map(e=>({
  energy:e.dataset.moodEnergy??'',mood:e.dataset.moodRating??'',level:e.dataset.level,tagged:e.classList.contains('onharu-mood-tone'),
  bg:getComputedStyle(e).backgroundColor,fill:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor
 }));
});
const errorReport=(row,msg,detail)=>{row.errors.push({message:msg,detail});console.error('FAIL',row.viewport,row.theme,msg,JSON.stringify(detail))};
const check=(row,name,test,details)=>{row.assertions++;if(!test)errorReport(row,name,details)};
try {
for(const width of [320,390,1024])for(const theme of ['light','dark']){
 const row={viewport:width,theme,errors:[],assertions:0,screenshots:[]};output.cases.push(row);
 const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await ctx.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errorReport(row,'browser-error',String(e)));
 const screenshot=async name=>{const p=dir+'/'+width+'-'+theme+'-'+name+'.png';await page.screenshot({path:p,animations:'disabled',caret:'hide'});row.screenshots.push(p)};
 try {
  await page.clock.setFixedTime(new Date('2026-11-04T09:30:00-10:00'));
  await page.goto(output.base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.tabs [data-page="capture"]');
  await page.locator('#tutorialChooseEn').click();await page.locator('#welcomeSkip').click();
  await page.evaluate(theme=>{
   document.querySelector('#launchScreen')?.remove();const modal=document.querySelector('#tutorialModal');if(modal){modal.hidden=true;modal.style.display='none'}
   document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme;
  },theme);
  const palette=await page.evaluate(()=>{
   const pair=(bg,text)=>{
    const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
    const a=lum(bg),b=lum(text);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   };
   return {light:KONA_REVIEW_MOOD_LIGHT,dark:KONA_REVIEW_MOOD_DARK,ratios:{
    light:KONA_REVIEW_MOOD_LIGHT.flat().map(c=>pair(c,'#283C39')),
    dark:KONA_REVIEW_MOOD_DARK.flat().map(c=>pair(c,'#FFFFFF'))
   }};
  });
  check(row,'25 light + 25 dark colors',palette.light.flat().length===25&&palette.dark.flat().length===25,palette);
  check(row,'all 50 colors contrast >=4.5',Math.min(...palette.ratios.light,...palette.ratios.dark)>=4.5,{minLight:Math.min(...palette.ratios.light),minDark:Math.min(...palette.ratios.dark)});
  await page.evaluate(fixture);
  await page.locator('.tabs [data-page="records"]').click();
  await page.locator('#rev-reflect').click();
  const chips=await inspect(page);
  check(row,'two decorated Daily Review chip entries',chips.length===2,chips);
  const paletteSet=colors[theme];
  check(row,'Morning energy2 mood4 tone',chips.some(e=>e.energy===2&&e.mood===4&&e.bg===rgb(paletteSet.morning)&&e.fg===paletteSet.text),chips);
  check(row,'Evening energy4 mood2 tone',chips.some(e=>e.energy===4&&e.mood===2&&e.bg===rgb(paletteSet.evening)&&e.fg===paletteSet.text),chips);
  check(row,'editable mood buttons retained',chips.every(e=>e.handler),chips);
  await screenshot('daily');
  // CSS-only color switch: no mutation to records or rerender required.
  const reversed=theme==='light'?'dark':'light';
  await page.evaluate(t=>{document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t},reversed);
  const changed=await inspect(page);const other=colors[reversed];
  check(row,'theme switch changes background without reconstructing mood records',
   changed.some(e=>e.energy===2&&e.mood===4&&e.bg===rgb(other.morning)&&e.fg===other.text)&&changed.some(e=>e.energy===4&&e.mood===2&&e.bg===rgb(other.evening)),changed);
  await page.evaluate(t=>{document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t},theme);
  await page.locator('#rev-archive').click();
  await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
  await page.locator('[data-mood-date="2026-11-04"]').click();
  const dots=await inspectDots(page);
  check(row,'two Archive Mood details and exact matching colors',dots.length===2&&dots.some(e=>e.energy==='2'&&e.mood==='4'&&e.bg===rgb(paletteSet.morning))&&dots.some(e=>e.energy==='4'&&e.mood==='2'&&e.bg===rgb(paletteSet.evening)),dots);
  check(row,'Archive calendar renders two color-coded dots',await page.locator('[data-mood-date="2026-11-04"] .archive-mood-dot.onharu-mood-tone').count()===2,{dots});
  await screenshot('archive');
  await page.locator('[data-mood-date="2026-11-02"]').click();
  const energyOnly=await inspectDots(page);
  check(row,'energy-only remains outlined and does not invent mood',energyOnly.length===1&&energyOnly[0].level==='0'&&!energyOnly[0].tagged,energyOnly);
  check(row,'no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),{width});
  await page.locator('.archive-mood-open-daily').click();
  check(row,'Mood to Daily Review navigation survives',await page.evaluate(()=>date==='2026-11-02'&&document.querySelector('#rev-reflect')?.getAttribute('aria-pressed')==='true'),{date:'2026-11-02'});
 }catch(e){errorReport(row,'test execution',String(e))}
 finally {await ctx.close()}
 console.log('MOOD_QA '+row.viewport+'-'+row.theme+' '+JSON.stringify({assertions:row.assertions,errors:row.errors}));
}
}finally{await browser.close()}
output.summary={configs:output.cases.length,assertions:output.cases.reduce((n,c)=>n+c.assertions,0),failed:output.cases.reduce((n,c)=>n+c.errors.length,0)};
await fs.writeFile(dir+'/mood-palette.json',JSON.stringify(output,null,2));
console.log('MOOD_QA_SUMMARY '+JSON.stringify(output.summary));
if(output.summary.failed)process.exitCode=1;
