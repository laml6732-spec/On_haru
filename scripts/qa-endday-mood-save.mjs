// End-of-day mood persistence regression: isolated QA browser storage only.
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const base=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const out='test-results/endday-mood-save';
await fs.mkdir(out,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
if(!executablePath)throw Error('Chromium not found');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const checks=[],errors=[];
const assert=(config,name,ok,details)=>{checks.push({config,name,ok:!!ok,details});if(!ok)console.error('ENDDAY_FAIL',config,name,JSON.stringify(details))};
const configs=[
 {width:320,theme:'light',lang:'ko'},
 {width:390,theme:'dark',lang:'ko'},
 {width:390,theme:'light',lang:'en'},
 {width:1024,theme:'light',lang:'ko'}
];
for(const {width,theme,lang} of configs){
 const key=width+'-'+theme+'-'+lang;
 const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600,locale:lang==='ko'?'ko-KR':'en-US',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(7500);
 page.on('pageerror',e=>errors.push(key+': '+String(e)));
 page.on('dialog',d=>d.dismiss());
 try{
  await page.clock.setFixedTime(new Date('2026-11-12T20:30:00-10:00'));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const langButton=page.locator(lang==='ko'?'#tutorialChooseKo':'#tutorialChooseEn');
  if(await langButton.isVisible())await langButton.click();
  const skip=page.locator('#welcomeSkip');if(await skip.isVisible())await skip.click();
  const language=await page.evaluate(t=>{
   document.getElementById('launchScreen')?.remove();
   const tutorial=document.getElementById('tutorialModal');if(tutorial){tutorial.hidden=true;tutorial.style.display='none'}
   document.documentElement.dataset.appearance=t;document.documentElement.style.colorScheme=t;
   date='2026-11-12';const v=day(date);v.checkins.night={};save();
   return KonaI18n.language;
  },theme);
  assert(key,'User-facing language selected',language===lang,language);
  await page.locator('.tabs [data-page="records"]').click();
  await page.locator('#rev-reflect').click();
  const finalButton=page.locator('#page-records .review-final-feeling-button');
  assert(key,'Unrated day offers End-of-day mood entry',await finalButton.isVisible(),await finalButton.count());
  await finalButton.click();
  const scope='.review-final-feeling .review-feeling-editor';
  assert(key,'Mood editor opens',await page.locator(scope).isVisible(),'editor');
  await page.locator(scope+' .kona-slim-scale[data-dimension="energy"] .kona-scale-stops button').nth(3).click();
  const afterEnergy=await page.evaluate(()=>({...db.days['2026-11-12'].checkins.night}));
  assert(key,'Energy written to stable nightEnergy field',afterEnergy.nightEnergy===4,afterEnergy);
  assert(key,'Editor remains open after first value',await page.locator(scope).isVisible(),'editor');
  await page.locator(scope+' .kona-slim-scale[data-dimension="happiness"] .kona-scale-stops button').nth(4).click();
  const both=await page.evaluate(()=>{
   const v=db.days['2026-11-12'].checkins.night,stored=JSON.parse(window.localStorage.getItem('kona.legacy.v1.dayframe')).days['2026-11-12'].checkins.night;
   return {live:{...v},saved:stored};
  });
  assert(key,'Mood and energy use stable numeric fields',both.live.nightEnergy===4&&both.live.nightHappiness===5,both.live);
  assert(key,'No new translated data keys',!Object.prototype.hasOwnProperty.call(both.live,'night에너지')&&!Object.prototype.hasOwnProperty.call(both.live,'night기분'),both.live);
  assert(key,'Mood and energy persisted to localStorage',both.saved.nightEnergy===4&&both.saved.nightHappiness===5,both.saved);
  assert(key,'Combined mood object created',both.saved.mood?.energy===4&&both.saved.mood?.happiness===5,both.saved.mood);
  await page.screenshot({path:out+'/'+key+'-saved.png',animations:'disabled'});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.tabs [data-page="records"]').click();
  await page.locator('#rev-reflect').click();
  const afterReload=await page.evaluate(()=>db.days['2026-11-12']?.checkins?.night);
  assert(key,'End-of-day values retained after reload',afterReload?.nightEnergy===4&&afterReload?.nightHappiness===5,afterReload);
  assert(key,'Saved mood is visible in Review',await page.locator('#page-records .review-final-feeling-button').isVisible(),await page.locator('#page-records .review-final-feeling-button').count());

  // Recover data created by the previous Korean-language bug, preserving any valid canonical score.
  await page.evaluate(()=>{
   const name='kona.legacy.v1.dayframe',raw=JSON.parse(window.localStorage.getItem(name));
   raw.days['2026-11-11']={checkins:{night:{'night에너지':2,'night기분':4,note:'legacy saved'}}};
   raw.days['2026-11-10']={checkins:{night:{nightEnergy:5,nightHappiness:1,'night에너지':2,'night기분':4}}};
   window.localStorage.setItem(name,JSON.stringify(raw));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  const recovered=await page.evaluate(()=>({
   old:db.days['2026-11-11']?.checkins?.night,
   priority:db.days['2026-11-10']?.checkins?.night,
   persisted:JSON.parse(window.localStorage.getItem('kona.legacy.v1.dayframe')).days['2026-11-11']?.checkins?.night
  }));
  assert(key,'Previous Korean scores recovered',recovered.old?.nightEnergy===2&&recovered.old?.nightHappiness===4,recovered.old);
  assert(key,'Existing canonical scores take priority',recovered.priority?.nightEnergy===5&&recovered.priority?.nightHappiness===1,recovered.priority);
  assert(key,'Recovery persisted without deleting legacy data',recovered.persisted?.nightEnergy===2&&recovered.persisted?.nightHappiness===4&&recovered.persisted?.['night에너지']===2,recovered.persisted);
 }catch(e){errors.push(key+': '+String(e));console.error('ENDDAY_ABORT',key,String(e))}
 await context.close();
 const n=checks.filter(x=>x.config===key);console.log('ENDDAY_CONFIG',key,JSON.stringify({pass:n.filter(x=>x.ok).length,fail:n.filter(x=>!x.ok).length,errors:errors.filter(x=>x.startsWith(key+':')).length}));
}
await browser.close();
const summary={configs:configs.length,checks:checks.length,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,errors:errors.length};
await fs.writeFile(out+'/report.json',JSON.stringify({summary,checks,errors},null,2));
console.log('ENDDAY_SUMMARY',JSON.stringify(summary));
if(summary.failed||summary.errors)process.exitCode=1;
