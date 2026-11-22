import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';

const root = process.env.ONHARU_URL || 'http://127.0.0.1:8080/legacy/';
const out = 'test-results/morning-prayer-anchor';
await fs.mkdir(out,{recursive:true});
const binary = [process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(p=>p&&existsSync(p));
if(!binary) throw Error('Chromium is required for the visual QA');
const browser = await chromium.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const failed=[];
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
async function state(field){
 return field.evaluate(el=>{
  const c=getComputedStyle(el);
  return {height:el.getBoundingClientRect().height,computedHeight:c.height,offsetHeight:el.offsetHeight,parentHeight:el.parentElement?.getBoundingClientRect().height,flexShrink:c.flexShrink,line:parseFloat(c.lineHeight),scroll:el.scrollHeight,overflow:c.overflowY,minHeight:c.minHeight,maxHeight:c.maxHeight,style:el.getAttribute('style'),value:el.value};
 });
}
for(const width of [320,390,1024]) for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:840},isMobile:width<600,hasTouch:width<600,locale:'ko-KR',timezoneId:'Pacific/Honolulu',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(root,{waitUntil:'domcontentloaded',timeout:35000});
  if(await page.locator('#tutorialChooseKo').isVisible())await page.locator('#tutorialChooseKo').click();
  if(await page.locator('#welcomeSkip').isVisible())await page.locator('#welcomeSkip').click();
  await page.evaluate(t=>{
   document.querySelector('#launchScreen')?.remove();
   const welcome=document.querySelector('#tutorialModal');
   if(welcome)welcome.hidden=true;
   document.documentElement.dataset.appearance=t;
   document.documentElement.style.colorScheme=t;
  },theme);
  await page.locator('.tabs [data-page="capture"]').click();
  const field=page.locator('#dayHeadline');
  assert(await field.getAttribute('rows')==='1','Anchor must start from one row');
  await field.fill('주님을 신뢰하는 하루');await page.waitForTimeout(80);
  const single=await state(field);
  assert(Math.abs(single.height-single.line)<3,'One-line anchor expanded: '+JSON.stringify(single));
  await page.screenshot({path:`${out}/${width}-${theme}-one-line.png`,animations:'disabled'});
  let two=null;
  for(let i=1;i<=12;i++){
   await field.fill('주님의 선하심을 신뢰하며 '.repeat(i));await page.waitForTimeout(80);
   const test=await state(field);
   if(test.scroll>test.line*1.5&&test.scroll<test.line*2.4){two=test;break;}
  }
  assert(two&&Math.abs(two.height-2*two.line)<3,'Two-line anchor did not size to two rows: '+JSON.stringify(two));
  await page.screenshot({path:`${out}/${width}-${theme}-two-lines.png`,animations:'disabled'});
  const longText='주님의 선하심을 신뢰하며 오늘 하루를 걸어가겠습니다. '.repeat(8);
  await field.fill(longText);await page.waitForTimeout(80);
  const long=await state(field);
  assert(long.scroll>long.line*2.4,'Long test must wrap to three or more lines: '+JSON.stringify(long));
  assert(long.height<=2*long.line+3,'Long anchor exceeded two-line cap: '+JSON.stringify(long));
  assert(long.value.length>=100,'Long anchor was truncated unexpectedly');
  assert(long.overflow==='auto','Long anchor must remain scrollable and editable');
  await field.blur();
  const saved=await field.inputValue();
  assert(saved.length>=100,'Stored anchor was truncated after blur');
  await page.screenshot({path:`${out}/${width}-${theme}-clamped.png`,animations:'disabled'});
  await page.locator('.tabs [data-page="checkin"]').click();
  await page.locator('#page-checkin [data-phase="morning"]').click();
  const prayer=page.locator('#morningPrayerPrompt');
  assert(await prayer.isVisible(),'Prayer button is missing from Morning check-in');
  const button=prayer.locator('button');
  const visual=await button.evaluate(el=>{
   const css=getComputedStyle(el),parent=el.parentElement.getBoundingClientRect(),box=el.getBoundingClientRect();
   return {bg:css.backgroundColor,color:css.color,width:box.width,parentWidth:parent.width,height:box.height,label:el.textContent.trim()};
  });
  assert(visual.label==='기도로 아침 시작하기','Incorrect Morning CTA label: '+visual.label);
  assert(visual.height>=51.5,'Prayer CTA not large enough: '+JSON.stringify(visual));
  assert(Math.abs(visual.width-visual.parentWidth)<=2,'Prayer CTA is not full width: '+JSON.stringify(visual));
  assert(visual.bg===(theme==='dark'?'rgb(59, 112, 93)':'rgb(39, 78, 71)'),'Prayer CTA color incorrect: '+JSON.stringify(visual));
  assert(visual.color==='rgb(255, 255, 255)','Prayer CTA text lacks white contrast: '+JSON.stringify(visual));
  await page.screenshot({path:`${out}/${width}-${theme}-morning.png`,animations:'disabled'});
  await page.locator('#page-checkin [data-phase="noon"]').click();
  assert(!(await prayer.isVisible()),'Morning prayer button leaked into Midday');
  await page.locator('#page-checkin [data-phase="evening"]').click();
  assert(!(await prayer.isVisible()),'Morning prayer button leaked into Reflection');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert(overflow<=2,'Horizontal overflow '+overflow+'px');
  if(width===390&&theme==='light'){
   await page.locator('#page-checkin [data-phase="morning"]').click();
   await button.click();
   assert(await page.locator('#page-focus').isVisible(),'Morning prayer did not open Focus');
   await page.locator('#focusStart').click();
   await page.waitForTimeout(1400);
   await page.locator('#focusEnd').click();
   await page.locator('#choiceModal').waitFor({state:'visible'});
   assert((await page.locator('#choiceTitle').innerText()).includes('앵커'),'Morning prayer should propose anchor');
   await page.screenshot({path:`${out}/${width}-${theme}-prayer-complete.png`,animations:'disabled'});
   await page.locator('#choiceModal .choice').first().click();
   assert(await page.locator('#page-capture').isVisible(),'Anchor action did not navigate to Capture');
   assert((await field.inputValue())===saved,'Morning prayer overwrote an existing anchor');
   await page.locator('.tabs [data-page="focus"]').click();
   await page.locator('#focusStart').click();
   await page.waitForTimeout(1400);
   await page.locator('#focusEnd').click();
   assert(!(await page.locator('#choiceModal').isVisible()),'Ordinary Focus prayer unexpectedly suggested an anchor');
  }
  assert(errors.length===0,'JavaScript errors: '+errors.join('; '));
  console.log('PASS',width,theme);
 }catch(err){
  failed.push({width,theme,error:String(err),errors});
  console.error('FAIL',width,theme,err);
  await page.screenshot({path:`${out}/${width}-${theme}-FAIL.png`}).catch(()=>{});
 }finally{await context.close();}
}
await browser.close();
await fs.writeFile(`${out}/result.json`,JSON.stringify({failed},null,2));
if(failed.length)process.exitCode=1;
