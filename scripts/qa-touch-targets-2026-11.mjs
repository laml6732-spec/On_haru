import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const targetURL=process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/';
const dir=process.env.ONHARU_ARTIFACTS||'test-results/touch-targets';
await fs.mkdir(dir,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={url:targetURL,release:'touchv120261105',cases:[]};
try{
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  const item={id:width+'-'+theme,checks:[],errors:[],screenshots:[],measurements:{}};
  report.cases.push(item);
  const check=(name,ok,details)=>{item.checks.push({name,ok:!!ok,details});if(!ok)console.error('FAIL',item.id,name,JSON.stringify(details))};
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block',reducedMotion:'reduce',locale:'en-US',timezoneId:'Pacific/Honolulu'});
  const page=await context.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>item.errors.push(String(e)));
  page.on('dialog',async d=>{item.errors.push('Unexpected dialog '+d.type());await d.dismiss()});
  const snap=async name=>{const path=dir+'/'+item.id+'-'+name+'.png';await page.screenshot({path,animations:'disabled',caret:'hide'});item.screenshots.push(path)};
  try {
   await page.clock.setFixedTime(new Date('2026-11-05T09:35:00-10:00'));
   await page.goto(targetURL,{waitUntil:'domcontentloaded'});await page.waitForSelector('.tabs [data-page="capture"]');
   check('release marker',await page.locator('meta[name="kona-release"]').getAttribute('content')==='touchv120261105');
   await page.locator('#tutorialChooseEn').click();await page.locator('#welcomeSkip').click();
   await page.evaluate(theme=>{document.querySelector('#launchScreen')?.remove();const t=document.querySelector('#tutorialModal');if(t){t.hidden=true;t.style.display='none'}document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme},theme);
   await page.locator('.tabs [data-page="capture"]').click();
   const more=page.locator('#qc-v2 .kona-tag-tray-toggle'),sheep=page.locator('#konaCaptureTagTray button[data-tag="meaning_listening"]');
   const write=await page.evaluate(()=>{
    const e=document.querySelector('#qc-v2 .kona-tag-tray-toggle'),s=document.querySelector('#konaCaptureTagTray button[data-tag="meaning_listening"]'),box=e.getBoundingClientRect(),sr=s.getBoundingClientRect(),parent=e.closest('#qc-v2').getBoundingClientRect(),ps=getComputedStyle(e,'::before');
    const intersect={w:Math.max(0,Math.min(box.right,sr.right)-Math.max(box.left,sr.left)),h:Math.max(0,Math.min(box.bottom,sr.bottom)-Math.max(box.top,sr.top))};
    return{width:box.width,height:box.height,left:box.left,right:box.right,panelRight:parent.right,visualWidth:ps.width,visualHeight:ps.height,visualContent:ps.content,intersect,centerHit:document.elementFromPoint(box.left+box.width/2,box.top+box.height/2)===e,
    visibleTags:[...document.querySelectorAll('#konaCaptureTagTray button.kona-tag-chip')].filter(x=>x.getBoundingClientRect().width>0).length};
   });
   item.measurements.write=write;
   check('Write button 44x44',write.width>=43.9&&write.height>=43.9,write);
   check('Write circle remains 32x32',Math.abs(parseFloat(write.visualWidth)-32)<.1&&Math.abs(parseFloat(write.visualHeight)-32)<.1&&write.visualContent!=='none',write);
   check('Write button visual circle stays within composer',write.right-6<=write.panelRight+.5&&write.right<=write.panelRight+2,write);
   check('Write does not overlap sheep',write.intersect.w===0||write.intersect.h===0,write.intersect);
   check('Write button center click works',write.centerHit,write);
   check('Write displays 7 initial chips',write.visibleTags===7,write);
   await snap('write-collapsed');
   await more.click();
   check('More expands tags',await more.getAttribute('aria-expanded')==='true');
   const expanded=await page.locator('#konaCaptureTagTray button.kona-tag-chip:visible').count();
   check('More reveals other tags',expanded>=13,{expanded});
   await snap('write-expanded');
   await more.click();
   check('More collapses tags',await more.getAttribute('aria-expanded')==='false');
   await sheep.click();
   check('Sheep remains selectable',await sheep.getAttribute('aria-pressed')==='true');
   check('Write no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.locator('.tabs [data-page="today"]').click();
   const plan=await page.evaluate(()=>{
    const e=document.querySelector('#konaScheduleMore>summary'),b=e.getBoundingClientRect(),title=document.querySelector('#todayScheduleHeading')?.getBoundingClientRect();
    const a=e.closest('.right'),other=a?[...a.children].filter(x=>x!==e.closest('details')).map(x=>x.getBoundingClientRect()).map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})):[];
    return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,titleRight:title?.right||null,
      other,centerHit:document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)===e};
   });
   item.measurements.plan=plan;
   check('Plan button 44x44',plan.width>=43.9&&plan.height>=43.9,plan);
   check('Plan center hit',plan.centerHit,plan);
   check('Plan remains on screen',plan.left>=0&&plan.right<=width,plan);
   check('Plan title does not overlap menu',plan.titleRight===null||plan.titleRight<=plan.left+1,plan);
   check('Plan sibling buttons do not overlap menu',plan.other.every(b=>b.right<=plan.left+1||b.left>=plan.right-1||b.bottom<=plan.top||b.top>=plan.bottom),plan);
   await snap('plan-closed');
   const summary=page.locator('#konaScheduleMore>summary');
   await summary.click();check('Plan menu opens',await page.locator('#konaScheduleMore').getAttribute('open')!==null);
   await snap('plan-open');
   await summary.click();check('Plan menu closes',await page.locator('#konaScheduleMore').getAttribute('open')===null);
   check('Plan no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  }catch(e){item.errors.push(String(e))}
  finally{await context.close()}
  console.log('TOUCH_QA '+item.id+' '+JSON.stringify({passed:item.checks.filter(c=>c.ok).length,failed:item.checks.filter(c=>!c.ok).map(c=>c.name),errors:item.errors,write:item.measurements.write,plan:item.measurements.plan}));
 }
}finally{await browser.close()}
report.summary={configs:report.cases.length,checks:report.cases.flatMap(x=>x.checks).length,passed:report.cases.flatMap(x=>x.checks).filter(x=>x.ok).length,failures:report.cases.flatMap(x=>x.checks).filter(x=>!x.ok).length,errors:report.cases.flatMap(x=>x.errors).length};
await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2));
console.log('TOUCH_QA_SUMMARY '+JSON.stringify(report.summary));
if(report.summary.failures||report.summary.errors)process.exitCode=1;
