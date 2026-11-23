// Responsive / interaction / accessibility exploratory QA for stages 4–5.
// Report measured DOM geometry; a 24px hit target is not a complete WCAG verdict.
// All sessions isolated on localhost; original app and records remain untouched.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const OUT='test-results/stages-mobile-a11y';
await fs.mkdir(OUT,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('Chromium unavailable');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const configs=[],failures=[];
const pages=['capture','checkin','today','focus','records'];
const widthList=[320,390,430,1024];
const visible=el=>{
 const style=getComputedStyle(el),rect=el.getBoundingClientRect();
 return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0&&!el.closest('[hidden],[inert],[aria-hidden="true"]');
};
for(const width of widthList)for(const theme of ['light','dark'])for(const language of ['en','ko']){
 const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:language==='ko'?'ko-KR':'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const p=await ctx.newPage();p.setDefaultTimeout(7500);
 const row={width,theme,language,checks:[],errors:[],observations:[]};configs.push(row);
 const note=(step,result)=>{row.checks.push({step,...result});if(!result.ok)failures.push({width,theme,language,step,...result})};
 p.on('pageerror',e=>row.errors.push(String(e)));
 try {
  await p.clock.setFixedTime(new Date('2026-11-21T10:15:00-10:00'));
  await p.goto('http://127.0.0.1:8080/legacy/',{waitUntil:'domcontentloaded'});
  const start=p.locator(language==='ko'?'#tutorialChooseKo':'#tutorialChooseEn');
  if(await start.isVisible().catch(()=>false))await start.click();
  if(await p.locator('#welcomeSkip').isVisible().catch(()=>false))await p.locator('#welcomeSkip').click();
  await p.evaluate(theme=>{
   document.getElementById('launchScreen')?.remove();
   for(const id of ['tutorialModal','welcomeModal']){const x=document.getElementById(id);if(x){x.hidden=true;x.style.display='none'}}
   document.documentElement.dataset.appearance=theme;
   document.documentElement.style.colorScheme=theme;
  },theme);
  for(const tab of pages){
   await p.locator('.tabs [data-page="'+tab+'"]').click();
   if(tab==='records'&&await p.locator('#rev-reflect').count())await p.locator('#rev-reflect').click();
   const stat=await p.evaluate(()=> {
    const on=el=>{if(el.closest('[hidden],[inert],[aria-hidden="true"]'))return false;const c=getComputedStyle(el),r=el.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0};
    const elements=[...document.querySelectorAll('button,input,textarea,select,summary,[role="button"]')].filter(on);
    const small=elements.map(el=>{const r=el.getBoundingClientRect();return {id:el.id||'',label:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,50),width:Math.round(r.width),height:Math.round(r.height),x:Math.round(r.x)};}).filter(x=>x.width<24||x.height<24);
    const unnamed=elements.filter(el=>el.tagName==='BUTTON' && !(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent?.trim()||el.querySelector('img[alt]')?.getAttribute('alt'))).map(el=>el.id||String(el.className).slice(0,45));
    const textInputs=elements.filter(el=>['INPUT','TEXTAREA'].includes(el.tagName)&&['text','search','email','tel','url','number',''].includes(el.getAttribute('type')||'')).map(el=>({id:el.id,px:parseFloat(getComputedStyle(el).fontSize)}));
    return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),tab:document.querySelector('.tabs button.active')?.dataset.page,
      smallCount:small.length,small:small.slice(0,15),unnamed:unnamed.slice(0,20),textInputs};
   });
   row.observations.push({tab,...stat});
   note(tab+' viewport and active dock',{ok:stat.overflow<=2&&stat.tab===tab,overflow:stat.overflow,active:stat.tab});
   if(width<600)note(tab+' visible text inputs at least 16 CSS px',{ok:stat.textInputs.every(x=>x.px>=16),inputsBelow16:stat.textInputs.filter(x=>x.px<16)});
   if(stat.smallCount>0&&width===390&&language==='ko')console.log('STAGES_SMALL_TARGETS',theme,tab,JSON.stringify(stat.small));
   if(width===390&&theme==='light'&&language==='en')console.log('STAGES_INPUT_FONTS',tab,JSON.stringify(stat.textInputs));
   if(width===320&&language==='en')await p.screenshot({path:OUT+'/'+width+'-'+theme+'-'+tab+'.png',animations:'disabled',caret:'hide'});
  }
  await p.locator('.tabs [data-page="capture"]').click();
  const menu=p.locator('#captureScheduleLink>summary');
  if(await menu.isVisible()){
   await menu.click();
   const bounds=await p.locator('#captureScheduleMenu').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,viewport:innerWidth}});
   note('capture schedule popover in viewport',{ok:bounds.left>=-2&&bounds.right<=width+2,bounds});
   await p.keyboard.press('Escape');
  }
  if(width===320 && language==='en'){
    await p.evaluate(()=>document.documentElement.style.fontSize='200%'); // simulated root font increase; not an iOS OS-setting proof
    const stat=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
    row.observations.push({tab:'capture',mode:'synthetic 200% root font',...stat});
    note('synthetic root-font 200% reflow',{ok:stat.scroll<=stat.viewport+2,scroll:stat.scroll,viewport:stat.viewport});
  }
  note('no uncaught page error',{ok:row.errors.length===0,errors:row.errors});
 }catch(error){failures.push({width,theme,language,error:String(error)});row.errors.push(String(error));}
 finally{await ctx.close()}
 console.log('STAGES_A11Y '+width+' '+theme+' '+language+' '+JSON.stringify({fail:row.checks.filter(c=>!c.ok).map(c=>c.step),errors:row.errors,small:row.observations.map(x=>[x.tab,x.smallCount])}));
}
await browser.close();
const report={source:'QA stages 4–5 / current PR branch',configs,failures,method:'Chromium DOM geometry + screenshots, not actual Safari, keyboard or screen-reader testing'};
await fs.writeFile(OUT+'/report.json',JSON.stringify(report,null,2));
console.log('STAGES_A11Y_SUMMARY '+JSON.stringify({configs:configs.length,checks:configs.reduce((x,c)=>x+c.checks.length,0),failures:failures.length}));
if(failures.length)process.exitCode=1;
