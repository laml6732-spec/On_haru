import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL = 'http://127.0.0.1:8787/legacy/';
const OUT = 'promo/circle';
const executablePath = ['/usr/bin/google-chrome','/usr/bin/chromium','/opt/google/chrome/chrome'].find(existsSync);
const browser = await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
const cards = [
 {n:'01',name:'capture',tab:'capture',eyebrow:'WHY ON_HARU',lines:['Notice it.','Capture it.','Remember it.'],description:'A home for thoughts, prayers, and little moments.',chips:[],footer:'YOUR EVERYDAY MOMENTS MATTER',bg:'#FAF7F2',accent:'#DCEFE6'},
 {n:'02',name:'plan',tab:'today',eyebrow:'CAPTURE → PLAN',lines:['Capture once.','See it in','your day.'],description:'See captured notes beside their linked events.',chips:[],footer:'YOUR DAY, WITH ITS MOMENTS',bg:'#F8F6F0',accent:'#E7F1DE'},
 {n:'03',name:'focus',tab:'focus',eyebrow:'PRAYER TIMER',lines:['Pause.','Pray.','Be present.'],description:'Make time to be still with God.',chips:[],footer:'',bg:'#F6F7F0',accent:'#D7ECE3'},
 {n:'04',name:'checkin',tab:'checkin',eyebrow:'MORNING CHECK-IN',lines:['Wake up.','Check in.','Pray.'],description:'Name your mood. Rise in prayer.',chips:[],footer:'BEGIN WITH PRAYER',bg:'#FAF6F1',accent:'#E8E8DD'},
 {n:'05',name:'review',tab:'records',eyebrow:'REVIEW',lines:['Remember','the little','moments.'],description:'Revisit notes, prayers, and growth.',chips:[],footer:'ON_HARU · FREE WEB APP',bg:'#F4F7F2',accent:'#CFE4D7'}
];
await fs.mkdir(OUT,{recursive:true});
for (const name of await fs.readdir(OUT)) if(name.endsWith('.png')) await fs.rm(OUT+'/'+name);
const styles = [
 '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Pacifico&display=swap");',
 '*{box-sizing:border-box}html,body{width:1080px;height:1350px;margin:0;overflow:hidden}',
 'body{color:#24483B;background:var(--bg);font-family:"DM Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased}',
 '.poster{position:relative;width:1080px;height:1350px;overflow:hidden;background:radial-gradient(circle at 93% 74%,var(--accent) 0%,var(--bg) 53%)}',
 '.orb{position:absolute;width:490px;height:490px;left:-240px;bottom:-300px;border-radius:50%;background:var(--accent);opacity:.67}',
 '.line{position:absolute;top:149px;left:65px;right:65px;height:2px;background:rgba(92,139,112,.22)}',
 'header{position:absolute;top:52px;left:65px;right:65px;display:flex;align-items:center;justify-content:space-between}',
 '.brand{font-family:"Pacifico",Georgia,cursive;font-size:39px;line-height:1.6;color:#245946}',
 '.count{font-size:19px;letter-spacing:3px;color:#587665;font-weight:800}',
 '.copy{position:absolute;top:335px;left:65px;width:455px;z-index:2}',
 '.eyebrow{font-size:21px;letter-spacing:3.5px;font-weight:800;color:#6B8E78}',
 'h1{display:flex;flex-direction:column;font-size:68px;letter-spacing:-3.2px;line-height:1.09;font-weight:800;margin:29px 0 25px}',
 'h1 span{white-space:nowrap}p{font-size:26px;line-height:1.5;color:#60776A;margin:0;width:405px;font-weight:500}',
 '.chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:42px;max-width:420px}',
 '.chip{border-radius:100px;border:1px solid #ACC5B5;background:rgba(255,255,255,.54);color:#3E6E55;font-size:15px;font-weight:800;letter-spacing:1px;padding:11px 15px}',
 '.phone{position:absolute;left:527px;top:192px;width:508px;height:1087px;background:#FFF;border:10px solid #FFF;border-radius:47px;overflow:hidden;box-shadow:0 31px 80px rgba(39,75,51,.18),0 3px 10px rgba(39,75,51,.05)}',
 '.phone img{display:block;width:100%;height:100%;object-fit:cover}',
 'footer{position:absolute;left:66px;bottom:85px;width:405px;color:#577C66;font-size:16px;font-weight:800;line-height:1.7;letter-spacing:1.3px}',
 'footer:before{content:"";display:block;width:138px;height:3px;background:#85AE92;border-radius:10px;margin-bottom:20px}'
].join('');
async function takeAppScreenshot(c) {
 const context=await browser.newContext({viewport:{width:393,height:840},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'en-US',timezoneId:'Pacific/Honolulu',reducedMotion:'reduce'});
 try {
  const page=await context.newPage();
  await page.goto(URL,{waitUntil:'networkidle',timeout:30000});
  await page.waitForTimeout(1100);
  await page.evaluate(()=>{document.querySelector('#launchScreen')?.remove();const t=document.querySelector('#tutorialModal');if(t)t.hidden=true});
  await page.addStyleTag({content:'*{animation-duration:0s!important;transition-duration:0s!important}#launchScreen,#tutorialModal{display:none!important}'});
  // Both capture and plan samples are entered into the actual app UI.
  // They remain isolated in this temporary browser context (not users' real data).
  if(c.tab==='capture'||c.tab==='today'){
    // The same notes are saved through Capture on both slides.
    // Each is explicitly linked to its schedule in the real Capture selector.
    const moments=[
      ['Work Duty','A small kindness','A teammate helped me through a busy afternoon.','meaning_insight'],
      ['Dinner','A good conversation','We laughed together. I want to remember that.','meaning_insight'],
      ['Design Class','Something to try','One idea I want to explore tomorrow.','meaning_practice']
    ];
    for(const [event,title,body,tag] of moments){
      await page.locator('#qc-select').evaluate((select,target)=>{
        const option=[...select.options].find(x=>x.textContent.includes(target));
        if(!option)throw new Error('Capture schedule not found: '+target);
        select.value=option.value;
        select.dispatchEvent(new Event('change',{bubbles:true}));
      },event);
      await page.locator('#qc-note-title').fill(title);
      await page.locator('#qc-text').fill(body);
      await page.locator('#page-capture [data-tag="'+tag+'"]').click();
      await page.locator('#qc-submit').click();
      await page.waitForTimeout(220);
    }
    if(c.tab==='capture'){
      await page.locator('#qc-select').evaluate(select=>{
        const option=[...select.options].find(x=>x.textContent.includes('Work Duty'));
        if(!option)throw new Error('Cannot link featured Capture draft');
        select.value=option.value;
        select.dispatchEvent(new Event('change',{bubbles:true}));
      });
      await page.locator('#qc-note-title').fill('A moment worth keeping');
      await page.locator('#qc-text').fill('A quiet reminder that God is with us in ordinary days.');
      await page.locator('#page-capture [data-tag="meaning_listening"]').click();
    }
  }
  if(c.tab==='records'){
    const examples=[
      ['Listening in the quiet','God reminded me to trust Him one step at a time.','meaning_listening'],
      ['Scripture for today','Be still, and know that I am God. — Psalm 46:10','meaning_scripture'],
      ['A small answered prayer','I felt peace after praying for my family.','meaning_prayer'],
      ['Grateful for today','Thankful for new friends and kind conversations.','meaning_insight'],
      ['Choosing courage','Listen carefully. Respond with love.','meaning_practice'],
      ['Prayer for tomorrow','Lord, help me make room for Your voice.','meaning_prayer']
    ];
    for(const [title,note,tag] of examples){
      await page.locator('#qc-note-title').fill(title);
      await page.locator('#qc-text').fill(note);
      await page.locator('#page-capture [data-tag="'+tag+'"]').click();
      await page.locator('#qc-submit').click();
      await page.waitForTimeout(200);
    }
  }
  if(c.tab!=='capture')await page.locator('.tabs [data-page="'+c.tab+'"]').click();
  if(c.tab==='today'){
    // Verify three Capture entries really appear under three different events in Plan.
    const expected=['A small kindness','A good conversation','Something to try'];
    const notes=await page.locator('#kx-summary .kona-rich-note.has-note').allTextContents();
    for(const title of expected)
      if(!notes.some(t=>t.includes(title)))throw new Error('Capture note not shown in Plan: '+title);
    if(notes.length<3)throw new Error('Plan has fewer than three linked Capture notes');
    await page.waitForTimeout(900);
  }
  if(c.tab==='records'){const expand=page.locator('#page-records .review-group-more[aria-expanded="false"]');if(await expand.count())await expand.first().click();}
  if(c.tab==='focus'){await page.locator('#kindSeg [data-kind="prayer"]').click();await page.locator('#focusStart').click();await page.waitForTimeout(1300);}
  if(c.tab==='checkin'){await page.locator('#page-checkin .phases [data-phase="morning"]').click();await page.waitForTimeout(250);const n=page.locator('#checkNote');if(await n.isVisible())await n.fill('Lord, help me begin today with prayer.');for(const dimension of ['energy','happiness']){await page.locator('#moodGrid .kona-slim-scale[data-dimension="'+dimension+'"] input[type="range"]').evaluate(el=>{el.value='4';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});await page.waitForTimeout(160);}await page.waitForTimeout(250);}
  await page.waitForTimeout(400);
  return (await page.screenshot({type:'png',animations:'disabled'})).toString('base64');
 }finally{await context.close();}
}
function posterHTML(c,shot) {
 const title=c.lines.map(x=>'<span>'+x+'</span>').join('');
 const chips=c.chips.map(x=>'<span class="chip">'+x+'</span>').join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>'+styles+'</style></head><body style="--bg:'+c.bg+';--accent:'+c.accent+'"><div class="poster"><div class="orb"></div><header><span class="brand">On_HARU</span><span class="count">'+c.n+' / 05</span></header><div class="line"></div><section class="copy"><div class="eyebrow">'+c.eyebrow+'</div><h1>'+title+'</h1><p>'+c.description+'</p><div class="chips">'+chips+'</div></section><div class="phone"><img src="data:image/png;base64,'+shot+'" alt="Actual English On_HARU app screen"></div><footer>'+c.footer+'</footer></div></body></html>';
}
try {
 for(const c of cards){
  const shot=await takeAppScreenshot(c);
  const art=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1,reducedMotion:'reduce'});
  await art.setContent(posterHTML(c,shot),{waitUntil:'load'});
  const file=OUT+'/'+c.n+'-'+c.name+'.png';
  await art.screenshot({path:file,type:'png',animations:'disabled'});
  console.log('Created '+file+' from actual English UI');
  await art.close();
 }
}finally{await browser.close();}
