import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
const exe=['/usr/bin/google-chrome','/usr/bin/chromium',chromium.executablePath()].find(p=>p&&existsSync(p));
const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const rows=[];
for(const width of [320,390,1024])for(const theme of ['light','dark']){
 const ctx=await browser.newContext({viewport:{width,height:844},locale:'en-US',timezoneId:'Pacific/Honolulu',isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
 const page=await ctx.newPage();page.setDefaultTimeout(9000);
 try{
  await page.clock.setFixedTime(new Date('2026-11-05T09:30:00-10:00'));
  await page.goto('http://127.0.0.1:8080/legacy/',{waitUntil:'domcontentloaded'});
  await page.locator('#tutorialChooseEn').click();
  await page.locator('#welcomeSkip').click();
  await page.evaluate(theme=>{
   document.querySelector('#launchScreen')?.remove();const t=document.querySelector('#tutorialModal');if(t){t.hidden=true;t.style.display='none'}
   document.documentElement.dataset.appearance=theme;document.documentElement.style.colorScheme=theme;
   date='2026-11-05';
   for(const d of ['2026-11-05','2026-11-04','2026-11-03']){
    const data=day(d),evt=dayEvents(d).find(e=>e.id)||dayEvents(d)[0];
    data.quickCaptureEntries=[...(data.quickCaptureEntries||[]),...Array.from({length:5},(_,i)=>({
     id:'qa-contrast-'+d+'-'+i,time:String(i+9).padStart(2,'0')+':20',createdAt:d+'T'+String(i+19).padStart(2,'0')+':20:00Z',
     title:'Contrast test '+(i+1),text:'An example note to check the readable preview.',
     scheduleId:evt?.id||'',scheduleTitle:evt?.title||'',tags:[]
    }))];
    data.checkins.morning={moodTime:'08:46',morningEnergy:3,morningHappiness:4,note:'Morning note'};
    data.checkins.evening={moodTime:'20:36',eveningEnergy:4,eveningHappiness:2,note:'Evening note'};
   }
  },theme);
  await page.locator('.tabs [data-page="records"]').click();
  for(const view of ['daily','weekly','archive','mood']){
   if(view==='weekly')await page.locator('#rev-weekly').click();
   if(view==='archive')await page.locator('#rev-archive').click();
   if(view==='mood')await page.locator('.archive-mood-view-switch button').filter({hasText:'Mood'}).click();
   const sample=async()=>page.evaluate(()=>{
    const root=document.querySelector('#page-records');
    const parse=c=>{const nums=c.match(/[\d.]+/g)?.map(Number)||[];return nums.length>=3?[...nums.slice(0,3),nums.length>=4?nums[3]:1]:null};
    const bg=el=>{for(let n=el;n;n=n.parentElement){const rgba=parse(getComputedStyle(n).backgroundColor);if(rgba&&rgba[3]>=.98)return rgba}return parse(getComputedStyle(document.documentElement).backgroundColor)||[255,255,255,1]};
    const luminance=a=>{const v=a.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));return .2126*v[0]+.7152*v[1]+.0722*v[2]};
    const ratio=(a,b)=>{const l=luminance(a),m=luminance(b);return(Math.max(l,m)+.05)/(Math.min(l,m)+.05)};
    const visible=e=>{for(let x=e;x;x=x.parentElement){const c=getComputedStyle(x);if(c.display==='none'||c.visibility==='hidden'||Number(c.opacity)===0||x.hidden)return false}return e.getClientRects().length>0};
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
    const fails=[],all=[];
    while(node=walker.nextNode()){
     const text=node.nodeValue?.trim();if(!text||!node.parentElement||!visible(node.parentElement))continue;
     const el=node.parentElement,c=getComputedStyle(el),fore=parse(c.color),back=bg(el);
     if(!fore||!back)continue;
     let opacity=1;for(let p=el;p;p=p.parentElement){const op=parseFloat(getComputedStyle(p).opacity);if(Number.isFinite(op))opacity*=op;}
     const blended=fore.slice(0,3).map((v,i)=>v*opacity+back[i]*(1-opacity));const r=ratio(blended,back);
     const rec={text:text.slice(0,62),selector:(el.tagName.toLowerCase()+'.'+[...el.classList].join('.')).slice(0,130),fg:c.color,bg:'rgb('+back.slice(0,3).join(',')+')',opacity:+opacity.toFixed(2),ratio:+r.toFixed(2)};
     all.push(rec);if(r<4.5)fails.push(rec);
    }
    // Calendar is a grid of recorded dates. First viewport rule applies
    // only when at least three records exist in the synthetic fixture.
    const allRows=[...root.querySelectorAll(
      '.review-record,.review-weekly-records .review-plan-note,#archive-search-results>.archive-search-result,.archive-mood-day:has(.archive-mood-dot)'
    )].filter(e=>visible(e));
    const firstViewport=allRows.filter(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.top<innerHeight-76;});
    return{samples:all.length,failCount:fails.length,failures:fails.slice(0,35),visibleContent:firstViewport.length,overflow:document.documentElement.scrollWidth-innerWidth,
      selectedNav:[...root.querySelectorAll('#new-review-switch button.on')].length};
   });
   const value=await sample();
   rows.push({width,theme,view,...value,isDefault:true});
   console.log('AUDIT '+JSON.stringify(rows.at(-1)));
   const checkExpanded=async state=>{
     const reading=await sample();
     rows.push({width,theme,view:state,...reading,isDefault:false});
     console.log('AUDIT '+JSON.stringify(rows.at(-1)));
   };
   if(view==='weekly'){
     await page.locator('#new-reflect-page .weekly-feeling-summary>summary').click();
     await checkExpanded('weekly-feelings-open');
     await page.locator('#new-reflect-page .weekly-feeling-summary>summary').click();
   }
   if(view==='archive'){
     await page.locator('#archive-search .archive-filter-disclosure>summary').click();
     await checkExpanded('archive-filters-open');
     await page.locator('#archive-search .archive-filter-disclosure>summary').click();
     await page.locator('#archive-search .review-saved-filters button').filter({hasText:'Saved for later'}).click();
     await checkExpanded('archive-saved-selected');
     await page.locator('#archive-search .review-saved-filters button').filter({hasText:'All records'}).click();
   }
   if(view==='mood'){
     await page.locator('#archive-search .archive-mood-info>summary').click();
     await checkExpanded('mood-help-open');
   }
  }
 }catch(e){rows.push({width,theme,error:String(e)});console.error('ERROR '+width+' '+theme,e)}
 await ctx.close();
}
await browser.close();
await fs.mkdir('test-results/review-overall',{recursive:true});
await fs.writeFile('test-results/review-overall/contrast.json',JSON.stringify(rows,null,2));
if(rows.some(r=>r.error||r.failCount>0||r.overflow>1||r.selectedNav!==1||(r.isDefault!==false&&r.visibleContent<3))){
 console.error('FAIL: Review contrast/navigation/viewport criterion not met');
 process.exitCode=1;
}
