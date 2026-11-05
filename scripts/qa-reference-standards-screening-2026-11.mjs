// On_HARU reference-driven *screening* against W3C WCAG 2.2 AA.
// Do not mistake bounding boxes or a simple CSS-color contrast calculation for a full conformance audit.
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
const output=process.env.ONHARU_ARTIFACTS||'test-results/reference-aa-screening';
await fs.mkdir(output,{recursive:true});
const executablePath=[process.env.CHROME_PATH,chromium.executablePath(),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={baseline:'On_HARU reference-first rubric v1.0',url:process.env.ONHARU_URL||'http://127.0.0.1:8080/legacy/',rulebook:'docs/ui-audit-2026-11/REFERENCE_FIRST_DESIGN_QA_STANDARD.md',screens:[],notes:[
'WCAG 2.5.8: a target under 24 CSS px may pass via explicit exceptions (spacing, equivalent, inline, user-agent, essential). A bounding box alone does not prove failure.',
'44 CSS px is On_HARU proposed touch-comfort target, not a WCAG AA requirement and not interchangeable with 44pt iOS or 48dp Android.',
'Contrast is a computed CSS solid-color screening. Background gradients, images, transparency/blending, glyph stroke, text overlays and decorative exemptions require visual verification.',
'No WCAG AA minimum font size exists; 12px microcopy is an On_HARU design proposal.',
'WCAG reflow/keyboard focus/screen reader requires further testing; 320px horizontal overflow alone does not prove 1.4.10 or 2.4.11 compliance.'
]};
const scenarios=[320,390,1024].flatMap(width=>['light','dark'].map(theme=>({width,theme})));
const scan=()=> {
 const selectors={
  critical:{
   'Write More':'.kona-tag-tray-toggle',
   'Listening sheep tag':'button.kona-tag-chip[data-tag="meaning_listening"]',
   'Plan More':'#konaScheduleMore',
   'Check-in time':'#checkRecordedTime',
   'Focus primary start':'#focusStart',
   'Archive Mood day':'[data-mood-date="2026-11-04"]',
   'Archive Mood open Daily':'.archive-mood-open-daily'
  },
  text:{
   'Write textarea':'#qc-text',
   'Plan more':'#konaScheduleMore',
   'Check-in heading':'#page-checkin h2',
   'Focus clock':'#focusClock',
   'Review archive label':'#rev-archive',
   'Mood weekday':'.archive-mood-weekdays',
   'Mood legend':'.archive-mood-legend',
   'Mood detail title':'.archive-mood-detail h3',
   'Mood open Daily':'.archive-mood-open-daily'
  }
 };
 const visible=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return !!r.width&&!!r.height&&s.display!=='none'&&s.visibility!=='hidden'};
 const rgba=s=>{const match=s?.match(/^rgba?\(([^)]+)\)/i);if(!match)return null;const nums=match[1].split(/[,\s/]+/).filter(Boolean).map(Number);return nums.length>=3&&nums.slice(0,3).every(Number.isFinite)?[...nums.slice(0,3),Number.isFinite(nums[3])?nums[3]:1]:null};
 const over=(fg,bg)=>{const a=fg[3];return [0,1,2].map(i=>fg[i]*a+bg[i]*(1-a)).concat(1)};
 const styleBg=e=>{let layers=[],n=e,complex=false;while(n&&n.nodeType===1){const c=getComputedStyle(n);if(c.backgroundImage!=='none'||c.mixBlendMode!=='normal'||c.opacity!=='1')complex=true;layers.unshift(rgba(c.backgroundColor)||[0,0,0,0]);n=n.parentElement}let col=[255,255,255,1];for(const layer of layers)col=over(layer,col);return{color:col,complex}};
 const luminance=c=>{const x=c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return x[0]*.2126+x[1]*.7152+x[2]*.0722};
 const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return+( (Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)};
 const target=(name,selector)=>{
  const e=document.querySelector(selector);if(!visible(e))return null;
  const r=e.getBoundingClientRect(),w=+r.width.toFixed(1),h=+r.height.toFixed(1);
  const cs=getComputedStyle(e);
  return {name,selector,w,h,meets24BoundingBox:w>=24&&h>=24,smallerThan44ComfortTarget:w<44||h<44,roundedOrClipped:parseFloat(cs.borderRadius)>0||!['visible','clip'].includes(cs.overflow),
   note:'Effective pointer region, exceptions and adjacent hit overlaps must be manually verified.'};
 };
 const text=(name,selector)=>{
  const e=document.querySelector(selector);if(!visible(e))return null;const cs=getComputedStyle(e),raw=rgba(cs.color),bg=styleBg(e);
  const fg=raw?over(raw,bg.color):null;
  const fs=parseFloat(cs.fontSize),weight=parseFloat(cs.fontWeight)||400;
  const large=fs>=24||(fs>=18.5&&weight>=700);
  return {name,selector,text:(e.textContent||'').trim().slice(0,75),fontPx:fs,weight:cs.fontWeight,actualColor:cs.color,computedSolidBg:bg.color.map(v=>Math.round(v)),
   gradientOrBlendNeedsManualCheck:bg.complex,ratio:fg?ratio(fg,bg.color):null,threshold:large?3:4.5,
   belowContrastThresholdCandidate:!!fg&&ratio(fg,bg.color)<(large?3:4.5),rule:large?'WCAG 1.4.3 large text':'WCAG 1.4.3 normal text'};
 };
 const targets=Object.entries(selectors.critical).map(([n,s])=>target(n,s)).filter(Boolean);
 const texts=Object.entries(selectors.text).map(([n,s])=>text(n,s)).filter(Boolean);
 return {width:innerWidth,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),targets,texts};
};
try{
for(const c of scenarios){
 const ctx=await browser.newContext({viewport:{width:c.width,height:844},isMobile:c.width<600,hasTouch:c.width<600,locale:'en-US',serviceWorkers:'block',timezoneId:'Pacific/Honolulu'});
 const page=await ctx.newPage(),row={config:c.width+'-'+c.theme,targets:[],texts:[],errors:[]};report.screens.push(row);
 page.on('pageerror',e=>row.errors.push(String(e)));
 try{
  await page.clock.setFixedTime(new Date('2026-11-04T09:30:00-10:00'));
  await page.goto(report.url,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForSelector('.tabs [data-page="capture"]');
  await page.locator('#tutorialChooseEn').click();await page.locator('#welcomeSkip').click();
  await page.evaluate(theme=>{document.querySelector('#launchScreen')?.remove();const t=document.querySelector('#tutorialModal');if(t){t.hidden=true;t.style.display='none'}document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme},c.theme);
  for(const pageId of ['capture','today','checkin','focus','records']){
   await page.locator('.tabs [data-page="'+pageId+'"]').click();
   if(pageId==='records'){await page.locator('#rev-archive').click();await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click()}
   const d=await page.evaluate(scan);
   row.overflow=Math.max(row.overflow||0,d.overflow);
   for(const t of d.targets)row.targets.push({...t,view:pageId});
   for(const t of d.texts)row.texts.push({...t,view:pageId});
  }
 }catch(e){row.errors.push(String(e))}
 finally{await ctx.close()}
 console.log('REFERENCE_QA '+row.config+' '+JSON.stringify({targets:row.targets.filter(x=>x.smallerThan44ComfortTarget).map(x=>[x.name,x.w,x.h]),candidateBelowContrast:row.texts.filter(x=>x.belowContrastThresholdCandidate).map(x=>[x.name,x.ratio,x.threshold,x.gradientOrBlendNeedsManualCheck]),overflow:row.overflow,errors:row.errors}));
}
}finally{await browser.close()}
report.summary={
configurations:report.screens.length,errors:report.screens.flatMap(x=>x.errors).length,
tgtUnder24:report.screens.flatMap(x=>x.targets.filter(t=>!t.meets24BoundingBox)).length,
comfortUnder44:report.screens.flatMap(x=>x.targets.filter(t=>t.smallerThan44ComfortTarget)).length,
contrastCandidates:report.screens.flatMap(x=>x.texts.filter(t=>t.belowContrastThresholdCandidate)).length,
horizontalOverflows:report.screens.filter(x=>x.overflow>2).length
};
await fs.writeFile(output+'/reference-screening.json',JSON.stringify(report,null,2));
console.log('REFERENCE_QA_SUMMARY '+JSON.stringify(report.summary));
if(report.summary.errors)process.exitCode=1;
