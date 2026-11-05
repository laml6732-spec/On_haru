import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL='https://on-haru.laml6732.workers.dev/legacy/';
const OUT='promo/review-actual';
await fs.mkdir(OUT,{recursive:true});
const executablePath=['/usr/bin/google-chrome','/usr/bin/chromium','/opt/google/chrome/chrome'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:393,height:900},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'en-US',timezoneId:'Pacific/Honolulu',reducedMotion:'reduce',serviceWorkers:'block'});
const log={liveURL:URL,mode:'isolated-browser-session',actions:[],errors:[]};
const page=await context.newPage();
page.on('pageerror',e=>log.errors.push(String(e)));
async function record(label,fn){await fn();log.actions.push(label);console.log('SUCCESS',label);}
async function capture(title,note,event,tag){
 await page.locator('.tabs [data-page="capture"]').click();
 const select=page.locator('#qc-select');
 await select.evaluate((el,eventName)=>{
  const match=[...el.options].find(o=>o.textContent.includes(eventName));
  if(!match)throw Error('Actual schedule not found: '+eventName);
  el.value=match.value;
  el.dispatchEvent(new Event('change',{bubbles:true}));
 },event);
 await page.locator('#qc-note-title').fill(title,{timeout:8000});
 await page.locator('#qc-text').fill(note);
 if(tag && await page.locator('#page-capture [data-tag="'+tag+'"]').count())await page.locator('#page-capture [data-tag="'+tag+'"]').click({timeout:5000});
 await page.locator('#qc-submit').click();
 await page.waitForTimeout(200);
 const count=await page.locator('#recentNotes').count();
 log.actions.push('Capture saved for '+event+': '+title);
}
try{
 // Use a real deployed URL, not the GitHub static copy.
 await page.clock.install({time:new Date('2026-11-04T19:20:00-10:00')});
 await page.goto(URL+'?test=actual-review-entries', {waitUntil:'networkidle',timeout:35000});
 await page.waitForTimeout(1100);
 await page.evaluate(()=>{document.querySelector('#launchScreen')?.remove();const t=document.querySelector('#tutorialModal');if(t)t.hidden=true});
 await page.addStyleTag({content:'*{animation-duration:0s!important;transition-duration:0s!important}#launchScreen,#tutorialModal{display:none!important}'});
 console.log('LIVE PAGE:', await page.title());
 await record('Morning Class Review in actual Check-in',async()=>{
  await page.locator('.tabs [data-page="checkin"]').click();
  await page.locator('#page-checkin [data-phase="noon"]').click();
  await page.waitForTimeout(300);
  const noteCard=page.locator('#lectureNoteCard');
  log.morningClassCardVisible=await noteCard.isVisible();
  if(await noteCard.isVisible()){
   await page.locator('#lectureQuote').fill('Pay attention to the little things.');
   await page.locator('#lectureReflection').fill('Morning class reminded me to listen carefully and stay present.');
  }else{
   log.errors.push('Class-specific fields not visible in Check-in, using actual Capture linked to Morning Class instead');
  }
 });
 if(!log.morningClassCardVisible)await capture('Morning Class Reflection','The class reminded me to listen carefully and stay present.','Morning Class','meaning_insight');
 await capture('A small kindness','A teammate helped me through a busy afternoon.','Work Duty','meaning_insight');
 await capture('Dinner Reflection','Dinner felt warm and restful. Grateful for our conversation.','Dinner','meaning_insight');
 await capture('An idea worth trying','One creative idea I want to explore tomorrow.','Design Class','meaning_practice');
 // Capture an authentic Review screenshot before adding a prayer session.
 await page.locator('.tabs [data-page="records"]').click();
 await page.waitForTimeout(650);
 await page.screenshot({path:OUT+'/actual-review-before-prayer.png',type:'png',fullPage:true,animations:'disabled'});
 await record('Save an actual Prayer session with note',async()=>{
  await page.locator('.tabs [data-page="focus"]').click();
  await page.locator('#kindSeg [data-kind="prayer"]').click();
  const toggle=page.locator('#focusNoteToggle');
  if(await toggle.isVisible())await toggle.click();
  await page.locator('#timerNote').fill('Prayed for a friend who has an exam tomorrow. May they feel peace and courage.');
  await page.locator('#focusStart').click();
  await page.waitForTimeout(1500);
  await page.locator('#focusEnd').click();
  await page.waitForTimeout(350);
 });
 await page.locator('.tabs [data-page="records"]').click();
 await page.waitForTimeout(900);
 // Expand actual Daily review sections if collapsed
 for(const btn of await page.locator('#page-records .review-section-bar[aria-expanded="false"]').all())await btn.click();
 for(const btn of await page.locator('#page-records .review-group-more[aria-expanded="false"]').all())await btn.click();
 await page.waitForTimeout(350);
 const audit=await page.evaluate(()=>({
  title:document.title,
  selectedTab:[...document.querySelectorAll('.tabs [data-page]')].filter(x=>x.classList.contains('active')).map(x=>x.dataset.page),
  sections:[...document.querySelectorAll('#page-records .review-v3-section')].map(s=>({
    label:s.querySelector('.review-section-name')?.textContent,
    count:s.querySelector('.review-section-count')?.textContent,
    eventNames:[...s.querySelectorAll('.review-event-heading')].map(x=>x.textContent.trim()),
    recordTexts:[...s.querySelectorAll('.review-record')].map(x=>x.innerText.trim().slice(0,270))
  })),
  reviewText:document.querySelector('#new-reflect-page')?.innerText?.slice(0,4000),
  totalRecords:document.querySelectorAll('#page-records .review-record').length,
  screenshotWidth:innerWidth,
  screenshotHeight:innerHeight
 }));
 log.review=audit;
 console.log('REVIEW INSPECT:',JSON.stringify(audit));
 if(audit.totalRecords<4)throw Error('Expected at least four actual Review records, got '+audit.totalRecords);
 await page.screenshot({path:OUT+'/actual-review-full-page.png',type:'png',fullPage:true,animations:'disabled'});
 // Also provide a detail screenshot of the actual Review content, not an AI mockup.
 const panel=page.locator('#new-reflect-page');
 if(await panel.count())await panel.screenshot({path:OUT+'/actual-review-panel.png',type:'png',animations:'disabled'});
 await fs.writeFile(OUT+'/audit.json',JSON.stringify(log,null,2));
}finally{
 await context.close();
 await browser.close();
}
